# Program Data

This folder contains all program listings and state funding guides used by the Exceptional Care Finder website.

---

## Folder Structure

```
program-data/
└── CA/
    ├── funding-guide.json     ← California regulations, FAQs, and Regional Center contacts
    └── riverside/
        └── programs.json      ← Riverside County program listings (4 programs)
```

Each state gets its own folder (`CA`, `TX`, etc.).
Each county gets a subfolder inside the state folder.

---

## How Data Gets Here

### Current (manual, Riverside County only)
The 4 Riverside County programs were added manually using Gemini to research each program and generate the JSON. See `data-entry-templates/` for the schema and instructions.

### Planned (automated pipeline — in development)
An automated weekly pipeline will expand this folder to cover all of California:

1. **CCLD ingest** — California's state licensing database is downloaded and diffed weekly
2. **Gemini API enrichment** — each new program is automatically researched and enriched
3. **Quality gate** — only programs meeting a completeness threshold are auto-published
4. **Google Sheets review** — programs below the threshold appear in a staging sheet for human approval before publishing

Once the pipeline is live, this folder will grow automatically. You won't need to add files manually for CA counties.

See `CLAUDE.md` → "Planned Data Pipeline Architecture" for the full technical plan.

---

## Export All Programs to a Spreadsheet

To generate a fresh `programs.csv` file you can open in Excel or Google Sheets, run this command in Claude Code:

```
! bun run export-csv
```

The file will be saved to `exports/programs.csv` in the project folder.
It automatically includes every county and state — no changes needed as data grows.
