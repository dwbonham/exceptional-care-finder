#!/usr/bin/env bun
// CCLD Import — daily standalone pipeline for ingesting new programs from CCLD.
//
// Usage:
//   bun scripts/pipeline/ccld-import.js
//
// Required env vars:
//   GOOGLE_MAPS_API_KEY         — Maps Geocoding API key
//   GOOGLE_SHEET_ID             — Spreadsheet ID from the sheet URL
//   GOOGLE_SERVICE_ACCOUNT_PATH — Path to service account JSON key file
//
// Does NOT require GEMINI_API_KEY. New programs are set to PENDING_GEOCODE with
// geminiEnriched=false so the Gemini pipeline (pipeline.js) picks them up later.
//
// This script commits directly to main (no PR). The Gemini pipeline still uses
// the PR workflow for enriched programs.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

import {
  load, save, startRun, updateStatus, resetFailed,
  getPendingGeocode, getPendingQualityGate, completeRun, STATUS,
} from './checkpoint.js';
import { fetchAdultDayPrograms, diffWithCheckpoint } from './ingest-ccld.js';
import { resolveCoordinates, GeocodingError } from './geocode.js';
import { evaluate, DECISION } from './quality-gate.js';
import { upsertProgramRows, syncFundingGuides, syncRegionalCenters, syncCountySummary } from './sheets-writer.js';

const ROOT = join(import.meta.dir, '..', '..');
const PROGRAM_DATA = join(ROOT, 'program-data');

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig() {
  const missing = ['GOOGLE_MAPS_API_KEY', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_PATH']
    .filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);

  return {
    mapsKey:        process.env.GOOGLE_MAPS_API_KEY,
    sheetId:        process.env.GOOGLE_SHEET_ID,
    serviceAccount: JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_PATH, 'utf8')),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const cfg = loadConfig();
let state = load();
const sheetsBase = { spreadsheetId: cfg.sheetId, serviceAccount: cfg.serviceAccount };

const today = new Date().toISOString().slice(0, 10);

// QC counters
let ccldTotal = 0;
let newCount = 0;
let revokedCount = 0;
let statusChangeCount = 0;
let geocodedCcld = 0;
let geocodedMaps = 0;
let geocodeFailed = 0;
let publishedCount = 0;
let sheetsRows = 0;
const affectedCounties = new Set();

// Reset any previously failed geocodes so they're retried this run.
const { state: s0, resetCount: failResetCount } = resetFailed(state);
state = s0;
if (failResetCount > 0) {
  console.log(`Retrying ${failResetCount} previously failed geocodes`);
  save(state);
}

// ── Phase 0: Funding guide sync ───────────────────────────────────────────────
const fundingGuides = _loadAllFundingGuides();
if (fundingGuides.length > 0) {
  console.log(`Syncing ${fundingGuides.length} state funding guide(s) to Sheets…`);
  await syncFundingGuides(fundingGuides, sheetsBase);
  await syncRegionalCenters(fundingGuides, sheetsBase);
  console.log('  Funding Guides and Regional Centers tabs updated.');
}

// ── Phase 1: CCLD ingest + diff ───────────────────────────────────────────────
console.log('Fetching CCLD Adult Day Program records…');
const ccldRecords = await fetchAdultDayPrograms();
ccldTotal = ccldRecords.length;
console.log(`  ${ccldTotal} total programs in CCLD`);

const { newPrograms, revokedPrograms, statusChanges } = diffWithCheckpoint(ccldRecords, state);
newCount = newPrograms.length;
revokedCount = revokedPrograms.length;
statusChangeCount = statusChanges.length;
console.log(`  ${newCount} new | ${revokedCount} inactive-on-discovery | ${statusChangeCount} status changes`);

// Handle revoked programs — mark in checkpoint so they're excluded from future runs
for (const r of revokedPrograms) {
  state = updateStatus(state, r.ccldLicenseNumber, STATUS.SKIPPED_REVOKED, { ccldLicenseStatus: r.licenseStatus });
}

// Handle status changes on known programs — remove non-Active programs from site
for (const { record, oldStatus, newStatus } of statusChanges) {
  console.log(`  ⚠ Status change: ${record.legalLicenseName} (${record.ccldLicenseNumber}) ${oldStatus} → ${newStatus}`);
  if (newStatus !== 'Active') {
    // Program went Inactive — remove from site entirely (same behavior as Revoked).
    // Both Inactive and Revoked are excluded; the 'Inactive' licenseStatus value in the
    // schema exists for future use but is not currently shown as a badge on the site.
    _removeRevokedProgram(record);
    affectedCounties.add((record.county ?? '').toLowerCase().replace(/\s+/g, '-'));
  }
  state = updateStatus(state, record.ccldLicenseNumber, STATUS.SKIPPED_REVOKED, { ccldLicenseStatus: newStatus });
}

// Early exit if nothing new
if (newCount === 0 && revokedCount === 0 && statusChangeCount === 0) {
  console.log('No changes from CCLD today.');
  console.log('\nUpdating County Summary tab…');
  await syncCountySummary(sheetsBase);
  _printSummary();
  process.exit(0);
}

// Register new programs in checkpoint — set to PENDING_GEOCODE with bare enrich result.
// geminiEnriched=false signals pipeline.js Phase 5 to enrich them on future runs.
const { state: s1, newCount: registeredCount } = startRun(state, newPrograms.map(r => r.ccldLicenseNumber));
state = s1;

for (const r of newPrograms) {
  state = updateStatus(state, r.ccldLicenseNumber, STATUS.PENDING_GEOCODE, {
    ccldRecord: r,
    ccldLicenseStatus: r.licenseStatus,
    enrichResult: _buildBareEnrichResult(),
    geminiEnriched: false,
    sentimentEnriched: false,
  });
}

save(state);
console.log(`Run ${state.currentRunId} started — ${registeredCount} programs to geocode`);

// ── Phase 2: Geocode new programs ─────────────────────────────────────────────
const toGeocode = getPendingGeocode(state);
if (toGeocode.length) {
  console.log(`\nGeocoding ${toGeocode.length} programs…`);
  for (const licNum of toGeocode) {
    const { ccldRecord } = state.programs[licNum];
    try {
      const geocodeResult = await resolveCoordinates(ccldRecord, cfg.mapsKey);
      state = updateStatus(state, licNum, STATUS.PENDING_QUALITY_GATE, { geocodeResult });
      if (geocodeResult.source === 'ccld') {
        geocodedCcld++;
        process.stdout.write('-');
      } else if (geocodeResult.source === 'geocoded') {
        geocodedMaps++;
        process.stdout.write('.');
      } else {
        geocodeFailed++;
        process.stdout.write('?');
      }
    } catch (e) {
      if (e instanceof GeocodingError && (e.status === 'OVER_QUERY_LIMIT' || e.status === 'OVER_DAILY_LIMIT')) {
        save(state);
        console.log(`\nGeocoding quota reached — checkpoint saved.`);
        await syncCountySummary(sheetsBase);
        _printSummary();
        process.exit(0);
      }
      state = updateStatus(state, licNum, STATUS.GEOCODE_FAILED, { geocodeError: e.message });
      geocodeFailed++;
      process.stdout.write('!');
    }
    save(state);
  }
  console.log();
}

// ── Phase 3: Quality gate ─────────────────────────────────────────────────────
const toScore = getPendingQualityGate(state);
const approvedResults = [];

if (toScore.length) {
  console.log(`\nRunning quality gate on ${toScore.length} programs…`);

  for (const licNum of toScore) {
    const prog = state.programs[licNum];
    const gateResult = evaluate(prog.ccldRecord, prog.enrichResult, prog.geocodeResult);

    if (gateResult.decision === DECISION.SKIP_REVOKED) {
      state = updateStatus(state, licNum, STATUS.SKIPPED_REVOKED);
      continue;
    }

    // SKIP_WRONG_POPULATION cannot fire here: servesDDPopulation is 'Unknown'
    // in the bare enrichResult. Phase 5 (Gemini) handles this case later.

    if (gateResult.decision === DECISION.APPROVED) {
      _writeApprovedProgram(gateResult.record);
      state = updateStatus(state, licNum, STATUS.APPROVED);
      approvedResults.push(gateResult);
      publishedCount++;
      const county = (prog.ccldRecord.county ?? '').toLowerCase().replace(/\s+/g, '-');
      affectedCounties.add(county);
    } else {
      state = updateStatus(state, licNum, STATUS.FLAGGED_FOR_REVIEW);
    }
  }
  save(state);
}

// ── Phase 4: Sheets + county summary ─────────────────────────────────────────
const sheetsConfig = { spreadsheetId: cfg.sheetId, sheetName: 'Programs', serviceAccount: cfg.serviceAccount };

if (approvedResults.length > 0) {
  console.log(`\nSyncing ${approvedResults.length} rows to Google Sheets…`);
  await upsertProgramRows(approvedResults, sheetsConfig);
  sheetsRows = approvedResults.length;
}

console.log('\nUpdating County Summary tab…');
await syncCountySummary(sheetsBase);

state = completeRun(state);
save(state);

_printSummary();

// ─── Helper: print QC summary box ────────────────────────────────────────────

function _printSummary() {
  const line = '━'.repeat(40);
  const countiesStr = affectedCounties.size > 0
    ? [...affectedCounties].sort().join(', ')
    : '(none)';
  console.log(`\n${line}`);
  console.log(`CCLD Import Complete — ${today}`);
  console.log(line);
  console.log(`  CCLD total:          ${ccldTotal}`);
  console.log(`  New programs:        +${newCount}`);
  console.log(`  Removed (revoked):   -${revokedCount}`);
  console.log(`  Status changes:       ${statusChangeCount}`);
  console.log(`  Geocoded (CCLD):     ${geocodedCcld}`);
  console.log(`  Geocoded (Maps API): ${geocodedMaps}`);
  console.log(`  Geocode failed:      ${geocodeFailed}`);
  console.log(`  Published to site:   ${publishedCount}`);
  console.log(`  Sheets rows:         ${sheetsRows}`);
  console.log(`  Counties affected:   ${countiesStr}`);
  console.log(line);
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

// ─── Helper: bare enrichResult for new CCLD programs ─────────────────────────
// All fields null/empty so buildProgramRecord falls back to CCLD data.
// geminiEnriched=false flag signals Phase 5 in pipeline.js to backfill later.

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
    servesDDPopulation:       'Unknown',
    enrichParseError:         false,
    sentimentBullets:         [],
    sentimentFlagged:         false,
    sentimentParseError:      false,
  };
}

// ─── Helper: remove a revoked/inactive program from its county JSON file ─────
// Called during Phase 1 when a known program goes inactive or revoked.
// Similar to _removeWrongPopulationProgram in pipeline.js.

function _removeRevokedProgram(ccldRecord) {
  const rawCounty = (ccldRecord.county ?? '').replace(/ County$/i, '').trim();
  const county = rawCounty.toLowerCase().replace(/\s+/g, '-');
  const file = join(PROGRAM_DATA, ccldRecord.state ?? 'CA', county, 'programs.json');

  if (!existsSync(file)) return;
  const existing = JSON.parse(readFileSync(file, 'utf8'));
  const filtered = existing.filter(p => p.ccldLicenseNumber !== ccldRecord.ccldLicenseNumber);
  if (filtered.length < existing.length) {
    writeFileSync(file, JSON.stringify(filtered, null, 2) + '\n');
    console.log(`    Removed from JSON: ${ccldRecord.legalLicenseName} (${ccldRecord.ccldLicenseNumber})`);
  }
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
