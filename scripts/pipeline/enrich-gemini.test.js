#!/usr/bin/env bun
// Run:           bun scripts/pipeline/enrich-gemini.test.js
// Run live test: GEMINI_API_KEY=your_key bun scripts/pipeline/enrich-gemini.test.js

import {
  RateLimitError,
  enrichProgram,
  calculateCompleteness,
  _buildEnrichmentPrompt,
  _buildSentimentPrompt,
  _extractJson,
} from './enrich-gemini.js';

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

const sampleRecord = {
  ccldLicenseNumber: '126803405',
  legalLicenseName: 'CAROLE SUND CENTER',
  licenseStatus: 'Active',
  licenseType: 'ADULT DAY CARE',
  address: '4635 BROADWAY',
  city: 'EUREKA',
  state: 'CA',
  zipCode: '95503',
  county: 'Humboldt',
  phone: '(707) 442-3969',
  capacity: 30,
  lat: 40.762947,
  lng: -124.19073,
};

// ─── _extractJson ─────────────────────────────────────────────────────────────

console.log('\n_extractJson() — formats');

assert('plain JSON object', (() => {
  const r = _extractJson('{"streetName":"Test","webPresenceFound":true}');
  return r?.streetName === 'Test';
})());

assert('JSON in markdown code fence', (() => {
  const r = _extractJson('```json\n{"streetName":"Test"}\n```');
  return r?.streetName === 'Test';
})());

assert('JSON with preamble prose', (() => {
  const r = _extractJson('Here is the data:\n{"streetName":"Test","phone":null}');
  return r?.streetName === 'Test' && r?.phone === null;
})());

assert('JSON with trailing prose', (() => {
  const r = _extractJson('{"streetName":"Test"}\nLet me know if you need more.');
  return r?.streetName === 'Test';
})());

assert('nested arrays parse correctly', (() => {
  const r = _extractJson('{"languagesSupported":["English","Spanish"]}');
  return Array.isArray(r?.languagesSupported) && r.languagesSupported[1] === 'Spanish';
})());

assert('null input returns null', () => _extractJson(null) === null);
assert('empty string returns null', () => _extractJson('') === null);
assert('prose with no JSON returns null', () => _extractJson('No JSON here at all.') === null);

assert('real-world fence without json tag', (() => {
  const r = _extractJson('```\n{"streetName":"ARC"}\n```');
  return r?.streetName === 'ARC';
})());

// ─── _buildEnrichmentPrompt ───────────────────────────────────────────────────

console.log('\n_buildEnrichmentPrompt()');

const ep = _buildEnrichmentPrompt(sampleRecord);
assert('contains legal name', ep.includes('CAROLE SUND CENTER'));
assert('contains address', ep.includes('4635 BROADWAY'));
assert('contains city', ep.includes('EUREKA'));
assert('contains license number', ep.includes('126803405'));
assert('mentions selfDeterminationAccepted field', ep.includes('selfDeterminationAccepted'));
assert('mentions webPresenceFound field', ep.includes('webPresenceFound'));
assert('mentions activitiesOffered field', ep.includes('activitiesOffered'));
assert('mentions yearEstablished field', ep.includes('yearEstablished'));
assert('mentions acceptsPrivatePay field', ep.includes('acceptsPrivatePay'));
assert('mentions transportationServiceArea field', ep.includes('transportationServiceArea'));
assert('mentions servesDDPopulation field', ep.includes('servesDDPopulation'));
assert('prompt explains DD population criteria', ep.includes('Lanterman'));

// ─── _buildSentimentPrompt ────────────────────────────────────────────────────

console.log('\n_buildSentimentPrompt()');

const enrichData = {
  streetName: 'Carole Sund Center',
  websiteUrl: 'https://example.com',
  phone: '(707) 442-3969',
  parentOrganization: null,
  daysOfOperation: 'Monday–Friday',
  hoursOfOperation: '8:00am–3:00pm',
  languagesSupported: ['English'],
  facilityFeatures: ['Wheelchair Accessible'],
  selfDeterminationAccepted: 'Unknown',
  populationSpecialization: [],
  maximumAge: null,
  programFocus: 'Supports adults with developmental disabilities.',
  webPresenceFound: true,
  enrichParseError: false,
};

const sp = _buildSentimentPrompt(sampleRecord, enrichData);
assert('uses streetName not legal name when available', sp.includes('Carole Sund Center'));
assert('includes website URL', sp.includes('https://example.com'));
assert('explicitly bans Yelp', sp.includes('Yelp'));
assert('explicitly bans Google Maps reviews', sp.includes('Google Maps'));
assert('requests flaggedForReview field', sp.includes('flaggedForReview'));
assert('mentions Lanterman Act for DD context', sp.includes('Lanterman Act'));
assert('mentions developmental disabilities audience', sp.includes('developmental disabilities'));

const spNoWebsite = _buildSentimentPrompt(sampleRecord, { ...enrichData, streetName: null, websiteUrl: null });
assert('falls back to legal name when streetName null', spNoWebsite.includes('CAROLE SUND CENTER'));

// ─── calculateCompleteness ────────────────────────────────────────────────────

console.log('\ncalculateCompleteness()');

const fullResult = {
  streetName: 'Carole Sund Center',
  websiteUrl: 'https://example.com',
  phone: '(707) 442-3969',
  programFocus: 'Supports adults.',
  sentimentBullets: ['Great program.', 'Well staffed.'],
  daysOfOperation: 'Monday–Friday',
  hoursOfOperation: '8:00am–3:00pm',
  languagesSupported: ['English'],
  facilityFeatures: ['Wheelchair Accessible'],
  selfDeterminationAccepted: 'Yes',
  populationSpecialization: ['Autism'],
  parentOrganization: 'Easterseals',
  maximumAge: 65,
};

assert('fully populated result scores 100', calculateCompleteness(fullResult) === 100);

const minResult = {
  streetName: 'Carole Sund Center',
  websiteUrl: null,
  phone: null,
  programFocus: null,
  sentimentBullets: [],
  daysOfOperation: null,
  hoursOfOperation: null,
  languagesSupported: [],
  facilityFeatures: [],
  selfDeterminationAccepted: 'Unknown',
  populationSpecialization: [],
  parentOrganization: null,
  maximumAge: null,
};

const minScore = calculateCompleteness(minResult);
assert('minimal result (streetName only) scores 5', minScore === 5);

const midResult = { ...fullResult, websiteUrl: null, hoursOfOperation: null, parentOrganization: null };
const midScore = calculateCompleteness(midResult);
assert('mid result scores between 60 and 90', midScore > 60 && midScore < 90);

assert('score never exceeds 100', calculateCompleteness(fullResult) <= 100);

// ─── enrichProgram() — mocked fetch ──────────────────────────────────────────

console.log('\nenrichProgram() — mocked Gemini API');

const MOCK_ENRICHMENT = {
  streetName: 'Carole Sund ADP',
  phone: '(707) 442-3969',
  websiteUrl: 'https://carolesundcenter.org',
  parentOrganization: null,
  yearEstablished: 1988,
  daysOfOperation: 'Monday–Friday',
  hoursOfOperation: '8:00am–2:30pm',
  languagesSupported: ['English'],
  facilityFeatures: ['Wheelchair Accessible'],
  activitiesOffered: ['Arts and Crafts', 'Music Therapy'],
  selfDeterminationAccepted: 'Yes',
  populationSpecialization: ['Autism', 'Mixed IDD'],
  maximumAge: null,
  programFocus: 'Supports adults with developmental disabilities through day activities.',
  acceptsPrivatePay: 'No',
  transportationServiceArea: null,
  webPresenceFound: true,
};

const MOCK_SENTIMENT = {
  bullets: ['Established in 1988, the center serves Humboldt County adults with developmental disabilities.'],
  sourcesFound: 2,
  flaggedForReview: false,
};

let callCount = 0;
const originalFetch = globalThis.fetch;

globalThis.fetch = async (url, opts) => {
  callCount++;
  const body = JSON.parse(opts.body);
  const promptText = body.contents[0].parts[0].text;

  // Return enrichment JSON for the first call, sentiment for the second
  const responseJson = callCount === 1 ? MOCK_ENRICHMENT : MOCK_SENTIMENT;

  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{
        content: { parts: [{ text: JSON.stringify(responseJson) }], role: 'model' },
        finishReason: 'STOP',
      }],
    }),
  };
};

callCount = 0;
const result = await enrichProgram(sampleRecord, 'test-key');

assert('makes exactly 2 API calls', callCount === 2);
assert('streetName from enrichment', result.streetName === 'Carole Sund ADP');
assert('websiteUrl from enrichment', result.websiteUrl === 'https://carolesundcenter.org');
assert('daysOfOperation from enrichment', result.daysOfOperation === 'Monday–Friday');
assert('selfDeterminationAccepted from enrichment', result.selfDeterminationAccepted === 'Yes');
assert('yearEstablished from enrichment', result.yearEstablished === 1988);
assert('activitiesOffered from enrichment', result.activitiesOffered.length === 2);
assert('acceptsPrivatePay from enrichment', result.acceptsPrivatePay === 'No');
assert('transportationServiceArea null when absent', result.transportationServiceArea === null);
assert('sentimentBullets from sentiment step', result.sentimentBullets.length === 1);
assert('sentimentFlagged false', result.sentimentFlagged === false);
assert('enrichParseError false', result.enrichParseError === false);

// ── skipSentiment option ────────────────────────────────────────────────────
callCount = 0;
const resultSkip = await enrichProgram(sampleRecord, 'test-key', { skipSentiment: true });
assert('skipSentiment makes only 1 API call', callCount === 1);
assert('sentimentBullets empty when skipped', resultSkip.sentimentBullets.length === 0);

// ── Phone fallback to CCLD when Gemini returns null ───────────────────────
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: '{"streetName":"Test","phone":null,"webPresenceFound":true,"languagesSupported":[],"facilityFeatures":[],"selfDeterminationAccepted":"Unknown","populationSpecialization":[]}' }], role: 'model' }, finishReason: 'STOP' }],
  }),
});
const resultFallback = await enrichProgram(sampleRecord, 'test-key', { skipSentiment: true });
assert('phone falls back to CCLD record when Gemini returns null', resultFallback.phone === '(707) 442-3969');

// ── streetName fallback to legal name ────────────────────────────────────
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: '{"streetName":null,"webPresenceFound":false,"languagesSupported":[],"facilityFeatures":[],"selfDeterminationAccepted":"Unknown","populationSpecialization":[]}' }], role: 'model' }, finishReason: 'STOP' }],
  }),
});
const resultNameFallback = await enrichProgram(sampleRecord, 'test-key', { skipSentiment: true });
assert('streetName falls back to legalLicenseName when null', resultNameFallback.streetName === 'CAROLE SUND CENTER');

// ── RateLimitError on 429 ─────────────────────────────────────────────────
globalThis.fetch = async () => ({ ok: false, status: 429, text: async () => 'rate limited' });
let rateLimitCaught = false;
try {
  await enrichProgram(sampleRecord, 'test-key');
} catch (e) {
  rateLimitCaught = e instanceof RateLimitError;
}
assert('throws RateLimitError on HTTP 429', rateLimitCaught);

// ── Generic API error on 500 ──────────────────────────────────────────────
globalThis.fetch = async () => ({ ok: false, status: 500, text: async () => 'server error' });
let apiErrorCaught = false;
try {
  await enrichProgram(sampleRecord, 'test-key');
} catch (e) {
  apiErrorCaught = !(e instanceof RateLimitError) && e instanceof Error;
}
assert('throws Error (not RateLimitError) on HTTP 500', apiErrorCaught);

// ── Parse failure returns safe defaults ──────────────────────────────────
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => ({
    candidates: [{ content: { parts: [{ text: 'Sorry, I could not find any information about this program.' }], role: 'model' }, finishReason: 'STOP' }],
  }),
});
const resultParseFail = await enrichProgram(sampleRecord, 'test-key', { skipSentiment: true });
assert('enrichParseError true when JSON extraction fails', resultParseFail.enrichParseError === true);
assert('streetName falls back to legal name on parse error', resultParseFail.streetName === 'CAROLE SUND CENTER');
assert('languagesSupported defaults to [] on parse error', Array.isArray(resultParseFail.languagesSupported) && resultParseFail.languagesSupported.length === 0);

// ── servesDDPopulation normalization ────────────────────────────────────────
for (const [input, expected] of [
  ['Yes', 'Yes'],
  ['No', 'No'],
  ['Unknown', 'Unknown'],
  [null, 'Unknown'],
  [undefined, 'Unknown'],
  ['yes', 'Unknown'],   // case-sensitive — Gemini should return exact values
  ['no', 'Unknown'],
]) {
  const mockBody = JSON.stringify({ servesDDPopulation: input, webPresenceFound: true, languagesSupported: [], facilityFeatures: [], selfDeterminationAccepted: 'Unknown', populationSpecialization: [] });
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ candidates: [{ content: { parts: [{ text: mockBody }], role: 'model' }, finishReason: 'STOP' }] }),
  });
  const r = await enrichProgram(sampleRecord, 'test-key', { skipSentiment: true });
  assert(`servesDDPopulation '${input}' normalizes to '${expected}'`, r.servesDDPopulation === expected);
}

// Restore fetch
globalThis.fetch = originalFetch;

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);

if (process.env.GEMINI_API_KEY) {
  console.log('\n[Live test: set GEMINI_API_KEY to run against real Gemini API — already set, run manually if desired]');
}

if (failed > 0) process.exit(1);
