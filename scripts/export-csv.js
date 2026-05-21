#!/usr/bin/env bun
// Run with: bun run export-csv
// Output:   exports/programs.csv

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');

// Walk program-data/ and collect every programs.json file found
function findProgramFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findProgramFiles(full));
    } else if (entry === 'programs.json') {
      results.push(full);
    }
  }
  return results;
}

// Wrap a cell value in quotes if it contains commas, quotes, or line breaks
function cell(val) {
  if (val == null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const HEADERS = [
  // Identity
  'Display Name',
  'Legal License Name',
  // Classification
  'Program Type',
  'Billing Code',
  // Key numbers (quantitative)
  'Licensed Capacity',
  'Minimum Age',
  // Geography
  'City',
  'County',
  'State',
  'Zip Code',
  'Latitude',
  'Longitude',
  // Accessibility
  'Languages Supported',
  'Facility Features',
  'Transportation',
  // Funding
  'Funding Source',
  'Administering Agency',
  'Vendor ID',
  'Required Document',
  // Contact
  'Phone',
  'Website',
  // Long text (useful for reference, less for analysis)
  'Coverage Note',
  'Program Focus',
  'AI Community Sentiment',
];

const files = findProgramFiles(join(ROOT, 'program-data'));

if (files.length === 0) {
  console.error('No programs.json files found in program-data/');
  process.exit(1);
}

const rows = [HEADERS];

for (const file of files.sort()) {
  const programs = JSON.parse(readFileSync(file, 'utf8'));
  for (const p of programs) {
    const f = p.facilityDetails;
    const fm = p.fundingMechanics;
    const loc = p.location;

    rows.push([
      p.streetName,
      p.legalLicenseName,
      f.decryptedProgramType,
      fm.stateBillingCode,
      f.licensedCapacity ?? '',
      f.minimumAge ?? '',
      loc.city,
      loc.county,
      loc.state,
      loc.zipCode,
      loc.coordinates?.lat ?? '',
      loc.coordinates?.lng ?? '',
      (f.languagesSupported ?? []).join('; '),
      (f.facilityFeatures ?? []).join('; '),
      fm.transportationAvailability ?? '',
      fm.fundingSourceCategory,
      fm.localAdministeringAgency,
      fm.vendorId ?? '',
      fm.requiredFundingDocument,
      p.contact.phone,
      p.contact.websiteUrl,
      fm.financialCoverageNote,
      f.programFocus,
      (p.qualitativeInsights?.parentReviews ?? []).join(' | '),
    ].map(cell).join(','));
  }
}

mkdirSync(join(ROOT, 'exports'), { recursive: true });
const outPath = join(ROOT, 'exports', 'programs.csv');
writeFileSync(outPath, rows.join('\n') + '\n');

console.log(`✓ Exported ${rows.length - 1} program(s) → exports/programs.csv`);
console.log(`  Sources: ${files.map(f => f.replace(ROOT + '/', '')).join(', ')}`);
