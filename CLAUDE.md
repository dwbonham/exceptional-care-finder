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
│   └── pipeline.yml                 ← Weekly data pipeline cron + manual dispatch
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
        └── StateRegulatoryGuide.tsx ← Sidebar: FAQs + RC contacts

program-data/                        ← ALL EDITABLE DATA LIVES HERE
└── CA/
    ├── funding-guide.json           ← RC contacts, FAQs, parent education content
    └── [county]/programs.json       ← One folder per county; auto-discovered by import.meta.glob
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
- `licenseStatus: 'Active' | 'Inactive' | 'Revoked'` — Inactive shows warning badge; Revoked filtered out
- `legalLicenseName`, `streetName` (display name)
- `location` — street, city, state, zipCode, county, coordinates (lat/lng)
- `contact` — phone, websiteUrl
- `facilityDetails` — licensedCapacity, decryptedProgramType, programFocus, minimumAge?, maximumAge?, languagesSupported?, facilityFeatures?, parentOrganization?, daysOfOperation?, hoursOfOperation?, selfDeterminationAccepted?, populationSpecialization?
- `fundingMechanics` — vendorIds?, coveringAgencies, authorizedServiceCodes, transportationAvailability?, requiredFundingDocument, financialCoverageNote
- `qualitativeInsights` — parentReviews: string[]
- `completenessScore?`, `lastVerifiedDate?`, `dataSourceNotes?` — pipeline metadata

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

**Pipeline**
- **CCLD filter: `FacilityType == '775 Adult Day Program'` ONLY** — "Adult Day Health Care" is a different program, different funding, wrong audience
- **CCLD License Number as dedup key** — program names and addresses change; license numbers don't
- **Upsert over append for Sheets writes** — both Phase 4 (quality gate) and Phase 5 (backfill) use `upsertProgramRows`, which reads column F to find existing rows and updates in place. Pure append caused duplicate rows when the pipeline re-ran.
- **503 = early exit like 429** — when Gemini returns 503, throw `RateLimitError` and save checkpoint. Previously treated as non-fatal; pipeline would log an error for every queued program and exit burning the entire run for zero enrichment.
- **Google Sheets as full mirror, not exceptions-only** — ALL programs mirrored to Sheets (not just flagged ones); enables audit queries like "all LA County programs missing a phone number"
- **County Summary tab auto-rebuilt on every run** — `syncCountySummary()` called at end of every pipeline run; gives a per-county view of enrichment progress without touching JSON files
- **Sentiment excluded from automated daily runs** — automated cron passes no `WITH_SENTIMENT` flag (defaults off). Manual workflow dispatch with sentiment checked is used for bulk enrichment of new counties. Programs enriched without sentiment are marked done in checkpoint and won't be re-enriched automatically.
- **Quality gate: completeness ≥ 80% + ≥ 1 sentiment bullet → auto-approve** — below threshold → "Needs Review" in Sheets
- **Sentiment sources: public web only** — Yelp and Google Reviews excluded (ToS prohibits republication)

---

## Pipeline Operation

**Automated:** Weekly cron Monday 6am PT + catch-up crons Tue–Sun. No county filter, no sentiment. Processes ~25 programs per run (Gemini quota limit), resumes from checkpoint.

**Manual enrichment (for new large counties):** Trigger workflow dispatch with `enrich_counties` (comma-separated) and `with_sentiment=true`. Merge the resulting PR when the run completes.

**Flow:** CCLD ingest → Gemini enrichment → geocode → quality gate → Google Sheets upsert + County Summary sync → commit to `pipeline/weekly-update` branch → open PR → merge to publish

**Checkpoint:** `scripts/pipeline/checkpoint.json` persisted via GitHub Actions cache (`pipeline-checkpoint-` key). Tracks enriched license numbers so runs resume without re-processing. Local runs and Actions runs use separate checkpoint files.

**Current state:** 53/58 counties complete. LA county (largest — ~200 programs) pending manual enrichment run with sentiment. Remaining 4 counties will be picked up by automated runs.

---

## Current Status

- ~935 active programs across 53 CA counties
- Pipeline running in production; merging PRs weekly
- LA County pending manual enrichment (largest county, needs sentiment checked)
- Google Sheets County Summary tab tracks per-county enrichment progress
- About page county count is dynamic (auto-updates as pipeline adds counties)

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
