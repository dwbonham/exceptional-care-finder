#!/usr/bin/env bun
// Checkpoint module — persistent pipeline state across interrupted runs.
//
// WHY: Gemini free tier caps at 1,500 req/day. The first CA import processes
// 500–1,000 programs over 2 days. Without a checkpoint, a crash or rate-limit
// pause means re-processing everything from scratch and burning through the quota.
//
// State is stored in checkpoint.json next to this file. The pipeline reads it
// at startup, works through pending programs, and saves after each stage.
// The Tuesday–Friday catch-up crons call hasPendingWork() and exit early if
// there's nothing left from the previous day's run.

import { readFileSync, writeFileSync, existsSync, renameSync } from 'fs';
import { join } from 'path';

const CHECKPOINT_FILE = join(import.meta.dir, 'checkpoint.json');
const SCHEMA_VERSION = 1;

// ─── Status values ────────────────────────────────────────────────────────────
// Programs move forward through these stages. Failed stages stay put so the
// next run can retry them without re-processing already-completed stages.

export const STATUS = {
  KNOWN: 'known',                           // already in our JSON; skip entirely
  PENDING_ENRICHMENT: 'pending_enrichment', // new from CCLD; awaiting Gemini step 2
  ENRICHMENT_FAILED: 'enrichment_failed',   // Gemini failed; retry next run
  PENDING_GEOCODE: 'pending_geocode',       // enriched; awaiting geocoding
  GEOCODE_FAILED: 'geocode_failed',         // geocoding failed; retry next run
  PENDING_QUALITY_GATE: 'pending_quality_gate', // geocoded; awaiting scoring
  APPROVED: 'approved',                     // score ≥ 80%; included in weekly PR
  FLAGGED_FOR_REVIEW: 'flagged_for_review', // score < 80%; written to Google Sheet
  PUBLISHED: 'published',                   // PR merged; permanently in the site
  SKIPPED_REVOKED: 'skipped_revoked',       // CCLD licenseStatus = Revoked; excluded
};

// Stages that represent unfinished work (used by catch-up crons)
const PENDING_STATUSES = new Set([
  STATUS.PENDING_ENRICHMENT,
  STATUS.ENRICHMENT_FAILED,
  STATUS.PENDING_GEOCODE,
  STATUS.GEOCODE_FAILED,
  STATUS.PENDING_QUALITY_GATE,
]);

// ─── Load / Save ──────────────────────────────────────────────────────────────

/** Load checkpoint from disk. Returns empty state if the file doesn't exist yet. */
export function load() {
  if (!existsSync(CHECKPOINT_FILE)) {
    return _emptyState();
  }
  const raw = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Checkpoint schema mismatch: file is v${raw.schemaVersion}, code expects v${SCHEMA_VERSION}. ` +
      `Manual migration required.`
    );
  }
  return raw;
}

/**
 * Save checkpoint atomically (write to .tmp then rename) so a crash mid-write
 * can't leave the file in a corrupt state.
 */
export function save(state) {
  const tmp = CHECKPOINT_FILE + '.tmp';
  const updated = { ...state, lastUpdated: new Date().toISOString() };
  writeFileSync(tmp, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  renameSync(tmp, CHECKPOINT_FILE);
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

/**
 * Mark pre-existing license numbers as KNOWN so the pipeline skips them.
 * Call this once before the first run (see TODOS.md T1) with the CCLD numbers
 * for the 4 existing Riverside programs.
 *
 * Safe to call repeatedly — already-tracked numbers are left unchanged.
 */
export function addKnown(state, licenseNumbers) {
  const programs = { ...state.programs };
  const now = new Date().toISOString();
  let added = 0;

  for (const num of licenseNumbers) {
    if (!programs[num]) {
      programs[num] = { status: STATUS.KNOWN, addedAt: now };
      added++;
    }
  }

  return { ...state, programs, _bootstrapNote: `${added} new, ${licenseNumbers.length - added} already tracked` };
}

// ─── Run lifecycle ────────────────────────────────────────────────────────────

/**
 * Register a new batch of CCLD license numbers as pending enrichment.
 * Only numbers not already tracked are added — this is the diff step.
 * Returns { state, newCount } so the caller can log how many are genuinely new.
 */
export function startRun(state, allCcldLicenseNumbers) {
  const runId = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const now = new Date().toISOString();
  const programs = { ...state.programs };
  let newCount = 0;

  for (const num of allCcldLicenseNumbers) {
    if (!programs[num]) {
      programs[num] = { status: STATUS.PENDING_ENRICHMENT, discoveredAt: now, runId };
      newCount++;
    }
  }

  const run = { runId, startedAt: now, completedAt: null, newCount };
  const runs = [...state.runs, run];

  return {
    state: { ...state, currentRunId: runId, programs, runs },
    newCount,
  };
}

/** Mark the current run as complete (call after the PR is opened or when nothing was found). */
export function completeRun(state) {
  const runs = state.runs.map(r =>
    r.runId === state.currentRunId
      ? { ...r, completedAt: new Date().toISOString() }
      : r
  );
  return { ...state, currentRunId: null, runs };
}

// ─── Per-program state ────────────────────────────────────────────────────────

/**
 * Update a single program's status and attach optional stage data.
 * The `data` object is merged into the program record — use it to store
 * enrichment results, geocoords, quality scores, etc.
 */
export function updateStatus(state, licenseNumber, status, data = {}) {
  const existing = state.programs[licenseNumber] ?? {};
  const timestampKey = _statusTimestampKey(status);
  return {
    ...state,
    programs: {
      ...state.programs,
      [licenseNumber]: {
        ...existing,
        ...data,
        status,
        [timestampKey]: new Date().toISOString(),
      },
    },
  };
}

/**
 * Reset failed programs back to their retry-able pending status.
 * Call at the start of each run to retry yesterday's failures.
 */
export function resetFailed(state) {
  const programs = { ...state.programs };
  let count = 0;

  for (const [num, prog] of Object.entries(programs)) {
    if (prog.status === STATUS.ENRICHMENT_FAILED) {
      programs[num] = { ...prog, status: STATUS.PENDING_ENRICHMENT };
      count++;
    } else if (prog.status === STATUS.GEOCODE_FAILED) {
      programs[num] = { ...prog, status: STATUS.PENDING_GEOCODE };
      count++;
    }
  }

  return { state: { ...state, programs }, resetCount: count };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** True if the pipeline has work to continue (used by catch-up crons to skip unnecessary runs). */
export function hasPendingWork(state) {
  return Object.values(state.programs).some(p => PENDING_STATUSES.has(p.status));
}

/** All license numbers in a given status. */
export function getByStatus(state, status) {
  return Object.entries(state.programs)
    .filter(([, prog]) => prog.status === status)
    .map(([num]) => num);
}

/** Shorthand for the two enrichment stages. */
export function getPendingEnrichment(state) {
  return getByStatus(state, STATUS.PENDING_ENRICHMENT);
}

/** Shorthand for the geocode stage. */
export function getPendingGeocode(state) {
  return getByStatus(state, STATUS.PENDING_GEOCODE);
}

/** Shorthand for the quality gate stage. */
export function getPendingQualityGate(state) {
  return getByStatus(state, STATUS.PENDING_QUALITY_GATE);
}

/** Count of programs in each status — useful for logging and health checks. */
export function summary(state) {
  const counts = Object.fromEntries(Object.values(STATUS).map(s => [s, 0]));
  for (const prog of Object.values(state.programs)) {
    counts[prog.status] = (counts[prog.status] ?? 0) + 1;
  }
  return counts;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _emptyState() {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    lastUpdated: now,
    currentRunId: null,
    programs: {},
    runs: [],
  };
}

// Converts a STATUS value to a camelCase timestamp key stored on the program record.
// e.g. 'pending_geocode' → 'pendingGeocodeAt', 'approved' → 'approvedAt'
function _statusTimestampKey(status) {
  const camel = status.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return camel + 'At';
}
