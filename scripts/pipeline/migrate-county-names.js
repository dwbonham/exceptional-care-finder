#!/usr/bin/env bun
// One-time migration: normalize county directory names and location.county fields.
//
// Problem: CCLD data inconsistently names counties — some records say "Riverside",
// others "Riverside County". The pipeline created parallel directories:
//   program-data/CA/riverside/        (county = "Riverside")
//   program-data/CA/riverside-county/ (county = "Riverside County")
//
// Fix: merge *-county dirs into their base counterpart, normalize all
// location.county fields to the short form (strip " County" suffix).
// Run once, then delete this script.

import { readFileSync, writeFileSync, existsSync, readdirSync, rmSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';

const CA_DIR = join(import.meta.dir, '..', '..', 'program-data', 'CA');

function normalizeCounty(county) {
  if (!county) return county;
  // Special case: CCLD had "City and of San Francisco" (garbled "City and County of SF")
  if (county.toLowerCase().includes('city and')) return 'San Francisco';
  return county.replace(/ County$/i, '').trim();
}

function targetDir(srcDir) {
  if (srcDir === 'city-and-of-san-francisco') return 'san-francisco';
  return srcDir.replace(/-county$/, '');
}

const allDirs = readdirSync(CA_DIR).filter(d => statSync(join(CA_DIR, d)).isDirectory());

// Dirs that need to move: *-county variants and the garbled SF directory
const sourceDirs = allDirs.filter(d => d.endsWith('-county') || d === 'city-and-of-san-francisco');

let merged = 0, renamed = 0, programsMoved = 0;

for (const srcDir of sourceDirs) {
  const srcFile = join(CA_DIR, srcDir, 'programs.json');
  if (!existsSync(srcFile)) continue;

  const srcPrograms = JSON.parse(readFileSync(srcFile, 'utf8'));
  const dest = targetDir(srcDir);
  const destDir = join(CA_DIR, dest);
  const destFile = join(destDir, 'programs.json');

  // Normalize county field in source programs
  const normalizedSrc = srcPrograms.map(p => ({
    ...p,
    location: { ...p.location, county: normalizeCounty(p.location.county) },
  }));

  if (existsSync(destFile)) {
    // Merge: combine dest + normalized src, dedup by ccldLicenseNumber
    const destPrograms = JSON.parse(readFileSync(destFile, 'utf8'));
    const normalizedDest = destPrograms.map(p => ({
      ...p,
      location: { ...p.location, county: normalizeCounty(p.location.county) },
    }));

    const licNums = new Set(normalizedDest.map(p => p.ccldLicenseNumber).filter(Boolean));
    const toAdd = normalizedSrc.filter(p => !p.ccldLicenseNumber || !licNums.has(p.ccldLicenseNumber));
    const combined = [...normalizedDest, ...toAdd];

    writeFileSync(destFile, JSON.stringify(combined, null, 2) + '\n');
    console.log(`  merged ${normalizedSrc.length} programs from ${srcDir} → ${dest} (total: ${combined.length})`);
    merged++;
  } else {
    // Orphan -county dir (no base counterpart): just create as the normalized name
    mkdirSync(destDir, { recursive: true });
    writeFileSync(destFile, JSON.stringify(normalizedSrc, null, 2) + '\n');
    console.log(`  renamed ${srcDir} → ${dest} (${normalizedSrc.length} programs)`);
    renamed++;
  }

  programsMoved += normalizedSrc.length;

  // Remove the source directory entirely
  rmSync(join(CA_DIR, srcDir), { recursive: true });
}

// Normalize location.county in all remaining base dirs (they may have stale values too)
let baseFixed = 0;
const remainingDirs = readdirSync(CA_DIR).filter(d => statSync(join(CA_DIR, d)).isDirectory());
for (const dir of remainingDirs) {
  const file = join(CA_DIR, dir, 'programs.json');
  if (!existsSync(file)) continue;

  const programs = JSON.parse(readFileSync(file, 'utf8'));
  const needsFix = programs.some(p => p.location?.county !== normalizeCounty(p.location?.county));
  if (!needsFix) continue;

  const updated = programs.map(p => ({
    ...p,
    location: { ...p.location, county: normalizeCounty(p.location.county) },
  }));
  writeFileSync(file, JSON.stringify(updated, null, 2) + '\n');
  baseFixed++;
}

console.log(`\nDone.`);
console.log(`  ${merged} county pairs merged`);
console.log(`  ${renamed} orphan -county dirs renamed`);
console.log(`  ${programsMoved} programs moved/normalized`);
console.log(`  ${baseFixed} base dirs with county field updated`);
console.log(`\nCounty dirs after migration:`);
readdirSync(CA_DIR).filter(d => statSync(join(CA_DIR, d)).isDirectory()).sort().forEach(d => {
  const f = join(CA_DIR, d, 'programs.json');
  const count = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')).length : 0;
  console.log(`  ${d}: ${count} programs`);
});
