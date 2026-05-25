#!/usr/bin/env bun
// Audit all stored website URLs across program-data/ and null out any that are
// unreachable (4xx / 5xx / timeout). Writes updated JSON files in place.
//
// Run locally or via GitHub Actions:
//   bun scripts/pipeline/audit-website-urls.js
//
// Safe to re-run — only modifies programs whose URL check fails.
// Note: soft 404s (server returns 200 for missing pages) are not caught here.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { checkUrl } from './enrich-gemini.js';

function findProgramFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      const f = join(full, 'programs.json');
      try { statSync(f); results.push(f); } catch {}
    }
  }
  return results.sort();
}

const PROGRAM_DATA = join(import.meta.dir, '..', '..', 'program-data');

const files = findProgramFiles(join(PROGRAM_DATA, 'CA'));

let checked = 0;
let dead = 0;
let alive = 0;
let skipped = 0;

for (const file of files) {
  const programs = JSON.parse(readFileSync(file, 'utf8'));
  let changed = false;

  for (const p of programs) {
    const url = p.contact?.websiteUrl;
    if (!url) { skipped++; continue; }

    process.stdout.write(`  Checking ${p.legalLicenseName}: ${url} … `);
    const ok = await checkUrl(url);
    checked++;

    if (ok) {
      console.log('✓');
      alive++;
    } else {
      console.log('✗ dead — clearing');
      p.contact.websiteUrl = '';
      dead++;
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(file, JSON.stringify(programs, null, 2) + '\n');
  }
}

console.log(`\nDone.`);
console.log(`  Checked: ${checked}`);
console.log(`  Alive:   ${alive}`);
console.log(`  Dead:    ${dead} (URL cleared)`);
console.log(`  No URL:  ${skipped}`);
