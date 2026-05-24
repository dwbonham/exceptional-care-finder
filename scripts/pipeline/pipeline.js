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

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  load, save, addKnown, startRun, updateStatus, resetFailed,
  hasPendingWork, getPendingEnrichment, getPendingGeocode,
  getPendingQualityGate, completeRun, summary, STATUS,
  getNotGeminiEnriched, markGeminiEnriched,
} from './checkpoint.js';
import { fetchAdultDayPrograms, diffWithCheckpoint } from './ingest-ccld.js';
import { enrichProgram, RateLimitError } from './enrich-gemini.js';
import { resolveCoordinates, GeocodingError } from './geocode.js';
import { evaluate, DECISION } from './quality-gate.js';
import { appendProgramRow, appendProgramRows, upsertProgramRows, syncFundingGuides, syncRegionalCenters, syncCountySummary } from './sheets-writer.js';

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

// Enrichment settings — parsed once, used by both Phase 2 and Phase 5.
// ENRICH_COUNTIES=butte,riverside limits Gemini calls to specific counties;
// non-matching programs get CCLD-only data now and Gemini enrichment later via Phase 5.
// WITH_SENTIMENT=1 enables the second sentiment API call (default off).
const enrichCounties = process.env.ENRICH_COUNTIES
  ? new Set(process.env.ENRICH_COUNTIES.toLowerCase().split(',').map(c => c.trim()))
  : null;
const skipSentiment = !['1', 'true', 'yes'].includes((process.env.WITH_SENTIMENT ?? '').toLowerCase());

function _matchesCountyFilter(county) {
  if (!enrichCounties) return true;
  return [...enrichCounties].some(c => (county ?? '').toLowerCase().includes(c));
}

// Catch-up cron: if all new programs are processed, close the run.
// Then check whether Gemini backfill is still needed before exiting.
if (state.currentRunId && !hasPendingWork(state)) {
  const pendingBackfill = !process.env.SKIP_ENRICHMENT && getNotGeminiEnriched(state, 1).length > 0;
  if (!pendingBackfill) {
    state = completeRun(state);
    save(state);
    console.log('No pending work — pipeline complete for this run.');
    process.exit(0);
  }
  // Backfill needed — fall through to Phase 5 (Phase 1 is skipped since currentRunId is set)
}

// Catch-up path: re-queue any failed programs so they're retried this run.
// (Phase 1 handles this on Monday; here we cover the Tue–Sun catch-up crons.)
if (state.currentRunId) {
  const { state: s, resetCount } = resetFailed(state);
  state = s;
  if (resetCount > 0) {
    console.log(`Retrying ${resetCount} previously failed programs`);
    save(state);
  }
}

// ── Phase 1: CCLD ingest + diff ──────────────────────────────────────────────
if (!state.currentRunId) {
  // Sync funding guide FAQs and RC contacts to Google Sheets on each Monday run
  const sheetsBase = { spreadsheetId: cfg.sheetId, serviceAccount: cfg.serviceAccount };
  const fundingGuides = _loadAllFundingGuides();
  if (fundingGuides.length > 0) {
    console.log(`Syncing ${fundingGuides.length} state funding guide(s) to Sheets…`);
    await syncFundingGuides(fundingGuides, sheetsBase);
    await syncRegionalCenters(fundingGuides, sheetsBase);
    console.log('  Funding Guides and Regional Centers tabs updated.');
  }

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

  // Re-queue any failed programs before deciding there's nothing to do
  const { state: s3, resetCount } = resetFailed(state);
  state = s3;
  if (resetCount > 0) console.log(`Retrying ${resetCount} previously failed programs`);

  if (newCount === 0 && resetCount === 0) {
    const pendingBackfill = !process.env.SKIP_ENRICHMENT && getNotGeminiEnriched(state, 1).length > 0;
    state = completeRun(state); // always clear the empty run immediately
    save(state);
    if (!pendingBackfill) {
      console.log('Nothing to do — site is up to date.');
      process.exit(0);
    }
    console.log(`No new programs. Continuing to Gemini backfill enrichment.`);
    // Fall through — Phases 2–4 have nothing, Phase 5 will run backfill
  } else {
    save(state);
  }
}

// ── Phase 2: Gemini enrichment ────────────────────────────────────────────────
const toEnrich = getPendingEnrichment(state);
let enrichmentRateLimited = false;
if (toEnrich.length) {
  if (process.env.SKIP_ENRICHMENT === 'true') {
    // Bulk-import mode: skip Gemini entirely, use CCLD data only.
    // Programs are marked geminiEnriched=false so Phase 5 backfill picks them up on future runs.
    console.log(`\nSKIP_ENRICHMENT: moving ${toEnrich.length} programs to geocoding with CCLD data only…`);
    for (const licNum of toEnrich) {
      state = updateStatus(state, licNum, STATUS.PENDING_GEOCODE, {
        enrichResult: _buildBareEnrichResult(),
        geminiEnriched: false,
      });
    }
    save(state);
  } else {
    // When ENRICH_COUNTIES is set, non-matching programs get CCLD data now;
    // Phase 5 will Gemini-enrich them on future runs once the county filter is removed.
    const nonMatching = enrichCounties
      ? toEnrich.filter(licNum => !_matchesCountyFilter(state.programs[licNum].ccldRecord.county))
      : [];
    if (nonMatching.length > 0) {
      for (const licNum of nonMatching) {
        state = updateStatus(state, licNum, STATUS.PENDING_GEOCODE, {
          enrichResult: _buildBareEnrichResult(),
          geminiEnriched: false,
        });
      }
      save(state);
    }

    const toEnrichFiltered = enrichCounties
      ? toEnrich.filter(licNum => _matchesCountyFilter(state.programs[licNum].ccldRecord.county))
      : toEnrich;
    const skipNote = nonMatching.length > 0 ? ` (${nonMatching.length} non-matching counties deferred to Phase 5)` : '';
    console.log(`\nEnriching ${toEnrichFiltered.length} programs via Gemini${skipNote}…`);
    for (const licNum of toEnrichFiltered) {
      const ccldRecord = state.programs[licNum].ccldRecord;
      try {
        const enrichResult = await enrichProgram(ccldRecord, cfg.geminiKey, { skipSentiment });
        state = updateStatus(state, licNum, STATUS.PENDING_GEOCODE, { enrichResult, geminiEnriched: true });
        process.stdout.write('.');
      } catch (e) {
        if (e instanceof RateLimitError) {
          save(state);
          console.log(`\nGemini quota reached — continuing to geocode/publish already-enriched programs.\nError: ${e.message}`);
          enrichmentRateLimited = true;
          break;
        }
        state = updateStatus(state, licNum, STATUS.ENRICHMENT_FAILED, { enrichError: e.message });
        const failCount = Object.values(state.programs).filter(p => p.status === STATUS.ENRICHMENT_FAILED).length;
        if (failCount <= 3) console.error(`\nEnrichment error #${failCount}: ${e.message}`);
        if (failCount === 4) console.error('(suppressing further enrichment errors — see checkpoint for details)');
        process.stdout.write('!');
      }
      save(state);
    }
    console.log();
  }
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

  // Score all programs and write JSON files first (no network calls)
  const approvedGateResults = [];
  for (const licNum of toScore) {
    const prog = state.programs[licNum];
    const gateResult = evaluate(prog.ccldRecord, prog.enrichResult, prog.geocodeResult);

    if (gateResult.decision === DECISION.SKIP_REVOKED) {
      state = updateStatus(state, licNum, STATUS.SKIPPED_REVOKED);
      continue;
    }

    if (gateResult.decision === DECISION.APPROVED) {
      _writeApprovedProgram(gateResult.record);
      state = updateStatus(state, licNum, STATUS.APPROVED);
      approved++;
    } else {
      state = updateStatus(state, licNum, STATUS.FLAGGED_FOR_REVIEW);
      needsReview++;
    }
    approvedGateResults.push(gateResult);
  }
  save(state);

  // Mirror all programs to Sheets in one batch call (avoids per-row rate limits)
  if (approvedGateResults.length > 0) {
    console.log(`  Syncing ${approvedGateResults.length} rows to Google Sheets…`);
    await appendProgramRows(approvedGateResults, sheetsConfig);
  }
  console.log(`  ${approved} auto-approved | ${needsReview} flagged for review | all mirrored to Sheets`);
}

// ── Phase 5: Gemini backfill enrichment ──────────────────────────────────────
// Runs after new-program phases. Enriches up to 20 CCLD-only programs per day,
// improving their site cards automatically until all programs are fully enriched.
// Skipped on SKIP_ENRICHMENT runs (the bulk-import itself) and when quota is gone.
//
// Env vars (optional):
//   ENRICH_COUNTIES=butte,riverside  — only process programs in these counties
//   WITH_SENTIMENT=1                 — include sentiment step (2 API calls/program vs 1)
if (!process.env.SKIP_ENRICHMENT && !enrichmentRateLimited) {
  const allUnenriched = getNotGeminiEnriched(state, enrichCounties ? 999999 : undefined);
  const toBackfill = enrichCounties
    ? allUnenriched.filter(licNum => _matchesCountyFilter(state.programs[licNum]?.ccldRecord?.county))
    : allUnenriched;

  if (toBackfill.length) {
    const modeNote = enrichCounties ? `counties: ${[...enrichCounties].join(', ')}` : 'all queued';
    const sentNote = skipSentiment ? 'no sentiment' : 'with sentiment';
    console.log(`\nGemini backfill: enriching ${toBackfill.length} program(s) (${modeNote}, ${sentNote})…`);
    const backfillGateResults = [];
    for (const licNum of toBackfill) {
      const { ccldRecord, geocodeResult } = state.programs[licNum];
      try {
        const enrichResult = await enrichProgram(ccldRecord, cfg.geminiKey, { skipSentiment });
        const gateResult = evaluate(ccldRecord, enrichResult, geocodeResult);
        if (gateResult.decision !== DECISION.SKIP_REVOKED) {
          _writeApprovedProgram(gateResult.record);
          backfillGateResults.push(gateResult);
        }
        state = markGeminiEnriched(state, licNum, { enrichResult });
        process.stdout.write('.');
      } catch (e) {
        if (e instanceof RateLimitError) {
          enrichmentRateLimited = true;
          console.log(`\nGemini quota reached during backfill — resuming tomorrow.`);
          break;
        }
        // Non-quota error: log and continue; will retry tomorrow
        console.error(`\nBackfill error for ${licNum}: ${e.message}`);
        process.stdout.write('!');
      }
      save(state);
    }
    // Upsert enriched rows into Sheets — updates existing rows written by Phase 4
    // instead of appending duplicates. New rows (not yet in sheet) are appended.
    if (backfillGateResults.length > 0) {
      const sheetsConfig = { spreadsheetId: cfg.sheetId, sheetName: 'Programs', serviceAccount: cfg.serviceAccount };
      console.log(`\n  Upserting ${backfillGateResults.length} backfilled rows in Google Sheets…`);
      await upsertProgramRows(backfillGateResults, sheetsConfig);
    }
    const remaining = getNotGeminiEnriched(state, 999999).length;
    console.log(`  Backfill: ${remaining} programs still queued for enrichment`);
  }
}

// ── Complete ──────────────────────────────────────────────────────────────────
const sheetsBase = { spreadsheetId: cfg.sheetId, serviceAccount: cfg.serviceAccount };

if (enrichmentRateLimited) {
  // Don't mark the run complete — it will resume tomorrow when quota resets
  console.log('\nPartial run complete (Gemini quota reached). Resuming tomorrow.');
  console.log('\nUpdating County Summary tab…');
  await syncCountySummary(sheetsBase);
  console.log(JSON.stringify(summary(state), null, 2));
  process.exit(0);
}

console.log('\nUpdating County Summary tab…');
await syncCountySummary(sheetsBase);

state = completeRun(state);
save(state);

console.log('\nPipeline complete.');
console.log(JSON.stringify(summary(state), null, 2));

if (summary(state)[STATUS.APPROVED] > 0) {
  console.log('\nNext step: commit program-data/ changes and open a PR for review.');
  console.log('  git add program-data/ && git commit -m "pipeline: add new programs" && git push');
}

// ─── Helper: load all state funding guides from program-data/ ─────────────────

function _loadAllFundingGuides() {
  const guides = [];
  try {
    for (const stateDir of readdirSync(PROGRAM_DATA)) {
      const guideFile = join(PROGRAM_DATA, stateDir, 'funding-guide.json');
      if (existsSync(guideFile)) {
        guides.push(JSON.parse(readFileSync(guideFile, 'utf8')));
      }
    }
  } catch {
    // PROGRAM_DATA doesn't exist yet — no guides to sync
  }
  return guides;
}

// ─── Helper: bare enrichResult for SKIP_ENRICHMENT bulk imports ───────────────
// All fields null/empty so buildProgramRecord falls back to CCLD data.
// geminiEnriched=false flag signals Phase 5 to backfill this program later.

function _buildBareEnrichResult() {
  return {
    streetName:               null,
    phone:                    null,
    websiteUrl:               null,
    parentOrganization:       null,
    yearEstablished:          null,
    daysOfOperation:          null,
    hoursOfOperation:         null,
    languagesSupported:       [],
    facilityFeatures:         [],
    activitiesOffered:        [],
    selfDeterminationAccepted: 'Unknown',
    populationSpecialization: [],
    maximumAge:               null,
    programFocus:             null,
    acceptsPrivatePay:        'Unknown',
    transportationServiceArea: null,
    webPresenceFound:         false,
    enrichParseError:         false,
    sentimentBullets:         [],
    sentimentFlagged:         false,
    sentimentParseError:      false,
  };
}

// ─── Helper: write approved program to county JSON file ──────────────────────

function _writeApprovedProgram(record) {
  const rawCounty = record.location.county.replace(/ County$/i, '').trim();
  const county = rawCounty.toLowerCase().replace(/\s+/g, '-');
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
