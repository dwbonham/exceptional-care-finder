#!/usr/bin/env bun
// Shared file-I/O helpers for program JSON files.
// Both ccld-import.js and pipeline.js write and remove programs — this module
// eliminates the duplication so tests only need to mock one place.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_ROOT = join(import.meta.dir, '..', '..', 'program-data');

/**
 * Write an approved program record to its county JSON file.
 * Creates the directory if needed. Deduplicates by ccldLicenseNumber (upsert).
 *
 * @param {object} record          — ProgramData-shaped record from buildProgramRecord()
 * @param {string} [programDataRoot] — override for tests; defaults to program-data/
 */
export function writeApprovedProgram(record, programDataRoot = DEFAULT_ROOT) {
  const rawCounty = record.location.county.replace(/ County$/i, '').trim();
  const county = rawCounty.toLowerCase().replace(/\s+/g, '-');
  const dir = join(programDataRoot, record.location.state, county);
  const file = join(dir, 'programs.json');

  mkdirSync(dir, { recursive: true });

  const existing = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : [];

  const filtered = existing.filter(p => p.ccldLicenseNumber !== record.ccldLicenseNumber);
  writeFileSync(file, JSON.stringify([...filtered, record], null, 2) + '\n');
}

/**
 * Remove a program from its county JSON file.
 * No-op if the file doesn't exist or the program isn't in it.
 *
 * @param {object} ccldRecord      — record with at least { ccldLicenseNumber, county, state }
 * @param {string} [programDataRoot] — override for tests; defaults to program-data/
 */
export function removeProgram(ccldRecord, programDataRoot = DEFAULT_ROOT) {
  const rawCounty = (ccldRecord.county ?? '').replace(/ County$/i, '').trim();
  const county = rawCounty.toLowerCase().replace(/\s+/g, '-');
  const file = join(programDataRoot, ccldRecord.state ?? 'CA', county, 'programs.json');

  if (!existsSync(file)) return;
  const existing = JSON.parse(readFileSync(file, 'utf8'));
  const filtered = existing.filter(p => p.ccldLicenseNumber !== ccldRecord.ccldLicenseNumber);
  if (filtered.length < existing.length) {
    writeFileSync(file, JSON.stringify(filtered, null, 2) + '\n');
  }
}
