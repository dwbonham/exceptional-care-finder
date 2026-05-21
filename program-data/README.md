# Program Data

This folder contains all program listings and state funding guides used by the Exceptional Care Finder website.

---

## Folder Structure

```
program-data/
└── CA/
    ├── funding-guide.json     ← California regulations, FAQs, and Regional Center contacts
    └── riverside/
        └── programs.json      ← Riverside County program listings
```

Each state gets its own folder (`CA`, `TX`, etc.).
Each county gets a subfolder inside the state folder.

---

## Export All Programs to a Spreadsheet

To generate a fresh `programs.csv` file you can open in Excel or Google Sheets, run this command in Claude Code:

```
! bun run export-csv
```

The file will be saved to `exports/programs.csv` in the project folder.
It automatically includes every county and state you've added — no changes needed as data grows.
