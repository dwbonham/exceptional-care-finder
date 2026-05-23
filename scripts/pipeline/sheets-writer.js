#!/usr/bin/env bun
// Google Sheets writer — mirrors all pipeline programs to the master data sheet.
//
// Authentication: Google service account (JSON key file from Cloud Console).
// The orchestrator reads the JSON key file and passes it as serviceAccount object.
//
// Sheet layout: 40 columns defined in HEADERS below. ensureHeaders() writes
// the header row the first time the sheet is used; subsequent runs append rows.
//
// Scope required: https://www.googleapis.com/auth/spreadsheets
// (set on the service account when creating the key in Cloud Console)

import { createSign } from 'crypto';

// ─── Sheet column definitions ─────────────────────────────────────────────────
// Must match the order in buildSheetRow(). Used to create the header row.

export const HEADERS = [
  // Workflow (col 0–3)
  'Status', 'Completeness %', 'Last Updated', 'CCLD Last Verified',
  // CCLD Auto-fill (col 4–13)
  'CCLD License Number', 'Legal Name', 'License Type', 'License Status',
  'Address', 'City', 'County', 'State', 'Zip', 'Capacity',
  // RC / Funding (col 14–18)
  'Covering Agencies', 'Vendor IDs', 'Authorized Service Codes',
  'Transportation', 'Financial Coverage Note',
  // Gemini-Enriched (col 19–31)
  'Display Name', 'Phone', 'Website', 'Parent Org',
  'Min Age', 'Max Age', 'Days', 'Hours',
  'Languages', 'Features', 'Self-Determination',
  'Population Specialization', 'Program Focus',
  // AI Sentiment (col 32–34)
  'Sentiment Bullet 1', 'Sentiment Bullet 2', 'Sentiment Bullet 3',
  // Auto-generated (col 35–39)
  'Latitude', 'Longitude', 'Geocode Source', 'Import Notes', 'Review Notes',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Append a program row to the Google Sheet (all programs, not just needs-review).
 * Writes header row first if the sheet is empty.
 *
 * @param {import('./quality-gate.js').QualityGateResult} gateResult
 * @param {{ spreadsheetId: string, sheetName: string, serviceAccount: object }} config
 * @returns {Promise<{ updatedRange: string, updatedRows: number }>}
 */
export async function appendProgramRow(gateResult, config) {
  const { spreadsheetId, sheetName, serviceAccount } = config;
  const token = await _getAccessToken(serviceAccount);

  await _ensureHeaders(spreadsheetId, sheetName, token);

  const row = buildSheetRow(gateResult);
  return _appendRows(spreadsheetId, sheetName, [row], token);
}

/**
 * Append multiple rows in one API call (more efficient for batch imports).
 *
 * @param {import('./quality-gate.js').QualityGateResult[]} gateResults
 * @param {{ spreadsheetId: string, sheetName: string, serviceAccount: object }} config
 */
export async function appendProgramRows(gateResults, config) {
  if (gateResults.length === 0) return;
  const { spreadsheetId, sheetName, serviceAccount } = config;
  const token = await _getAccessToken(serviceAccount);

  await _ensureHeaders(spreadsheetId, sheetName, token);

  const rows = gateResults.map(buildSheetRow);
  return _appendRows(spreadsheetId, sheetName, rows, token);
}

/**
 * Map a QualityGateResult to a 40-column row array matching HEADERS order.
 * Pure function — exported for tests.
 *
 * @param {import('./quality-gate.js').QualityGateResult} gateResult
 * @returns {(string|number)[]}
 */
export function buildSheetRow(gateResult) {
  const { decision, completenessScore, reasons, record } = gateResult;
  const r = record ?? {};
  const fd = r.facilityDetails ?? {};
  const fm = r.fundingMechanics ?? {};
  const loc = r.location ?? {};
  const qi = r.qualitativeInsights ?? {};

  const statusLabel = decision === 'approved' ? 'Approved' : 'Needs Review';
  const today = new Date().toISOString().slice(0, 10);

  return [
    // Workflow
    statusLabel,
    completenessScore,
    today,
    r.lastVerifiedDate ?? today,
    // CCLD Auto-fill
    r.ccldLicenseNumber ?? '',
    r.legalLicenseName ?? '',
    r.licenseType ?? '',
    r.licenseStatus ?? '',
    loc.street ?? '',
    loc.city ?? '',
    loc.county ?? '',
    loc.state ?? '',
    loc.zipCode ?? '',
    fd.licensedCapacity ?? '',
    // RC / Funding
    _join(fm.coveringAgencies),
    _joinVendorIds(fm.vendorIds),
    _join(fm.authorizedServiceCodes),
    fm.transportationAvailability ?? '',
    fm.financialCoverageNote ?? '',
    // Gemini-Enriched
    r.streetName ?? '',
    r.contact?.phone ?? '',
    r.contact?.websiteUrl ?? '',
    fd.parentOrganization ?? '',
    fd.minimumAge ?? '',
    fd.maximumAge ?? '',
    fd.daysOfOperation ?? '',
    fd.hoursOfOperation ?? '',
    _join(fd.languagesSupported),
    _join(fd.facilityFeatures),
    fd.selfDeterminationAccepted ?? 'Unknown',
    _join(fd.populationSpecialization),
    fd.programFocus ?? '',
    // AI Sentiment
    qi.parentReviews?.[0] ?? '',
    qi.parentReviews?.[1] ?? '',
    qi.parentReviews?.[2] ?? '',
    // Auto-generated
    loc.coordinates?.lat ?? '',
    loc.coordinates?.lng ?? '',
    r.dataSourceNotes?.match(/Geocode: (\w+)/)?.[1] ?? '',
    reasons.length > 0 ? reasons.join(' | ') : '',
    '', // Review Notes — left blank for Doug
  ];
}

// ─── Internal: Sheets API calls ───────────────────────────────────────────────

async function _ensureHeaders(spreadsheetId, sheetName, token) {
  // Read the first row to check if headers are already present
  const range = encodeURIComponent(`${sheetName}!A1:A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Sheets read failed: HTTP ${res.status}\n${errText}`);
  }

  const data = await res.json();
  const firstCell = data.values?.[0]?.[0];

  if (firstCell === HEADERS[0]) return; // headers already present

  // Sheet is empty or has different headers — write the header row
  await _appendRows(spreadsheetId, sheetName, [HEADERS], token);
}

async function _appendRows(spreadsheetId, sheetName, rows, token) {
  const range = encodeURIComponent(`${sheetName}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets append failed: HTTP ${res.status}\n${text}`);
  }
  const data = await res.json();
  return {
    updatedRange: data.updates?.updatedRange ?? '',
    updatedRows:  data.updates?.updatedRows  ?? 0,
  };
}

// ─── Internal: Service account JWT auth ──────────────────────────────────────

async function _getAccessToken(serviceAccount) {
  const jwt = _signJwt(serviceAccount);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Service account auth failed (${serviceAccount.client_email}): ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

function _signJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:   serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  })).toString('base64url');

  const toSign = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(toSign);
  const sig = signer.sign(serviceAccount.private_key).toString('base64url');
  return `${toSign}.${sig}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _join(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.join(', ');
}

function _joinVendorIds(vendorIds) {
  if (!Array.isArray(vendorIds) || vendorIds.length === 0) return '';
  return vendorIds.map(v => `${v.rc}: ${v.id}`).join(', ');
}
