# Exceptional Care Finder

A free, public web directory helping families find state-funded day programs for adults and children with developmental disabilities. Currently covers Riverside County, CA — being expanded to all of California via an automated data pipeline.

**Live site:** https://dwbonham.github.io/exceptional-care-finder/

---

## What This Does

Parents of adults with disabilities (autism, cerebral palsy, intellectual disability, epilepsy) use this tool to:
- Find licensed day programs near them
- Understand which programs are eligible for 100% state funding through their Regional Center
- Read AI-aggregated community sentiment from other families
- Get contact info, program focus, and directions in one place

---

## What's Been Built

- Program cards with care type, licensed capacity, languages, facility features, and funding details
- Interactive map (above the listings) showing all programs as pins, with auto-fit and collapse toggle
- Three filter dropdowns: State, County, and Care Type
- State Regulatory Guide sidebar — explains eligibility, the IPP process, and links to the local Regional Center
- Fully deployed on GitHub Pages with automatic publishing every time data or code is updated

---

## What's Being Built Next — The Automated Pipeline

Expanding to all of CA (~500–1,000 programs across 21 regional centers) requires an automated data pipeline, not manual data entry. The planned pipeline:

1. **Pulls from CCLD** — California's public licensing database, updated by the state
2. **Enriches with Gemini API** — automatically researches each program's hours, contact info, languages, features, and AI sentiment from public web sources
3. **Quality-gates before publishing** — only auto-publishes programs that meet a completeness threshold; others are flagged for a quick human review
4. **Runs weekly on a schedule** — the site stays current without any manual work

See `CLAUDE.md` for the full technical architecture. Engineering review is in progress.

---

## Folder Guide — What Everything Is

```
exceptional-care-finder/
│
├── README.md                    ← You are here. Project overview.
├── CLAUDE.md                    ← Loaded automatically by Claude Code. Full technical plan.
│
├── program-data/                ← ALL PROGRAM DATA LIVES HERE.
│   └── CA/
│       ├── funding-guide.json   ← CA regulations, FAQs, Regional Center contacts
│       └── riverside/
│           └── programs.json    ← Riverside County program listings (4 programs)
│
├── data-entry-templates/        ← Schema templates for manual data entry (interim use).
│   ├── programs.json            ← Template for a county's programs file
│   ├── funding-guide.json       ← Template for a state's regulations file
│   └── README.md                ← Manual data entry instructions
│
│  ── Everything below this line is app code. Claude manages it; you don't need to edit it. ──
│
├── src/                         ← The website's source code
├── scripts/                     ← Utility scripts (CSV export, future pipeline scripts)
├── public/                      ← The browser tab icon
├── index.html                   ← The HTML shell the app loads into
├── vite.config.ts               ← Build tool settings
├── package.json                 ← List of software packages the app uses
├── bun.lock                     ← Auto-generated lock file for packages (never edit)
├── tsconfig*.json               ← TypeScript compiler settings (never edit)
├── eslint.config.js             ← Code quality checker settings (never edit)
└── .github/                     ← GitHub Actions workflows (site deploy + future pipeline)
```

---

## Adding Data — Current Process (Manual, Pre-Pipeline)

Until the automated pipeline is live, new programs can be added manually:

1. Open Gemini and provide:
   - `data-entry-templates/programs.json` (the schema template)
   - `program-data/CA/riverside/programs.json` (a real example)
   - The county and state you want to add
2. Ask Gemini: *"Using this schema and example, research and build a complete programs.json for [County], [State]"*
3. Save the result to `program-data/[STATE]/[county]/programs.json`
4. Open Claude Code and say: *"Wire in the new [County, State] programs file"*
5. Claude updates the code and the site publishes automatically

**Note:** The automated pipeline will replace these manual steps for CA counties once it is built. The manual process remains valid for adding new states.

---

## Tools Used

| Tool | What it does |
|------|-------------|
| **React** | Builds the web pages |
| **TypeScript** | Catches code errors before they reach the site |
| **Tailwind CSS** | Handles all visual styling |
| **Leaflet / OpenStreetMap** | Powers the map — no API key required |
| **Vite** | Packages and builds the site for publishing |
| **Bun** | Runs the build tools |
| **GitHub** | Stores all code and data files |
| **GitHub Pages** | Hosts the live website for free |
| **GitHub Actions** | Runs the weekly automated pipeline and site deploy |
| **Claude Code** | AI coding assistant used to build and update the app |
| **Gemini API** | Automated web research and program enrichment (pipeline) |
| **Google Maps Geocoding** | Converts program addresses to map coordinates (pipeline) |
| **Google Sheets** | Staging layer for programs that need human review before publishing |

---

## Starting a New Claude Code Session

Claude Code automatically reads `CLAUDE.md` at the start of every session — all project context and the full pipeline plan are already loaded. Just open the project folder in Claude Code and say what you want to work on.
