# Project Context — Exceptional Care Finder

## What This Project Is

A React SPA helping parents of adults with developmental disabilities find state-funded Adult Day Programs in California. Covers 53 of 58 CA counties (LA county manual enrichment in progress). ~935 active programs in the database.

**Owner:** Doug Bonham (non-technical; works with Claude Code for all code changes)
**Live URL:** https://dwbonham.github.io/exceptional-care-finder/
**GitHub repo:** https://github.com/dwbonham/exceptional-care-finder
**Deploy:** Automatic via GitHub Actions on every push to `main`

---

## Tech Stack

- **Vite 8** — build tool; `~/.bun/bin/bun run build` to compile, `~/.bun/bin/bun run dev` for local preview
- **React 19 + TypeScript 6** — UI framework with strict typing
- **Tailwind CSS v4** — utility-first styling via `@tailwindcss/vite` plugin (no config file)
- **Leaflet 1.9.4 + react-leaflet 5** — map with OpenStreetMap tiles (no API key)
- **Bun** — package manager; always use `~/.bun/bin/bun`, never npm/yarn
- **GitHub Pages** — hosting via `.github/workflows/deploy.yml`

---

## File Map

```
exceptional-care-finder/
├── CLAUDE.md                        ← This file
├── README.md                        ← Project overview + interview reference
├── TODOS.md                         ← Deferred work items with context
├── index.html
├── vite.config.ts
│
├── .github/workflows/
│   ├── deploy.yml                   ← Builds + publishes to GitHub Pages on push to main
│   ├── ccld-daily.yml               ← Daily 6am PT: CCLD import (free, auto-commits to main)
│   ├── pipeline.yml                 ← Daily 7am PT: Gemini enrichment (quota-limited, opens PR)
│   ├── bulk-import.yml              ← One-time manual: populate a fresh environment from CCLD
│   ├── audit-urls.yml               ← Manual: audit URLs in program data
│   ├── fix-sheet-county.yml         ← Manual: dedup + normalize county names in Programs sheet
│   ├── validate-rc.yml              ← Monthly (1st of month): validate RC phones vs DDS live page; opens GitHub Issue on mismatch
│   └── test.yml                     ← Runs pipeline tests on every push/PR to main
│
└── src/
    ├── App.tsx                      ← Root; owns all filter state
    ├── types/index.ts               ← All TypeScript interfaces
    ├── utils/programUtils.ts        ← extractStateMap(), extractCareTypes(), filterPrograms()
    └── components/
        ├── HeroSection.tsx          ← Top banner; title updates with active filters
        ├── LocationFilter.tsx       ← Sticky filter bar: State → County + Care Type
        ├── ProgramMap.tsx           ← Leaflet map; collapsible; auto-fits bounds
        ├── MapModal.tsx             ← Per-card map modal via ReactDOM.createPortal
        ├── ProgramCard.tsx          ← Program card; conditionally renders enriched fields
        ├── ProgramGrid.tsx          ← Grid of ProgramCards
        ├── AboutPage.tsx            ← About page; county count derived dynamically
        ├── ParentGuidePage.tsx      ← Enrollment Guide page (full content, ToC sidebar)
        └── StateRegulatoryGuide.tsx ← Sidebar: program types + RC finder + CTA to Enrollment Guide

program-data/                        ← ALL EDITABLE DATA LIVES HERE
└── CA/
    ├── funding-guide.json           ← RC contacts, enrollment guide sections, glossary, care-type defs
    └── [county]/programs.json       ← One folder per county; auto-discovered by import.meta.glob

public/
    ├── hero-bg.jpeg                 ← Hero section background image
    ├── about-bg.jpeg                ← About page background image
    └── enrollment-bg.jpeg           ← Enrollment Guide page background image
```

---

## Data Architecture

### Adding a new county
1. Create `program-data/CA/[county]/programs.json`
2. `src/data/programs/index.ts` uses `import.meta.glob` — new counties are auto-discovered, no code change needed

### Adding a new state
1. Create `program-data/[STATE]/funding-guide.json`
2. Create at least one county folder with `programs.json`
3. Add one import to `src/data/funding-guides/index.ts` and add to `fundingGuideMap`

### Current schema (TypeScript interfaces in `src/types/index.ts`)

**ProgramData** key fields:
- `ccldLicenseNumber` — state-assigned ID; pipeline deduplication key
- `licenseStatus: 'Active' | 'Inactive' | 'Revoked'` — only Active programs appear on the site; both Inactive and Revoked are removed from the JSON files when detected
- `legalLicenseName`, `streetName` (display name)
- `location` — street, city, state, zipCode, county, coordinates (lat/lng)
- `contact` — phone, websiteUrl
- `facilityDetails` — licensedCapacity, decryptedProgramType, programFocus, minimumAge?, maximumAge?, languagesSupported?, facilityFeatures?, parentOrganization?, daysOfOperation?, hoursOfOperation?, selfDeterminationAccepted?, populationSpecialization?
- `fundingMechanics` — vendorIds?, coveringAgencies, authorizedServiceCodes, transportationAvailability?, requiredFundingDocument, financialCoverageNote
- `qualitativeInsights` — parentReviews: string[]
- `completenessScore?`, `lastVerifiedDate?`, `dataSourceNotes?` — pipeline metadata

**FundingGuide** key fields (in `program-data/CA/funding-guide.json`):
- `state`, `title` — state code and display title
- `localAgencies[]` — Regional Center contacts; supports `county`, `zipCodes[]`, `note` for LA multi-RC logic
- `careTypeDefinitions[]` — `{ term, definition }` pairs shown in sidebar and Enrollment Guide Program Types section
- `glossary[]` — `{ term, definition }` pairs shown in Enrollment Guide Glossary section; includes "Self-Determination Program (SDP)" used by ProgramCard tooltip
- `enrollmentGuide[]` — `EnrollmentSection[]`; each section has `title`, `blocks: EnrollmentBlock[]`, `sources?: EnrollmentSource[]`
  - Block types: `paragraph` (text), `note` (amber callout), `bullets` (unordered list, optional heading), `steps` (numbered, optional heading), `questions` (grouped Q&A), `resources` (link list)
  - Replaces the former `faqs[]` array; richer structure allows the Enrollment Guide page to render formatted content
- **Enrollment Guide synced to Google Sheets "Enrollment Guide" tab** — `syncFundingGuides()` in `sheets-writer.js` flattens block structure to one row per content item; called by `ccld-import.js` on every run

### Fields intentionally NOT in schema
- **Availability / waitlist status** — too volatile; always changes
- **Current enrollment** — use `licensedCapacity` with "Licensed Capacity" label instead

---

## Key Decisions

**Frontend**
- **Leaflet over Google Maps** — OpenStreetMap requires no API key; Google Maps embed only supports single-location without one
- **Custom SVG pins** — Leaflet's default icons break in Vite builds; replaced with inline SVG `L.divIcon`
- **`ReactDOM.createPortal` for map modals** — ProgramCard has `overflow:hidden`; portal to `document.body` prevents clipping
- **All new schema fields are optional (`?`)** — existing JSON stays valid when fields are added
- **`import.meta.glob` for data discovery** — auto-discovers all `program-data/**/programs.json`; no import needed for new counties
- **County count in About page is dynamic** — derived from `allPrograms` at build time; never goes stale
- **Three-tab navigation: Find Programs / Enrollment Guide / About** — view state `'finder' | 'guide' | 'about'` owned by `App.tsx`; the guide tab was previously "Parent Guide" — renamed because caregivers and advocates (not just parents) use the tool
- **Enrollment Guide page (`ParentGuidePage.tsx`)** — standalone full-content page with hero header (enrollment-bg.jpeg), sticky ToC sidebar (desktop), collapsible "On this page" (mobile), and three sections: Enrollment Guide accordion, Program Types, Glossary. Pattern matches About page layout
- **`StateRegulatoryGuide.tsx` sidebar is navigation-focused only** — shows Program Types definitions and RC finder (with LA ZIP logic); all deep enrollment content moved to Enrollment Guide page. Footer CTA button links to the full guide
- **Care-type badge tooltips** — clicking the care-type or Self-Determination badge in ProgramCard expands an inline definition panel. Definitions sourced from `careTypeDefinitions[]` and `glossary[]` in funding-guide.json via module-level `CARE_TYPE_DEFS` lookup (not per-render). Inline expansion chosen over floating popovers because ProgramCard has `overflow:hidden`
- **Population specialization badges removed** — AI-generated from public web; coverage was inconsistent (~5% of programs). Showing badges for some programs but not others implied exclusion for Lanterman Act programs (which by law serve all qualifying individuals). Removed entirely to avoid misleading families
- **Language filter not added** — only 55/935 programs (5.9%) have language data; Spanish = 43 programs across 12 counties. Filter would be misleading until LA enrichment (largest county) is complete; revisit after LA is done

**Pipeline**
- **CCLD filter: `FacilityType == '775 Adult Day Program'` ONLY** — "Adult Day Health Care" is a different program, different funding, wrong audience
- **CCLD License Number as dedup key** — program names and addresses change; license numbers don't
- **Upsert over append for Sheets writes** — both Phase 4 (quality gate) and Phase 5 (backfill) use `upsertProgramRows`, which reads column F to find existing rows and updates in place. Pure append caused duplicate rows when the pipeline re-ran.
- **503 = early exit like 429** — when Gemini returns 503, throw `RateLimitError` and save checkpoint. Previously treated as non-fatal; pipeline would log an error for every queued program and exit burning the entire run for zero enrichment.
- **Google Sheets as full mirror, not exceptions-only** — ALL programs mirrored to Sheets (not just flagged ones); enables audit queries like "all LA County programs missing a phone number"
- **Two separate pipelines** — CCLD import (`ccld-import.js`) runs daily at 6am PT and handles all ingest/geocode/publish steps for free. Gemini enrichment (`pipeline.js`) runs at 7am PT (1 hour later) and handles AI enrichment only. Separation avoids Gemini quota hitting CCLD ingest.
- **Both pipelines share `pipeline-checkpoint-` cache key** — they read/write consistent state. The 1-hour gap + concurrency group (`group: pipeline, cancel-in-progress: false`) ensures CCLD always completes before Gemini starts.
- **AUTO_BACKFILL_CAP = 100 for automated Gemini runs** — automated cron is capped so manual workflow dispatches always have quota available. Dispatches with `enrich_counties` set bypass the cap entirely. The selection logic lives in `selectBackfillQueue()` in `checkpoint.js` so it's unit-testable.
- **`program-files.js` is the single source of truth for JSON write/remove** — both `ccld-import.js` and `pipeline.js` import `writeApprovedProgram` and `removeProgram` from this module. No duplicate file I/O logic; tests only need to cover one place.
- **County Summary tab auto-rebuilt on every run** — `syncCountySummary()` called at end of every pipeline run, including no-op runs where CCLD has no new programs.
- **County name normalization in Sheets** — `_normalizeCountySummary()` strips " County" suffix and title-cases the name before grouping. Prevents "Butte" and "Butte County" from appearing as separate rows.
- **429/503 = early exit with detail logging** — when Gemini returns RateLimitError, checkpoint is saved and the error body logged (`API said: ...`) so the exact limit type (RPD vs RPM) is visible in the run log.
- **Sentiment excluded from automated daily runs** — automated cron passes no `WITH_SENTIMENT` flag (defaults off). Manual workflow dispatch with sentiment checked is used for bulk enrichment of new counties. Programs enriched without sentiment are marked done in checkpoint and won't be re-enriched automatically.
- **Quality gate: completeness ≥ 80% + ≥ 1 sentiment bullet → auto-approve** — below threshold → "Needs Review" in Sheets
- **Sentiment sources: public web only** — Yelp and Google Reviews excluded (ToS prohibits republication)
- **Monthly RC contact validator** — `scripts/pipeline/validate-rc-contacts.js` fetches the live DDS RC listings page and compares phone numbers against `funding-guide.json`. Runs automatically on the 1st of each month via `validate-rc.yml`. Exit 0 = all match, Exit 1 = mismatches (opens a GitHub Issue), Exit 2 = DDS page unreachable (logs a warning, no issue). Sanity check: if fewer than 15 RCs parse, treats it as a page-structure change (exit 2). Fuzzy name matching handles minor naming differences between our records and the DDS listing. Built after discovering 7 of 21 RC phone numbers were wrong in the initial AI-generated data.

---

## Pipeline Operation

### Two-workflow architecture

**Workflow 1 — Daily CCLD Import (`ccld-daily.yml`, 6am PT)**
- Script: `scripts/pipeline/ccld-import.js`
- Free: no Gemini API key required
- What it does: fetch CCLD → diff (new/revoked/status changes) → geocode → quality gate → write JSON files → upsert to Google Sheets Programs tab → sync Enrollment Guide tab → sync Regional Centers tab → sync County Summary tab
- New programs are tagged `geminiEnriched: false` — Gemini pipeline picks them up automatically
- Commits directly to `main` (no PR); site deploys automatically
- **Google Sheets tabs written by this workflow:** Programs, Enrollment Guide, Regional Centers, County Summary

**Workflow 2 — Daily Gemini Enrichment (`pipeline.yml`, 7am PT)**
- Script: `scripts/pipeline/pipeline.js`
- Requires: `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`, `GOOGLE_SHEET_ID`, service account credentials
- What it does: backfill Gemini enrichment on programs tagged `geminiEnriched: false`, optionally add sentiment research
- Automated runs: capped at 100 programs/run (`AUTO_BACKFILL_CAP`) to preserve quota for manual dispatches
- Manual dispatch with `enrich_counties` set: bypasses cap, runs until quota exhausted or all done
- Commits to `pipeline/weekly-update` branch and opens a PR for review before publishing

**Workflow 3 — Monthly RC Contact Validation (`validate-rc.yml`, 1st of month 9am UTC)**
- Script: `scripts/pipeline/validate-rc-contacts.js`
- Free: no API keys required
- What it does: fetch DDS RC listings page → parse one card per RC → fuzzy-match names → compare phones against `funding-guide.json`
- On mismatch: opens a GitHub Issue with the diff; deduplicates (won't open a second issue if one is already open)
- On parse failure / page unreachable: logs `::warning::` only, no issue created
- Can also be triggered manually via workflow_dispatch

**Manual enrichment (for new large counties):** Trigger `pipeline.yml` workflow dispatch with `enrich_counties` (comma-separated, e.g. `los-angeles`) and `with_sentiment=true`. Merge the resulting PR when the run completes.

**Checkpoint:** `scripts/pipeline/checkpoint.json` persisted via GitHub Actions cache (`pipeline-checkpoint-` key). Both workflows share this cache. Local runs and Actions runs use separate checkpoint files.

**Current state:** 53/58 counties complete. LA county (~184 programs) pending manual enrichment run with sentiment. Remaining 4 counties will be picked up by automated runs.

---

## Current Status

- ~935 active programs across 53 CA counties
- Pipeline running in production; merging PRs weekly
- LA County pending manual enrichment (largest county, needs sentiment checked)
- Google Sheets County Summary tab tracks per-county enrichment progress
- About page county count is dynamic (auto-updates as pipeline adds counties)

---

## Documentation Maintenance

After any commit that changes pipeline behavior, schema, UI features, or operational decisions, update the relevant sections **in the same commit** — not as a separate pass later.

| What changed | Update these |
|---|---|
| Pipeline logic, quota handling, new phases | CLAUDE.md → Key Decisions + Pipeline Operation + Current Status |
| New fields in schema | CLAUDE.md → Current schema section |
| Coverage, program count, county status | CLAUDE.md → Current Status; README → Current Status table |
| Architectural tradeoff worth explaining | README → Key Design Decisions |
| New UI feature | CLAUDE.md → Key Decisions (Frontend) |

The goal: a new Claude Code session started tomorrow should have a fully accurate picture without needing a manual doc update pass.

---

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.

Key tokens to use in Tailwind custom properties or inline styles:
- Background: `#FAF7F2` (warm parchment — use instead of `bg-white` for page backgrounds)
- Primary action: `#C2410C` (terracotta — use instead of `blue-600` for buttons and CTAs)
- Trust/structure: `#1E3A5F` (deep navy — sidebar headers, filter selects)
- Accent/badges: `#D97706` (amber)
- Display font: Fraunces (serif) — card names, hero headline, sidebar title
- Body font: Instrument Sans
- UI font: DM Sans (badges, labels, filters)

---

## Skill Routing

- Product ideas/brainstorming → `/office-hours`
- Strategy/scope → `/plan-ceo-review`
- Architecture → `/plan-eng-review`
- Design → `/design-consultation` or `/plan-design-review`
- Bugs/errors → `/investigate`
- QA/testing → `/qa` or `/qa-only`
- Code review → `/review`
- Visual polish → `/design-review`
- Ship/deploy/PR → `/ship` or `/land-and-deploy`
- Save progress → `/context-save`
- Resume context → `/context-restore`
