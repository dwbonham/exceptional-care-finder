#!/usr/bin/env bun
// Run: bun scripts/pipeline/quality-gate.test.js

import { DECISION, evaluate, buildProgramRecord } from './quality-gate.js';
import { calculateCompleteness } from './enrich-gemini.js';

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

// ─── Test fixtures ────────────────────────────────────────────────────────────

const ccld = {
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

// Enrichment result that scores ≥ 80 (covers all high-weight fields)
const richEnrich = {
  streetName:               'Carole Sund Center',
  phone:                    '(707) 442-3969',
  websiteUrl:               'https://carolesundcenter.org',
  parentOrganization:       'Easterseals',
  daysOfOperation:          'Monday–Friday',
  hoursOfOperation:         '8:00am–3:00pm',
  languagesSupported:       ['English', 'Spanish'],
  facilityFeatures:         ['Wheelchair Accessible'],
  selfDeterminationAccepted: 'Yes',
  populationSpecialization: ['Autism', 'Mixed IDD'],
  maximumAge:               65,
  programFocus:             'Supports adults with developmental disabilities through structured day activities.',
  webPresenceFound:         true,
  enrichParseError:         false,
  sentimentBullets:         ['Established in 1988, serving Humboldt County adults with developmental disabilities.'],
  sentimentFlagged:         false,
  sentimentParseError:      false,
};

// Thinly enriched result that scores < 80
const thinEnrich = {
  streetName:               'Carole Sund Center',
  phone:                    null,
  websiteUrl:               null,
  parentOrganization:       null,
  daysOfOperation:          null,
  hoursOfOperation:         null,
  languagesSupported:       [],
  facilityFeatures:         [],
  selfDeterminationAccepted: 'Unknown',
  populationSpecialization: [],
  maximumAge:               null,
  programFocus:             null,
  webPresenceFound:         false,
  enrichParseError:         false,
  sentimentBullets:         [],
  sentimentFlagged:         true,
  sentimentParseError:      false,
};

const goodGeocode  = { lat: 40.7794, lng: -124.1688, source: 'geocoded', locationType: 'ROOFTOP', formattedAddress: '4635 Broadway, Eureka, CA 95503, USA' };
const ccldGeocode  = { lat: 40.762947, lng: -124.19073, source: 'ccld' };
const failedGeocode = { lat: null, lng: null, source: 'failed' };

// ─── evaluate() — APPROVED ────────────────────────────────────────────────────

console.log('\nevaluate() — APPROVED');

const approvedResult = evaluate(ccld, richEnrich, goodGeocode);
assert('decision is approved', approvedResult.decision === DECISION.APPROVED);
assert('completenessScore ≥ 80', approvedResult.completenessScore >= 80);
assert('reasons array is empty', approvedResult.reasons.length === 0);
assert('record is present', approvedResult.record !== null);
assert('record has streetName', approvedResult.record.streetName === 'Carole Sund Center');

// ─── evaluate() — APPROVED with notes: low completeness ──────────────────────

console.log('\nevaluate() — APPROVED with notes: low completeness score');

const lowScoreResult = evaluate(ccld, thinEnrich, goodGeocode);
assert('decision is approved (not blocked by low completeness)', lowScoreResult.decision === DECISION.APPROVED);
assert('reasons includes low completeness note', lowScoreResult.reasons.some(r => r.includes('completeness')));
assert('reasons includes no-web-presence note', lowScoreResult.reasons.some(r => r.includes('web presence')));
assert('completenessScore is low', lowScoreResult.completenessScore < 80);
assert('record assembled even with low completeness', lowScoreResult.record !== null);

// ─── evaluate() — APPROVED: no sentiment bullets do not block ─────────────────

console.log('\nevaluate() — APPROVED: high score but no sentiment bullets');

// Build an enrichment that scores ≥ 80 on fields alone but has no bullets
const noSentimentEnrich = { ...richEnrich, sentimentBullets: [] };
// Recalculate: sentimentBullets (10 pts) missing → score = richEnrich score - 10
const richScore = calculateCompleteness(richEnrich);
const noSentimentScore = calculateCompleteness(noSentimentEnrich);
assert('noSentimentScore is richScore minus 10', noSentimentScore === richScore - 10);

const noSentimentResult = evaluate(ccld, noSentimentEnrich, goodGeocode);
assert('no bullets → still approved (bullets no longer block publication)', noSentimentResult.decision === DECISION.APPROVED);
assert('reasons is empty when score ≥ 80 and no other issues', noSentimentResult.reasons.length === 0);
assert('record is present', noSentimentResult.record !== null);

// ─── evaluate() — APPROVED with note: enrichment parse error ─────────────────

console.log('\nevaluate() — APPROVED with note: enrichment parse error');

const parseErrResult = evaluate(ccld, { ...richEnrich, enrichParseError: true }, goodGeocode);
assert('parse error → still approved', parseErrResult.decision === DECISION.APPROVED);
assert('reasons includes parse error note', parseErrResult.reasons.some(r => r.includes('parse error')));
assert('record is present', parseErrResult.record !== null);

// ─── evaluate() — APPROVED with note: geocoding failed ───────────────────────

console.log('\nevaluate() — APPROVED with note: geocoding failed');

const noCoordResult = evaluate(ccld, richEnrich, failedGeocode);
assert('failed geocode → still approved', noCoordResult.decision === DECISION.APPROVED);
assert('reasons includes no-coordinates note', noCoordResult.reasons.some(r => r.includes('coordinates')));
assert('record has no coordinates field', noCoordResult.record.location.coordinates === undefined);

// ─── evaluate() — SKIP_REVOKED ────────────────────────────────────────────────

console.log('\nevaluate() — SKIP_REVOKED');

for (const status of ['Inactive', 'Revoked']) {
  const r = evaluate({ ...ccld, licenseStatus: status }, richEnrich, goodGeocode);
  assert(`${status} → skip_revoked`, r.decision === DECISION.SKIP_REVOKED);
  assert(`${status} → record is null`, r.record === null);
  assert(`${status} → reason mentions status`, r.reasons[0].includes(status));
}

// ─── evaluate() — SKIP_WRONG_POPULATION ──────────────────────────────────────

console.log('\nevaluate() — SKIP_WRONG_POPULATION');

const nonDDEnrich = { ...richEnrich, servesDDPopulation: 'No' };
const wrongPopResult = evaluate(ccld, nonDDEnrich, goodGeocode);
assert('servesDDPopulation No → skip_wrong_population', wrongPopResult.decision === DECISION.SKIP_WRONG_POPULATION);
assert('skip_wrong_population → record is null', wrongPopResult.record === null);
assert('skip_wrong_population → reason mentions Lanterman', wrongPopResult.reasons[0].includes('Lanterman'));

const ddEnrich    = { ...richEnrich, servesDDPopulation: 'Yes' };
const unknownEnrich = { ...richEnrich, servesDDPopulation: 'Unknown' };
const missingEnrich = { ...richEnrich }; // field absent (pre-fix enrichResult)
delete missingEnrich.servesDDPopulation;

assert('servesDDPopulation Yes → approved', evaluate(ccld, ddEnrich, goodGeocode).decision === DECISION.APPROVED);
assert('servesDDPopulation Unknown → approved (conservative pass-through)', evaluate(ccld, unknownEnrich, goodGeocode).decision === DECISION.APPROVED);
assert('servesDDPopulation absent → approved (pre-fix enrichResults pass through)', evaluate(ccld, missingEnrich, goodGeocode).decision === DECISION.APPROVED);

// SKIP_WRONG_POPULATION takes precedence over license status check
const revokedNonDD = evaluate({ ...ccld, licenseStatus: 'Inactive' }, nonDDEnrich, goodGeocode);
assert('inactive license checked before population — still skip_revoked', revokedNonDD.decision === DECISION.SKIP_REVOKED);

// ─── buildProgramRecord() — field mapping ─────────────────────────────────────

console.log('\nbuildProgramRecord() — field mapping');

const rec = buildProgramRecord(ccld, richEnrich, goodGeocode);

assert('legalLicenseName preserved', rec.legalLicenseName === 'CAROLE SUND CENTER');
assert('streetName from enrichment', rec.streetName === 'Carole Sund Center');
assert('ccldLicenseNumber present', rec.ccldLicenseNumber === '126803405');
assert('licenseStatus present', rec.licenseStatus === 'Active');
assert('contact phone from enrichment', rec.contact.phone === '(707) 442-3969');
assert('websiteUrl from enrichment', rec.contact.websiteUrl === 'https://carolesundcenter.org');
assert('coordinates present', rec.location.coordinates?.lat === 40.7794);
assert('minimumAge defaults to 18', rec.facilityDetails.minimumAge === 18);
assert('maximumAge from enrichment', rec.facilityDetails.maximumAge === 65);
assert('sentimentBullets in parentReviews', rec.qualitativeInsights.parentReviews.length === 1);
assert('completenessScore present', typeof rec.completenessScore === 'number');
assert('lastVerifiedDate is ISO date', /^\d{4}-\d{2}-\d{2}$/.test(rec.lastVerifiedDate));
assert('dataSourceNotes mentions pipeline', rec.dataSourceNotes.includes('Pipeline import'));
assert('dataSourceNotes mentions geocode source', rec.dataSourceNotes.includes('geocoded'));

console.log('\nbuildProgramRecord() — title case conversion');

assert('address title-cased', rec.location.street === '4635 Broadway');
assert('city title-cased', rec.location.city === 'Eureka');

const laRec = buildProgramRecord(
  { ...ccld, address: '123 CESAR CHAVEZ AVE', city: 'LOS ANGELES' },
  richEnrich, goodGeocode
);
assert('multi-word city title-cased', laRec.location.city === 'Los Angeles');
assert('multi-word street title-cased', laRec.location.street === '123 Cesar Chavez Ave');

console.log('\nbuildProgramRecord() — optional fields absent when null');

const sparseRec = buildProgramRecord(ccld, thinEnrich, goodGeocode);
assert('maximumAge absent when null', !('maximumAge' in sparseRec.facilityDetails));
assert('facilityFeatures absent when empty', !('facilityFeatures' in sparseRec.facilityDetails));
assert('parentOrganization absent when null', !('parentOrganization' in sparseRec.facilityDetails));
assert('daysOfOperation absent when null', !('daysOfOperation' in sparseRec.facilityDetails));
assert('hoursOfOperation absent when null', !('hoursOfOperation' in sparseRec.facilityDetails));
assert('populationSpecialization absent when empty', !('populationSpecialization' in sparseRec.facilityDetails));
assert('languagesSupported defaults to English', sparseRec.facilityDetails.languagesSupported[0] === 'English');

console.log('\nbuildProgramRecord() — coordinate handling');

const noCoordRec = buildProgramRecord(ccld, richEnrich, failedGeocode);
assert('no coordinates field when geocode failed', !('coordinates' in noCoordRec.location));

const ccldCoordRec = buildProgramRecord(ccld, richEnrich, ccldGeocode);
assert('CCLD-sourced coordinates included', ccldCoordRec.location.coordinates?.lat === 40.762947);

console.log('\nbuildProgramRecord() — phone fallback');

const noPhoneEnrich = { ...richEnrich, phone: null };
const noPhoneRec = buildProgramRecord(ccld, noPhoneEnrich, goodGeocode);
assert('phone falls back to CCLD when enrichment phone is null', noPhoneRec.contact.phone === '(707) 442-3969');

console.log('\nbuildProgramRecord() — funding defaults');

assert('fundingSourceCategory default', rec.fundingMechanics.fundingSourceCategory === 'DDS/Regional Center');
assert('coveringAgencies is empty array', Array.isArray(rec.fundingMechanics.coveringAgencies) && rec.fundingMechanics.coveringAgencies.length === 0);
assert('vendorIds is empty array', Array.isArray(rec.fundingMechanics.vendorIds) && rec.fundingMechanics.vendorIds.length === 0);
assert('authorizedServiceCodes is empty array', Array.isArray(rec.fundingMechanics.authorizedServiceCodes) && rec.fundingMechanics.authorizedServiceCodes.length === 0);

// ─── evaluate() + buildProgramRecord() roundtrip ────────────────────────────

console.log('\nevaluate() score matches direct calculateCompleteness()');

const directScore = calculateCompleteness(richEnrich);
const gateScore   = evaluate(ccld, richEnrich, goodGeocode).completenessScore;
assert('evaluate() score matches calculateCompleteness() directly', gateScore === directScore);

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
