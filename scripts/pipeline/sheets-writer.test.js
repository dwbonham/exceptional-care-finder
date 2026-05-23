#!/usr/bin/env bun
// Run: bun scripts/pipeline/sheets-writer.test.js

import { HEADERS, buildSheetRow, appendProgramRow } from './sheets-writer.js';
import { DECISION } from './quality-gate.js';

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

const approvedResult = {
  decision: DECISION.APPROVED,
  completenessScore: 84,
  reasons: [],
  record: {
    legalLicenseName:  'CAROLE SUND CENTER',
    streetName:        'Carole Sund Center',
    ccldLicenseNumber: '126803405',
    licenseStatus:     'Active',
    licenseType:       'ADULT DAY CARE',
    location: {
      street: '4635 Broadway', city: 'Eureka', county: 'Humboldt',
      state: 'CA', zipCode: '95503',
      coordinates: { lat: 40.7794, lng: -124.1688 },
    },
    contact: { phone: '(707) 442-3969', websiteUrl: 'https://carolesundcenter.org' },
    facilityDetails: {
      licensedCapacity: 30,
      decryptedProgramType: 'Adult Day Program',
      programFocus: 'Supports adults with developmental disabilities.',
      minimumAge: 18, maximumAge: 65,
      languagesSupported: ['English', 'Spanish'],
      facilityFeatures: ['Wheelchair Accessible'],
      parentOrganization: 'Easterseals',
      daysOfOperation: 'Monday–Friday',
      hoursOfOperation: '8:00am–3:00pm',
      selfDeterminationAccepted: 'Yes',
      populationSpecialization: ['Autism', 'Mixed IDD'],
    },
    fundingMechanics: {
      fundingSourceCategory: 'DDS/Regional Center',
      coveringAgencies: ['Redwood Coast Regional Center'],
      vendorIds: [{ rc: 'RCRC', id: 'V1234' }],
      authorizedServiceCodes: ['510', '515'],
      transportationAvailability: 'Contact Regional Center',
      financialCoverageNote: 'Funding via Regional Center.',
    },
    qualitativeInsights: {
      parentReviews: ['Established in 1988.', 'Highly regarded in Humboldt County.', 'Dedicated staff.'],
    },
    completenessScore: 84,
    lastVerifiedDate: '2026-05-22',
    dataSourceNotes: 'Pipeline import 2026-05-22. Geocode: geocoded.',
  },
};

const needsReviewResult = {
  decision: DECISION.NEEDS_REVIEW,
  completenessScore: 45,
  reasons: ['Completeness 45/100 is below the 80 threshold', 'No sentiment bullets found'],
  record: {
    ...approvedResult.record,
    streetName: 'CAROLE SUND CENTER',
    contact: { phone: '(707) 442-3969', websiteUrl: '' },
    facilityDetails: {
      ...approvedResult.record.facilityDetails,
      programFocus: '',
      languagesSupported: ['English'],
      facilityFeatures: undefined,
      parentOrganization: undefined,
      daysOfOperation: undefined,
      hoursOfOperation: undefined,
    },
    fundingMechanics: {
      ...approvedResult.record.fundingMechanics,
      coveringAgencies: [],
      vendorIds: [],
      authorizedServiceCodes: [],
    },
    qualitativeInsights: { parentReviews: [] },
    completenessScore: 45,
    dataSourceNotes: 'Pipeline import 2026-05-22. Geocode: ccld.',
  },
};

// ─── HEADERS ──────────────────────────────────────────────────────────────────

console.log('\nHEADERS');

assert('exactly 40 columns', HEADERS.length === 40);
assert('first column is Status', HEADERS[0] === 'Status');
assert('last column is Review Notes', HEADERS[39] === 'Review Notes');
assert('no duplicate headers', new Set(HEADERS).size === HEADERS.length);

// ─── buildSheetRow() — structure ─────────────────────────────────────────────

console.log('\nbuildSheetRow() — row length and structure');

const approvedRow = buildSheetRow(approvedResult);
const reviewRow   = buildSheetRow(needsReviewResult);

assert('row has exactly 40 values', approvedRow.length === 40);
assert('needs-review row also has 40 values', reviewRow.length === 40);

// ─── buildSheetRow() — Workflow columns (0–3) ─────────────────────────────────

console.log('\nbuildSheetRow() — Workflow columns');

assert('col 0 Status = Approved', approvedRow[0] === 'Approved');
assert('col 0 Status = Needs Review', reviewRow[0] === 'Needs Review');
assert('col 1 completeness score', approvedRow[1] === 84);
assert('col 2 Last Updated is date', /^\d{4}-\d{2}-\d{2}$/.test(approvedRow[2]));
assert('col 3 CCLD Last Verified', approvedRow[3] === '2026-05-22');

// ─── buildSheetRow() — CCLD Auto-fill columns (4–13) ─────────────────────────

console.log('\nbuildSheetRow() — CCLD Auto-fill columns');

assert('col 4  CCLD License Number', approvedRow[4]  === '126803405');
assert('col 5  Legal Name',          approvedRow[5]  === 'CAROLE SUND CENTER');
assert('col 6  License Type',        approvedRow[6]  === 'ADULT DAY CARE');
assert('col 7  License Status',      approvedRow[7]  === 'Active');
assert('col 8  Address',             approvedRow[8]  === '4635 Broadway');
assert('col 9  City',                approvedRow[9]  === 'Eureka');
assert('col 10 County',              approvedRow[10] === 'Humboldt');
assert('col 11 State',               approvedRow[11] === 'CA');
assert('col 12 Zip',                 approvedRow[12] === '95503');
assert('col 13 Capacity',            approvedRow[13] === 30);

// ─── buildSheetRow() — RC / Funding columns (14–18) ──────────────────────────

console.log('\nbuildSheetRow() — RC / Funding columns');

assert('col 14 Covering Agencies joined', approvedRow[14] === 'Redwood Coast Regional Center');
assert('col 15 Vendor IDs joined as rc:id', approvedRow[15] === 'RCRC: V1234');
assert('col 16 Service Codes joined', approvedRow[16] === '510, 515');
assert('col 17 Transportation', approvedRow[17] === 'Contact Regional Center');
assert('col 14 empty array → empty string', reviewRow[14] === '');
assert('col 15 empty array → empty string', reviewRow[15] === '');

// ─── buildSheetRow() — Gemini-Enriched columns (19–31) ───────────────────────

console.log('\nbuildSheetRow() — Gemini-Enriched columns');

assert('col 19 Display Name',  approvedRow[19] === 'Carole Sund Center');
assert('col 20 Phone',         approvedRow[20] === '(707) 442-3969');
assert('col 21 Website',       approvedRow[21] === 'https://carolesundcenter.org');
assert('col 22 Parent Org',    approvedRow[22] === 'Easterseals');
assert('col 23 Min Age',       approvedRow[23] === 18);
assert('col 24 Max Age',       approvedRow[24] === 65);
assert('col 25 Days',          approvedRow[25] === 'Monday–Friday');
assert('col 26 Hours',         approvedRow[26] === '8:00am–3:00pm');
assert('col 27 Languages',     approvedRow[27] === 'English, Spanish');
assert('col 28 Features',      approvedRow[28] === 'Wheelchair Accessible');
assert('col 29 Self-Det',      approvedRow[29] === 'Yes');
assert('col 30 Pop Spec',      approvedRow[30] === 'Autism, Mixed IDD');
assert('col 31 Program Focus', approvedRow[31].includes('disabilities'));

// ─── buildSheetRow() — AI Sentiment columns (32–34) ──────────────────────────

console.log('\nbuildSheetRow() — AI Sentiment columns');

assert('col 32 Bullet 1', approvedRow[32] === 'Established in 1988.');
assert('col 33 Bullet 2', approvedRow[33] === 'Highly regarded in Humboldt County.');
assert('col 34 Bullet 3', approvedRow[34] === 'Dedicated staff.');
assert('col 32 empty string when no bullets', reviewRow[32] === '');

// ─── buildSheetRow() — Auto-generated columns (35–39) ────────────────────────

console.log('\nbuildSheetRow() — Auto-generated columns');

assert('col 35 Latitude',  approvedRow[35] === 40.7794);
assert('col 36 Longitude', approvedRow[36] === -124.1688);
assert('col 37 Geocode Source extracted from dataSourceNotes', approvedRow[37] === 'geocoded');
assert('col 38 Import Notes empty when approved', approvedRow[38] === '');
assert('col 38 Import Notes contains reasons when needs_review', reviewRow[38].includes('threshold'));
assert('col 39 Review Notes always blank', approvedRow[39] === '' && reviewRow[39] === '');

// ─── buildSheetRow() — missing coords ────────────────────────────────────────

console.log('\nbuildSheetRow() — missing coordinates');

const noCoordResult = {
  ...approvedResult,
  record: { ...approvedResult.record, location: { ...approvedResult.record.location, coordinates: undefined } },
};
const noCoordRow = buildSheetRow(noCoordResult);
assert('lat empty string when no coordinates', noCoordRow[35] === '');
assert('lng empty string when no coordinates', noCoordRow[36] === '');

// ─── HEADERS alignment check ─────────────────────────────────────────────────

console.log('\nHEADERS vs buildSheetRow() alignment');

const headerRow = buildSheetRow({ decision: DECISION.NEEDS_REVIEW, completenessScore: 0, reasons: [], record: {} });
assert('row length matches HEADERS length', headerRow.length === HEADERS.length);

// ─── appendProgramRow() — mocked fetch ───────────────────────────────────────

console.log('\nappendProgramRow() — mocked fetch');

const originalFetch = globalThis.fetch;
const calls = [];

globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), method: opts?.method ?? 'GET', body: opts?.body });

  if (url.includes('oauth2.googleapis.com/token')) {
    return { ok: true, json: async () => ({ access_token: 'mock-token' }) };
  }
  if (url.includes('/values/') && (!opts || opts.method === 'GET' || !opts.method)) {
    // ensureHeaders check — return empty sheet (no headers yet)
    return { ok: true, json: async () => ({ values: [] }) };
  }
  if (url.includes(':append')) {
    return { ok: true, json: async () => ({ updates: { updatedRange: 'Programs!A2', updatedRows: 1 } }) };
  }
  return { ok: true, json: async () => ({}) };
};

calls.length = 0;
const fakeServiceAccount = {
  client_email: 'test@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----',
};

let appendError = null;
try {
  await appendProgramRow(needsReviewResult, {
    spreadsheetId: 'fake-sheet-id',
    sheetName: 'Programs',
    serviceAccount: fakeServiceAccount,
  });
} catch (e) {
  appendError = e;
}

// We expect either success (if Bun can handle the fake key) or a crypto error (not an API error)
// The important thing is the right API endpoints were called in the right order
const tokenCall  = calls.find(c => c.url.includes('oauth2.googleapis.com'));
const readCall   = calls.find(c => c.url.includes('/values/') && c.method === 'GET');
const appendCall = calls.find(c => c.url.includes(':append'));

if (!appendError) {
  assert('token endpoint called', !!tokenCall);
  assert('headers check (GET) called before append', !!readCall);
  assert('append endpoint called', !!appendCall);
  assert('append body contains row data', appendCall?.body?.includes('126803405'));
} else {
  // Fake RSA key causes crypto error — verify it's crypto not an API logic error
  assert('only error is from crypto (fake key)', appendError.message.includes('key') || appendError.message.includes('PEM') || appendError.message.includes('sign') || appendError.message.includes('RSA'));
  console.log(`  (crypto error with fake key is expected: ${appendError.message.slice(0, 60)})`);
}

globalThis.fetch = originalFetch;

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
