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

## Current State (as of May 2026)

**Working:**
- 4 programs in Riverside County, CA
- State/County/Care Type filters
- Leaflet map with collapse toggle
- Per-card map modal (Google Maps embed, no API key)
- State Regulatory Guide sidebar with FAQ accordion
- GitHub Pages deployment

**Known placeholders in data:**
- `vendorId: "TBD"` on all 4 Riverside programs — real DDS vendor IDs not yet researched
- `transportationAvailability: "Contact Regional Center"` — placeholder; real values TBD

**Not yet built:**
- Additional counties or states
- Search by program name
- Filtering by `minimumAge`, `languagesSupported`, or `facilityFeatures`
- Mobile map improvements
