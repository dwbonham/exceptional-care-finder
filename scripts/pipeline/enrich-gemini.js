#!/usr/bin/env bun
// Gemini enrichment module — two-step web research per new CCLD program.
//
// Step 1 (enrichment): Google Search grounding to find display name, website,
//   phone, hours, parent org, languages, features, and program focus.
// Step 2 (sentiment): Google Search grounding to find 1–3 factual sentences
//   from public web sources (program website, news, state agency pages).
//   Explicitly skips Yelp and Google Reviews (ToS prohibits republishing).
//
// Rate limits (Gemini free tier): ~1,500 req/day, ~15 RPM.
// Two API calls per program → ~750 programs/day max.
// The first CA import (~969 programs) spans 2 days; weekly runs (5–20) fit easily.
// On a 429, this module throws RateLimitError so the orchestrator can save the
// checkpoint and stop the run gracefully.

// gemini-2.5-flash: confirmed working on this API key (20 RPD free tier).
// gemini-2.0-flash and gemini-2.0-flash-lite both return limit:0 on this project key.
const DEFAULT_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── Public error class ───────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor(message = 'Gemini rate limit reached') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich a new CCLD record with web-researched details.
 * Makes two Gemini API calls (enrichment + sentiment) and returns a combined result.
 *
 * Throws RateLimitError on HTTP 429 — caller should save checkpoint and stop the run.
 * Throws Error on other API failures.
 *
 * @param {import('./ingest-ccld.js').CcldRecord} ccldRecord
 * @param {string} apiKey  GEMINI_API_KEY
 * @param {{ model?: string, skipSentiment?: boolean }} [options]
 * @returns {Promise<EnrichmentResult>}
 */
export async function enrichProgram(ccldRecord, apiKey, options = {}) {
  const model = options.model ?? DEFAULT_MODEL;

  // ── Step 1: Enrichment ───────────────────────────────────────────────────
  const enrichPrompt = _buildEnrichmentPrompt(ccldRecord);
  const enrichRaw = await _callGemini(enrichPrompt, apiKey, model);
  const enrichJson = _extractJson(enrichRaw);
  const enrichData = _normalizeEnrichment(enrichJson, ccldRecord);

  if (options.skipSentiment) {
    return { ...enrichData, sentimentBullets: [], sentimentFlagged: false };
  }

  // ── Step 2: Sentiment ────────────────────────────────────────────────────
  const sentimentPrompt = _buildSentimentPrompt(ccldRecord, enrichData);
  const sentimentRaw = await _callGemini(sentimentPrompt, apiKey, model);
  const sentimentJson = _extractJson(sentimentRaw);
  const sentimentData = _normalizeSentiment(sentimentJson);

  return { ...enrichData, ...sentimentData };
}

/**
 * Calculate a 0–100 completeness score for an enriched program record.
 * Score ≥ 80 + at least 1 sentiment bullet → auto-approve in quality gate.
 *
 * Each field contributes a weighted point value; see weights below.
 */
export function calculateCompleteness(enrichResult) {
  // Field weights (total = 100 when all present)
  const checks = [
    [5,  !!enrichResult.streetName],
    [10, !!enrichResult.websiteUrl],
    [10, !!enrichResult.phone],
    [10, !!enrichResult.programFocus],
    [10, enrichResult.sentimentBullets?.length > 0],
    [8,  !!enrichResult.daysOfOperation],
    [8,  !!enrichResult.hoursOfOperation],
    [8,  enrichResult.languagesSupported?.length > 0],
    [8,  enrichResult.facilityFeatures?.length > 0],
    [8,  enrichResult.activitiesOffered?.length > 0],
    [7,  enrichResult.selfDeterminationAccepted !== 'Unknown'],
    [6,  enrichResult.populationSpecialization?.length > 0],
    [5,  !!enrichResult.parentOrganization],
    [5,  enrichResult.maximumAge != null],
    [4,  enrichResult.acceptsPrivatePay != null && enrichResult.acceptsPrivatePay !== 'Unknown'],
    [3,  enrichResult.yearEstablished != null],
  ];
  const score = checks.reduce((sum, [weight, present]) => sum + (present ? weight : 0), 0);
  return Math.min(100, score);
}

// ─── Prompt builders (exported for tests) ────────────────────────────────────

export function _buildEnrichmentPrompt(record) {
  const countyDisplay = record.county.replace(/ County$/i, '');
  return `You are a research assistant building a directory for parents seeking Adult Day Programs in California. These programs serve adults with developmental disabilities (autism, Down syndrome, intellectual disabilities) and are funded by regional centers.

Search the web to find current details about this licensed facility:
- Legal name: ${record.legalLicenseName}
- Address: ${record.address}, ${record.city}, CA ${record.zipCode}
- County: ${countyDisplay} County
- CCLD License #: ${record.ccldLicenseNumber}
- Licensed capacity: ${record.capacity ?? 'unknown'}

Return ONLY a JSON object with exactly these fields (no other text):
{
  "streetName": "Display name used on the program website or public materials (use legal name if identical or if not found)",
  "phone": "(XXX) XXX-XXXX format, or null",
  "websiteUrl": "URL starting with https://, or null",
  "parentOrganization": "Parent company or nonprofit (e.g. Sevita, Easterseals, ResCare/BrightSpring), or null if independent",
  "yearEstablished": null,
  "daysOfOperation": "e.g. Monday–Friday, or null",
  "hoursOfOperation": "e.g. 8:00am–3:00pm, or null",
  "languagesSupported": ["English"],
  "facilityFeatures": ["Wheelchair Accessible", "Outdoor Space", "Sensory Room", "Computer Lab", "Commercial Kitchen", "Vocational Workshop"],
  "activitiesOffered": ["Arts and Crafts", "Music Therapy", "Life Skills Training"],
  "selfDeterminationAccepted": "Yes or No or Unknown",
  "populationSpecialization": ["Autism", "Down Syndrome"],
  "maximumAge": null,
  "programFocus": "1–2 sentence description of what the program offers to participants",
  "acceptsPrivatePay": "Yes or No or Unknown",
  "transportationServiceArea": "Geographic area served by program transportation (e.g. 'Within 10 miles', 'Riverside County'), or null",
  "webPresenceFound": true,
  "servesDDPopulation": "Yes or No or Unknown"
}

Set webPresenceFound to false only if you cannot find ANY web presence for this program. Use null for fields you cannot confirm.

For servesDDPopulation: answer Yes if this program PRIMARILY serves adults with intellectual or developmental disabilities (autism, intellectual disability, cerebral palsy, Down syndrome, epilepsy, or closely related conditions) funded through a California Regional Center under the Lanterman Act. Answer No if it primarily serves seniors with dementia or Alzheimer's, adults with mental illness or substance use disorders, or medically frail elderly adults. Answer Unknown only if you genuinely cannot determine the primary population served.`;
}

export function _buildSentimentPrompt(record, enrichData) {
  const name = enrichData.streetName || record.legalLicenseName;
  const website = enrichData.websiteUrl || 'unknown';
  return `You are researching the reputation of a California Adult Day Program for a parent-facing directory.

Program: ${name}
Location: ${record.city}, ${record.county} County, CA
Website: ${website}
CCLD License: ${record.ccldLicenseNumber}

Search the web for factual information about this specific program from: the program's official website, local news, state agency pages, nonprofit directories, and parent advocacy forums.

DO NOT use Yelp, Google Maps reviews, or any review aggregator platform. Do not use user-submitted ratings.

Write 0–3 sentences suitable for parents researching the program. Each sentence must be under 150 characters and convey something useful: program specialty, history, accreditation, population focus, or community involvement.

Respond with ONLY this JSON (no other text):
{
  "bullets": ["Sentence 1.", "Sentence 2."],
  "sourcesFound": 2,
  "flaggedForReview": false
}

Set flaggedForReview to true and bullets to [] if you find fewer than 2 credible public sources about this specific program.`;
}

// ─── JSON extraction (exported for tests) ────────────────────────────────────

/**
 * Extract the first valid JSON object from a Gemini text response.
 * Handles responses wrapped in ```json ... ``` code fences or mixed with prose.
 * Returns null if no valid JSON object is found.
 */
export function _extractJson(text) {
  if (!text || typeof text !== 'string') return null;

  // Try stripping a markdown code block first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1]); } catch { /* fall through */ }
  }

  // Try finding the outermost {...} in the text
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
  }

  return null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _callGemini(prompt, apiKey, model) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.1 },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const body429 = await res.text();
    throw new RateLimitError(`Gemini rate limit reached (429): ${body429}`);
  }

  if (res.status === 503) {
    const body503 = await res.text();
    throw new RateLimitError(`Gemini unavailable (503) — will retry next run: ${body503}`);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error: HTTP ${res.status}\n${errBody}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message} (code ${data.error.code})`);
  }

  // Extract text from candidates[0].content.parts[0].text
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no text in response');
  return text;
}

function _normalizeEnrichment(json, ccldRecord) {
  const j = json ?? {};
  return {
    streetName:               _str(j.streetName)  || ccldRecord.legalLicenseName,
    phone:                    _str(j.phone)        || ccldRecord.phone,
    websiteUrl:               _str(j.websiteUrl),
    parentOrganization:       _str(j.parentOrganization),
    yearEstablished:          _posInt(j.yearEstablished),
    daysOfOperation:          _str(j.daysOfOperation),
    hoursOfOperation:         _str(j.hoursOfOperation),
    languagesSupported:       _strArray(j.languagesSupported),
    facilityFeatures:         _strArray(j.facilityFeatures),
    activitiesOffered:        _strArray(j.activitiesOffered),
    selfDeterminationAccepted: _selfDet(j.selfDeterminationAccepted),
    populationSpecialization: _strArray(j.populationSpecialization),
    maximumAge:               _posInt(j.maximumAge),
    programFocus:             _str(j.programFocus),
    acceptsPrivatePay:        _selfDet(j.acceptsPrivatePay),
    transportationServiceArea: _str(j.transportationServiceArea),
    webPresenceFound:         j.webPresenceFound !== false,
    servesDDPopulation:       _selfDet(j.servesDDPopulation),
    enrichParseError:         json === null,
  };
}

function _normalizeSentiment(json) {
  if (json === null) {
    return { sentimentBullets: [], sentimentFlagged: true, sentimentParseError: true };
  }
  return {
    sentimentBullets:   _strArray(json.bullets).slice(0, 3),
    sentimentFlagged:   json.flaggedForReview === true,
    sentimentParseError: false,
  };
}

// ── Coercion helpers ──────────────────────────────────────────────────────────

function _str(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

function _strArray(v) {
  if (!Array.isArray(v)) return [];
  return v.map(s => String(s).trim()).filter(Boolean);
}

function _selfDet(v) {
  if (v === 'Yes' || v === 'No') return v;
  return 'Unknown';
}

function _posInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ─── Types (JSDoc only) ───────────────────────────────────────────────────────
/**
 * @typedef {object} EnrichmentResult
 * @property {string} streetName
 * @property {string|null} phone
 * @property {string|null} websiteUrl
 * @property {string|null} parentOrganization
 * @property {number|null} yearEstablished
 * @property {string|null} daysOfOperation
 * @property {string|null} hoursOfOperation
 * @property {string[]} languagesSupported
 * @property {string[]} facilityFeatures
 * @property {string[]} activitiesOffered
 * @property {'Yes'|'No'|'Unknown'} selfDeterminationAccepted
 * @property {string[]} populationSpecialization
 * @property {number|null} maximumAge
 * @property {string|null} programFocus
 * @property {'Yes'|'No'|'Unknown'} acceptsPrivatePay
 * @property {string|null} transportationServiceArea
 * @property {boolean} webPresenceFound
 * @property {'Yes'|'No'|'Unknown'} servesDDPopulation
 * @property {boolean} enrichParseError
 * @property {string[]} sentimentBullets
 * @property {boolean} sentimentFlagged
 * @property {boolean} sentimentParseError
 */
