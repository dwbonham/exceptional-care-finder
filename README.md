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

## How the Data Files Work

All program and regulatory data lives in one folder:

```
src/data/content/
  CA/
    funding-guide.json        ← State regulations, FAQs, and Regional Center contact info
    riverside/
      programs.json           ← All program listings for Riverside County
```

**To add a new county:** Create a new folder (e.g., `CA/los-angeles/`) with a `programs.json` file using the same format as the Riverside file, then tell Claude Code to wire it in.

**To add a new state:** Create a new state folder (e.g., `TX/`) with a `funding-guide.json` and at least one county subfolder.

**Schema templates** for both file types are at the top of this repo under `_templates/` — give these to Gemini or any AI when generating new data.

---

## Workflow for Adding New Programs

1. Open Gemini (or another AI) and provide:
   - The `programs.json` schema template from `_templates/`
   - The existing Riverside `programs.json` as a real example
   - The name of the county and state you want to add
2. Ask Gemini to research and populate a complete `programs.json` for that county
3. Save the file to `src/data/content/[STATE]/[county]/programs.json`
4. Open Claude Code and say: "Wire in the new [County, State] programs file"
5. Claude will update the two index files and deploy automatically

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

Claude Code automatically reads `CLAUDE.md` at the start of every session — all project context is already loaded. Just open the project folder in Claude Code and continue working. No need to re-explain what the project is.

If starting fresh in a new terminal:
```
cd ~/Claude\ Projects/exceptional-care-finder
claude
```
