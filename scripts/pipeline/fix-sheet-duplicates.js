#!/usr/bin/env bun
// One-off cleanup script: deduplicates the Programs tab and normalizes county names.
//
// What it fixes:
//   1. Duplicate rows — Phase 4 (CCLD-only) + Phase 5 (Gemini backfill) both appended
//      rows for the same license number. Keeps the most complete/enriched version.
//   2. County names — e.g. "Contra Costa County" → "Contra Costa",
//      "City And County Of San Francisco" → "San Francisco"
//
// Usage:
//   GOOGLE_SHEET_ID=<id> GOOGLE_SERVICE_ACCOUNT_PATH=<path> bun scripts/pipeline/fix-sheet-duplicates.js
//
// Safe to re-run — idempotent. After running, kick off Phase 5 backfill enrichment.

import { createSign } from 'crypto';
import { readFileSync } from 'fs';
import { syncCountySummary } from './sheets-writer.js';

// Column indices (0-based), matching HEADERS in sheets-writer.js
const COL_COMPLETENESS = 2;   // "Completeness %"
const COL_LAST_UPDATED = 3;   // "Last Updated"
const COL_LICENSE_NUM  = 5;   // "CCLD License Number"
const COL_COUNTY       = 11;  // "County"

// ─── County normalization ─────────────────────────────────────────────────────

function normalizeCounty(raw) {
  if (!raw) return raw;
  const s = raw.trim();
  if (s.toLowerCase().includes('city and')) return 'San Francisco';
  return s.replace(/ County$/i, '').trim();
}

// ─── Deduplication helpers ────────────────────────────────────────────────────

function countNonEmpty(row) {
  return row.filter(cell => cell !== '' && cell != null && cell !== undefined).length;
}

function parseCompleteness(row) {
  return parseFloat(row[COL_COMPLETENESS]) || 0;
}

/**
 * Given a list of rows with the same CCLD License Number, return the best single row.
 * Ranking: highest completeness % first, then most non-empty cells, then most recent date.
 */
function pickBestRow(rows) {
  if (rows.length === 1) return rows[0];

  return rows.slice().sort((a, b) => {
    const compDiff = parseCompleteness(b) - parseCompleteness(a);
    if (compDiff !== 0) return compDiff;

    const fillDiff = countNonEmpty(b) - countNonEmpty(a);
    if (fillDiff !== 0) return fillDiff;

    // Tie-break: most recent Last Updated date
    const dateA = a[COL_LAST_UPDATED] ?? '';
    const dateB = b[COL_LAST_UPDATED] ?? '';
    return dateB.localeCompare(dateA);
  })[0];
}

// ─── Sheets API helpers ───────────────────────────────────────────────────────

async function getAccessToken(serviceAccount) {
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
  const jwt = `${toSign}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Auth failed: ${data.error} — ${data.error_description}`);
  }
  return data.access_token;
}

async function readAllRows(spreadsheetId, sheetName, token) {
  const range = encodeURIComponent(`${sheetName}!A:AS`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    throw new Error(`Sheets read failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.values ?? [];
}

async function clearSheet(spreadsheetId, sheetName, token) {
  const range = encodeURIComponent(`${sheetName}!A:ZZ`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    }
  );
  if (!res.ok) {
    throw new Error(`Sheets clear failed: HTTP ${res.status} ${await res.text()}`);
  }
}

async function appendRows(spreadsheetId, sheetName, rows, token) {
  const range = encodeURIComponent(`${sheetName}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    }
  );
  if (!res.ok) {
    throw new Error(`Sheets append failed: HTTP ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.updates?.updatedRows ?? 0;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const missing = ['GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_PATH'].filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_PATH, 'utf8'));
  const spreadsheetId  = process.env.GOOGLE_SHEET_ID;
  const sheetName      = 'Programs';

  console.log('Authenticating…');
  const token = await getAccessToken(serviceAccount);

  console.log('Reading Programs sheet…');
  const allRows = await readAllRows(spreadsheetId, sheetName, token);

  if (allRows.length === 0) {
    console.log('Sheet is empty — nothing to do.');
    return;
  }

  const [headerRow, ...dataRows] = allRows;
  console.log(`Found ${dataRows.length} data row(s) (excluding header)`);

  // Group by CCLD License Number
  const groups = new Map();
  const noLicense = [];

  for (const row of dataRows) {
    const licNum = (row[COL_LICENSE_NUM] ?? '').toString().trim();
    if (!licNum) {
      noLicense.push(row);
      continue;
    }
    if (!groups.has(licNum)) groups.set(licNum, []);
    groups.get(licNum).push(row);
  }

  // Resolve duplicates and normalize county
  let dupesRemoved = 0;
  let countiesFixed = 0;
  const dedupedRows = [];

  for (const [licNum, rows] of groups) {
    const best = pickBestRow(rows);

    if (rows.length > 1) {
      dupesRemoved += rows.length - 1;
      const completeness = best[COL_COMPLETENESS] ?? '?';
      console.log(`  [DEDUP] ${licNum}: kept 1 of ${rows.length} rows (completeness: ${completeness}%)`);
    }

    // Normalize county name
    const rawCounty = best[COL_COUNTY] ?? '';
    const normalized = normalizeCounty(rawCounty);
    if (normalized !== rawCounty) {
      console.log(`  [COUNTY] ${licNum}: "${rawCounty}" → "${normalized}"`);
      best[COL_COUNTY] = normalized;
      countiesFixed++;
    }

    dedupedRows.push(best);
  }

  // Rows with no license number (shouldn't normally exist) — keep at end
  for (const row of noLicense) {
    console.warn(`  [WARN] Row with no CCLD License Number: ${JSON.stringify(row.slice(0, 8))}`);
    dedupedRows.push(row);
  }

  console.log(`\nSummary:`);
  console.log(`  Before: ${dataRows.length} rows`);
  console.log(`  After:  ${dedupedRows.length} rows`);
  console.log(`  Duplicates removed: ${dupesRemoved}`);
  console.log(`  County names normalized: ${countiesFixed}`);

  if (dupesRemoved === 0 && countiesFixed === 0) {
    console.log('\nPrograms tab already clean — no changes needed.');
  } else {
    console.log('\nClearing Programs tab…');
    await clearSheet(spreadsheetId, sheetName, token);

    console.log(`Writing ${dedupedRows.length + 1} rows (header + data)…`);
    const written = await appendRows(spreadsheetId, sheetName, [headerRow, ...dedupedRows], token);
    console.log(`Done — ${written} row(s) written.`);
  }

  console.log('\nRebuilding County Summary tab…');
  await syncCountySummary({ spreadsheetId, serviceAccount });
  console.log('County Summary updated.');

  console.log('\nNext step: run Phase 5 backfill enrichment:');
  console.log('  ENRICH_COUNTIES=<county> bun scripts/pipeline/pipeline.js');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
