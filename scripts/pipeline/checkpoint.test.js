#!/usr/bin/env bun
// Run: bun scripts/pipeline/checkpoint.test.js

import {
  STATUS,
  load,
  save,
  addKnown,
  startRun,
  completeRun,
  updateStatus,
  resetFailed,
  hasPendingWork,
  getByStatus,
  getPendingEnrichment,
  getNotGeminiEnriched,
  markGeminiEnriched,
  getNotSentimentEnriched,
  markSentimentEnriched,
  summary,
} from './checkpoint.js';

import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const CHECKPOINT_FILE = join(import.meta.dir, 'checkpoint.json');
let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) {
    console.log(`  ✓ ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ ${desc}`);
    failed++;
  }
}

// Clean up any checkpoint from a previous test run
if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);

// ─── load() creates empty state when no file ─────────────────────────────────
console.log('\nload()');
let state = load();
assert('schemaVersion = 1', state.schemaVersion === 1);
assert('programs starts empty', Object.keys(state.programs).length === 0);
assert('runs starts empty', state.runs.length === 0);
assert('currentRunId is null', state.currentRunId === null);

// ─── save() + load() roundtrip ────────────────────────────────────────────────
console.log('\nsave() / load() roundtrip');
save(state);
assert('checkpoint.json created', existsSync(CHECKPOINT_FILE));
const reloaded = load();
assert('schemaVersion survives roundtrip', reloaded.schemaVersion === 1);

// ─── addKnown() ───────────────────────────────────────────────────────────────
console.log('\naddKnown()');
state = addKnown(state, ['111111', '222222']);
assert('two programs added', Object.keys(state.programs).length === 2);
assert('status = known', state.programs['111111'].status === STATUS.KNOWN);
assert('idempotent: re-adding same numbers changes nothing', (() => {
  const s2 = addKnown(state, ['111111']);
  return s2.programs['111111'].status === STATUS.KNOWN &&
    Object.keys(s2.programs).length === 2;
})());

// ─── startRun() ───────────────────────────────────────────────────────────────
console.log('\nstartRun()');
const { state: s2, newCount } = startRun(state, ['111111', '333333', '444444']);
assert('newCount = 2 (111111 already known)', newCount === 2);
assert('333333 added as pending_enrichment', s2.programs['333333'].status === STATUS.PENDING_ENRICHMENT);
assert('111111 still known (not overwritten)', s2.programs['111111'].status === STATUS.KNOWN);
assert('run recorded', s2.runs.length === 1);
assert('currentRunId set', s2.currentRunId !== null);
state = s2;

// ─── hasPendingWork() ─────────────────────────────────────────────────────────
console.log('\nhasPendingWork()');
assert('true when programs are pending', hasPendingWork(state));

// ─── updateStatus() ───────────────────────────────────────────────────────────
console.log('\nupdateStatus()');
state = updateStatus(state, '333333', STATUS.PENDING_GEOCODE, { enrichedData: { name: 'Test Ctr' } });
assert('status updated', state.programs['333333'].status === STATUS.PENDING_GEOCODE);
assert('data attached', state.programs['333333'].enrichedData?.name === 'Test Ctr');
assert('timestamp key set', typeof state.programs['333333'].pendingGeocodeAt === 'string');

state = updateStatus(state, '444444', STATUS.ENRICHMENT_FAILED, { error: 'rate limited' });
assert('444444 marked failed', state.programs['444444'].status === STATUS.ENRICHMENT_FAILED);

// ─── resetFailed() ────────────────────────────────────────────────────────────
console.log('\nresetFailed()');
const { state: s3, resetCount } = resetFailed(state);
assert('resetCount = 1', resetCount === 1);
assert('444444 back to pending_enrichment', s3.programs['444444'].status === STATUS.PENDING_ENRICHMENT);
assert('333333 (geocode stage) not affected', s3.programs['333333'].status === STATUS.PENDING_GEOCODE);
state = s3;

// ─── getByStatus() / getPendingEnrichment() ───────────────────────────────────
console.log('\ngetByStatus()');
assert('getPendingEnrichment returns [444444]', (() => {
  const nums = getPendingEnrichment(state);
  return nums.length === 1 && nums[0] === '444444';
})());
assert('getByStatus KNOWN returns [111111, 222222]', (() => {
  const nums = getByStatus(state, STATUS.KNOWN).sort();
  return nums[0] === '111111' && nums[1] === '222222' && nums.length === 2;
})());

// ─── summary() ────────────────────────────────────────────────────────────────
console.log('\nsummary()');
const counts = summary(state);
assert('known = 2', counts[STATUS.KNOWN] === 2);
assert('pending_enrichment = 1', counts[STATUS.PENDING_ENRICHMENT] === 1);
assert('pending_geocode = 1', counts[STATUS.PENDING_GEOCODE] === 1);
assert('published = 0', counts[STATUS.PUBLISHED] === 0);

// ─── completeRun() ────────────────────────────────────────────────────────────
console.log('\ncompleteRun()');
const allApproved = updateStatus(
  updateStatus(state, '333333', STATUS.APPROVED),
  '444444', STATUS.APPROVED
);
const completed = completeRun(allApproved);
assert('currentRunId cleared', completed.currentRunId === null);
assert('run has completedAt', typeof completed.runs[0].completedAt === 'string');
assert('hasPendingWork = false after completing', !hasPendingWork(completed));

// ─── getNotGeminiEnriched() + markGeminiEnriched() ───────────────────────────
console.log('\ngetNotGeminiEnriched() + markGeminiEnriched()');

// Build a state with 3 APPROVED programs: 2 needing backfill, 1 already enriched
const approvedBase = updateStatus(
  updateStatus(
    updateStatus(completed, 'aaa111', STATUS.APPROVED, { ccldRecord: { dummy: 1 }, geminiEnriched: false }),
    'aaa222', STATUS.APPROVED, { ccldRecord: { dummy: 2 }, geminiEnriched: false }
  ),
  'aaa333', STATUS.APPROVED, { ccldRecord: { dummy: 3 }, geminiEnriched: true }
);

const backfillList = getNotGeminiEnriched(approvedBase);
assert('returns programs with geminiEnriched=false', backfillList.length === 2);
assert('excludes already-enriched program', !backfillList.includes('aaa333'));
assert('includes aaa111', backfillList.includes('aaa111'));
assert('includes aaa222', backfillList.includes('aaa222'));

const limited = getNotGeminiEnriched(approvedBase, 1);
assert('limit=1 returns exactly 1', limited.length === 1);

// markGeminiEnriched updates the flag and stores the enrichResult
const fakeEnrichResult = { streetName: 'Test Center', phone: '(555) 000-0001' };
const afterMark = markGeminiEnriched(approvedBase, 'aaa111', { enrichResult: fakeEnrichResult });
assert('geminiEnriched set to true after mark', afterMark.programs['aaa111'].geminiEnriched === true);
assert('enrichResult stored', afterMark.programs['aaa111'].enrichResult.streetName === 'Test Center');
assert('other programs unchanged', afterMark.programs['aaa222'].geminiEnriched === false);

const afterBothMarked = markGeminiEnriched(afterMark, 'aaa222', { enrichResult: fakeEnrichResult });
assert('no backfill remaining after both marked', getNotGeminiEnriched(afterBothMarked).length === 0);

// Programs without ccldRecord should not appear in backfill queue
const noCcld = updateStatus(completed, 'noccld1', STATUS.APPROVED, { geminiEnriched: false });
assert('programs without ccldRecord excluded from backfill', getNotGeminiEnriched(noCcld).length === 0);

// PENDING_ENRICHMENT programs should not appear even if geminiEnriched=false
const pending = updateStatus(completed, 'pend1', STATUS.PENDING_ENRICHMENT, {
  ccldRecord: { dummy: 1 }, geminiEnriched: false
});
assert('PENDING_ENRICHMENT programs not in backfill queue', getNotGeminiEnriched(pending).length === 0);

// ─── getNotSentimentEnriched() + markSentimentEnriched() ─────────────────────
// Build a clean base with two programs that have full ccldRecord (including county)
// so county filter tests work correctly.
let sentimentBase = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  lastUpdated: new Date().toISOString(),
  currentRunId: null,
  programs: {},
  runs: [],
};
sentimentBase = updateStatus(sentimentBase, 'snt111', STATUS.APPROVED, {
  ccldRecord: { county: 'Riverside', legalLicenseName: 'A' },
  geminiEnriched: true,
  sentimentEnriched: false,
  enrichResult: { streetName: 'A', sentimentBullets: [] },
  geocodeResult: { lat: 33.9, lng: -117.3, source: 'google' },
});
sentimentBase = updateStatus(sentimentBase, 'snt222', STATUS.APPROVED, {
  ccldRecord: { county: 'Riverside', legalLicenseName: 'B' },
  geminiEnriched: true,
  sentimentEnriched: true,
  enrichResult: { streetName: 'B', sentimentBullets: ['Great program'] },
  geocodeResult: { lat: 33.9, lng: -117.3, source: 'google' },
});
sentimentBase = updateStatus(sentimentBase, 'snt333', STATUS.APPROVED, {
  ccldRecord: { county: 'Los Angeles', legalLicenseName: 'C' },
  geminiEnriched: true,
  sentimentEnriched: false,
  enrichResult: { streetName: 'C', sentimentBullets: [] },
  geocodeResult: { lat: 34.0, lng: -118.2, source: 'google' },
});

assert('getNotSentimentEnriched returns programs missing sentiment', getNotSentimentEnriched(sentimentBase).length === 2);
assert('getNotSentimentEnriched excludes already-sentiment-enriched', !getNotSentimentEnriched(sentimentBase).includes('snt222'));
assert('getNotSentimentEnriched includes snt111', getNotSentimentEnriched(sentimentBase).includes('snt111'));
assert('getNotSentimentEnriched includes snt333', getNotSentimentEnriched(sentimentBase).includes('snt333'));

// County filter — exact match (no hyphen)
const filteredRiverside = getNotSentimentEnriched(sentimentBase, { countyFilter: new Set(['riverside']) });
assert('county filter matches programs in county', filteredRiverside.length === 1);
assert('county filter returns correct program', filteredRiverside[0] === 'snt111');

// County filter — hyphen normalization (folder name vs CCLD name)
const filteredLA = getNotSentimentEnriched(sentimentBase, { countyFilter: new Set(['los-angeles']) });
assert('county filter hyphen-normalizes to match CCLD county name', filteredLA.length === 1);
assert('county filter with hyphen returns correct program', filteredLA[0] === 'snt333');

const filteredNoMatch = getNotSentimentEnriched(sentimentBase, { countyFilter: new Set(['san-diego']) });
assert('county filter excludes non-matching programs', filteredNoMatch.length === 0);

// markSentimentEnriched stores the merged enrichResult in checkpoint
const mergedEnrich = { streetName: 'A', sentimentBullets: ['Staff is wonderful'] };
const afterSentiment = markSentimentEnriched(sentimentBase, 'snt111', mergedEnrich);
assert('sentimentEnriched set to true', afterSentiment.programs['snt111'].sentimentEnriched === true);
assert('merged enrichResult stored in checkpoint', afterSentiment.programs['snt111'].enrichResult.sentimentBullets[0] === 'Staff is wonderful');
assert('other programs unaffected by markSentimentEnriched', afterSentiment.programs['snt333'].sentimentEnriched === false);

// Programs with existing sentimentBullets in enrichResult are excluded even without sentimentEnriched flag
const withBullets = updateStatus(sentimentBase, 'snt111', STATUS.APPROVED, {
  ccldRecord: { county: 'Riverside', legalLicenseName: 'A' },
  geminiEnriched: true,
  sentimentEnriched: false,
  enrichResult: { streetName: 'A', sentimentBullets: ['Already has this'] },
  geocodeResult: { lat: 33.9, lng: -117.3, source: 'google' },
});
assert('programs with existing bullets excluded from sentiment queue', !getNotSentimentEnriched(withBullets).includes('snt111'));

// ─── Cleanup ──────────────────────────────────────────────────────────────────
if (existsSync(CHECKPOINT_FILE)) unlinkSync(CHECKPOINT_FILE);

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
