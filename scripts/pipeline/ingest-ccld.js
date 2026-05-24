#!/usr/bin/env bun
// CCLD ingest module — fetches Adult Day Program records from the CA state licensing database.
//
// Data source: CDSS Community Care Licensing ArcGIS FeatureServer
// Portal: https://gis.data.chhs.ca.gov (CKAN dataset ID: 3c2fc34a-8517-4938-b3ee-992af04cd6b7)
// API endpoint used instead of the full CSV because it supports server-side type filtering,
// returns clean JSON, and fits under the 1,000-record page limit for the ~969 ADP records.
//
// CRITICAL FILTER: TYPE = 775 ("Adult Day Care" / Adult Day Programs)
// NOT Adult Day Health Care — that program type is licensed by DHCS, not CCLD, and
// serves a different population with different funding. It does not appear in this dataset.

const FEATURE_SERVICE =
  'https://services.arcgis.com/XLPEppdz2H9dOiqp/arcgis/rest/services/CDSS_CCL_Facilities/FeatureServer/0/query';

const ADP_TYPE_CODE = 775;
const PAGE_SIZE = 1000; // FeatureServer maxRecordCount limit

// STATUS codes observed in the CCLD export. Only STATUS=3 has appeared for TYPE=775,
// but the pipeline maps anything non-3 to 'Inactive' for defensive handling.
const STATUS_ACTIVE = 3;

// Fields we request — omit x/y/ObjectId geometry projections we don't need
const OUT_FIELDS = [
  'FAC_NBR',
  'NAME',
  'STATUS',
  'FAC_TYPE_DESC',
  'RES_STREET_ADDR',
  'RES_CITY',
  'RES_STATE',
  'RES_ZIP_CODE',
  'COUNTY',
  'FAC_PHONE_NBR',
  'CAPACITY',
  'FAC_LATITUDE',
  'FAC_LONGITUDE',
].join(',');

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch all Adult Day Program records from the CCLD ArcGIS FeatureServer.
 * Paginates automatically if the record count ever exceeds PAGE_SIZE.
 * Returns a normalized array of CcldRecord objects.
 *
 * @returns {Promise<CcldRecord[]>}
 */
export async function fetchAdultDayPrograms() {
  const records = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      where: `TYPE = ${ADP_TYPE_CODE}`,
      outFields: OUT_FIELDS,
      returnGeometry: 'false',
      f: 'json',
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
    });

    const res = await fetch(`${FEATURE_SERVICE}?${params}`);
    if (!res.ok) {
      throw new Error(`CCLD fetch failed: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`CCLD API error: ${data.error.message} (code ${data.error.code})`);
    }

    const features = data.features ?? [];
    for (const feature of features) {
      records.push(normalizeCcldRecord(feature.attributes));
    }

    // ArcGIS sets exceededTransferLimit=true when there are more pages
    if (!data.exceededTransferLimit || features.length === 0) break;
    offset += PAGE_SIZE;
  }

  return records;
}

/**
 * Diff a fresh CCLD fetch against the current checkpoint state.
 * Returns three buckets:
 *   newPrograms     — license numbers not yet in the checkpoint → enqueue for enrichment
 *   revokedPrograms — CCLD licenseStatus is not Active AND not already known-inactive
 *   statusChanges   — programs whose licenseStatus changed since last seen
 *
 * @param {CcldRecord[]} ccldRecords
 * @param {object} checkpointState  — loaded checkpoint (from checkpoint.js)
 * @returns {{ newPrograms: CcldRecord[], revokedPrograms: CcldRecord[], statusChanges: StatusChange[] }}
 */
export function diffWithCheckpoint(ccldRecords, checkpointState) {
  const known = checkpointState.programs ?? {};
  const newPrograms = [];
  const revokedPrograms = [];
  const statusChanges = [];

  for (const record of ccldRecords) {
    const num = record.ccldLicenseNumber;
    const existing = known[num];

    if (!existing) {
      // Never seen before
      if (record.licenseStatus !== 'Active') {
        // Inactive on first discovery — skip enrichment; flag as inactive immediately
        revokedPrograms.push(record);
      } else {
        newPrograms.push(record);
      }
      continue;
    }

    // Already in checkpoint — check for status change
    const knownStatus = existing.ccldLicenseStatus;
    if (knownStatus && knownStatus !== record.licenseStatus) {
      statusChanges.push({ record, oldStatus: knownStatus, newStatus: record.licenseStatus });
    }
  }

  return { newPrograms, revokedPrograms, statusChanges };
}

// ─── Record normalization ─────────────────────────────────────────────────────

/**
 * Map a raw ArcGIS attributes object to a normalized CcldRecord.
 * Exported for unit testing.
 *
 * @param {object} attrs — raw feature attributes from ArcGIS JSON response
 * @returns {CcldRecord}
 */
export function normalizeCcldRecord(attrs) {
  return {
    ccldLicenseNumber: String(attrs.FAC_NBR ?? '').trim(),
    legalLicenseName: String(attrs.NAME ?? '').trim(),
    licenseStatus: attrs.STATUS === STATUS_ACTIVE ? 'Active' : 'Inactive',
    licenseType: String(attrs.FAC_TYPE_DESC ?? '').trim(),
    address: String(attrs.RES_STREET_ADDR ?? '').trim(),
    city: String(attrs.RES_CITY ?? '').trim(),
    state: String(attrs.RES_STATE ?? 'CA').trim(),
    zipCode: String(attrs.RES_ZIP_CODE ?? '').trim(),
    county: _normalizeCounty(String(attrs.COUNTY ?? '').trim()),
    phone: _formatPhone(attrs.FAC_PHONE_NBR),
    capacity: attrs.CAPACITY != null ? Number(attrs.CAPACITY) : null,
    lat: _parseCoord(attrs.FAC_LATITUDE),
    lng: _parseCoord(attrs.FAC_LONGITUDE),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _normalizeCounty(county) {
  if (!county) return county;
  if (county.toLowerCase().includes('city and')) return 'San Francisco';
  return county.replace(/ County$/i, '').trim();
}

// FAC_PHONE_NBR is stored as Double in ArcGIS, so 10-digit numbers arrive as floats.
// Round to integer before converting to string to strip any floating-point drift.
function _formatPhone(raw) {
  if (raw == null || raw === 0) return '';
  const digits = String(Math.round(Number(raw))).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits; // return raw digits if unexpected length
}

// FAC_LATITUDE / FAC_LONGITUDE come as String fields in the ArcGIS schema
function _parseCoord(raw) {
  if (raw == null || raw === '' || raw === 0) return null;
  const n = parseFloat(raw);
  return isFinite(n) ? n : null;
}

// ─── Types (JSDoc only — no TypeScript in this script) ───────────────────────
/**
 * @typedef {object} CcldRecord
 * @property {string} ccldLicenseNumber
 * @property {string} legalLicenseName
 * @property {'Active'|'Inactive'} licenseStatus
 * @property {string} licenseType
 * @property {string} address
 * @property {string} city
 * @property {string} state
 * @property {string} zipCode
 * @property {string} county
 * @property {string} phone
 * @property {number|null} capacity
 * @property {number|null} lat
 * @property {number|null} lng
 *
 * @typedef {object} StatusChange
 * @property {CcldRecord} record
 * @property {string} oldStatus
 * @property {string} newStatus
 */
