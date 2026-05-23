#!/usr/bin/env bun
// Quality gate — routes enriched+geocoded programs to auto-approve or Sheets review.
//
// Rule (from engineering review):
//   Completeness ≥ 80 AND at least 1 sentiment bullet → APPROVED (written to JSON)
//   Anything else                                     → NEEDS_REVIEW (written to Sheet)
//   licenseStatus !== 'Active'                        → SKIP_REVOKED (discarded)
//
// Also assembles the final ProgramData-shaped record used by both paths:
//   APPROVED    → orchestrator writes it to program-data/CA/{county}/programs.json
//   NEEDS_REVIEW → Sheets writer maps it to the 40-column row format

import { calculateCompleteness } from './enrich-gemini.js';

export const DECISION = {
  APPROVED:     'approved',
  NEEDS_REVIEW: 'needs_review',
  SKIP_REVOKED: 'skip_revoked',
};

const COMPLETENESS_THRESHOLD = 80;

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

  const score = calculateCompleteness(enrichResult);
  const reasons = [];

  if (score < COMPLETENESS_THRESHOLD) {
    reasons.push(`Completeness ${score}/100 is below the ${COMPLETENESS_THRESHOLD} threshold`);
  }
  if (!enrichResult.sentimentBullets?.length) {
    reasons.push('No sentiment bullets found (low web presence)');
  }
  if (enrichResult.enrichParseError) {
    reasons.push('Gemini enrichment response could not be parsed — data may be incomplete');
  }
  if (!geocodeResult?.lat || !geocodeResult?.lng) {
    reasons.push('Coordinates not resolved — program will not appear on map');
  }

  return {
    decision: reasons.length === 0 ? DECISION.APPROVED : DECISION.NEEDS_REVIEW,
    completenessScore: score,
    reasons,
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
      county:  ccldRecord.county,
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
      languagesSupported:       enrichResult.languagesSupported?.length
                                  ? enrichResult.languagesSupported
                                  : ['English'],
      ...(enrichResult.facilityFeatures?.length  ? { facilityFeatures: enrichResult.facilityFeatures } : {}),
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
