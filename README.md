# Exceptional Care Finder

A free, public web directory helping families find state-funded day programs for adults and children with developmental disabilities. Currently covers Riverside County, CA — built to scale to every county in the country.

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

## Folder Guide — What Everything Is

```
exceptional-care-finder/
│
├── README.md                    ← You are here. Project overview.
├── CLAUDE.md                    ← Loaded automatically by Claude Code each session.
│
├── program-data/                ← THE DATA FILES. This is what you edit.
│   └── CA/
│       ├── funding-guide.json   ← CA regulations, FAQs, Regional Center contact
│       └── riverside/
│           └── programs.json    ← The 4 Riverside County program listings
│
├── data-entry-templates/        ← Give these to Gemini when building new counties/states.
│   ├── programs.json            ← Template for a county's programs file
│   ├── funding-guide.json       ← Template for a state's regulations file
│   └── README.md                ← Instructions for using the templates with Gemini
│
│  ── Everything below this line is app code. Claude manages it; you don't need to edit it. ──
│
├── src/                         ← The website's source code
├── public/                      ← The browser tab icon
├── index.html                   ← The HTML shell the app loads into
├── vite.config.ts               ← Build tool settings
├── package.json                 ← List of software packages the app uses
├── bun.lock                     ← Auto-generated lock file for packages (never edit)
├── tsconfig*.json               ← TypeScript compiler settings (never edit)
├── eslint.config.js             ← Code quality checker settings (never edit)
└── .github/                     ← GitHub Actions workflow that auto-publishes the site
```

---

## How to Add a New County

1. Open Gemini and provide:
   - `data-entry-templates/programs.json` (the schema template)
   - `program-data/CA/riverside/programs.json` (a real example)
   - The name of the county and state you want to add
2. Ask Gemini: *"Using this schema and example, research and build a complete programs.json for [County], [State]"*
3. Save the result to `program-data/[STATE]/[county]/programs.json`
4. Open Claude Code and say: *"Wire in the new [County, State] programs file"*
5. Claude updates the code and the site publishes automatically

## How to Add a New State

Same as above, but also:
- Give Gemini `data-entry-templates/funding-guide.json`
- Ask it to research the state's developmental disability funding rules
- Save the result to `program-data/[STATE]/funding-guide.json`
- Tell Claude Code: *"Wire in the new [State] funding guide and programs"*

---

## Tools Used

| Tool | What it does (plain English) |
|------|------------------------------|
| **React** | The framework that builds the web pages |
| **TypeScript** | Adds rules to the code so mistakes are caught before they reach the site |
| **Tailwind CSS** | Handles all the visual styling (colors, spacing, layout) |
| **Leaflet / OpenStreetMap** | Powers the map — no API key or cost required |
| **Vite** | Packages and builds the site for publishing |
| **Bun** | Runs the build tools (faster alternative to npm) |
| **GitHub** | Stores all the code and data files |
| **GitHub Pages** | Hosts and publishes the live website for free |
| **Claude Code** | AI coding assistant used to build and update the app |
| **Gemini** | AI used to research and generate program data |

---

## Starting a New Claude Code Session

Claude Code automatically reads `CLAUDE.md` at the start of every session — all project context is already loaded. Just open the project folder in Claude Code and say what you want to work on. No need to re-explain what the project is.
