#!/usr/bin/env bun
// Quality gate — routes enriched+geocoded programs to approved or review.
//
// Rule:
//   licenseStatus === 'Active'  → APPROVED (always published to JSON + Sheet)
//   licenseStatus !== 'Active'  → SKIP_REVOKED (discarded — never shown on site)
//   NEEDS_REVIEW is reserved for future manual overrides; pipeline never sets it.
//
// Informational notes (low completeness, no web presence, parse errors) are
// written to the Import Notes column so Doug can spot patterns, but they do
// NOT block publication. We publish what we know; we omit what we don't.
//
// Also assembles the final ProgramData-shaped record used by both paths:
//   APPROVED    → orchestrator writes it to program-data/CA/{county}/programs.json
//   NEEDS_REVIEW → Sheets writer maps it to the 40-column row format

import { calculateCompleteness } from './enrich-gemini.js';

export const DECISION = {
  APPROVED:              'approved',
  NEEDS_REVIEW:          'needs_review',
  SKIP_REVOKED:          'skip_revoked',
  SKIP_WRONG_POPULATION: 'skip_wrong_population',
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate a program through the quality gate.
 *
 * @param {import('./ingest-ccld.js').CcldRecord}      ccldRecord
 * @param {import('./enrich-gemini.js').EnrichmentResult} enrichResult
 * @param {import('./geocode.js').GeocodeResult}        geocodeResult
 * @returns {QualityGateResult}
 */
export function evaluate(ccldRecord, enrichResult, geocodeResult) {
  // Hard filter — inactive/revoked programs never appear on the site
  if (ccldRecord.licenseStatus !== 'Active') {
    return {
      decision: DECISION.SKIP_REVOKED,
      completenessScore: 0,
      reasons: [`License status is "${ccldRecord.licenseStatus}" — excluded from site`],
      record: null,
    };
  }

  // Hard filter — programs Gemini confirms do not serve the DD/Lanterman Act population
  // Unknown passes through; only an explicit No is rejected here.
  if (enrichResult.servesDDPopulation === 'No') {
    return {
      decision: DECISION.SKIP_WRONG_POPULATION,
      completenessScore: 0,
      reasons: ['Gemini determined this program does not primarily serve the Lanterman Act (developmental disabilities) population — excluded from directory'],
      record: null,
    };
  }

  const score = calculateCompleteness(enrichResult);
  const notes = [];

  // Informational notes → Import Notes column in sheet (do NOT block publication)
  if (enrichResult.enrichParseError) {
    notes.push('Enrichment parse error — Gemini data unreliable, showing CCLD fields only');
  }
  if (!enrichResult.webPresenceFound) {
    notes.push('No web presence found — description limited to CCLD data');
  } else if (enrichResult.sentimentFlagged) {
    notes.push('Low web presence — no program description found');
  }
  if (score < 50) {
    notes.push(`Low completeness (${score}/100) — many enriched fields missing`);
  }
  if (!geocodeResult?.lat || !geocodeResult?.lng) {
    notes.push('No coordinates — program will not appear on map');
  }

  // All active programs are approved — publish what we know, omit what we don't
  return {
    decision: DECISION.APPROVED,
    completenessScore: score,
    reasons: notes,
    record: buildProgramRecord(ccldRecord, enrichResult, geocodeResult, score),
  };
}

/**
 * Assemble a ProgramData-shaped record from the three pipeline data sources.
 * Used by both paths: approved records go to JSON files; needs-review records
 * go to Google Sheets columns.
 *
 * Funding fields (coveringAgencies, vendorIds, authorizedServiceCodes) are left
 * empty for pipeline-discovered programs — Doug fills them in via Sheets review.
 *
 * @param {import('./ingest-ccld.js').CcldRecord}         ccldRecord
 * @param {import('./enrich-gemini.js').EnrichmentResult} enrichResult
 * @param {import('./geocode.js').GeocodeResult}          geocodeResult
 * @param {number} [completenessScore]  pass pre-computed score to avoid double calc
 * @returns {object}  conforms to ProgramData interface in src/types/index.ts
 */
export function buildProgramRecord(ccldRecord, enrichResult, geocodeResult, completenessScore) {
  const score = completenessScore ?? calculateCompleteness(enrichResult);
  const today = new Date().toISOString().slice(0, 10);

  return {
    legalLicenseName: ccldRecord.legalLicenseName,
    streetName:       enrichResult.streetName || ccldRecord.legalLicenseName,
    ccldLicenseNumber: ccldRecord.ccldLicenseNumber,
    licenseStatus:    ccldRecord.licenseStatus,
    licenseType:      ccldRecord.licenseType,

    location: {
      street:  _titleCase(ccldRecord.address),
      city:    _titleCase(ccldRecord.city),
      state:   ccldRecord.state,
      zipCode: ccldRecord.zipCode,
      county:  _normalizeCounty(ccldRecord.county),
      ...(geocodeResult?.lat != null && geocodeResult?.lng != null
        ? { coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng } }
        : {}),
    },

    contact: {
      phone:      enrichResult.phone || ccldRecord.phone,
      websiteUrl: enrichResult.websiteUrl || '',
    },

    facilityDetails: {
      licensedCapacity:         ccldRecord.capacity ?? 'Unknown',
      decryptedProgramType:     'Adult Day Program',
      programFocus:             enrichResult.programFocus || '',
      minimumAge:               18,
      ...(enrichResult.maximumAge != null        ? { maximumAge: enrichResult.maximumAge } : {}),
      ...(enrichResult.yearEstablished != null   ? { yearEstablished: enrichResult.yearEstablished } : {}),
      languagesSupported:       enrichResult.languagesSupported?.length
                                  ? enrichResult.languagesSupported
                                  : ['English'],
      ...(enrichResult.facilityFeatures?.length  ? { facilityFeatures: enrichResult.facilityFeatures } : {}),
      ...(enrichResult.activitiesOffered?.length ? { activitiesOffered: enrichResult.activitiesOffered } : {}),
      ...(enrichResult.parentOrganization        ? { parentOrganization: enrichResult.parentOrganization } : {}),
      ...(enrichResult.daysOfOperation           ? { daysOfOperation: enrichResult.daysOfOperation } : {}),
      ...(enrichResult.hoursOfOperation          ? { hoursOfOperation: enrichResult.hoursOfOperation } : {}),
      selfDeterminationAccepted: enrichResult.selfDeterminationAccepted ?? 'Unknown',
      ...(enrichResult.populationSpecialization?.length
                                  ? { populationSpecialization: enrichResult.populationSpecialization } : {}),
    },

    // Funding fields: left as defaults — Regional Center specifics require manual review
    fundingMechanics: {
      fundingSourceCategory:    'DDS/Regional Center',
      coveringAgencies:         [],
      vendorIds:                [],
      authorizedServiceCodes:   [],
      transportationAvailability: 'Contact Regional Center',
      ...(enrichResult.transportationServiceArea ? { transportationServiceArea: enrichResult.transportationServiceArea } : {}),
      ...(enrichResult.acceptsPrivatePay && enrichResult.acceptsPrivatePay !== 'Unknown'
        ? { acceptsPrivatePay: enrichResult.acceptsPrivatePay } : {}),
      requiredFundingDocument:  'IPP (Individual Program Plan)',
      financialCoverageNote:    'Funding administered through your assigned Regional Center. Contact them to confirm vendor enrollment and service coverage.',
    },

    qualitativeInsights: {
      parentReviews: enrichResult.sentimentBullets ?? [],
    },

    completenessScore: score,
    lastVerifiedDate:  today,
    dataSourceNotes:   `Pipeline import ${today}. Geocode: ${geocodeResult?.source ?? 'unknown'}.`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Normalize a raw CCLD county value: handle garbled SF name, strip " County" suffix, title-case.
// Applied in buildProgramRecord so it corrects stale checkpoint values and all-caps CCLD output.
function _normalizeCounty(county) {
  if (!county) return county;
  if (county.toLowerCase().includes('city and')) return 'San Francisco';
  return _titleCase(county.replace(/ County$/i, '').trim());
}

// CCLD exports addresses and city names in all-caps ("4635 BROADWAY", "SAN BERNARDINO").
// Title-case them for display ("4635 Broadway", "San Bernardino").
function _titleCase(str) {
  if (!str) return str;
  return str
    .toLowerCase()
    .replace(/\b([a-z])/g, c => c.toUpperCase());
}

// ─── Types (JSDoc only) ───────────────────────────────────────────────────────
/**
 * @typedef {object} QualityGateResult
 * @property {'approved'|'needs_review'|'skip_revoked'} decision
 * @property {number}   completenessScore
 * @property {string[]} reasons   empty when decision === 'approved'
 * @property {object|null} record  null only when decision === 'skip_revoked'
 */
