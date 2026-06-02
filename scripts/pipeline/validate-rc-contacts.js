#!/usr/bin/env node
/**
 * Validates Regional Center phone numbers in funding-guide.json against
 * the official DDS RC listings page (https://www.dds.ca.gov/rc/listings/).
 *
 * Exit 0 — all phone numbers match the DDS listings
 * Exit 1 — mismatches found (report printed to stdout)
 * Exit 2 — DDS page unreachable or parse failed (skip and warn)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const GUIDE_PATH = join(__dir, '..', '..', 'program-data', 'CA', 'funding-guide.json');
const DDS_URL = 'https://www.dds.ca.gov/rc/listings/';
const MIN_RC_COUNT = 15; // if we parse fewer than this, the page structure changed

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '')
    .trim();
}

function normalizePhone(raw) {
  return raw.replace(/\D/g, '');
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/regional center/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function phoneDisplay(digits) {
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

async function fetchDDSPhones() {
  const res = await fetch(DDS_URL, {
    headers: { 'User-Agent': 'exceptional-care-finder-validator/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const phones = new Map(); // normName → { name, phone }

  // The DDS listings page renders one card per RC, each starting at an rc-logo image.
  // Split on that marker so each chunk contains exactly one RC's info.
  const sections = html.split(/<img[^>]+class="rc-logo"[^>]*>/i);

  for (const section of sections.slice(1)) {
    // RC name is in the first anchor containing "Regional Center"
    const nameMatch = section.match(/>\s*([^<]*Regional Center[^<]*?)\s*<\/a>/i);
    // Primary phone is the first <strong>Phone:</strong> paragraph
    const phoneMatch = section.match(/<strong>Phone:<\/strong>\s*([\d-]+)/i);

    if (nameMatch && phoneMatch) {
      const name = nameMatch[1].replace(/\s+/g, ' ').trim();
      const phone = normalizePhone(phoneMatch[1]);
      if (phone.length === 10) {
        phones.set(normalizeName(name), { name, phone });
      }
    }
  }

  return phones;
}

function findMatch(ddsPhones, agencyName) {
  const norm = normalizeName(agencyName);

  // Exact normalized match
  if (ddsPhones.has(norm)) return ddsPhones.get(norm);

  // One normalized name contains the other (handles minor word differences)
  for (const [key, val] of ddsPhones) {
    if (key.includes(norm) || norm.includes(key)) return val;
    // Two or more significant words in common
    const keyWords = new Set(key.split(' ').filter(w => w.length > 3));
    const overlap = norm.split(' ').filter(w => w.length > 3 && keyWords.has(w));
    if (overlap.length >= 2) return val;
  }

  return null;
}

async function main() {
  const guide = JSON.parse(readFileSync(GUIDE_PATH, 'utf8'));
  const agencies = guide.localAgencies;

  let ddsPhones;
  try {
    ddsPhones = await fetchDDSPhones();
  } catch (err) {
    console.warn(`WARNING: Could not fetch DDS RC listings page: ${err.message}`);
    console.warn(`Verify manually: ${DDS_URL}`);
    process.exit(2);
  }

  if (ddsPhones.size < MIN_RC_COUNT) {
    console.warn(`WARNING: Only ${ddsPhones.size} RCs parsed from DDS page (expected ≥${MIN_RC_COUNT}).`);
    console.warn('Page structure may have changed. Verify manually:', DDS_URL);
    process.exit(2);
  }

  const mismatches = [];
  const unmatched = [];

  for (const agency of agencies) {
    const match = findMatch(ddsPhones, agency.name);
    if (!match) {
      unmatched.push(agency.name);
      continue;
    }
    if (normalizePhone(agency.phone) !== match.phone) {
      mismatches.push({
        name: agency.name,
        ours: agency.phone,
        dds: phoneDisplay(match.phone),
        ddsName: match.name,
      });
    }
  }

  if (mismatches.length === 0 && unmatched.length === 0) {
    console.log(`✓ All ${agencies.length} Regional Center phone numbers match the DDS official listings.`);
    process.exit(0);
  }

  if (mismatches.length > 0) {
    console.log(`${mismatches.length} phone number mismatch(es) found:\n`);
    for (const m of mismatches) {
      console.log(`  ${m.name}`);
      if (m.ddsName !== m.name) console.log(`    (matched DDS name: "${m.ddsName}")`);
      console.log(`    Ours: ${m.ours}`);
      console.log(`    DDS:  ${m.dds}\n`);
    }
  }

  if (unmatched.length > 0) {
    console.log(`${unmatched.length} RC(s) could not be matched to a DDS listing (check for name changes):`);
    for (const name of unmatched) console.log(`  - ${name}`);
    console.log(`\nVerify at: ${DDS_URL}`);
  }

  process.exit(1);
}

main().catch(err => {
  console.error('Validation script error:', err.message);
  process.exit(2);
});
