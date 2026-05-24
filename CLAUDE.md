# Project Context — Exceptional Care Finder

## What This Project Is

A React SPA helping parents of adults with developmental disabilities find state-funded day programs. Currently covers Riverside County, CA. Expanding to all of CA via an automated weekly pipeline.

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
│   └── pipeline.yml                 ← Weekly data pipeline cron
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
        ├── ProgramCard.tsx          ← Program card with accordions
        ├── ProgramGrid.tsx          ← Grid of ProgramCards
        └── StateRegulatoryGuide.tsx ← Sidebar: FAQs + RC contact

program-data/                        ← ALL EDITABLE DATA LIVES HERE
└── CA/
    ├── funding-guide.json
    └── riverside/
        └── programs.json            ← 4 Riverside County programs

scripts/pipeline/                    ← Automated data pipeline (Phase 2 — complete)
├── pipeline.js                      ← Orchestrator
├── ingest-ccld.js                   ← CCLD download + diff
├── enrich-gemini.js                 ← Gemini enrichment + sentiment
├── geocode.js                       ← Google Maps geocoding
├── quality-gate.js                  ← Completeness scoring + routing
├── checkpoint.js                    ← Idempotent state across rate-limit pauses
└── sheets-writer.js                 ← Google Sheets sync

data-entry-templates/                ← Schema templates for manual data entry
```

---

## Data Architecture

### Adding a new county
1. Create `program-data/[STATE]/[county]/programs.json`
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
- `fundingMechanics` — vendorIds?: {rc, id}[], coveringAgencies: string[], authorizedServiceCodes: string[], transportationAvailability?, requiredFundingDocument, financialCoverageNote
- `qualitativeInsights` — parentReviews: string[]
- `completenessScore?`, `lastVerifiedDate?`, `dataSourceNotes?` — pipeline metadata

**FundingGuide** key fields:
- `state`, `title`
- `localAgencies[]` — county, name, phone, websiteUrl, note?
- `faqs[]` — question, answer, sourceUrl?, sourceLabel?

### Fields intentionally NOT in schema
- **Availability / waitlist status** — too volatile
- **Current enrollment numbers** — use `licensedCapacity` with "Licensed Capacity" label instead

---

## Key Decisions

- **Leaflet over Google Maps** — OpenStreetMap requires no API key; Google Maps embed only supports single-location without one
- **Custom SVG pins** — Leaflet's default icons break in Vite builds; replaced with inline SVG `L.divIcon`
- **`ReactDOM.createPortal` for map modals** — ProgramCard has `overflow:hidden`; portal to `document.body` prevents clipping
- **All new schema fields are optional (`?`)** — existing JSON stays valid when fields are added
- **`import.meta.glob` for data discovery** — `src/data/programs/index.ts` auto-discovers all `program-data/**/programs.json`; no import needed for new counties

---

## Pipeline (Phase 2 — Built, Ready to Run)

Weekly cron (Monday 6am PT) + catch-up crons Tue–Fri. All API keys are stored as GitHub Actions secrets.

**Flow:** CCLD ingest → Gemini enrichment → geocode → quality gate → Google Sheets sync → commit to `pipeline/weekly-update` branch → open PR

**Critical constraints:**
- CCLD filter: `FacilityType == '775 Adult Day Program'` ONLY — "Adult Day Health Care" is a different program, different funding, wrong audience
- Quality gate: completeness ≥ 80% AND ≥ 1 sentiment bullet → auto-approve; below threshold → write to Sheets as "Needs Review"
- Gemini: free tier 1,500 req/day; `checkpoint.js` tracks enriched license numbers so the pipeline resumes across days without re-processing
- Sentiment sources: public web only — program sites, news, state agency pages, parent forums. Yelp and Google Reviews are explicitly excluded (ToS)
- Google Sheets: full mirror of ALL programs (not just flagged ones) for audit/query use; GitHub JSON is the deploy source of truth

**Before first run:** Complete TODOS.md T1 — add CCLD license numbers for 4 existing Riverside programs to bootstrap checkpoint.

**Known placeholders in current data:**
- `vendorIds` — `"TBD"` on all 4 Riverside programs
- `transportationAvailability` — `"Contact Regional Center"` placeholder
- `coordinates` — manually set; will be auto-geocoded by pipeline

---

## Current Status

- Site live with 4 Riverside County programs
- Pipeline code complete — 85 tests passing
- API keys, Google Sheet, and GitHub Actions workflow all configured
- Pending: T1 (bootstrap CCLD license numbers) before first live pipeline run

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
