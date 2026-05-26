#!/usr/bin/env bun
// Pipeline orchestrator — runs Gemini enrichment on CCLD-only programs.
//
// Usage:
//   bun scripts/pipeline/pipeline.js
//
// Required env vars:
//   GEMINI_API_KEY              — Google AI Studio key
//   GOOGLE_MAPS_API_KEY         — Maps Geocoding API key (safety-net Phase 2-4 only)
//   GOOGLE_SHEET_ID             — Spreadsheet ID from the sheet URL
//   GOOGLE_SERVICE_ACCOUNT_PATH — Path to service account JSON key file
//
// CCLD ingest is handled by ccld-daily.yml / ccld-import.js (runs at 6am PT daily).
// This pipeline runs at 7am PT daily to Gemini-enrich programs discovered by ccld-daily.
// The script is idempotent: re-run after a rate-limit pause and it resumes from
// where it left off.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import {
  load, save, updateStatus, resetFailed,
  getPendingEnrichment, getPendingGeocode,
  getPendingQualityGate, completeRun, summary, STATUS,
  getNotGeminiEnriched, markGeminiEnriched,
  getNotSentimentEnriched, markSentimentEnriched,
} from './checkpoint.js';
import { enrichProgram, enrichSentimentOnly, RateLimitError } from './enrich-gemini.js';
import { resolveCoordinates, GeocodingError } from './geocode.js';
import { evaluate, DECISION } from './quality-gate.js';
import { upsertProgramRows, syncCountySummary } from './sheets-writer.js';

const ROOT = join(import.meta.dir, '..', '..');
const PROGRAM_DATA = join(ROOT, 'program-data');

// ─── Config ───────────────────────────────────────────────────────────────────

function loadConfig() {
  const missing = ['GEMINI_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_SHEET_ID', 'GOOGLE_SERVICE_ACCOUNT_PATH']
    .filter(k => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);

  return {
    geminiKey:      process.env.GEMINI_API_KEY,
    mapsKey:        process.env.GOOGLE_MAPS_API_KEY,
    sheetId:        process.env.GOOGLE_SHEET_ID,
    serviceAccount: JSON.parse(readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_PATH, 'utf8')),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const cfg = loadConfig();
let state = load();

const today = new Date().toISOString().slice(0, 10);

// Enrichment settings — parsed once, used by both Phase 2 and Phase 5.
// ENRICH_COUNTIES=butte,riverside limits Gemini calls to specific counties;
// non-matching programs get CCLD-only data now and Gemini enrichment later via Phase 5.
// WITH_SENTIMENT=1 enables the second sentiment API call (default off).
// IS_MANUAL_DISPATCH=true (set by pipeline.yml for workflow_dispatch events) bypasses
// AUTO_BACKFILL_CAP so a manual run always processes the full backlog.
const enrichCounties = process.env.ENRICH_COUNTIES
  ? new Set(process.env.ENRICH_COUNTIES.toLowerCase().split(',').map(c => c.trim()))
  : null;
const skipSentiment = !['1', 'true', 'yes'].includes((process.env.WITH_SENTIMENT ?? '').toLowerCase());
const isManualDispatch = process.env.IS_MANUAL_DISPATCH === 'true';

// QC counters — accumulated across all phases, printed in the summary box.
let enrichedCount = 0;
let sentimentCount = 0;
let sheetsRowsTotal = 0;
const enrichedCounties = new Set();

function _matchesCountyFilter(county) {
  if (!enrichCounties) return true;
  return [...enrichCounties].some(c => (county ?? '').toLowerCase().includes(c.replace(/-/g, ' ')));
}

// ── CCLD ingest is handled by ccld-daily workflow ─────────────────────────────
// This pipeline only handles Gemini enrichment (Phases 5+6).
// Phases 2-4 below are safety-net only for any PENDING* programs in checkpoint.

// Re-queue any failed programs so they're retried this run.
const { state: s0, resetCount } = resetFailed(state);
state = s0;
if (resetCount > 0) {
  console.log(`Retrying ${resetCount} previously failed programs`);
  save(state);
}

// ── Phase 2: Gemini enrichment (safety net) ──────────────────────────────────
// Safety net: handles programs stuck in PENDING_ENRICHMENT state.
// Normally a no-op when ccld-daily is running (which sets programs to PENDING_GEOCODE directly).
const toEnrich = getPendingEnrichment(state);
let enrichmentRateLimited = false;
if (toEnrich.length) {
  if (process.env.SKIP_ENRICHMENT === 'true') {
    // Bulk-import mode: skip Gemini entirely, use CCLD data only.
    // Programs are marked geminiEnriched=false so Phase 5 backfill picks them up on future runs.
    console.log(`\nSKIP_ENRICHMENT: moving ${toEnrich.length} programs to geocoding with CCLD data only…`);
    for (const licNum of toEnrich) {
      state = updateStatus(state, licNum, STATUS.PENDING_GEOCODE, {
        enrichResult: _buildBareEnrichResult(),
        geminiEnriched: false,
      });
    }
    save(state);
  } else {
    // When ENRICH_COUNTIES is set, non-matching programs get CCLD data now;
    // Phase 5 will Gemini-enrich them on future runs once the county filter is removed.
    const nonMatching = enrichCounties
      ? toEnrich.filter(licNum => !_matchesCountyFilter(state.programs[licNum].ccldRecord.county))
      : [];
    if (nonMatching.length > 0) {
      for (const licNum of nonMatching) {
        state = updateStatus(state, licNum, STATUS.PENDING_GEOCODE, {
          enrichResult: _buildBareEnrichResult(),
          geminiEnriched: false,
        });
      }
      save(state);
    }

    const toEnrichFiltered = enrichCounties
      ? toEnrich.filter(licNum => _matchesCountyFilter(state.programs[licNum].ccldRecord.county))
      : toEnrich;
    const skipNote = nonMatching.length > 0 ? ` (${nonMatching.length} non-matching counties deferred to Phase 5)` : '';
    console.log(`\nEnriching ${toEnrichFiltered.length} programs via Gemini${skipNote}…`);
    for (const licNum of toEnrichFiltered) {
      const ccldRecord = state.programs[licNum].ccldRecord;
      try {
        const enrichResult = await enrichProgram(ccldRecord, cfg.geminiKey, { skipSentiment });
        state = updateStatus(state, licNum, STATUS.PENDING_GEOCODE, { enrichResult, geminiEnriched: true, sentimentEnriched: !skipSentiment });
        process.stdout.write('.');
      } catch (e) {
        if (e instanceof RateLimitError) {
          save(state);
          console.log(`\nGemini quota reached — continuing to geocode/publish already-enriched programs.\nError: ${e.message}`);
          enrichmentRateLimited = true;
          break;
        }
        state = updateStatus(state, licNum, STATUS.ENRICHMENT_FAILED, { enrichError: e.message });
        const failCount = Object.values(state.programs).filter(p => p.status === STATUS.ENRICHMENT_FAILED).length;
        if (failCount <= 3) console.error(`\nEnrichment error #${failCount}: ${e.message}`);
        if (failCount === 4) console.error('(suppressing further enrichment errors — see checkpoint for details)');
        process.stdout.write('!');
      }
      save(state);
    }
    console.log();
  }
}

// ── Phase 3: Geocoding (safety net) ──────────────────────────────────────────
// Safety net: handles programs in PENDING_GEOCODE state missed by ccld-daily.
// Normally a no-op when ccld-daily is running.
const toGeocode = getPendingGeocode(state);
if (toGeocode.length) {
  console.log(`\nGeocoding ${toGeocode.length} programs…`);
  for (const licNum of toGeocode) {
    const { ccldRecord } = state.programs[licNum];
    try {
      const geocodeResult = await resolveCoordinates(ccldRecord, cfg.mapsKey);
      state = updateStatus(state, licNum, STATUS.PENDING_QUALITY_GATE, { geocodeResult });
      process.stdout.write(geocodeResult.source === 'ccld' ? '-' : '.');
    } catch (e) {
      if (e instanceof GeocodingError && (e.status === 'OVER_QUERY_LIMIT' || e.status === 'OVER_DAILY_LIMIT')) {
        save(state);
        console.log(`\nGeocoding quota reached — checkpoint saved.`);
        await syncCountySummary({ spreadsheetId: cfg.sheetId, serviceAccount: cfg.serviceAccount });
        process.exit(0);
      }
      state = updateStatus(state, licNum, STATUS.GEOCODE_FAILED, { geocodeError: e.message });
      process.stdout.write('!');
    }
    save(state);
  }
  console.log();
}

// ── Phase 4: Quality gate + routing (safety net) ─────────────────────────────
// Safety net: handles programs stuck in PENDING_QUALITY_GATE state.
// Normally a no-op when ccld-daily is running.
const toScore = getPendingQualityGate(state);
if (toScore.length) {
  console.log(`\nRunning quality gate on ${toScore.length} programs…`);
  let approved = 0, needsReview = 0;
  const sheetsConfig = { spreadsheetId: cfg.sheetId, sheetName: 'Programs', serviceAccount: cfg.serviceAccount };

  // Score all programs and write JSON files first (no network calls)
  const approvedGateResults = [];
  for (const licNum of toScore) {
    const prog = state.programs[licNum];
    const gateResult = evaluate(prog.ccldRecord, prog.enrichResult, prog.geocodeResult);

    if (gateResult.decision === DECISION.SKIP_REVOKED) {
      state = updateStatus(state, licNum, STATUS.SKIPPED_REVOKED);
      continue;
    }

    if (gateResult.decision === DECISION.SKIP_WRONG_POPULATION) {
      state = updateStatus(state, licNum, STATUS.SKIPPED_WRONG_POPULATION, { skipReason: gateResult.reasons[0] });
      console.log(`  ⚠ Wrong population: ${state.programs[licNum]?.ccldRecord?.legalLicenseName} (${licNum}) — excluded`);
      continue;
    }

    if (gateResult.decision === DECISION.APPROVED) {
      _writeApprovedProgram(gateResult.record);
      state = updateStatus(state, licNum, STATUS.APPROVED);
      approved++;
    } else {
      state = updateStatus(state, licNum, STATUS.FLAGGED_FOR_REVIEW);
      needsReview++;
    }
    approvedGateResults.push(gateResult);
  }
  save(state);

  // Upsert all programs to Sheets — updates existing rows if present, appends if new.
  // Keeps the sheet idempotent if Phase 4 ever re-runs the same programs.
  if (approvedGateResults.length > 0) {
    console.log(`  Syncing ${approvedGateResults.length} rows to Google Sheets…`);
    await upsertProgramRows(approvedGateResults, sheetsConfig);
    sheetsRowsTotal += approvedGateResults.length;
  }
  console.log(`  ${approved} auto-approved | ${needsReview} flagged for review | all mirrored to Sheets`);
}

// ── Phase 5: Gemini backfill enrichment ──────────────────────────────────────
// Enriches CCLD-only programs already published to the site by ccld-daily.
// Auto runs (no ENRICH_COUNTIES): capped at AUTO_BACKFILL_CAP to preserve quota for
// manual dispatches. Manual runs: unlimited — RateLimitError is the real stop.
//
// Env vars (optional):
//   ENRICH_COUNTIES=butte,riverside  — only process programs in these counties
//   WITH_SENTIMENT=1                 — include sentiment step (2 API calls/program vs 1)
// Automatic cron runs (no ENRICH_COUNTIES) are capped at 100 programs to
// preserve quota for manual dispatches. Manual workflow dispatches are unlimited
// regardless of ENRICH_COUNTIES — RateLimitError is the real stopping point.
const AUTO_BACKFILL_CAP = 100;

if (!process.env.SKIP_ENRICHMENT && !enrichmentRateLimited) {
  const allUnenriched = getNotGeminiEnriched(state);
  const toBackfill = enrichCounties
    ? allUnenriched.filter(licNum => _matchesCountyFilter(state.programs[licNum]?.ccldRecord?.county))
    : isManualDispatch
      ? allUnenriched
      : allUnenriched.slice(0, AUTO_BACKFILL_CAP);

  if (toBackfill.length) {
    const modeNote = enrichCounties
      ? `counties: ${[...enrichCounties].join(', ')}`
      : isManualDispatch
        ? `manual dispatch (no cap — ${allUnenriched.length} total queued)`
        : `auto (capped at ${AUTO_BACKFILL_CAP})`;
    const sentNote = skipSentiment ? 'no sentiment' : 'with sentiment';
    console.log(`\nGemini backfill: enriching ${toBackfill.length} program(s) (${modeNote}, ${sentNote})…`);
    const backfillGateResults = [];
    for (const licNum of toBackfill) {
      const { ccldRecord, geocodeResult } = state.programs[licNum];
      try {
        const enrichResult = await enrichProgram(ccldRecord, cfg.geminiKey, { skipSentiment });
        const gateResult = evaluate(ccldRecord, enrichResult, geocodeResult);
        if (gateResult.decision === DECISION.SKIP_WRONG_POPULATION) {
          state = updateStatus(state, licNum, STATUS.SKIPPED_WRONG_POPULATION, { skipReason: gateResult.reasons[0] });
          console.log(`\n  ⚠ Backfill wrong population: ${ccldRecord.legalLicenseName} (${licNum}) — removed from directory`);
          _removeWrongPopulationProgram(ccldRecord);
        } else {
          if (gateResult.decision === DECISION.APPROVED) {
            _writeApprovedProgram(gateResult.record);
            backfillGateResults.push(gateResult);
          }
          state = markGeminiEnriched(state, licNum, { enrichResult, sentimentEnriched: !skipSentiment });
          enrichedCount++;
          if (!skipSentiment) sentimentCount++;
          const county = (ccldRecord.county ?? '').toLowerCase().replace(/\s+/g, '-');
          enrichedCounties.add(county);
        }
        process.stdout.write('.');
      } catch (e) {
        if (e instanceof RateLimitError) {
          enrichmentRateLimited = true;
          console.log(`\nGemini quota reached during backfill — resuming tomorrow.\nAPI said: ${e.message}`);
          break;
        }
        // Non-quota error: log and continue; will retry tomorrow
        console.error(`\nBackfill error for ${licNum}: ${e.message}`);
        process.stdout.write('!');
      }
      save(state);
    }
    // Upsert enriched rows into Sheets — updates existing rows written by Phase 4
    // instead of appending duplicates. New rows (not yet in sheet) are appended.
    if (backfillGateResults.length > 0) {
      const sheetsConfig = { spreadsheetId: cfg.sheetId, sheetName: 'Programs', serviceAccount: cfg.serviceAccount };
      console.log(`\n  Upserting ${backfillGateResults.length} backfilled rows in Google Sheets…`);
      await upsertProgramRows(backfillGateResults, sheetsConfig);
      sheetsRowsTotal += backfillGateResults.length;
    }
    const remaining = getNotGeminiEnriched(state, 999999).length;
    console.log(`  Backfill: ${remaining} programs still queued for enrichment`);
  }
}

// ── Phase 6: Sentiment backfill ──────────────────────────────────────────────
// Adds sentiment bullets to programs already Gemini-enriched but missing them.
// One Gemini call per program (sentiment step only) — preserves existing enrichment
// data instead of re-running the full two-call enrichment.
//
// Only runs when WITH_SENTIMENT is set and ENRICH_COUNTIES is specified, so
// automated daily runs are never affected. Triggered by manual workflow dispatch
// with both flags set, targeting specific counties that lack sentiment coverage.
if (!skipSentiment && !enrichmentRateLimited && enrichCounties) {
  const toSentiment = getNotSentimentEnriched(state, { countyFilter: enrichCounties });

  if (toSentiment.length) {
    console.log(`\nSentiment backfill: ${toSentiment.length} program(s) (counties: ${[...enrichCounties].join(', ')})…`);
    const sentimentGateResults = [];

    for (const licNum of toSentiment) {
      const { ccldRecord, enrichResult, geocodeResult } = state.programs[licNum];
      if (!ccldRecord || !enrichResult) {
        console.error(`\nSentiment backfill: missing data for ${licNum} — skipping`);
        continue;
      }
      try {
        const mergedEnrich = await enrichSentimentOnly(ccldRecord, enrichResult, cfg.geminiKey);
        const gateResult = evaluate(ccldRecord, mergedEnrich, geocodeResult);
        if (gateResult.decision !== DECISION.SKIP_REVOKED && gateResult.decision !== DECISION.SKIP_WRONG_POPULATION) {
          _writeApprovedProgram(gateResult.record);
          sentimentGateResults.push(gateResult);
        }
        state = markSentimentEnriched(state, licNum, mergedEnrich);
        sentimentCount++;
        const sentCounty = (ccldRecord.county ?? '').toLowerCase().replace(/\s+/g, '-');
        enrichedCounties.add(sentCounty);
        process.stdout.write('.');
      } catch (e) {
        if (e instanceof RateLimitError) {
          enrichmentRateLimited = true;
          console.log(`\nGemini quota reached during sentiment backfill — resuming tomorrow.\nAPI said: ${e.message}`);
          break;
        }
        console.error(`\nSentiment backfill error for ${licNum}: ${e.message}`);
        process.stdout.write('!');
      }
      save(state);
    }
    console.log();

    if (sentimentGateResults.length > 0) {
      const sheetsConfig = { spreadsheetId: cfg.sheetId, sheetName: 'Programs', serviceAccount: cfg.serviceAccount };
      console.log(`  Upserting ${sentimentGateResults.length} sentiment-enriched rows in Google Sheets…`);
      await upsertProgramRows(sentimentGateResults, sheetsConfig);
      sheetsRowsTotal += sentimentGateResults.length;
    }
    const remaining = getNotSentimentEnriched(state, { countyFilter: enrichCounties }).length;
    console.log(`  Sentiment backfill: ${remaining} programs still need sentiment in these counties`);
  }
}

// ── Complete ──────────────────────────────────────────────────────────────────
const sheetsBase = { spreadsheetId: cfg.sheetId, serviceAccount: cfg.serviceAccount };

if (enrichmentRateLimited) {
  // Don't mark the run complete — it will resume tomorrow when quota resets
  console.log('\nPartial run complete (Gemini quota reached). Resuming tomorrow.');
  console.log('\nUpdating County Summary tab…');
  await syncCountySummary(sheetsBase);
  _printQcSummary(true);
  process.exit(0);
}

console.log('\nUpdating County Summary tab…');
await syncCountySummary(sheetsBase);

state = completeRun(state);
save(state);

_printQcSummary(false);

if (summary(state)[STATUS.APPROVED] > 0) {
  console.log('\nNext step: commit program-data/ changes and open a PR for review.');
  console.log('  git add program-data/ && git commit -m "pipeline: add new programs" && git push');
}

// ─── Helper: QC summary box ────────────────────────────────────────────────────

function _printQcSummary(partial) {
  const remaining = getNotGeminiEnriched(state, 999999).length;
  const countiesStr = enrichedCounties.size > 0
    ? [...enrichedCounties].sort().join(', ')
    : '(none this run)';
  const line = '━'.repeat(40);
  const title = partial
    ? `Gemini Enrichment Partial — ${today} (quota reached)`
    : `Gemini Enrichment Complete — ${today}`;
  console.log(`\n${line}`);
  console.log(title);
  console.log(line);
  console.log(`  Enriched this run:  ${enrichedCount}`);
  console.log(`  Sentiment added:    ${sentimentCount}`);
  console.log(`  Still queued:       ${remaining}`);
  console.log(`  Sheets rows:        ${sheetsRowsTotal}`);
  console.log(`  Counties enriched:  ${countiesStr}`);
  console.log(line);
}

// ─── Helper: bare enrichResult for SKIP_ENRICHMENT bulk imports ───────────────
// All fields null/empty so buildProgramRecord falls back to CCLD data.
// geminiEnriched=false flag signals Phase 5 to backfill this program later.

function _buildBareEnrichResult() {
  return {
    streetName:               null,
    phone:                    null,
    websiteUrl:               null,
    parentOrganization:       null,
    yearEstablished:          null,
    daysOfOperation:          null,
    hoursOfOperation:         null,
    languagesSupported:       [],
    facilityFeatures:         [],
    activitiesOffered:        [],
    selfDeterminationAccepted: 'Unknown',
    populationSpecialization: [],
    maximumAge:               null,
    programFocus:             null,
    acceptsPrivatePay:        'Unknown',
    transportationServiceArea: null,
    webPresenceFound:         false,
    servesDDPopulation:       'Unknown',
    enrichParseError:         false,
    sentimentBullets:         [],
    sentimentFlagged:         false,
    sentimentParseError:      false,
  };
}

// ─── Helper: remove a wrong-population program from its county JSON file ─────
// Called during Phase 5 backfill when Gemini determines a previously-written
// CCLD-only record doesn't serve the Lanterman Act population.

function _removeWrongPopulationProgram(ccldRecord) {
  const rawCounty = (ccldRecord.county ?? '').replace(/ County$/i, '').trim();
  const county = rawCounty.toLowerCase().replace(/\s+/g, '-');
  const file = join(PROGRAM_DATA, ccldRecord.state ?? 'CA', county, 'programs.json');

  if (!existsSync(file)) return;
  const existing = JSON.parse(readFileSync(file, 'utf8'));
  const filtered = existing.filter(p => p.ccldLicenseNumber !== ccldRecord.ccldLicenseNumber);
  if (filtered.length < existing.length) {
    writeFileSync(file, JSON.stringify(filtered, null, 2) + '\n');
  }
}

// ─── Helper: write approved program to county JSON file ──────────────────────

function _writeApprovedProgram(record) {
  const rawCounty = record.location.county.replace(/ County$/i, '').trim();
  const county = rawCounty.toLowerCase().replace(/\s+/g, '-');
  const dir = join(PROGRAM_DATA, record.location.state, county);
  const file = join(dir, 'programs.json');

  mkdirSync(dir, { recursive: true });

  const existing = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : [];

  // Deduplicate by ccldLicenseNumber (replace if already present from a previous run)
  const filtered = existing.filter(p => p.ccldLicenseNumber !== record.ccldLicenseNumber);
  writeFileSync(file, JSON.stringify([...filtered, record], null, 2) + '\n');
}
