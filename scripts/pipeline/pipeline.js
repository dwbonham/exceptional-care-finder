#!/usr/bin/env bun
// Pipeline orchestrator — runs the full weekly import cycle.
//
// Usage:
//   bun scripts/pipeline/pipeline.js
//
// Required env vars:
//   GEMINI_API_KEY              — Google AI Studio key
//   GOOGLE_MAPS_API_KEY         — Maps Geocoding API key (only used when CCLD coords missing)
//   GOOGLE_SHEET_ID             — Spreadsheet ID from the sheet URL
//   GOOGLE_SERVICE_ACCOUNT_PATH — Path to service account JSON key file
//
// The script is idempotent: re-run after a rate-limit pause and it resumes
// from where it left off. Monday cron starts the run; Tue–Fri crons resume it.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import {
  load, save, addKnown, startRun, updateStatus, resetFailed,
  hasPendingWork, getPendingEnrichment, getPendingGeocode,
  getPendingQualityGate, completeRun, summary, STATUS,
} from './checkpoint.js';
import { fetchAdultDayPrograms, diffWithCheckpoint } from './ingest-ccld.js';
import { enrichProgram, RateLimitError } from './enrich-gemini.js';
import { resolveCoordinates, GeocodingError } from './geocode.js';
import { evaluate, DECISION } from './quality-gate.js';
import { appendProgramRow } from './sheets-writer.js';

const ROOT = join(import.meta.dir, '..', '..');
const PROGRAM_DATA = join(ROOT, 'program-data');

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig() {
  const missing = ['GEMINI_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_PATH']
    .filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);

  return {
    geminiKey:      process.env.GEMINI_API_KEY,
    mapsKey:        process.env.GOOGLE_MAPS_API_KEY,
    sheetId:        process.env.GOOGLE_SHEET_ID,
    serviceAccount: JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_PATH, 'utf8')),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const cfg = loadConfig();
let state = load();

// Catch-up cron: exit early if no pending work from a previous run
if (state.currentRunId && !hasPendingWork(state)) {
  console.log('No pending work — pipeline already complete for this run.');
  process.exit(0);
}

// ── Phase 1: CCLD ingest + diff ──────────────────────────────────────────────
if (!state.currentRunId) {
  console.log('Fetching CCLD Adult Day Program records…');
  const ccldRecords = await fetchAdultDayPrograms();
  console.log(`  ${ccldRecords.length} total programs in CCLD`);

  const { newPrograms, revokedPrograms, statusChanges } = diffWithCheckpoint(ccldRecords, state);
  console.log(`  ${newPrograms.length} new | ${revokedPrograms.length} inactive-on-discovery | ${statusChanges.length} status changes`);

  // Mark revoked programs so they're excluded from future runs
  for (const r of revokedPrograms) {
    state = updateStatus(state, r.ccldLicenseNumber, STATUS.SKIPPED_REVOKED, { ccldLicenseStatus: r.licenseStatus });
  }

  // Handle status changes on known programs (log for now; future: update JSON files)
  for (const { record, oldStatus, newStatus } of statusChanges) {
    console.log(`  ⚠ Status change: ${record.legalLicenseName} (${record.ccldLicenseNumber}) ${oldStatus} → ${newStatus}`);
  }

  const { state: s2, newCount } = startRun(state, newPrograms.map(r => r.ccldLicenseNumber));
  state = s2;

  // Store CCLD record data on each new program for downstream steps
  for (const r of newPrograms) {
    state = updateStatus(state, r.ccldLicenseNumber, STATUS.PENDING_ENRICHMENT, { ccldRecord: r, ccldLicenseStatus: r.licenseStatus });
  }

  save(state);
  console.log(`Run ${state.currentRunId} started — ${newCount} programs to process`);

  if (newCount === 0) {
    state = completeRun(state);
    save(state);
    console.log('Nothing to do — site is up to date.');
    process.exit(0);
  }
}

// Re-queue failed programs from a previous interrupted run
const { state: s3, resetCount } = resetFailed(state);
state = s3;
if (resetCount > 0) console.log(`Retrying ${resetCount} previously failed programs`);

// ── Phase 2: Gemini enrichment ────────────────────────────────────────────────
const toEnrich = getPendingEnrichment(state);
if (toEnrich.length) {
  console.log(`\nEnriching ${toEnrich.length} programs via Gemini…`);
  for (const licNum of toEnrich) {
    const ccldRecord = state.programs[licNum].ccldRecord;
    try {
      const enrichResult = await enrichProgram(ccldRecord, cfg.geminiKey);
      state = updateStatus(state, licNum, STATUS.PENDING_GEOCODE, { enrichResult });
      process.stdout.write('.');
    } catch (e) {
      if (e instanceof RateLimitError) {
        save(state);
        console.log(`\nRate limit reached — checkpoint saved. Re-run tomorrow to continue.\nError: ${e.message}`);
        console.log(JSON.stringify(summary(state), null, 2));
        process.exit(0);
      }
      state = updateStatus(state, licNum, STATUS.ENRICHMENT_FAILED, { enrichError: e.message });
      if (Object.values(state.programs).filter(p => p.status === STATUS.ENRICHMENT_FAILED).length === 1) {
        console.error('\nFirst enrichment error:', e.message.slice(0, 400));
      }
      process.stdout.write('!');
    }
    save(state); // save after every program so a crash loses at most one call
  }
  console.log();
}

// ── Phase 3: Geocoding ────────────────────────────────────────────────────────
const toGeocode = getPendingGeocode(state);
if (toGeocode.length) {
  console.log(`\nGeocoding ${toGeocode.length} programs…`);
  for (const licNum of toGeocode) {
    const { ccldRecord } = state.programs[licNum];
    try {
      const geocodeResult = await resolveCoordinates(ccldRecord, cfg.mapsKey);
      state = updateStatus(state, licNum, STATUS.PENDING_QUALITY_GATE, { geocodeResult });
      process.stdout.write(geocodeResult.source === 'ccld' ? '-' : '.');
    } catch (e) {
      if (e instanceof GeocodingError && (e.status === 'OVER_QUERY_LIMIT' || e.status === 'OVER_DAILY_LIMIT')) {
        save(state);
        console.log(`\nGeocoding quota reached — checkpoint saved.`);
        process.exit(0);
      }
      state = updateStatus(state, licNum, STATUS.GEOCODE_FAILED, { geocodeError: e.message });
      process.stdout.write('!');
    }
    save(state);
  }
  console.log();
}

// ── Phase 4: Quality gate + routing ──────────────────────────────────────────
const toScore = getPendingQualityGate(state);
if (toScore.length) {
  console.log(`\nRunning quality gate on ${toScore.length} programs…`);
  let approved = 0, needsReview = 0;

  const sheetsConfig = { spreadsheetId: cfg.sheetId, sheetName: 'Programs', serviceAccount: cfg.serviceAccount };

  for (const licNum of toScore) {
    const prog = state.programs[licNum];
    const gateResult = evaluate(prog.ccldRecord, prog.enrichResult, prog.geocodeResult);

    // Skip revoked programs entirely — they have no record to write
    if (gateResult.decision === DECISION.SKIP_REVOKED) {
      state = updateStatus(state, licNum, STATUS.SKIPPED_REVOKED);
      save(state);
      continue;
    }

    // Mirror ALL programs to Google Sheets regardless of quality gate result
    await appendProgramRow(gateResult, sheetsConfig);

    if (gateResult.decision === DECISION.APPROVED) {
      _writeApprovedProgram(gateResult.record);
      state = updateStatus(state, licNum, STATUS.APPROVED);
      approved++;
    } else {
      state = updateStatus(state, licNum, STATUS.FLAGGED_FOR_REVIEW);
      needsReview++;
    }
    save(state);
  }
  console.log(`  ${approved} auto-approved | ${needsReview} flagged for review | all mirrored to Sheets`);
}

// ── Complete ──────────────────────────────────────────────────────────────────
state = completeRun(state);
save(state);

console.log('\nPipeline complete.');
console.log(JSON.stringify(summary(state), null, 2));

if (summary(state)[STATUS.APPROVED] > 0) {
  console.log('\nNext step: commit program-data/ changes and open a PR for review.');
  console.log('  git add program-data/ && git commit -m "pipeline: add new programs" && git push');
}

// ─── Helper: write approved program to county JSON file ──────────────────────

function _writeApprovedProgram(record) {
  const county = record.location.county.toLowerCase().replace(/\s+/g, '-');
  const dir = join(PROGRAM_DATA, record.location.state, county);
  const file = join(dir, 'programs.json');

  mkdirSync(dir, { recursive: true });

  const existing = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : [];

  // Deduplicate by ccldLicenseNumber (replace if already present from a previous run)
  const filtered = existing.filter(p => p.ccldLicenseNumber !== record.ccldLicenseNumber);
  writeFileSync(file, JSON.stringify([...filtered, record], null, 2) + '\n');
}
