#!/usr/bin/env bun
// Run:           bun scripts/pipeline/geocode.test.js
// Run live test: GOOGLE_MAPS_API_KEY=your_key bun scripts/pipeline/geocode.test.js

import {
  GeocodingError,
  resolveCoordinates,
  geocodeAddress,
  _isValidCaCoord,
} from './geocode.js';

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

// Minimal CCLD record shape used across tests
const makeRecord = (lat, lng) => ({
  address: '4635 BROADWAY',
  city: 'EUREKA',
  state: 'CA',
  zipCode: '95503',
  lat,
  lng,
});

// ─── _isValidCaCoord ──────────────────────────────────────────────────────────

console.log('\n_isValidCaCoord() — valid CA coordinates');

assert('Eureka (north CA)',         _isValidCaCoord(40.762947, -124.19073));
assert('Los Angeles',               _isValidCaCoord(34.052235, -118.243683));
assert('San Diego',                 _isValidCaCoord(32.715736, -117.161087));
assert('SF',                        _isValidCaCoord(37.774929, -122.419418));
assert('far east CA (Needles)',     _isValidCaCoord(34.848, -114.614));
assert('far north CA (Yreka)',      _isValidCaCoord(41.735, -122.634));

console.log('\n_isValidCaCoord() — invalid / out-of-state');

assert('null lat',                  !_isValidCaCoord(null, -118.2));
assert('null lng',                  !_isValidCaCoord(34.0, null));
assert('both null',                 !_isValidCaCoord(null, null));
assert('null island (0,0)',         !_isValidCaCoord(0, 0));
assert('only lat is 0',             !_isValidCaCoord(0, -118.2));
assert('Oregon (too far north)',    !_isValidCaCoord(43.8, -120.5));
assert('Nevada (too far east)',     !_isValidCaCoord(36.0, -112.0));
assert('Mexico (too far south)',    !_isValidCaCoord(31.5, -116.0));
assert('Pacific (too far west)',    !_isValidCaCoord(37.0, -126.0));
assert('NaN lat',                   !_isValidCaCoord(NaN, -118.2));
assert('string coords convert',     _isValidCaCoord('40.76', '-124.19'));

// ─── geocodeAddress() — mocked fetch ─────────────────────────────────────────

console.log('\ngeocodeAddress() — OK response');

const originalFetch = globalThis.fetch;

const MOCK_OK = {
  status: 'OK',
  results: [{
    formatted_address: '4635 Broadway, Eureka, CA 95503, USA',
    geometry: {
      location: { lat: 40.7794, lng: -124.1688 },
      location_type: 'ROOFTOP',
    },
  }],
};

globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => MOCK_OK });

const coordsOk = await geocodeAddress('4635 BROADWAY', 'EUREKA', 'CA', '95503', 'test-key');
assert('returns lat', Math.abs(coordsOk.lat - 40.7794) < 0.0001);
assert('returns lng', Math.abs(coordsOk.lng - (-124.1688)) < 0.0001);
assert('returns locationType ROOFTOP', coordsOk.locationType === 'ROOFTOP');
assert('returns formattedAddress', coordsOk.formattedAddress.includes('Eureka'));

console.log('\ngeocodeAddress() — ZERO_RESULTS');

globalThis.fetch = async () => ({
  ok: true, status: 200,
  json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
});

const coordsZero = await geocodeAddress('1 Fake St', 'Nowhere', 'CA', '00000', 'test-key');
assert('returns null on ZERO_RESULTS', coordsZero === null);

console.log('\ngeocodeAddress() — error statuses throw GeocodingError');

for (const [gcStatus, fragment] of [
  ['OVER_QUERY_LIMIT', 'quota'],
  ['OVER_DAILY_LIMIT', 'quota'],
  ['REQUEST_DENIED',  'denied'],
  ['INVALID_REQUEST', 'invalid'],
  ['UNKNOWN_ERROR',   'unknown_error'],
]) {
  globalThis.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({ status: gcStatus, error_message: 'test error', results: [] }),
  });

  let caught = null;
  try { await geocodeAddress('X', 'Y', 'CA', '00000', 'key'); } catch (e) { caught = e; }

  assert(`${gcStatus} throws GeocodingError`, caught instanceof GeocodingError);
  assert(`${gcStatus} error has .status = '${gcStatus}'`, caught?.status === gcStatus);
  assert(`${gcStatus} message contains '${fragment}'`, caught?.message.toLowerCase().includes(fragment));
}

console.log('\ngeocodeAddress() — HTTP error throws GeocodingError');

globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
let httpErr = null;
try { await geocodeAddress('X', 'Y', 'CA', '00000', 'key'); } catch (e) { httpErr = e; }
assert('HTTP 503 throws GeocodingError', httpErr instanceof GeocodingError);
assert('HTTP 503 error has numeric status', httpErr?.status === 503);

console.log('\ngeocodeAddress() — request URL construction');

let capturedUrl = null;
globalThis.fetch = async (url) => {
  capturedUrl = url;
  return { ok: true, status: 200, json: async () => MOCK_OK };
};
await geocodeAddress('4635 BROADWAY', 'EUREKA', 'CA', '95503', 'my-key');
assert('URL includes CA component filter', capturedUrl.includes('administrative_area_level_1%3ACA'));
assert('URL includes country:US filter', capturedUrl.includes('country%3AUS'));
assert('URL includes address parameter', capturedUrl.includes('address='));
assert('URL does NOT expose key as plain text in assertion — key present', capturedUrl.includes('key=my-key'));
assert('empty parts omitted from address query', (() => {
  let url2 = null;
  globalThis.fetch = async (u) => { url2 = u; return { ok: true, status: 200, json: async () => MOCK_OK }; };
  return geocodeAddress('123 Main', 'Sacramento', null, null, 'k').then(() =>
    url2.includes('123+Main') && !url2.includes('null')
  );
})());

// ─── resolveCoordinates() ─────────────────────────────────────────────────────

console.log('\nresolveCoordinates() — uses CCLD coords when valid');

let apiCallCount = 0;
globalThis.fetch = async () => { apiCallCount++; return { ok: true, status: 200, json: async () => MOCK_OK }; };

apiCallCount = 0;
const r1 = await resolveCoordinates(makeRecord(40.762947, -124.19073), 'key');
assert('valid CCLD coords → source = ccld', r1.source === 'ccld');
assert('valid CCLD coords → lat preserved', r1.lat === 40.762947);
assert('valid CCLD coords → no API call made', apiCallCount === 0);

console.log('\nresolveCoordinates() — falls back to Google Maps when CCLD coords invalid');

apiCallCount = 0;
const r2 = await resolveCoordinates(makeRecord(null, null), 'key');
assert('null CCLD coords → source = geocoded', r2.source === 'geocoded');
assert('null CCLD coords → API called once', apiCallCount === 1);
assert('geocoded result has lat', typeof r2.lat === 'number');
assert('geocoded result has locationType', typeof r2.locationType === 'string');

apiCallCount = 0;
const r3 = await resolveCoordinates(makeRecord(0, 0), 'key');
assert('zero coords (null island) → falls back to geocoding', r3.source === 'geocoded' && apiCallCount === 1);

apiCallCount = 0;
const r4 = await resolveCoordinates(makeRecord(43.0, -120.0), 'key');
assert('Oregon coords → falls back to geocoding', r4.source === 'geocoded' && apiCallCount === 1);

console.log('\nresolveCoordinates() — source = failed when geocoding returns ZERO_RESULTS');

globalThis.fetch = async () => ({
  ok: true, status: 200,
  json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
});

const r5 = await resolveCoordinates(makeRecord(null, null), 'key');
assert('ZERO_RESULTS → source = failed', r5.source === 'failed');
assert('ZERO_RESULTS → lat = null', r5.lat === null);
assert('ZERO_RESULTS → lng = null', r5.lng === null);

console.log('\nresolveCoordinates() — propagates GeocodingError from geocodeAddress');

globalThis.fetch = async () => ({
  ok: true, status: 200,
  json: async () => ({ status: 'REQUEST_DENIED', results: [] }),
});

let propagated = null;
try { await resolveCoordinates(makeRecord(null, null), 'bad-key'); } catch (e) { propagated = e; }
assert('GeocodingError propagates from resolveCoordinates', propagated instanceof GeocodingError);

// Restore
globalThis.fetch = originalFetch;

// ─── Live test (opt-in) ───────────────────────────────────────────────────────

if (process.env.GOOGLE_MAPS_API_KEY) {
  console.log('\ngeocodeAddress() — LIVE (GOOGLE_MAPS_API_KEY set)');
  const live = await geocodeAddress('4635 Broadway', 'Eureka', 'CA', '95503', process.env.GOOGLE_MAPS_API_KEY);
  assert('live geocode returns lat near Eureka', live && Math.abs(live.lat - 40.77) < 0.1);
  assert('live geocode returns lng near Eureka', live && Math.abs(live.lng - (-124.17)) < 0.1);
  assert('live geocode locationType is ROOFTOP or RANGE_INTERPOLATED',
    ['ROOFTOP', 'RANGE_INTERPOLATED'].includes(live?.locationType)
  );
  assert('live formattedAddress includes CA', live?.formattedAddress?.includes('CA'));
  console.log(`  (${live?.locationType}: ${live?.formattedAddress})`);
} else {
  console.log('\n  [Live test skipped — run with GOOGLE_MAPS_API_KEY=your_key to test against real API]');
}

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
