# Project Context — Exceptional Care Finder

## What This Project Is

A React single-page application (SPA) that helps parents of adults with developmental disabilities find state-funded day programs. Currently covers Riverside County, CA. Built to scale nationwide by adding JSON data files — no code changes required for new counties or states.

**Owner:** Doug Bonham (non-technical; works with Claude Code for all code changes)
**Live URL:** https://dwbonham.github.io/exceptional-care-finder/
**GitHub repo:** https://github.com/dwbonham/exceptional-care-finder
**Deploy:** Automatic via GitHub Actions on every push to `main`

---

## Tech Stack

- **Vite 8** — build tool; `bun run build` to compile, `bun run dev` for local preview
- **React 19 + TypeScript 6** — UI framework with strict typing
- **Tailwind CSS v4** — utility-first styling via `@tailwindcss/vite` plugin (no config file needed)
- **Leaflet 1.9.4 + react-leaflet 5** — map with OpenStreetMap tiles (no API key)
- **Bun** — package manager; use `~/.bun/bin/bun` (not npm/yarn)
- **GitHub Pages** — hosting; deployed via `.github/workflows/deploy.yml`

---

## File Map

```
exceptional-care-finder/
├── CLAUDE.md                        ← This file (auto-loaded by Claude Code)
├── README.md                        ← Plain-English project overview for Doug
├── index.html                       ← HTML shell (rarely touched)
├── vite.config.ts                   ← Build config; sets base path for GitHub Pages
├── package.json                     ← Dependencies list
├── bun.lock                         ← Dependency lock file (don't edit manually)
├── tsconfig*.json                   ← TypeScript compiler settings (don't edit)
├── eslint.config.js                 ← Code quality rules (don't edit)
│
├── .github/workflows/deploy.yml     ← CI/CD pipeline: builds and publishes to GitHub Pages
│
├── public/
│   └── favicon.svg                  ← Browser tab icon
│
└── src/
    ├── main.tsx                     ← App entry point (rarely touched)
    ├── index.css                    ← Global styles: Google Fonts → Tailwind → Leaflet CSS
    ├── App.tsx                      ← Root component; owns all filter state; wires everything together
    │
    ├── types/
    │   └── index.ts                 ← All TypeScript interfaces (ProgramData, FundingGuide, etc.)
    │
    ├── utils/
    │   └── programUtils.ts          ← extractStateMap(), extractCareTypes(), filterPrograms()
    │
    ├── components/
    │   ├── HeroSection.tsx          ← Top banner; title updates dynamically based on active filters
    │   ├── LocationFilter.tsx       ← Sticky filter bar: State → County (cascades) + Care Type
    │   ├── ProgramMap.tsx           ← Full Leaflet map above listings; collapsible; auto-fits bounds
    │   ├── MapModal.tsx             ← Per-card map modal using ReactDOM.createPortal
    │   ├── ProgramCard.tsx          ← Individual program card with all details and accordions
    │   ├── ProgramGrid.tsx          ← Renders the grid of ProgramCards
    │   └── StateRegulatoryGuide.tsx ← Sidebar: funding FAQs and local Regional Center contact
    │
    └── data/
        ├── programs/
        │   └── index.ts            ← Imports all programs.json files → exports allPrograms[]
        ├── funding-guides/
        │   └── index.ts            ← Imports all funding-guide.json files → exports getFundingGuide()
        └── regulatoryContent.ts    ← Re-export shim (kept for import compatibility)

program-data/                        ← ALL EDITABLE DATA LIVES HERE (top-level, not inside src/)
└── CA/
    ├── funding-guide.json           ← CA regulations, FAQs, Inland RC contact
    └── riverside/
        └── programs.json            ← 4 Riverside County program listings

data-entry-templates/                ← Schema templates to give Gemini when generating new data
├── programs.json
├── funding-guide.json
└── README.md
```

---

## Data Architecture

### Adding a new county
1. Create `program-data/[STATE]/[county]/programs.json`
2. Add one import line to `src/data/programs/index.ts` and spread into `allPrograms`

### Adding a new state
1. Create `program-data/[STATE]/funding-guide.json`
2. Create at least one county folder with `programs.json`
3. Add one import to `src/data/funding-guides/index.ts` and add to `fundingGuideMap`
4. Add one import to `src/data/programs/index.ts`

### Schema summary (TypeScript interfaces in `src/types/index.ts`)

**ProgramData** top-level fields:
- `legalLicenseName` — official licensed entity name
- `streetName` — display name shown on card
- `location` — street, city, state, zipCode, county, coordinates (lat/lng)
- `contact` — phone, websiteUrl
- `facilityDetails` — licensedCapacity, decryptedProgramType, programFocus, minimumAge?, languagesSupported?, facilityFeatures?
- `fundingMechanics` — vendorId?, fundingSourceCategory, localAdministeringAgency, stateBillingCode, transportationAvailability?, requiredFundingDocument, financialCoverageNote
- `qualitativeInsights` — parentReviews: string[]

**FundingGuide** top-level fields:
- `state`, `title`
- `localAgencies[]` — county, name, phone, websiteUrl, note?
- `faqs[]` — question, answer, sourceUrl?, sourceLabel?

### Fields intentionally NOT in schema (data integrity policy)
- **Availability / waitlist status** — too volatile; removed after data integrity audit
- **Current enrollment numbers** — not reliably obtainable; `licensedCapacity` is shown instead with explicit "Licensed Capacity" label

---

## Key Decisions (context for future work)

- **Leaflet over Google Maps** — OpenStreetMap tiles require no API key; Google Maps embed only supports single-location without a key
- **GitHub Pages over Vercel** — simpler setup for this use case; auto-deploys on push to main
- **Custom SVG pins** — Leaflet's default marker icons break in Vite builds due to asset URL resolution; replaced with inline SVG `L.divIcon`
- **`ReactDOM.createPortal` for map modals** — ProgramCard has `overflow:hidden`; portaling to `document.body` prevents modal clipping
- **All new schema fields are optional (`?`)** — existing JSON files stay valid when new fields are added
- **Bun not npm** — project uses Bun; always use `~/.bun/bin/bun run build` not `npm run build`

---

## Planned Data Pipeline Architecture

**CEO review completed May 2026. Engineering review completed May 2026.**

The next major build phase replaces manual data entry with a fully automated, set-and-forget pipeline to expand coverage to all of California (21 regional centers, ~500–1,000 programs).

### Pipeline Flow

```
GitHub Actions (weekly cron — Monday 6am)
        │
        ▼
1. CCLD Ingest
   Download CA Adult Day Program CSV from state licensing database
   CRITICAL FILTER: license type = "Adult Day Program" ONLY
   (NOT "Adult Day Health Care" — different program, different funding, wrong target)
   Diff against current registry using CCLD License Number as primary key
        │ New / changed programs found
        ▼
2. Gemini API — Enrichment (per new program)
   Web search: display name, phone, website, hours, languages,
   facility features, parent organization
   Returns structured JSON
        │
        ▼
3. Gemini API — Sentiment Research (per new program)
   Google Search grounding enabled
   Searches: PUBLIC WEB ONLY (program websites, news, state agency pages)
   NOT Yelp or Google Reviews — ToS prohibits automated access/republication
   Returns 3 AI sentiment bullets
   Low web presence → flags row for manual review instead
        │
        ▼
4. Auto-Geocode
   Address → lat/lng via Google Maps Geocoding API
        │
        ▼
5. Quality Gate (Option A — selected)
   Completeness ≥ 80% AND at least 1 sentiment bullet found
   → Auto-approve and publish
   Below threshold
   → Write to Google Sheet as "Needs Review" (Doug reviews, approves or skips)
        │ Approved records
        ▼
6. Weekly pipeline also reads Google Sheets for "Approved" rows
   Approved programs from Doug's manual review included in same PR
        │
        ▼
7. Generate JSON + Open Staging PR
   Write to program-data/ JSON files → commit to pipeline/weekly-update branch
   Open GitHub PR for Doug to review (2-min check) → merge to publish
   Existing deploy.yml picks up the merge and builds/deploys automatically
```

### APIs Required (one-time setup)

| API | Purpose | Cost |
|-----|---------|------|
| Gemini API (Google AI Studio) | Web enrichment + sentiment | Free tier: 1,500 req/day |
| Google Maps Geocoding API | Address → lat/lng | Free: 200/month, then ~$0.005 each |
| Google Sheets API | Staging and exception-review layer | Free |
| GitHub Actions | Cron scheduler + auto-deploy | Free for public repos |

### Schema Changes Required Before Pipeline Build

Three structural issues in `src/types/index.ts` that work for single-RC counties but break at CA scale (especially LA County, which has 6 regional centers):

**1. Vendor IDs → must support multiple RCs per program**
```
// Current (single string — breaks for LA County):
vendorId?: string

// Required:
vendorIds?: { rc: string; id: string }[]
// Example: [{ rc: "Lanterman", id: "A1234" }, { rc: "North LA County RC", id: "B5678" }]
```

**2. Covering Agencies → must be an array**
```
// Current (single string):
localAdministeringAgency: string

// Required:
coveringAgencies: string[]
// Example: ["Lanterman Regional Center", "North LA County Regional Center"]
```

**3. Authorized Service Codes → programs often have multiple**
```
// Current (single string):
stateBillingCode: string

// Required:
authorizedServiceCodes: string[]
// Example: ["510", "515"]
```

**4. New fields to add**

*CCLD Auto-fill (pipeline writes these):*
- `ccldLicenseNumber: string` — unique state ID; primary key for deduplication and change detection
- `licenseStatus: 'Active' | 'Inactive' | 'Revoked'` — Inactive programs display a warning badge on the card ("Verify availability before visiting"); Revoked programs are filtered out of results entirely
- `licenseType: string` — "Adult Day Program" (confirms correct program type at import)

*Gemini-enriched (pipeline fills these; high value for families):*
- `parentOrganization?: string` — e.g., "Sevita", "Easterseals", "ResCare/BrightSpring"
- `daysOfOperation?: string` — e.g., "Monday–Friday"
- `hoursOfOperation?: string` — e.g., "8:00am–3:00pm"
- `selfDeterminationAccepted?: 'Yes' | 'No' | 'Unknown'`
- `populationSpecialization?: string[]` — e.g., ["Autism", "Down Syndrome", "Mixed IDD"]
- `maximumAge?: number`

*Pipeline metadata (internal, not shown on site):*
- `completenessScore?: number` — 0–100, auto-calculated at import
- `lastVerifiedDate?: string` — ISO date of last CCLD confirmation
- `dataSourceNotes?: string` — import run ID and any flags

### Google Sheets — Full Mirror + Review Layer

**Decision (May 2026):** The pipeline mirrors ALL programs to Google Sheets, not just flagged ones. GitHub JSON remains the deploy source of truth (the site reads from it). The Sheet is a read-friendly audit view of the entire dataset — useful for data quality checks, filtering, pivot tables, and portfolio work.

**Why this matters:** Doug is job searching and wants to demonstrate data pipeline and auditing skills. A full mirror lets him query "show me all LA County programs with no phone number" or "how many programs have Self-Determination accepted?" directly in Sheets without touching JSON files.

**Workbook name:** `Exceptional Care Finder — Master Data`

**Three tabs — pipeline creates headers automatically on first run:**

| Tab | Content | Updated by |
|-----|---------|------------|
| `Programs` | Every program, all fields, one row per program | Pipeline (automated weekly) |
| `Funding Guides` | FAQs per state — question, answer, source URL | Doug (manually, rarely) |
| `Regional Centers` | RC contacts per county — name, phone, website, notes | Doug (manually, rarely) |

**Programs tab column groups:**
1. **Workflow** — Status, Completeness %, Last Updated, CCLD Last Verified
2. **CCLD Auto-fill** — License Number, Legal Name, License Type, License Status, Address, City, County, State, Zip, Capacity
3. **RC / Funding** — Covering Agencies, Vendor IDs (per RC), Authorized Service Codes, Transportation, Financial Coverage Note
4. **Gemini-Enriched** — Display Name, Phone, Website, Parent Org, Min Age, Max Age, Days, Hours, Languages, Features, Self-Determination, Population Specialization, Program Focus
5. **AI Sentiment** — Sentiment Bullet 1, Sentiment Bullet 2, Sentiment Bullet 3
6. **Auto-generated** — Latitude, Longitude, Import Notes

**Status values:** `Needs Review` → `Gemini Pending` → `Approved` → `Published` → `Needs Reverification` → `Inactive`

### LA County Multi-RC Handling

LA County has 6 regional centers: Lanterman, North LA County, South Central LA, Westside, Harbor, San Gabriel/Pomona. One program may be vendored with multiple RCs and receive a different vendor ID from each. The schema changes above (vendorIds array, coveringAgencies array) handle this — one row per program, multiple RCs listed.

### Weekly Rhythm (once pipeline is live)

| When | What | Who |
|------|------|-----|
| Monday 6am | Pipeline runs, CCLD diff, Gemini enrichment, deploy | Automated |
| Monday–Wed | Review flagged rows in Google Sheet (typically 2–10 programs) | Doug (~10 min) |
| Ongoing | Site stays current with CA licensing changes | Automated |

### Engineering Review Decisions (May 2026)

These were open questions resolved in the engineering review:

1. **CCLD download** — Direct CSV download from data.chhs.ca.gov (CKAN-based portal). No browser automation needed. Filter on `FacilityType == '775 Adult Day Program'` after download. URL pattern: `https://data.chhs.ca.gov/dataset/[id]/resource/[resource-id]/download/community-care-licensing-adult-residential-facility-locations.csv`

2. **Gemini rate limits** — Build idempotent pipeline with checkpoint file tracking enriched CCLD license numbers. First CA import runs across 2 days (stays on free tier forever). Weekly runs (5–20 new programs) stay well within 1,500/day limit.

3. **Schema migration** — Phase 1 (ships first, atomic PR): update TypeScript types + migrate 4 Riverside programs + update ProgramCard rendering + add `import.meta.glob` + add Leaflet clustering. Pipeline builds on the clean foundation in Phase 2.

4. **Data auto-discovery** — Replace manual imports in `src/data/programs/index.ts` with `import.meta.glob('../../program-data/***/programs.json', { eager: true })`. New counties auto-discovered — no code change required.

5. **Deploy safety** — Pipeline commits to `pipeline/weekly-update` branch and opens a GitHub PR. Doug merges to publish. Easy rollback (close the PR). Option to switch to direct-main after trust is established.

6. **Sheets sync** — Weekly pipeline reads Google Sheets for "Approved" rows and folds them into the same PR as CCLD new programs. One workflow, one PR per week. Includes schema validation on read-back to catch accidental field edits.

7. **License status display** — Inactive: warning badge ("Verify availability before visiting") stays on site. Revoked: filtered out of results entirely. Handles temporary license lapses during renewals gracefully.

8. **Gemini sentiment sources** — PUBLIC WEB ONLY. Explicitly exclude Yelp and Google Reviews (ToS violation risk). Search program websites, news articles, state agency pages, and parent forums.

9. **Pipeline resumption** — Second cron fires Tuesday–Friday at 6am (same script, exits early if no checkpoint pending). Handles rate-limit pauses from the previous day.

10. **Bootstrap task (before first pipeline run)** — Manually look up CCLD license numbers for 4 existing Riverside programs, add to checkpoint file. See TODOS.md T1.

11. **Map clustering** — Add `Leaflet.markercluster` in Phase 1. Required for LA County density (200+ programs in a dense area).

12. **Pipeline tests** — Unit tests for 4 critical paths using Bun's built-in test runner: CCLD type filter, dedup/diff logic, quality gate scoring, idempotent checkpoint check.

---

## Current State (as of May 2026)

### Phase 1 — Complete
- 4 programs in Riverside County, CA
- State/County/Care Type filters
- Leaflet map with collapse toggle
- Per-card map modal (Google Maps embed, no API key)
- State Regulatory Guide sidebar with FAQ accordion
- GitHub Pages deployment at https://dwbonham.github.io/exceptional-care-finder/
- TypeScript schema fully migrated (`vendorIds[]`, `coveringAgencies[]`, `authorizedServiceCodes[]`, all new CCLD/enrichment/metadata fields)
- `import.meta.glob` auto-discovery in place — new counties need no code changes

### Phase 2 — Complete (ready to run)

**API keys configured (all stored as GitHub Actions secrets/variables):**
- `GEMINI_API_KEY` — Google AI Studio (Gemini API, free tier 1,500 req/day)
- `GOOGLE_MAPS_API_KEY` — Google Maps Geocoding API (restricted to Geocoding API only)
- `GOOGLE_SHEETS_CREDENTIALS` — Service account JSON (Google Cloud Console)
- `SHEET_ID` — GitHub Actions variable (not secret); Sheet ID of the master data workbook

**Google Sheet configured:**
- Workbook: `Exceptional Care Finder — Master Data`
- Shared with service account as Editor
- Tabs (pipeline creates headers on first run): `Programs`, `Funding Guides`, `Regional Centers`

**Pipeline modules (scripts/pipeline/) — all complete, 85 tests passing:**
- `ingest-ccld.js` — CCLD ArcGIS fetch + diff
- `enrich-gemini.js` — Gemini web enrichment + sentiment
- `geocode.js` — Google Maps geocoding
- `quality-gate.js` — completeness scoring + auto-approve/flag routing
- `checkpoint.js` — idempotent state across rate-limit pauses
- `sheets-writer.js` — Google Sheets append
- `pipeline.js` — orchestrator (CCLD → Gemini → geocode → quality gate → write JSON)

**GitHub Actions workflow (`.github/workflows/pipeline.yml`) — complete:**
- Runs Monday 6am PT; catch-up crons Tue–Fri
- Checkpoint persists between runs via Actions cache
- Commits approved programs to `pipeline/weekly-update` branch and opens a PR

**Before the first live run — complete T1 in TODOS.md:**
- Manually add CCLD license numbers for 4 existing Riverside programs to bootstrap checkpoint

**Known placeholders in data:**
- `vendorId: "TBD"` on all 4 Riverside programs — real DDS vendor IDs not yet researched
- `transportationAvailability: "Contact Regional Center"` — placeholder; real values TBD
- `coordinates` — manually set; will be auto-geocoded by pipeline

**Not yet built:**
- Additional counties or states (pipeline will fill these in automatically)
- Search by program name
- Filtering by `minimumAge`, `languagesSupported`, or `facilityFeatures`
- Mobile map improvements

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
