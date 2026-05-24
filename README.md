# Exceptional Care Finder

A free, public web directory helping families find state-funded day programs for adults with developmental disabilities. Currently covers Riverside County, CA — expanding to all of California via a fully automated weekly data pipeline.

**Live site:** https://dwbonham.github.io/exceptional-care-finder/

---

## The Problem This Solves

Parents of adults with autism, cerebral palsy, intellectual disabilities, and epilepsy are entitled to free, state-funded day programs through California's Regional Center system — but finding those programs is surprisingly hard. The state licensing database lists thousands of facilities but provides no search, no map, and no way to filter by funding type. Families end up calling programs one by one, often not knowing which ones accept their funding source or how to start the process.

This project takes that raw state licensing data and turns it into a searchable, filterable, family-friendly directory — with clear funding information, AI-summarized community feedback, and a map — all for free.

---

## What the App Does

Families use the site to:

- **Find licensed programs** near them, filtered by state, county, and care type
- **Understand funding** — which programs are eligible for 100% state coverage through their Regional Center, what documents they need, and who administers payments
- **Read AI-aggregated community sentiment** pulled from public web sources (program websites, news, parent forums)
- **Get everything in one place** — contact info, program focus, licensed capacity, languages supported, facility features, and a map with directions

The site is a React single-page application deployed on GitHub Pages. It updates automatically every time the underlying data changes — no manual publishing step required.

---

## The Automated Data Pipeline

Expanding to all of California (~500–1,000 programs across 21 regional centers) required building a fully automated pipeline rather than entering programs by hand. The pipeline runs on a weekly schedule with no human involvement for programs that meet the quality bar.

### Pipeline Flow

```
GitHub Actions (weekly cron — Monday 6am PT)
        │
        ▼
1. CCLD Ingest
   Downloads the California Community Care Licensing (CCLD) database
   from the state's public data portal (data.chhs.ca.gov).
   Filters to "Adult Day Program" license type only — this is a critical
   distinction from "Adult Day Health Care," which is a different program
   with different funding that serves a different population.
   Diffs new download against the current registry using CCLD License Number
   as the primary key — only new or changed programs move forward.
        │ New / changed programs found
        ▼
2. Gemini API — Program Enrichment
   For each new program, calls Gemini with Google Search grounding to
   research: display name, phone number, website, hours, languages
   supported, facility features, and parent organization.
   Returns structured JSON that maps directly to the data schema.
        │
        ▼
3. Gemini API — Community Sentiment Research
   Second Gemini call per program, again with Google Search grounding.
   Searches public web sources only: program websites, news articles,
   state agency pages, and parent forums.
   Yelp and Google Reviews are explicitly excluded (ToS prohibits
   automated access and republication).
   Returns up to 3 AI-written sentiment bullets.
   Programs with no discoverable web presence are flagged for manual
   review rather than published with empty sentiment.
        │
        ▼
4. Auto-Geocoding
   Converts each program's street address to latitude/longitude
   coordinates using the Google Maps Geocoding API. Coordinates are
   stored in the program record and used by the map on the site.
        │
        ▼
5. Quality Gate
   Each program is scored on completeness (0–100%) across all fields.
   Score ≥ 80% AND at least 1 sentiment bullet → auto-approved, moves
   directly to publish.
   Score below threshold → written to the Google Sheets staging layer
   as "Needs Review" for a quick human check before publishing.
        │ Approved records
        ▼
6. Google Sheets — Staging and Audit Layer
   The pipeline also reads Google Sheets for any rows Doug has manually
   marked "Approved" from a prior review session. These are folded into
   the same publish batch.
   Separately, ALL programs (not just flagged ones) are mirrored to the
   Sheet as a full audit view — useful for data quality queries like
   "show me every LA County program with no phone number."
        │
        ▼
7. Commit and Open a Pull Request
   Approved records are written to the program-data/ JSON files,
   committed to the pipeline/weekly-update branch, and a GitHub PR is
   opened for review. Merging the PR triggers the existing deploy
   workflow — the site updates automatically.
```

### Resumption Logic

The free tier of the Gemini API allows 1,500 requests per day. A full first-run import of all CA programs (500–1,000) takes more than one day. The pipeline uses a checkpoint file (persisted via GitHub Actions cache) to track which CCLD license numbers have already been enriched. Catch-up cron jobs run Tuesday–Friday — each run picks up where the previous one stopped. Once enrichment is complete, weekly runs process only 5–20 new programs and stay well within the daily limit.

---

## Key Design Decisions

These are the choices that had real tradeoffs — the kind of decisions that come up in engineering conversations.

**Quality gate at 80% completeness, not 100%**
A strict 100% threshold would flag most programs for review because some fields (like `hoursOfOperation`) are genuinely hard to find online. 80% catches programs with real data gaps while auto-approving the majority. The result: a small, meaningful review queue rather than a large noisy one.

**Google Sheets as a full mirror, not just an exceptions layer**
The original plan was to only write flagged programs to Sheets. After thinking through how the data would be used, the decision was made to mirror everything. This turns the Sheet into an audit dashboard: you can pivot by county, filter by completeness score, find all programs missing a phone number, or track enrichment status across the whole dataset — without touching JSON files.

**Inactive licenses stay on the site; Revoked licenses are filtered out**
California programs sometimes go temporarily inactive during license renewals. Filtering them out entirely would cause good programs to disappear for weeks at a time. The approach: Inactive programs show an amber warning banner ("Verify availability before visiting"). Revoked licenses are filtered out of results entirely — those programs have been shut down.

**CCLD License Number as the deduplication key**
Program names and addresses can change (a program moves, a parent org rebrands). The CCLD License Number is a stable, state-assigned identifier that never changes for a given facility. Using it as the primary key means the pipeline correctly identifies a renamed program as an update rather than a new program.

**Weekly PR review, not direct-to-main**
The pipeline commits to a branch and opens a PR rather than pushing directly to main. This keeps a human in the loop for a fast sanity check (2 minutes to scan the diff) and makes rollback trivial — close the PR. Direct-to-main can be enabled once trust in the pipeline is established.

---

## What This Project Demonstrates

| Skill | Where it shows up |
|-------|-------------------|
| **Data pipeline design** | Multi-stage ETL: ingest → enrich → geocode → quality gate → write |
| **API integration** | Gemini (with Google Search grounding), Google Maps Geocoding, Google Sheets |
| **Data quality engineering** | Completeness scoring, deduplication, quality gate with tiered routing |
| **Idempotent / resumable systems** | Checkpoint file design for multi-day first-run across API rate limits |
| **Automation and scheduling** | GitHub Actions cron, branch-and-PR deploy pattern, catch-up runs |
| **Schema design** | TypeScript interfaces supporting multi-RC programs (one program, multiple Regional Centers) |
| **Testing** | 85 unit tests covering CCLD type filter, dedup/diff logic, quality gate scoring, checkpoint idempotency |
| **Frontend development** | React + TypeScript SPA, Leaflet map, filter state management |
| **CI/CD** | GitHub Actions deploy pipeline; zero-touch publishing on merge |
| **Working with public datasets** | California CCLD open data portal, CKAN-based CSV download, license type filtering |

---

## Current Status

| Component | Status |
|-----------|--------|
| React app (Riverside County, 4 programs) | Live at https://dwbonham.github.io/exceptional-care-finder/ |
| TypeScript schema (pipeline-ready fields) | Complete |
| Pipeline modules (ingest, enrich, geocode, quality gate, sheets) | Complete — 85 tests passing |
| GitHub Actions workflow | Complete |
| API keys configured (Gemini, Google Maps, Google Sheets) | Complete |
| Google Sheet workbook | Created and shared with service account |
| First pipeline run | Pending T1 (bootstrap CCLD license numbers for 4 existing programs) |

**Before the first live run:** Manually look up the CCLD License Numbers for the 4 existing Riverside programs at ccld.dss.ca.gov and add them to the pipeline checkpoint file. This prevents the pipeline from treating them as new programs on the first run.

---

## Tools and APIs

| Tool / API | Purpose |
|------------|---------|
| **React + TypeScript** | Web app framework with strict type safety |
| **Tailwind CSS** | Visual styling |
| **Leaflet / OpenStreetMap** | Interactive map — no API key required |
| **Vite + Bun** | Build tooling and package management |
| **GitHub Pages** | Free static site hosting |
| **GitHub Actions** | Weekly pipeline cron + automatic site deploy on merge |
| **CCLD Open Data Portal** | California licensing database — primary data source, updated by the state |
| **Gemini API (Google AI Studio)** | Web enrichment and community sentiment research; free tier (1,500 req/day) |
| **Google Maps Geocoding API** | Address → lat/lng coordinates; free up to 200/month |
| **Google Sheets API** | Full-dataset mirror and manual review staging layer |

---

## Folder Guide

```
exceptional-care-finder/
│
├── README.md                    ← You are here
├── CLAUDE.md                    ← Full technical architecture (loaded by Claude Code)
├── TODOS.md                     ← Deferred work items with context and dependencies
│
├── program-data/                ← All program data lives here (not in src/)
│   └── CA/
│       ├── funding-guide.json   ← CA regulations, FAQs, Regional Center contacts
│       └── riverside/
│           └── programs.json    ← Riverside County listings (4 programs)
│
├── scripts/pipeline/            ← Automated pipeline modules
│   ├── pipeline.js              ← Orchestrator — runs the full pipeline end to end
│   ├── ingest-ccld.js           ← CCLD download, filter, and diff
│   ├── enrich-gemini.js         ← Gemini enrichment + sentiment research
│   ├── geocode.js               ← Google Maps geocoding
│   ├── quality-gate.js          ← Completeness scoring and routing
│   ├── sheets-writer.js         ← Google Sheets append and full-mirror sync
│   └── checkpoint.js            ← Idempotent state tracking across runs
│
├── data-entry-templates/        ← Schema templates for manual data entry
│
└── src/                         ← React app source code (managed by Claude Code)
    ├── components/              ← UI components (map, cards, filters, sidebar)
    ├── data/                    ← Auto-discovers program-data/ via import.meta.glob
    └── types/index.ts           ← TypeScript interfaces for all data structures
```

---

## Starting a New Claude Code Session

Claude Code reads `CLAUDE.md` automatically at the start of every session — all project context and architecture decisions are pre-loaded. Open the project folder and describe what you want to work on.
