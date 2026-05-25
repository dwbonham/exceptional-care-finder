# Exceptional Care Finder

A free, public web directory helping families find state-funded Adult Day Programs for adults with developmental disabilities. Covers **53 of 58 California counties** (~935 active programs) via a fully automated weekly data pipeline.

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

The site is a React SPA deployed on GitHub Pages. It updates automatically every time the pipeline merges a PR — no manual publishing step.

---

## The Automated Data Pipeline

Expanding to all of California (~969 programs) required a fully automated pipeline rather than manual data entry. The pipeline runs on a weekly schedule with no human involvement for programs that meet the quality bar.

### Pipeline Flow

```
GitHub Actions (weekly cron — Monday 6am PT + catch-up Tue–Sun)
        │
        ▼
1. CCLD Ingest
   Data source: CA Community Care Licensing (CCLD) ArcGIS FeatureServer
   Portal: https://gis.data.chhs.ca.gov
   Dataset: CKAN ID 3c2fc34a-8517-4938-b3ee-992af04cd6b7
   API: services.arcgis.com/.../CDSS_CCL_Facilities/FeatureServer/0/query

   Fetches all records where TYPE = 775 ("Adult Day Care"). This filter
   is critical — type 775 is a broad CCLD category that includes
   DDS-funded DD programs, senior/dementia ADHC programs, and mental
   health IOPs. The Gemini servesDDPopulation field (Step 2) is the
   second filter that removes non-DD programs before they reach the site.

   Diffs the new download against the checkpoint using CCLD License
   Number as the primary key. Only new or status-changed programs
   advance to enrichment. Revoked programs are removed immediately.
        │
        ▼
2. Gemini API — Program Enrichment
   Model: gemini-2.5-flash | Temp: 0.1 | Tool: Google Search grounding

   Prompt identifies the program as serving adults with developmental
   disabilities funded by California Regional Centers. Passes the
   legal name, address, county, license number, and licensed capacity.

   Returns structured JSON:
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
   entirely. "Unknown" passes through (publish what we know). This catches
   senior dementia centers and mental health IOPs that share the type 775
   license code but are the wrong program type for this directory.
        │
        ▼
3. Gemini API — Community Sentiment (manual runs only)
   Model: gemini-2.5-flash | Temp: 0.1 | Tool: Google Search grounding
   Only runs when WITH_SENTIMENT=1 (manual workflow dispatch).

   Prompt passes the program name, city/county, website, and license
   number. Instructs Gemini to search: program's official website,
   local news, state agency pages, nonprofit directories, and parent
   advocacy forums. Yelp, Google Maps, and review aggregators are
   explicitly excluded — their ToS prohibits automated republication.

   Returns structured JSON:
   {
     "bullets": ["Sentence 1.", "Sentence 2.", "Sentence 3."],
     "sourcesFound": 2,
     "flaggedForReview": false
   }

   Each sentence must be under 150 characters and convey something
   useful: program specialty, population focus, history, accreditation,
   or community involvement. flaggedForReview is set to true (and
   bullets to []) if fewer than 2 credible public sources are found —
   preventing fabricated content from reaching the site.
        │
        ▼
4. Auto-Geocoding
   Converts each program's street address to lat/lng using the
   Google Maps Geocoding API. Uses CCLD's built-in FAC_LATITUDE /
   FAC_LONGITUDE fields first — a Google Maps API call is only made
   when those are missing or outside California bounds. Stored in the
   program record for the map view.
        │
        ▼
5. Quality Gate
   Each program is scored on completeness (0–100%) across all fields.
   Score ≥ 80% AND ≥ 1 sentiment bullet → auto-approved.
   Below threshold → written to Google Sheets as "Needs Review."
        │
        ▼
6. Google Sheets — Full Mirror + County Summary
   ALL programs (not just flagged ones) are upserted to a Google
   Sheet via CCLD License Number lookup. This mirrors the full
   dataset for audit queries: "show every LA County program missing
   a phone number," "which counties have < 50% enrichment," etc.
   A County Summary tab is rebuilt on every run with per-county
   enrichment stats.
        │
        ▼
7. Commit + Pull Request
   Approved records are written to program-data/ JSON files,
   committed to pipeline/weekly-update, and a PR is opened.
   Merging triggers the deploy workflow — site updates automatically.
```

### Resumption Logic

The pipeline uses a checkpoint file (persisted via GitHub Actions cache) to track which CCLD license numbers have already been enriched. Catch-up cron jobs run Tuesday–Sunday — each run picks up where the previous one stopped. A Gemini rate limit (429) or service unavailability (503) both trigger an early exit that saves the checkpoint before stopping, so no work is lost.

At ~25 programs per automated run (Gemini quota), the initial CA import took several weeks of daily runs. Weekly ongoing runs process only 5–20 new programs and stay well within limits.

---

## Key Design Decisions

These are the choices that had real tradeoffs.

**Upsert over append for Google Sheets writes**
The original implementation used `values.append`, which always adds new rows. When the pipeline re-ran on the same dataset (after a quota pause, or during a backfill), it created duplicate rows — one CCLD-only row from Phase 4 and one enriched row from Phase 5 for the same program. The fix was `upsertProgramRows`: on each write, read column F to build a license-number-to-row-index map, then update existing rows in place and only append truly new ones. This made both phases fully idempotent and eliminated ~1,000 duplicate rows from the initial import.

**503 treated as an early exit, not a warning**
When Gemini returns 503 (service unavailable), the original code logged an error and continued. This meant a pipeline run during a Gemini outage would log an error for every one of the ~500 queued programs, burn all GitHub Actions minutes, and produce zero enrichment. The fix: treat 503 identically to 429 (rate limit) — throw `RateLimitError`, save the checkpoint, and exit. The next scheduled run retries cleanly.

**Sentiment excluded from automated daily runs**
The automated cron doesn't pass `WITH_SENTIMENT`, so the second Gemini call (which finds factual sentences from public sources) is skipped. This keeps automated runs fast and cheap. The tradeoff: programs enriched by the automated run have no sentiment bullets unless manually re-enriched. For large new counties, a manual workflow dispatch with sentiment checked is used. Programs are marked done in the checkpoint after enrichment, so they won't be re-processed automatically — sentiment is a one-time, manual-trigger operation for bulk imports.

**Quality gate at 80%, not 100%**
A 100% threshold would flag most programs because some fields (like `hoursOfOperation`) are genuinely hard to find for small programs with no web presence. 80% catches real data gaps while auto-approving the majority. Result: a small, meaningful review queue rather than a large noisy one.

**Google Sheets as a full mirror, not just an exceptions layer**
Originally the plan was to only write flagged programs to Sheets. The final design mirrors the entire dataset. This turns the Sheet into an audit dashboard — pivot by county, filter by completeness score, find programs missing phone numbers — without touching JSON files. The County Summary tab (rebuilt on every run) gives a quick per-county view of enrichment progress.

**CCLD License Number as the dedup key**
Program names and addresses change (rebrands, moves). The CCLD License Number is a stable, state-assigned identifier. Using it as the primary key means a renamed program is correctly treated as an update, not a new program.

**Program cards only show fields with content**
AI summary boxes are hidden when no `programFocus` exists (743 of ~935 programs are still unenriched). Population specialization, hours, days, and parent organization only render when the data is present. No empty boxes or placeholder text — a card with no enrichment shows only what the state database provides.

**Weekly PR review, not direct-to-main**
The pipeline commits to a branch and opens a PR rather than pushing directly to main. This keeps a human in the loop for a 2-minute sanity check and makes rollback trivial. Direct-to-main can be enabled once trust is established.

---

## What This Project Demonstrates

| Skill | Where it shows up |
|-------|-------------------|
| **Data pipeline design** | Multi-stage ETL: ingest → enrich → geocode → quality gate → write |
| **API integration** | Gemini (Google Search grounding), Google Maps Geocoding, Google Sheets |
| **Data quality engineering** | Completeness scoring, deduplication, quality gate with tiered routing |
| **Idempotent / resumable systems** | Checkpoint + upsert pattern for multi-day runs across quota limits |
| **Ops tooling** | County Summary tab, full-mirror Sheets audit layer, graceful quota handling |
| **Automation and scheduling** | GitHub Actions cron, catch-up runs, branch-and-PR deploy pattern |
| **Schema design** | TypeScript interfaces; all new fields optional so existing JSON stays valid |
| **Frontend development** | React + TypeScript SPA, Leaflet map, filter state management |
| **CI/CD** | GitHub Actions deploy pipeline; zero-touch publishing on merge |
| **Working with public datasets** | California CCLD open data portal, CKAN-based CSV, license type filtering |

---

## Current Status

| Component | Status |
|-----------|--------|
| React app | Live — ~935 programs, 53 CA counties |
| Automated pipeline | Running — weekly cron + manual dispatch for large counties |
| LA County enrichment | In progress (manual run with sentiment) |
| Google Sheets mirror | Live — County Summary tab updated on every run |
| GitHub Actions workflow | Complete — deploy + pipeline both configured |

---

## Tools and APIs

| Tool / API | Purpose |
|------------|---------|
| **React + TypeScript** | Web app framework with strict type safety |
| **Tailwind CSS v4** | Utility-first styling; no config file |
| **Leaflet / OpenStreetMap** | Interactive map — no API key required |
| **Vite + Bun** | Build tooling and package management |
| **GitHub Pages** | Free static site hosting |
| **GitHub Actions** | Weekly pipeline cron + automatic site deploy on merge |
| **CCLD Open Data Portal** | California licensing database — primary data source |
| **Gemini 2.5 Flash (Google AI)** | Web enrichment and sentiment research; ~25 programs/day on free tier |
| **Google Maps Geocoding API** | Address → lat/lng coordinates |
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
│   ├── pipeline.js              ← Orchestrator
│   ├── ingest-ccld.js           ← CCLD download, filter, diff
│   ├── enrich-gemini.js         ← Gemini enrichment + sentiment
│   ├── geocode.js               ← Google Maps geocoding
│   ├── quality-gate.js          ← Completeness scoring and routing
│   ├── sheets-writer.js         ← Sheets upsert, County Summary sync
│   └── checkpoint.js            ← Idempotent state tracking
│
└── src/                         ← React app source
    ├── components/              ← UI components
    ├── data/                    ← Auto-discovers program-data/ via import.meta.glob
    └── types/index.ts           ← TypeScript interfaces for all data structures
```
