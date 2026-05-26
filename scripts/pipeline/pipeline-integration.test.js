#!/usr/bin/env bun
// Run: bun scripts/pipeline/pipeline-integration.test.js
//
// Integration tests for cross-module flows and env-var gated paths.
// These cover logic that has historically been the source of pipeline bugs:
//   - The AUTO_BACKFILL_CAP bypass (IS_MANUAL_DISPATCH) — was silently broken
//   - The status-change Active→Inactive → remove-from-file flow
//   - The SKIP_WRONG_POPULATION → remove-from-file + Sheet-sync flow
//   - File I/O deduplication (upsert, not append)
//
// External APIs (Gemini, Maps, Sheets) are NOT called — tests are fast and offline.

import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  STATUS,
  updateStatus,
  startRun,
  markGeminiEnriched,
  selectBackfillQueue,
} from './checkpoint.js';
import { writeApprovedProgram, removeProgram } from './program-files.js';
import { diffWithCheckpoint } from './ingest-ccld.js';
import { evaluate, DECISION } from './quality-gate.js';

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}`);
    failed++;
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function emptyState() {
  const now = new Date().toISOString();
  return { schemaVersion: 1, createdAt: now, lastUpdated: now, currentRunId: null, programs: {}, runs: [] };
}

function makeCcldRecord(override = {}) {
  return {
    ccldLicenseNumber: '1234567',
    legalLicenseName: 'Test Day Program',
    address: '123 Main St',
    city: 'Riverside',
    state: 'CA',
    zipCode: '92501',
    county: 'Riverside',
    phone: '(951) 555-0100',
    capacity: 20,
    licenseStatus: 'Active',
    licenseType: 'Adult Day Program',
    lat: 33.9,
    lng: -117.4,
    ...override,
  };
}

function makeEnrichResult(override = {}) {
  return {
    streetName: null, phone: null, websiteUrl: null, parentOrganization: null,
    yearEstablished: null, daysOfOperation: null, hoursOfOperation: null,
    languagesSupported: [], facilityFeatures: [], activitiesOffered: [],
    selfDeterminationAccepted: 'Unknown', populationSpecialization: [],
    maximumAge: null, programFocus: null, acceptsPrivatePay: 'Unknown',
    transportationServiceArea: null, webPresenceFound: false,
    servesDDPopulation: 'Unknown', enrichParseError: false,
    sentimentBullets: [], sentimentFlagged: false, sentimentParseError: false,
    ...override,
  };
}

function makeGeocodeResult(override = {}) {
  return { lat: 33.9, lng: -117.4, source: 'ccld', ...override };
}

// Build a checkpoint state that has N approved, unenriched programs ready for Phase 5.
function stateWithApproved(entries) {
  let state = emptyState();
  for (const [licNum, countyOverride] of entries) {
    state = updateStatus(state, licNum, STATUS.APPROVED, {
      ccldRecord: makeCcldRecord({ ccldLicenseNumber: licNum, county: countyOverride ?? 'Riverside' }),
      enrichResult: makeEnrichResult(),
      geocodeResult: makeGeocodeResult(),
      geminiEnriched: false,
      ccldLicenseStatus: 'Active',
    });
  }
  return state;
}

// ─── selectBackfillQueue ──────────────────────────────────────────────────────

console.log('\nselectBackfillQueue()');
{
  const state = stateWithApproved([
    ['A001', 'Riverside'], ['A002', 'Butte'], ['A003', 'Riverside'], ['A004', 'Los Angeles'],
  ]);

  const cronResult = selectBackfillQueue(state, { cap: 2 });
  assert('cron mode: capped at 2', cronResult.length === 2);

  const manualResult = selectBackfillQueue(state, { isManualDispatch: true, cap: 2 });
  assert('manual dispatch: all 4 returned (cap ignored)', manualResult.length === 4);

  const countyResult = selectBackfillQueue(state, { enrichCounties: new Set(['riverside']) });
  assert('county filter: 2 Riverside programs returned', countyResult.length === 2);
  assert('county filter: both results are Riverside', countyResult.every(licNum =>
    state.programs[licNum].ccldRecord.county.toLowerCase().includes('riverside')
  ));

  const countyManualResult = selectBackfillQueue(state, {
    enrichCounties: new Set(['butte']),
    isManualDispatch: true,
    cap: 1,
  });
  assert('county + manual: county filter takes precedence over cap and manual flag', countyManualResult.length === 1);
  assert('county + manual: result is the Butte program', countyManualResult[0] === 'A002');

  // Already-enriched programs are excluded
  let stateWithEnriched = stateWithApproved([['B001', 'Riverside'], ['B002', 'Riverside']]);
  stateWithEnriched = markGeminiEnriched(stateWithEnriched, 'B001', { enrichResult: makeEnrichResult() });
  const enrichedResult = selectBackfillQueue(stateWithEnriched, { isManualDispatch: true });
  assert('already-enriched programs excluded from queue', enrichedResult.length === 1 && enrichedResult[0] === 'B002');

  const emptyResult = selectBackfillQueue(emptyState());
  assert('empty state: returns empty array', emptyResult.length === 0);
}

// ─── writeApprovedProgram ─────────────────────────────────────────────────────

console.log('\nwriteApprovedProgram()');
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'ecf-test-'));
  try {
    const ccldRecord = makeCcldRecord({ ccldLicenseNumber: 'W001', county: 'Riverside County' });
    const gateResult = evaluate(ccldRecord, makeEnrichResult(), makeGeocodeResult());
    assert('quality gate approves an Active program', gateResult.decision === DECISION.APPROVED);

    writeApprovedProgram(gateResult.record, tmpDir);

    const file = join(tmpDir, 'CA', 'riverside', 'programs.json');
    assert('creates programs.json in county subdirectory', existsSync(file));

    const contents = JSON.parse(readFileSync(file, 'utf8'));
    assert('file contains 1 program after first write', contents.length === 1);
    assert('written record has correct license number', contents[0].ccldLicenseNumber === 'W001');

    // Upsert: writing the same license number a second time replaces, does not append
    writeApprovedProgram(gateResult.record, tmpDir);
    const after2 = JSON.parse(readFileSync(file, 'utf8'));
    assert('second write deduplicates: still 1 program', after2.length === 1);

    // Two distinct programs coexist in the same file
    const ccldRecord2 = makeCcldRecord({ ccldLicenseNumber: 'W002', county: 'Riverside County' });
    const gateResult2 = evaluate(ccldRecord2, makeEnrichResult(), makeGeocodeResult());
    writeApprovedProgram(gateResult2.record, tmpDir);
    const after3 = JSON.parse(readFileSync(file, 'utf8'));
    assert('two distinct programs coexist in same file', after3.length === 2);

    // "Riverside County" in the CCLD record → folder named "riverside"
    const butteRecord = makeCcldRecord({ ccldLicenseNumber: 'W003', county: 'Butte County' });
    const butteGate = evaluate(butteRecord, makeEnrichResult(), makeGeocodeResult());
    writeApprovedProgram(butteGate.record, tmpDir);
    assert('"Butte County" suffix stripped: written to butte/ folder', existsSync(join(tmpDir, 'CA', 'butte', 'programs.json')));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── removeProgram ────────────────────────────────────────────────────────────

console.log('\nremoveProgram()');
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'ecf-test-'));
  try {
    const dir = join(tmpDir, 'CA', 'riverside');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'programs.json');
    writeFileSync(file, JSON.stringify([
      { ccldLicenseNumber: 'R001', legalLicenseName: 'Program A' },
      { ccldLicenseNumber: 'R002', legalLicenseName: 'Program B' },
    ], null, 2) + '\n');

    removeProgram(makeCcldRecord({ ccldLicenseNumber: 'R001', county: 'Riverside County' }), tmpDir);
    const after1 = JSON.parse(readFileSync(file, 'utf8'));
    assert('removes the matching program by license number', after1.length === 1);
    assert('non-matching program remains', after1[0].ccldLicenseNumber === 'R002');

    // Removing a license number not in the file is a no-op
    removeProgram(makeCcldRecord({ ccldLicenseNumber: 'R999', county: 'Riverside County' }), tmpDir);
    const after2 = JSON.parse(readFileSync(file, 'utf8'));
    assert('removing absent program does not change file', after2.length === 1);

    // Removing from a county that has no programs.json is a no-op (no error)
    let threw = false;
    try {
      removeProgram(makeCcldRecord({ ccldLicenseNumber: 'X001', county: 'Alameda County' }), tmpDir);
    } catch {
      threw = true;
    }
    assert('no-op and no error when county file does not exist', !threw);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Integration: diffWithCheckpoint → startRun ──────────────────────────────

console.log('\ndiffWithCheckpoint + startRun');
{
  let state = emptyState();
  state = updateStatus(state, 'KNOWN001', STATUS.APPROVED, {
    ccldRecord: makeCcldRecord({ ccldLicenseNumber: 'KNOWN001' }),
    ccldLicenseStatus: 'Active',
    geminiEnriched: true,
  });

  const ccldRecords = [
    makeCcldRecord({ ccldLicenseNumber: 'KNOWN001' }),                          // known
    makeCcldRecord({ ccldLicenseNumber: 'NEW001' }),                            // new
    makeCcldRecord({ ccldLicenseNumber: 'NEW002' }),                            // new
    makeCcldRecord({ ccldLicenseNumber: 'REVOKED001', licenseStatus: 'Inactive' }), // inactive on discovery
  ];

  const { newPrograms, revokedPrograms, statusChanges } = diffWithCheckpoint(ccldRecords, state);
  assert('diff: 2 new programs found', newPrograms.length === 2);
  assert('diff: 1 inactive-on-discovery program found', revokedPrograms.length === 1);
  assert('diff: 0 status changes (no known program changed status)', statusChanges.length === 0);
  assert('diff: known program not in new list', !newPrograms.some(r => r.ccldLicenseNumber === 'KNOWN001'));

  const { state: s1, newCount } = startRun(state, newPrograms.map(r => r.ccldLicenseNumber));
  assert('startRun: registers 2 new programs', newCount === 2);
  assert('startRun: NEW001 set to PENDING_ENRICHMENT', s1.programs['NEW001']?.status === STATUS.PENDING_ENRICHMENT);
  assert('startRun: NEW002 set to PENDING_ENRICHMENT', s1.programs['NEW002']?.status === STATUS.PENDING_ENRICHMENT);
  assert('startRun: KNOWN001 still APPROVED (not overwritten)', s1.programs['KNOWN001']?.status === STATUS.APPROVED);
}

// ─── Integration: status change Active→Inactive → removeProgram ──────────────

console.log('\nActive→Inactive status change → removeProgram');
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'ecf-test-'));
  try {
    const dir = join(tmpDir, 'CA', 'riverside');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'programs.json');
    writeFileSync(file, JSON.stringify([
      { ccldLicenseNumber: 'SC001', legalLicenseName: 'Going Inactive Program' },
      { ccldLicenseNumber: 'SC002', legalLicenseName: 'Stays Active Program' },
    ], null, 2) + '\n');

    let state = emptyState();
    state = updateStatus(state, 'SC001', STATUS.APPROVED, {
      ccldRecord: makeCcldRecord({ ccldLicenseNumber: 'SC001' }),
      ccldLicenseStatus: 'Active',
    });
    state = updateStatus(state, 'SC002', STATUS.APPROVED, {
      ccldRecord: makeCcldRecord({ ccldLicenseNumber: 'SC002' }),
      ccldLicenseStatus: 'Active',
    });

    const ccldRecords = [
      makeCcldRecord({ ccldLicenseNumber: 'SC001', licenseStatus: 'Inactive' }),
      makeCcldRecord({ ccldLicenseNumber: 'SC002', licenseStatus: 'Active' }),
    ];

    const { statusChanges } = diffWithCheckpoint(ccldRecords, state);
    assert('detects 1 status change', statusChanges.length === 1);
    assert('status change: old=Active, new=Inactive', statusChanges[0].oldStatus === 'Active' && statusChanges[0].newStatus === 'Inactive');

    // ccld-import.js Phase 1: for non-Active status changes, remove from site
    for (const { record, newStatus } of statusChanges) {
      if (newStatus !== 'Active') {
        removeProgram(record, tmpDir);
      }
    }

    const contents = JSON.parse(readFileSync(file, 'utf8'));
    assert('inactive program removed from county JSON file', contents.length === 1);
    assert('active program SC002 remains', contents[0].ccldLicenseNumber === 'SC002');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Integration: SKIP_WRONG_POPULATION → removeProgram ──────────────────────

console.log('\nSKIP_WRONG_POPULATION → removeProgram');
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'ecf-test-'));
  try {
    const dir = join(tmpDir, 'CA', 'riverside');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'programs.json');
    writeFileSync(file, JSON.stringify([
      { ccldLicenseNumber: 'WP001', legalLicenseName: 'Senior Memory Care Center' },
    ], null, 2) + '\n');

    const ccldRecord = makeCcldRecord({ ccldLicenseNumber: 'WP001' });
    const enrichResult = makeEnrichResult({ servesDDPopulation: 'No' });
    const gateResult = evaluate(ccldRecord, enrichResult, makeGeocodeResult());

    assert('evaluate: SKIP_WRONG_POPULATION when servesDDPopulation=No', gateResult.decision === DECISION.SKIP_WRONG_POPULATION);

    // pipeline.js Phase 5: remove from site when gate returns SKIP_WRONG_POPULATION
    removeProgram(ccldRecord, tmpDir);

    const contents = JSON.parse(readFileSync(file, 'utf8'));
    assert('wrong-population program removed from county JSON file', contents.length === 0);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Integration: full approved flow (evaluate → write → verify) ─────────────

console.log('\nfull approved flow');
{
  const tmpDir = mkdtempSync(join(tmpdir(), 'ecf-test-'));
  try {
    const ccldRecord = makeCcldRecord({ ccldLicenseNumber: 'FULL001', county: 'Los Angeles County', state: 'CA' });
    const enrichResult = makeEnrichResult({ websiteUrl: 'https://example.com', phone: '(213) 555-0100', servesDDPopulation: 'Yes' });
    const geocodeResult = makeGeocodeResult({ lat: 34.05, lng: -118.24, source: 'geocoded' });

    const gateResult = evaluate(ccldRecord, enrichResult, geocodeResult);
    assert('approved: gate approves Active program', gateResult.decision === DECISION.APPROVED);
    assert('approved: record has geocoded coordinates', gateResult.record.location.coordinates?.lat === 34.05);
    assert('approved: contact.websiteUrl propagated', gateResult.record.contact.websiteUrl === 'https://example.com');
    assert('approved: completenessScore is a number', typeof gateResult.record.completenessScore === 'number');

    writeApprovedProgram(gateResult.record, tmpDir);

    const file = join(tmpDir, 'CA', 'los-angeles', 'programs.json');
    assert('approved: LA County written to los-angeles/ folder', existsSync(file));

    const contents = JSON.parse(readFileSync(file, 'utf8'));
    assert('approved: read-back record has correct license number', contents[0].ccldLicenseNumber === 'FULL001');
    assert('approved: lastVerifiedDate is present', typeof contents[0].lastVerifiedDate === 'string');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
