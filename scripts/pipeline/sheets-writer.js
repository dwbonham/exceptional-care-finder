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
  // Workflow (col 0–4)
  'Status', 'Published Status', 'Completeness %', 'Last Updated', 'CCLD Last Verified',
  // CCLD Auto-fill (col 5–14)
  'CCLD License Number', 'Legal Name', 'License Type', 'License Status',
  'Address', 'City', 'County', 'State', 'Zip', 'Capacity',
  // RC / Funding (col 15–21)
  'Covering Agencies', 'Vendor IDs', 'Authorized Service Codes',
  'Transportation', 'Transportation Service Area', 'Accepts Private Pay', 'Financial Coverage Note',
  // Gemini-Enriched (col 22–36)
  'Display Name', 'Phone', 'Website', 'Parent Org', 'Year Established',
  'Min Age', 'Max Age', 'Days', 'Hours',
  'Languages', 'Features', 'Activities Offered', 'Self-Determination',
  'Population Specialization', 'Program Focus',
  // AI Sentiment (col 37–39)
  'Sentiment Bullet 1', 'Sentiment Bullet 2', 'Sentiment Bullet 3',
  // Auto-generated (col 40–44)
  'Latitude', 'Longitude', 'Geocode Source', 'Import Notes', 'Review Notes',
];

export const FUNDING_GUIDE_HEADERS = [
  'State', 'Question', 'Answer', 'Source URL', 'Source Label',
];

export const REGIONAL_CENTER_HEADERS = [
  'State', 'County', 'Name', 'Phone', 'Website', 'Zip Codes', 'Notes',
];

export const COUNTY_SUMMARY_HEADERS = [
  'County', 'Total Programs', 'Enriched', 'Pending Gemini', 'Enrichment %',
  'With Sentiment', 'Sentiment %',
  'Last CCLD Refresh', 'Last Gemini Run', 'Summary Updated',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Rebuild the "County Summary" tab from the current Programs tab data.
 * Reads all Programs rows, groups by county, computes stats, clears the tab,
 * and rewrites. Called at the end of every pipeline run that touches the sheet.
 *
 * @param {{ spreadsheetId: string, serviceAccount: object }} config
 */
export async function syncCountySummary(config) {
  const { spreadsheetId, serviceAccount } = config;
  const token = await _getAccessToken(serviceAccount);

  // Read all Programs rows (columns A–AS)
  const range = encodeURIComponent('Programs!A:AS');
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`County summary read failed: HTTP ${res.status}\n${text}`);
  }
  const { values = [] } = await res.json();
  const [, ...rows] = values; // skip header row

  // Column indices matching HEADERS in this file
  const C_LAST_UPDATED = 3;   // "Last Updated"
  const C_CCLD_VERIFIED = 4;  // "CCLD Last Verified"
  const C_COUNTY        = 11; // "County"
  const C_COMPLETENESS  = 2;  // "Completeness %"
  const C_PHONE         = 23; // "Phone"
  const C_WEBSITE       = 24; // "Website"
  const C_SENTIMENT     = 37; // "Sentiment Bullet 1"

  const countyMap = new Map();
  for (const row of rows) {
    const county       = (row[C_COUNTY]       ?? '').trim() || '(unknown)';
    const completeness = parseFloat(row[C_COMPLETENESS]) || 0;
    const website      = (row[C_WEBSITE]      ?? '').trim();
    const phone        = (row[C_PHONE]        ?? '').trim();
    const sentiment    = (row[C_SENTIMENT]    ?? '').trim();
    const lastUpdated  = (row[C_LAST_UPDATED] ?? '').trim();
    const ccldVerified = (row[C_CCLD_VERIFIED]?? '').trim();

    if (!countyMap.has(county)) {
      countyMap.set(county, { total: 0, enriched: 0, pending: 0, withSentiment: 0, lastCcld: '', lastGemini: '' });
    }
    const c = countyMap.get(county);
    c.total++;

    const geminiFoundData = completeness > 0 && (website || phone || sentiment);
    if (geminiFoundData) {
      c.enriched++;
      if (lastUpdated > c.lastGemini) c.lastGemini = lastUpdated;
    } else {
      c.pending++;
    }
    if (sentiment) c.withSentiment++;
    if (ccldVerified > c.lastCcld) c.lastCcld = ccldVerified;
  }

  const today = new Date().toISOString().slice(0, 10);
  const summaryRows = [COUNTY_SUMMARY_HEADERS];
  for (const [county, { total, enriched, pending, withSentiment, lastCcld, lastGemini }] of
    [...countyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const pct         = total > 0 ? `${Math.round((enriched      / total) * 100)}%` : '0%';
    const sentimentPct = total > 0 ? `${Math.round((withSentiment / total) * 100)}%` : '0%';
    summaryRows.push([county, total, enriched, pending, pct, withSentiment, sentimentPct, lastCcld, lastGemini, today]);
  }

  const sheetName = 'County Summary';
  await _ensureTab(spreadsheetId, sheetName, token);
  await _clearSheet(spreadsheetId, sheetName, token);
  return _appendRows(spreadsheetId, sheetName, summaryRows, token);
}

/**
 * Overwrite the Funding Guides tab with all FAQs from every state guide.
 * Clears the tab first so stale rows never accumulate.
 *
 * @param {Array<{ state: string, faqs: Array<{ question, answer, sourceUrl?, sourceLabel? }> }>} guides
 * @param {{ spreadsheetId: string, serviceAccount: object }} config
 */
export async function syncFundingGuides(guides, config) {
  const { spreadsheetId, serviceAccount } = config;
  const token = await _getAccessToken(serviceAccount);
  const sheetName = 'Funding Guides';

  await _ensureTab(spreadsheetId, sheetName, token);
  await _clearSheet(spreadsheetId, sheetName, token);

  const rows = [FUNDING_GUIDE_HEADERS];
  for (const guide of guides) {
    for (const faq of guide.faqs ?? []) {
      rows.push([
        guide.state ?? '',
        faq.question ?? '',
        faq.answer ?? '',
        faq.sourceUrl ?? '',
        faq.sourceLabel ?? '',
      ]);
    }
  }
  return _appendRows(spreadsheetId, sheetName, rows, token);
}

/**
 * Overwrite the Regional Centers tab with all agency contacts from every state guide.
 * Clears the tab first so stale rows never accumulate.
 *
 * @param {Array<{ state: string, localAgencies: Array<{ county?, name, phone, websiteUrl, note? }> }>} guides
 * @param {{ spreadsheetId: string, serviceAccount: object }} config
 */
export async function syncRegionalCenters(guides, config) {
  const { spreadsheetId, serviceAccount } = config;
  const token = await _getAccessToken(serviceAccount);
  const sheetName = 'Regional Centers';

  await _ensureTab(spreadsheetId, sheetName, token);
  await _clearSheet(spreadsheetId, sheetName, token);

  const rows = [REGIONAL_CENTER_HEADERS];
  for (const guide of guides) {
    for (const agency of guide.localAgencies ?? []) {
      rows.push([
        guide.state ?? '',
        agency.county ?? '',
        agency.name ?? '',
        agency.phone ?? '',
        agency.websiteUrl ?? '',
        (agency.zipCodes ?? []).join(', '),
        agency.note ?? '',
      ]);
    }
  }
  return _appendRows(spreadsheetId, sheetName, rows, token);
}

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
 * Upsert program rows: update existing rows in place by CCLD License Number,
 * append rows that don't exist yet. Prevents duplicates when Phase 5 backfill
 * re-processes programs already written by Phase 4.
 *
 * Review Notes (column AS, index 44) are preserved on update — only columns
 * A through AR are overwritten.
 *
 * @param {import('./quality-gate.js').QualityGateResult[]} gateResults
 * @param {{ spreadsheetId: string, sheetName: string, serviceAccount: object }} config
 */
export async function upsertProgramRows(gateResults, config) {
  if (gateResults.length === 0) return;
  const { spreadsheetId, sheetName, serviceAccount } = config;
  const token = await _getAccessToken(serviceAccount);

  await _ensureHeaders(spreadsheetId, sheetName, token);

  const licToRow = await _readLicenseToRowMap(spreadsheetId, sheetName, token);

  const updateData = [];
  const toAppend = [];

  for (const gateResult of gateResults) {
    const licNum = gateResult.record?.ccldLicenseNumber ?? '';
    const row = buildSheetRow(gateResult);
    const existingRowIdx = licToRow[licNum];

    if (existingRowIdx != null) {
      // Update columns A–AR (indices 0–43); preserve Review Notes at index 44 (col AS)
      updateData.push({
        range: `${sheetName}!A${existingRowIdx}:AR${existingRowIdx}`,
        values: [row.slice(0, 44)],
      });
    } else {
      toAppend.push(row);
    }
  }

  if (updateData.length > 0) {
    await _batchUpdateValues(spreadsheetId, updateData, token);
  }
  if (toAppend.length > 0) {
    await _appendRows(spreadsheetId, sheetName, toAppend, token);
  }
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
  const publishedStatus = decision === 'approved' ? 'Live' : 'Not Published';
  const today = new Date().toISOString().slice(0, 10);

  return [
    // Workflow
    statusLabel,
    publishedStatus,
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
    fm.transportationServiceArea ?? '',
    fm.acceptsPrivatePay ?? 'Unknown',
    fm.financialCoverageNote ?? '',
    // Gemini-Enriched
    r.streetName ?? '',
    r.contact?.phone ?? '',
    r.contact?.websiteUrl ?? '',
    fd.parentOrganization ?? '',
    fd.yearEstablished ?? '',
    fd.minimumAge ?? '',
    fd.maximumAge ?? '',
    fd.daysOfOperation ?? '',
    fd.hoursOfOperation ?? '',
    _join(fd.languagesSupported),
    _join(fd.facilityFeatures),
    _join(fd.activitiesOffered),
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

/**
 * Read column F (CCLD License Number) from the sheet and return a map of
 * licenseNumber → 1-based row index. Only the first occurrence is kept for
 * each license number — duplicates are resolved by the cleanup script.
 */
async function _readLicenseToRowMap(spreadsheetId, sheetName, token) {
  const range = encodeURIComponent(`${sheetName}!F:F`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets read failed: HTTP ${res.status}\n${text}`);
  }
  const data = await res.json();
  const rows = data.values ?? [];
  const map = {};
  for (let i = 0; i < rows.length; i++) {
    const licNum = rows[i]?.[0];
    if (licNum && licNum !== HEADERS[5] && !(licNum in map)) {
      map[licNum] = i + 1; // 1-based row index
    }
  }
  return map;
}

async function _batchUpdateValues(spreadsheetId, data, token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets batchUpdate failed: HTTP ${res.status}\n${text}`);
  }
}

async function _ensureHeaders(spreadsheetId, sheetName, token) {
  // Create the tab if it doesn't exist yet
  await _ensureTab(spreadsheetId, sheetName, token);

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

  // Tab is empty or has different headers — write the header row
  await _appendRows(spreadsheetId, sheetName, [HEADERS], token);
}

async function _ensureTab(spreadsheetId, sheetName, token) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
    }
  );
  if (!res.ok) {
    const data = await res.json();
    const msg = data?.error?.message ?? '';
    if (!msg.includes('already exists')) {
      throw new Error(`Failed to create sheet tab "${sheetName}": ${msg}`);
    }
    // Tab already exists — that's fine
  }
}

async function _clearSheet(spreadsheetId, sheetName, token) {
  const range = encodeURIComponent(`${sheetName}!A:ZZ`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets clear failed: HTTP ${res.status}\n${text}`);
  }
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
