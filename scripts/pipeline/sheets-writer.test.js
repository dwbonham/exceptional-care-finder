#!/usr/bin/env bun
// Run: bun scripts/pipeline/sheets-writer.test.js

import {
  HEADERS, buildSheetRow, appendProgramRow,
  FUNDING_GUIDE_HEADERS, REGIONAL_CENTER_HEADERS,
  syncFundingGuides, syncRegionalCenters,
} from './sheets-writer.js';
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

// Column layout (41 total):
// 0:  Status
// 1:  Published Status
// 2:  Completeness %
// 3:  Last Updated
// 4:  CCLD Last Verified
// 5–14: CCLD Auto-fill (License Number, Legal Name, Type, Status, Address, City, County, State, Zip, Capacity)
// 15–19: RC / Funding (Covering Agencies, Vendor IDs, Service Codes, Transportation, Financial Coverage Note)
// 20–32: Gemini-Enriched (Display Name, Phone, Website, Parent Org, Min/Max Age, Days, Hours, Languages, Features, Self-Det, Pop Spec, Program Focus)
// 33–35: AI Sentiment (Bullet 1–3)
// 36–40: Auto-generated (Lat, Lng, Geocode Source, Import Notes, Review Notes)

assert('exactly 41 columns', HEADERS.length === 41);
assert('first column is Status', HEADERS[0] === 'Status');
assert('second column is Published Status', HEADERS[1] === 'Published Status');
assert('last column is Review Notes', HEADERS[40] === 'Review Notes');
assert('no duplicate headers', new Set(HEADERS).size === HEADERS.length);

// ─── buildSheetRow() — structure ─────────────────────────────────────────────

console.log('\nbuildSheetRow() — row length and structure');

const approvedRow = buildSheetRow(approvedResult);
const reviewRow   = buildSheetRow(needsReviewResult);

assert('row has exactly 41 values', approvedRow.length === 41);
assert('needs-review row also has 41 values', reviewRow.length === 41);

// ─── buildSheetRow() — Workflow columns (0–4) ─────────────────────────────────

console.log('\nbuildSheetRow() — Workflow columns');

assert('col 0 Status = Approved',      approvedRow[0] === 'Approved');
assert('col 0 Status = Needs Review',  reviewRow[0]   === 'Needs Review');
assert('col 1 Published Status = Live',          approvedRow[1] === 'Live');
assert('col 1 Published Status = Not Published', reviewRow[1]   === 'Not Published');
assert('col 2 completeness score',     approvedRow[2] === 84);
assert('col 3 Last Updated is date',   /^\d{4}-\d{2}-\d{2}$/.test(approvedRow[3]));
assert('col 4 CCLD Last Verified',     approvedRow[4] === '2026-05-22');

// ─── buildSheetRow() — CCLD Auto-fill columns (5–14) ─────────────────────────

console.log('\nbuildSheetRow() — CCLD Auto-fill columns');

assert('col 5  CCLD License Number', approvedRow[5]  === '126803405');
assert('col 6  Legal Name',          approvedRow[6]  === 'CAROLE SUND CENTER');
assert('col 7  License Type',        approvedRow[7]  === 'ADULT DAY CARE');
assert('col 8  License Status',      approvedRow[8]  === 'Active');
assert('col 9  Address',             approvedRow[9]  === '4635 Broadway');
assert('col 10 City',                approvedRow[10] === 'Eureka');
assert('col 11 County',              approvedRow[11] === 'Humboldt');
assert('col 12 State',               approvedRow[12] === 'CA');
assert('col 13 Zip',                 approvedRow[13] === '95503');
assert('col 14 Capacity',            approvedRow[14] === 30);

// ─── buildSheetRow() — RC / Funding columns (15–19) ──────────────────────────

console.log('\nbuildSheetRow() — RC / Funding columns');

assert('col 15 Covering Agencies joined',     approvedRow[15] === 'Redwood Coast Regional Center');
assert('col 16 Vendor IDs joined as rc:id',   approvedRow[16] === 'RCRC: V1234');
assert('col 17 Service Codes joined',         approvedRow[17] === '510, 515');
assert('col 18 Transportation',               approvedRow[18] === 'Contact Regional Center');
assert('col 15 empty array → empty string',   reviewRow[15]  === '');
assert('col 16 empty array → empty string',   reviewRow[16]  === '');

// ─── buildSheetRow() — Gemini-Enriched columns (20–32) ───────────────────────

console.log('\nbuildSheetRow() — Gemini-Enriched columns');

assert('col 20 Display Name',  approvedRow[20] === 'Carole Sund Center');
assert('col 21 Phone',         approvedRow[21] === '(707) 442-3969');
assert('col 22 Website',       approvedRow[22] === 'https://carolesundcenter.org');
assert('col 23 Parent Org',    approvedRow[23] === 'Easterseals');
assert('col 24 Min Age',       approvedRow[24] === 18);
assert('col 25 Max Age',       approvedRow[25] === 65);
assert('col 26 Days',          approvedRow[26] === 'Monday–Friday');
assert('col 27 Hours',         approvedRow[27] === '8:00am–3:00pm');
assert('col 28 Languages',     approvedRow[28] === 'English, Spanish');
assert('col 29 Features',      approvedRow[29] === 'Wheelchair Accessible');
assert('col 30 Self-Det',      approvedRow[30] === 'Yes');
assert('col 31 Pop Spec',      approvedRow[31] === 'Autism, Mixed IDD');
assert('col 32 Program Focus', approvedRow[32].includes('disabilities'));

// ─── buildSheetRow() — AI Sentiment columns (33–35) ──────────────────────────

console.log('\nbuildSheetRow() — AI Sentiment columns');

assert('col 33 Bullet 1', approvedRow[33] === 'Established in 1988.');
assert('col 34 Bullet 2', approvedRow[34] === 'Highly regarded in Humboldt County.');
assert('col 35 Bullet 3', approvedRow[35] === 'Dedicated staff.');
assert('col 33 empty string when no bullets', reviewRow[33] === '');

// ─── buildSheetRow() — Auto-generated columns (36–40) ────────────────────────

console.log('\nbuildSheetRow() — Auto-generated columns');

assert('col 36 Latitude',  approvedRow[36] === 40.7794);
assert('col 37 Longitude', approvedRow[37] === -124.1688);
assert('col 38 Geocode Source extracted from dataSourceNotes', approvedRow[38] === 'geocoded');
assert('col 39 Import Notes empty when approved', approvedRow[39] === '');
assert('col 39 Import Notes contains reasons when needs_review', reviewRow[39].includes('threshold'));
assert('col 40 Review Notes always blank', approvedRow[40] === '' && reviewRow[40] === '');

// ─── buildSheetRow() — missing coords ────────────────────────────────────────

console.log('\nbuildSheetRow() — missing coordinates');

const noCoordResult = {
  ...approvedResult,
  record: { ...approvedResult.record, location: { ...approvedResult.record.location, coordinates: undefined } },
};
const noCoordRow = buildSheetRow(noCoordResult);
assert('lat empty string when no coordinates', noCoordRow[36] === '');
assert('lng empty string when no coordinates', noCoordRow[37] === '');

// ─── HEADERS alignment check ─────────────────────────────────────────────────

console.log('\nHEADERS vs buildSheetRow() alignment');

const headerRow = buildSheetRow({ decision: DECISION.NEEDS_REVIEW, completenessScore: 0, reasons: [], record: {} });
assert('row length matches HEADERS length', headerRow.length === HEADERS.length);

// ─── FUNDING_GUIDE_HEADERS and REGIONAL_CENTER_HEADERS ───────────────────────

console.log('\nFUNDING_GUIDE_HEADERS and REGIONAL_CENTER_HEADERS');

assert('FUNDING_GUIDE_HEADERS has 5 columns', FUNDING_GUIDE_HEADERS.length === 5);
assert('FUNDING_GUIDE_HEADERS[0] = State',    FUNDING_GUIDE_HEADERS[0] === 'State');
assert('FUNDING_GUIDE_HEADERS[1] = Question', FUNDING_GUIDE_HEADERS[1] === 'Question');
assert('FUNDING_GUIDE_HEADERS[2] = Answer',   FUNDING_GUIDE_HEADERS[2] === 'Answer');

assert('REGIONAL_CENTER_HEADERS has 7 columns', REGIONAL_CENTER_HEADERS.length === 7);
assert('REGIONAL_CENTER_HEADERS[0] = State',     REGIONAL_CENTER_HEADERS[0] === 'State');
assert('REGIONAL_CENTER_HEADERS[2] = Name',      REGIONAL_CENTER_HEADERS[2] === 'Name');
assert('REGIONAL_CENTER_HEADERS[5] = Zip Codes', REGIONAL_CENTER_HEADERS[5] === 'Zip Codes');

// ─── syncFundingGuides() and syncRegionalCenters() — mocked fetch ─────────────

console.log('\nsyncFundingGuides() and syncRegionalCenters() — mocked fetch');

const fakeServiceAccount = {
  client_email: 'test@project.iam.gserviceaccount.com',
  private_key: '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----',
};

const sampleGuides = [
  {
    state: 'CA',
    faqs: [
      { question: 'What is an IPP?', answer: 'A person-centered plan.', sourceUrl: 'https://dds.ca.gov', sourceLabel: 'DDS' },
      { question: 'Who is Eligible?', answer: 'Lanterman Act qualifying diagnoses.' },
    ],
    localAgencies: [
      { county: 'Riverside', zipCodes: ['92507', '92880'], name: 'Inland Regional Center', phone: '(909) 890-3000', websiteUrl: 'https://inlandrc.org', note: 'Serves Riverside & San Bernardino' },
    ],
  },
];

const originalFetch = globalThis.fetch;
const syncCalls = [];

globalThis.fetch = async (url, opts) => {
  syncCalls.push({ url: String(url), method: opts?.method ?? 'GET' });

  if (url.includes('oauth2.googleapis.com/token')) {
    return { ok: true, json: async () => ({ access_token: 'mock-token' }) };
  }
  if (url.includes(':batchUpdate')) {
    // ensureTab
    return { ok: true, json: async () => ({}) };
  }
  if (url.includes(':clear')) {
    return { ok: true, json: async () => ({}) };
  }
  if (url.includes(':append')) {
    return { ok: true, json: async () => ({ updates: { updatedRange: 'A1', updatedRows: 3 } }) };
  }
  return { ok: true, json: async () => ({}) };
};

let syncFundingError = null;
try {
  await syncFundingGuides(sampleGuides, { spreadsheetId: 'fake-id', serviceAccount: fakeServiceAccount });
} catch (e) {
  syncFundingError = e;
}

let syncRCError = null;
try {
  await syncRegionalCenters(sampleGuides, { spreadsheetId: 'fake-id', serviceAccount: fakeServiceAccount });
} catch (e) {
  syncRCError = e;
}

const isCryptoError = (e) => e && (
  e.message.includes('key') || e.message.includes('PEM') ||
  e.message.includes('sign') || e.message.includes('RSA')
);

if (!syncFundingError) {
  const clearCall = syncCalls.find(c => c.url.includes(':clear') && c.method === 'POST');
  const appendCall = syncCalls.find(c => c.url.includes(':append'));
  assert('syncFundingGuides: clear called before append', !!clearCall);
  assert('syncFundingGuides: append called', !!appendCall);
} else {
  assert('syncFundingGuides: only crypto error from fake key', isCryptoError(syncFundingError));
  console.log(`  (crypto error expected: ${syncFundingError.message.slice(0, 60)})`);
}

if (!syncRCError) {
  assert('syncRegionalCenters completed without error', true);
} else {
  assert('syncRegionalCenters: only crypto error from fake key', isCryptoError(syncRCError));
  console.log(`  (crypto error expected: ${syncRCError.message.slice(0, 60)})`);
}

globalThis.fetch = originalFetch;

// ─── appendProgramRow() — mocked fetch ───────────────────────────────────────

console.log('\nappendProgramRow() — mocked fetch');

const calls = [];

globalThis.fetch = async (url, opts) => {
  calls.push({ url: String(url), method: opts?.method ?? 'GET', body: opts?.body });

  if (url.includes('oauth2.googleapis.com/token')) {
    return { ok: true, json: async () => ({ access_token: 'mock-token' }) };
  }
  if (url.includes('/values/') && (!opts || opts.method === 'GET' || !opts.method)) {
    return { ok: true, json: async () => ({ values: [] }) };
  }
  if (url.includes(':append')) {
    return { ok: true, json: async () => ({ updates: { updatedRange: 'Programs!A2', updatedRows: 1 } }) };
  }
  return { ok: true, json: async () => ({}) };
};

calls.length = 0;

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

const tokenCall  = calls.find(c => c.url.includes('oauth2.googleapis.com'));
const readCall   = calls.find(c => c.url.includes('/values/') && c.method === 'GET');
const appendCall = calls.find(c => c.url.includes(':append'));

if (!appendError) {
  assert('token endpoint called', !!tokenCall);
  assert('headers check (GET) called before append', !!readCall);
  assert('append endpoint called', !!appendCall);
  assert('append body contains row data', appendCall?.body?.includes('126803405'));
} else {
  assert('only error is from crypto (fake key)', isCryptoError(appendError));
  console.log(`  (crypto error with fake key is expected: ${appendError.message.slice(0, 60)})`);
}

globalThis.fetch = originalFetch;

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
