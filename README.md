# Exceptional Care Finder

A free, public web directory helping families find state-funded Adult Day Programs for adults with developmental disabilities. Covers **53 of 58 California counties** (~935 active programs) via a fully automated daily data pipeline.

**Live site:** https://dwbonham.github.io/exceptional-care-finder/

---

## The Problem This Solves

Parents of adults with autism, cerebral palsy, intellectual disabilities, and epilepsy are entitled to free, state-funded day programs through California's Regional Center system — but finding those programs is surprisingly hard. The state licensing database lists ~969 facilities but provides no search, no map, and no way to filter by funding type or population served. Families end up calling programs one by one, often not knowing which ones accept their funding source or how to start the process.

This project takes that raw state licensing data and turns it into a searchable, filterable, family-friendly directory — with clear funding information, population-specific filtering, AI-researched program summaries, and a map — all for free.

---

## What the App Does

Families use the site to:

- **Find licensed programs** near them, filtered by state, county, and care type
- **Filter by who the program serves** — population specialization badges (Autism, Down Syndrome, etc.) appear on every enriched card
- **Understand the funding system** — how Regional Centers work, what an IPP is, how to get started
- **See schedule and logistics** — hours, days, transportation area, languages supported
- **Read AI-researched program summaries** sourced from public web pages, news, and parent forums
- **Contact programs directly** — phone, website, and map directions on every card

The site is a React SPA deployed on GitHub Pages. It updates automatically every time a pipeline commit lands on main — no manual publishing step.

---

## The Automated Data Pipeline

Two separate GitHub Actions workflows run daily on a coordinated schedule. They share a checkpoint file (via GitHub Actions cache) so state is consistent across both.

### Workflow 1 — Daily CCLD Import (6am PT, free)

```
GitHub Actions: ccld-daily.yml — runs daily at 6am PT
        │
        ▼
1. CCLD Ingest + Diff
   Data source: CA Community Care Licensing (CCLD) ArcGIS FeatureServer
   Portal: https://gis.data.chhs.ca.gov
   Dataset: CKAN ID 3c2fc34a-8517-4938-b3ee-992af04cd6b7
   API: services.arcgis.com/.../CDSS_CCL_Facilities/FeatureServer/0/query

   Fetches all records where TYPE = 775 ("Adult Day Care"). Diffs against
   the checkpoint using CCLD License Number as the primary key.
   - New programs → enqueue for geocoding
   - Programs gone inactive → removed from site immediately
   - No Gemini API key required; this step is entirely free.
        │
        ▼
2. Geocoding
   Resolves lat/lng for each new program. Uses CCLD's built-in
   FAC_LATITUDE / FAC_LONGITUDE fields first (no API cost). Falls back
   to Google Maps Geocoding API only when CCLD coords are missing or
   outside California bounds (~5% of programs).
        │
        ▼
3. Quality Gate
   Inactive or revoked programs → removed, never shown on site.
   Programs Gemini later confirms don't serve DD population → removed.
   All Active programs → approved and published immediately.
        │
        ▼
4. Publish + Sheets Sync
   Approved records written to program-data/CA/{county}/programs.json.
   All programs upserted to the Google Sheets Programs tab.
   County Summary tab rebuilt with per-county enrichment stats.
   Committed directly to main — site deploys automatically.

   New programs are tagged geminiEnriched=false so Workflow 2 picks
   them up for AI enrichment on the next run.
```

### Workflow 2 — Daily Gemini Enrichment (7am PT, quota-limited)

```
GitHub Actions: pipeline.yml — runs daily at 7am PT (1 hour after Workflow 1)
        │
        ▼
5. Gemini API — Program Enrichment (backfill)
   Model: gemini-2.5-flash | Temp: 0.1 | Tool: Google Search grounding

   Enriches programs tagged geminiEnriched=false (published by Workflow 1
   with CCLD-only data). Automated runs process up to 100 programs to
   preserve quota. Manual workflow dispatch processes the full backlog.

   Prompt identifies the program as serving adults with developmental
   disabilities funded by California Regional Centers. Returns structured JSON:
   {
     streetName, phone, websiteUrl, parentOrganization, yearEstablished,
     daysOfOperation, hoursOfOperation,
     languagesSupported: [],
     facilityFeatures: ["Wheelchair Accessible", "Sensory Room", ...],
     activitiesOffered: ["Music Therapy", "Life Skills Training", ...],
     selfDeterminationAccepted: "Yes|No|Unknown",
     populationSpecialization: ["Autism", "Down Syndrome", ...],
     maximumAge, programFocus,
     acceptsPrivatePay: "Yes|No|Unknown",
     transportationServiceArea,
     webPresenceFound: true/false,
     servesDDPopulation: "Yes|No|Unknown"
   }

   servesDDPopulation is the population filter: "No" removes the program
   from JSON files and marks its Sheet row as excluded. "Unknown" passes
   through. This catches senior dementia centers and mental health IOPs
   that share the type 775 license code but are the wrong program type
   for this directory.
        │
        ▼
6. Gemini API — Community Sentiment (manual runs with WITH_SENTIMENT=1)
   Model: gemini-2.5-flash | Temp: 0.1 | Tool: Google Search grounding

   Searches: program's official website, local news, state agency pages,
   nonprofit directories, and parent advocacy forums. Yelp, Google Maps,
   and review aggregators are explicitly excluded — their ToS prohibits
   automated republication.

   Returns 0–3 factual sentences per program (each under 150 characters)
   about the program's specialty, population focus, history, or
   accreditation. flaggedForReview=true (empty bullets) when fewer than 2
   credible public sources are found — preventing fabricated content.
        │
        ▼
7. Commit + Pull Request
   Enriched records written to program-data/ JSON files, committed to
   pipeline/weekly-update branch, PR opened for review.
   Merging triggers the deploy workflow — site updates automatically.
```

### Shared Infrastructure

**Checkpoint file** (`scripts/pipeline/checkpoint.json`) persisted via GitHub Actions cache (`pipeline-checkpoint-` key). Both workflows read and write this file. The 1-hour gap between workflows plus a shared concurrency group (`group: pipeline, cancel-in-progress: false`) ensures Workflow 1 always completes before Workflow 2 starts.

**Quota handling**: A Gemini rate limit (429) or service unavailability (503) both trigger an early exit that saves the checkpoint before stopping. The next scheduled run resumes exactly where the previous one stopped.

**Automated cap**: Workflow 2 automated cron is capped at 100 programs/run to preserve quota for manual dispatches. A manual workflow dispatch processes the full backlog — the real stopping point is Gemini quota exhaustion.

---

## Key Design Decisions

These are the choices that had real tradeoffs.

**Two separate pipelines, not one**
The original single pipeline tried to do CCLD ingest and Gemini enrichment in one run. This caused Gemini quota to interfere with CCLD ingest — if quota was exhausted early, new programs weren't published to the site at all. Splitting into two workflows makes CCLD ingest free and daily (no Gemini dependency), while Gemini enrichment runs in a separate window with quota management. CCLD ingest never fails due to Gemini limits.

**CCLD import commits directly to main; Gemini enrichment opens a PR**
CCLD ingest (adding/removing programs based on state licensing data) is objective and fully automated — no human review needed. Gemini enrichment (AI-generated descriptions, population filters, sentiment bullets) benefits from a 2-minute sanity check before publishing. The split means the site stays current on license changes daily, while AI-generated content gets reviewed before it goes live.

**Upsert over append for Google Sheets writes**
The original implementation used `values.append`, which always adds new rows. When the pipeline re-ran (after a quota pause, or during backfill), it created duplicate rows — one CCLD-only row from the daily import and one enriched row from the Gemini backfill for the same program. The fix was `upsertProgramRows`: read column F to build a license-number-to-row-index map, update existing rows in place, append only truly new ones. Fully idempotent regardless of how many times a program is processed.

**503 treated as an early exit, not a warning**
When Gemini returns 503 (service unavailable), the original code logged an error and continued. This meant a pipeline run during a Gemini outage would log an error for every queued program, burn all GitHub Actions minutes, and produce zero enrichment. The fix: treat 503 identically to 429 — throw `RateLimitError`, save the checkpoint, exit. The next scheduled run retries cleanly.

**Sentiment excluded from automated daily runs**
The automated cron skips the second Gemini call (sentiment research). This keeps automated runs fast and within quota. For large new counties, a manual workflow dispatch with `WITH_SENTIMENT=1` is used. Programs are marked done in the checkpoint after enrichment — sentiment is a one-time, manually-triggered operation for bulk imports.

**Quality gate: active license = published**
All programs with an Active CCLD license are published to the site. Completeness score and notes appear in Google Sheets for audit purposes, but nothing blocks publication. The only hard exclusions are: non-Active license (removed automatically) and Gemini explicitly confirming the program doesn't serve the DD/Lanterman Act population. The rationale: a family can call a program with limited enrichment data; they can't call a program we didn't include.

**Google Sheets as a full mirror, not just an exceptions layer**
The entire dataset is mirrored to Sheets. This turns the Sheet into an audit dashboard — pivot by county, filter by completeness score, find programs missing phone numbers — without touching JSON files. The County Summary tab (rebuilt on every run) gives a quick per-county view of enrichment progress.

**CCLD License Number as the dedup key**
Program names and addresses change (rebrands, moves). The CCLD License Number is a stable, state-assigned identifier. Using it as the primary key means a renamed program is correctly treated as an update, not a new program — and the pipeline never creates duplicate entries.

---

## What This Project Demonstrates

| Skill | Where it shows up |
|-------|-------------------|
| **Data pipeline design** | Two-stage ETL: daily free ingest + quota-managed AI enrichment |
| **API integration** | Gemini (Google Search grounding), Google Maps Geocoding, Google Sheets |
| **Data quality engineering** | Completeness scoring, deduplication, population filter via LLM |
| **Idempotent / resumable systems** | Checkpoint + upsert pattern for multi-day runs across quota limits |
| **Ops tooling** | County Summary tab, full-mirror Sheets audit layer, graceful quota handling |
| **Automation and scheduling** | GitHub Actions daily cron, coordinated two-workflow architecture |
| **Schema design** | TypeScript interfaces; all new fields optional so existing JSON stays valid |
| **Frontend development** | React + TypeScript SPA, Leaflet map, filter state management |
| **CI/CD** | GitHub Actions deploy pipeline; zero-touch publishing on merge |
| **Working with public datasets** | California CCLD open data portal, ArcGIS FeatureServer, license type filtering |

---

## Current Status

| Component | Status |
|-----------|--------|
| React app | Live — ~935 programs, 53 CA counties |
| Daily CCLD import | Running — 6am PT daily, commits directly to main |
| Daily Gemini enrichment | Running — 7am PT daily, opens PR for review |
| LA County enrichment | Pending manual run with sentiment (~184 programs) |
| Google Sheets mirror | Live — County Summary tab updated on every run |
| Backlog | ~500 programs queued for Gemini enrichment |

---

## Tools and APIs

| Tool / API | Purpose |
|------------|---------|
| **React + TypeScript** | Web app framework with strict type safety |
| **Tailwind CSS v4** | Utility-first styling; no config file |
| **Leaflet / OpenStreetMap** | Interactive map — no API key required |
| **Vite + Bun** | Build tooling and package management |
| **GitHub Pages** | Free static site hosting |
| **GitHub Actions** | Two daily pipeline workflows + automatic site deploy on merge |
| **CCLD Open Data Portal** | California licensing database — primary data source |
| **Gemini 2.5 Flash (Google AI)** | Web enrichment and sentiment research; paid tier removes RPD cap |
| **Google Maps Geocoding API** | Address → lat/lng coordinates (CCLD coords used first; API fallback only) |
| **Google Sheets API** | Full-dataset mirror, audit layer, County Summary tab |

---

## Folder Guide

```
exceptional-care-finder/
│
├── README.md                    ← You are here
├── CLAUDE.md                    ← Technical architecture for Claude Code sessions
├── TODOS.md                     ← Deferred work items with context
│
├── program-data/                ← All program data (not in src/)
│   └── CA/
│       ├── funding-guide.json   ← RC contacts, FAQs, parent education content
│       └── [county]/            ← One folder per county; auto-discovered
│           └── programs.json
│
├── scripts/pipeline/            ← Automated pipeline modules
│   ├── ccld-import.js           ← Daily CCLD ingest orchestrator (Workflow 1)
│   ├── pipeline.js              ← Gemini enrichment orchestrator (Workflow 2)
│   ├── ingest-ccld.js           ← CCLD API fetch, filter, diff
│   ├── enrich-gemini.js         ← Gemini enrichment + sentiment
│   ├── geocode.js               ← Google Maps geocoding (fallback only)
│   ├── quality-gate.js          ← Population filter and record assembly
│   ├── sheets-writer.js         ← Sheets upsert, County Summary sync
│   └── checkpoint.js            ← Shared idempotent state tracking
│
└── src/                         ← React app source
    ├── components/              ← UI components
    ├── data/                    ← Auto-discovers program-data/ via import.meta.glob
    └── types/index.ts           ← TypeScript interfaces for all data structures
```
