#!/usr/bin/env bun
// Run: bun scripts/pipeline/ingest-ccld.test.js
// Run with live CCLD fetch: CCLD_LIVE_TEST=1 bun scripts/pipeline/ingest-ccld.test.js

import { normalizeCcldRecord, diffWithCheckpoint } from './ingest-ccld.js';
import { STATUS } from './checkpoint.js';

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

// ─── normalizeCcldRecord ──────────────────────────────────────────────────────

console.log('\nnormalizeCcldRecord() — field mapping');

const sampleAttrs = {
  FAC_NBR: 126803405,
  NAME: '  CAROLE SUND CENTER  ',
  STATUS: 3,
  FAC_TYPE_DESC: 'ADULT DAY CARE',
  RES_STREET_ADDR: '4635 BROADWAY',
  RES_CITY: 'EUREKA',
  RES_STATE: 'CA',
  RES_ZIP_CODE: '95503',
  COUNTY: 'Humboldt',
  FAC_PHONE_NBR: 7074423969,
  CAPACITY: 30,
  FAC_LATITUDE: '40.762947',
  FAC_LONGITUDE: '-124.19073',
};

const r = normalizeCcldRecord(sampleAttrs);
assert('ccldLicenseNumber is string', r.ccldLicenseNumber === '126803405');
assert('legalLicenseName trimmed', r.legalLicenseName === 'CAROLE SUND CENTER');
assert('licenseStatus Active when STATUS=3', r.licenseStatus === 'Active');
assert('licenseType', r.licenseType === 'ADULT DAY CARE');
assert('address', r.address === '4635 BROADWAY');
assert('city', r.city === 'EUREKA');
assert('state', r.state === 'CA');
assert('zipCode preserved as string', r.zipCode === '95503');
assert('county', r.county === 'Humboldt');
assert('capacity is number', r.capacity === 30);
assert('lat parsed', r.lat === 40.762947);
assert('lng parsed', r.lng === -124.19073);

console.log('\nnormalizeCcldRecord() — phone formatting');

assert('10-digit phone formatted', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_PHONE_NBR: 9165551234 });
  return rec.phone === '(916) 555-1234';
})());

assert('11-digit with leading 1 formatted', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_PHONE_NBR: 19165551234 });
  return rec.phone === '(916) 555-1234';
})());

assert('null phone returns empty string', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_PHONE_NBR: null });
  return rec.phone === '';
})());

assert('zero phone returns empty string', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_PHONE_NBR: 0 });
  return rec.phone === '';
})());

assert('float phone rounded correctly (7074423969.0)', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_PHONE_NBR: 7074423969.0 });
  return rec.phone === '(707) 442-3969';
})());

console.log('\nnormalizeCcldRecord() — status mapping');

assert('STATUS=3 → Active', (() => {
  return normalizeCcldRecord({ ...sampleAttrs, STATUS: 3 }).licenseStatus === 'Active';
})());

assert('STATUS=4 → Inactive', (() => {
  return normalizeCcldRecord({ ...sampleAttrs, STATUS: 4 }).licenseStatus === 'Inactive';
})());

assert('STATUS=99 (unknown) → Inactive', (() => {
  return normalizeCcldRecord({ ...sampleAttrs, STATUS: 99 }).licenseStatus === 'Inactive';
})());

console.log('\nnormalizeCcldRecord() — coordinate edge cases');

assert('null lat/lng → null', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_LATITUDE: null, FAC_LONGITUDE: null });
  return rec.lat === null && rec.lng === null;
})());

assert('empty string coords → null', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_LATITUDE: '', FAC_LONGITUDE: '' });
  return rec.lat === null && rec.lng === null;
})());

assert('zero coords → null', (() => {
  const rec = normalizeCcldRecord({ ...sampleAttrs, FAC_LATITUDE: 0, FAC_LONGITUDE: 0 });
  return rec.lat === null && rec.lng === null;
})());

// ─── diffWithCheckpoint ───────────────────────────────────────────────────────

console.log('\ndiffWithCheckpoint() — new programs');

const makeRecord = (num, status = 'Active') => ({
  ...normalizeCcldRecord(sampleAttrs),
  ccldLicenseNumber: String(num),
  licenseStatus: status,
});

const emptyCheckpoint = { programs: {} };

const { newPrograms: np1, revokedPrograms: rp1, statusChanges: sc1 } =
  diffWithCheckpoint([makeRecord('111'), makeRecord('222')], emptyCheckpoint);

assert('two new active programs detected', np1.length === 2);
assert('no revoked on empty checkpoint + active records', rp1.length === 0);
assert('no status changes on empty checkpoint', sc1.length === 0);

console.log('\ndiffWithCheckpoint() — already known programs');

const checkpointWithKnown = {
  programs: {
    '111': { status: STATUS.KNOWN, ccldLicenseStatus: 'Active' },
    '333': { status: STATUS.PUBLISHED, ccldLicenseStatus: 'Active' },
  },
};

const { newPrograms: np2 } = diffWithCheckpoint(
  [makeRecord('111'), makeRecord('222'), makeRecord('333')],
  checkpointWithKnown
);

assert('known programs excluded from newPrograms', np2.length === 1 && np2[0].ccldLicenseNumber === '222');

console.log('\ndiffWithCheckpoint() — inactive on first discovery');

const { newPrograms: np3, revokedPrograms: rp3 } = diffWithCheckpoint(
  [makeRecord('999', 'Inactive')],
  emptyCheckpoint
);

assert('inactive new program goes to revokedPrograms, not newPrograms', np3.length === 0 && rp3.length === 1);

console.log('\ndiffWithCheckpoint() — status changes');

const checkpointWithActive = {
  programs: {
    '777': { status: STATUS.PUBLISHED, ccldLicenseStatus: 'Active' },
  },
};

const { statusChanges: sc2 } = diffWithCheckpoint(
  [makeRecord('777', 'Inactive')],
  checkpointWithActive
);

assert('Active→Inactive detected as status change', sc2.length === 1);
assert('statusChange has correct oldStatus/newStatus', sc2[0].oldStatus === 'Active' && sc2[0].newStatus === 'Inactive');

console.log('\ndiffWithCheckpoint() — no change when status unchanged');

const { statusChanges: sc3 } = diffWithCheckpoint(
  [makeRecord('777', 'Active')],
  checkpointWithActive
);

assert('no status change when Active→Active', sc3.length === 0);

// ─── Live fetch (opt-in) ──────────────────────────────────────────────────────

if (process.env.CCLD_LIVE_TEST === '1') {
  console.log('\nfetchAdultDayPrograms() — LIVE (CCLD_LIVE_TEST=1)');
  const { fetchAdultDayPrograms } = await import('./ingest-ccld.js');
  const records = await fetchAdultDayPrograms();
  assert('returns an array', Array.isArray(records));
  assert('returns 800+ records (CA Adult Day Programs)', records.length > 800);
  assert('first record has ccldLicenseNumber', typeof records[0]?.ccldLicenseNumber === 'string' && records[0].ccldLicenseNumber.length > 0);
  assert('first record has legalLicenseName', records[0]?.legalLicenseName.length > 0);
  assert('all records have licenseStatus Active or Inactive', records.every(r => r.licenseStatus === 'Active' || r.licenseStatus === 'Inactive'));
  const caRecords = records.filter(r => r.state === 'CA');
  assert('all records are in CA', caRecords.length === records.length);
  console.log(`  (fetched ${records.length} records)`);
} else {
  console.log('\n  [Live fetch skipped — run with CCLD_LIVE_TEST=1 to test against real CCLD API]');
}

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
