# TODOS

Deferred work captured during engineering review (May 2026). Each item has a clear prerequisite — don't start until it's met.

---

## T1 — Bootstrap CCLD license numbers for 4 existing Riverside programs

**What:** Manually look up the CCLD License Numbers for the 4 existing Riverside programs on the CCLD facility search (ccld.dss.ca.gov) and add them to the pipeline's bootstrap checkpoint file.

**Why:** Without this, the first pipeline run treats all 4 programs as "new," re-enriches them (wastes 8 Gemini API calls), and risks creating duplicate or out-of-sync JSON entries.

**Context:** 15-minute one-time task. Look up each program by name on the state facility search. Add the license numbers to the checkpoint file before running the pipeline the first time.

**Depends on:** Phase 2 pipeline built and ready to run (but do this BEFORE the first run).

---

## T2 — Add pipeline failure alerting

**What:** Configure the pipeline GitHub Actions workflow to post a GitHub Issue comment (or email) when the weekly run fails or produces zero new programs for 3 consecutive weeks.

**Why:** The CCLD data portal (data.chhs.ca.gov) has historically changed download URLs when datasets are republished. A silent pipeline failure means the site goes stale with no indication until a family notices.

**Context:** GitHub Actions can post to a GitHub Issue via the `gh` CLI with 2-3 lines of bash. A "zero new programs for 3 weeks" check catches URL changes and structural issues. Human: ~30min / CC: ~10min.

**Depends on:** Phase 2 pipeline workflow written.

---

## T3 — Tiered auto-approval for near-gate programs (toward automated Sheets review)

**What:** Add logic to auto-approve programs scoring 70–79% completeness (just below the 80% gate) if they also have a valid phone, website, and at least 1 sentiment bullet. This reduces the weekly Sheets review queue to genuinely ambiguous cases.

**Why:** Reduces the weekly human review burden. First step toward the fully automated review flow discussed during CEO planning.

**Context:** Don't build this until the pipeline has been running for 4+ weeks and you understand what kinds of programs actually land in Sheets review. The distribution may surprise you. Human: ~1 day / CC: ~45min.

**Depends on:** Phase 2 live and running for 4+ weeks with real review data.

---

## T4 — Display enriched fields in ProgramCard (days/hours, parent org, self-determination)

**What:** Update `src/components/ProgramCard.tsx` to display `daysOfOperation`, `hoursOfOperation`, `parentOrganization`, `selfDeterminationAccepted`, and `populationSpecialization` when they are present on a program record.

**Why:** These are high-value fields for families. "Is this program open Monday–Friday?" and "Does this program accept Self-Determination funding?" are among the most common questions parents ask.

**Design spec (from design review May 2026):**

```
CARD STRUCTURE (when enriched fields present):
┌────────────────────────────────────────────┐
│ ── amber banner if licenseStatus=Inactive ──│
│ Program Name                                │
│ by [parentOrganization]   ← gray subtitle   │
│ Registered Legal Entity: xxx                │
│ [Program Type badge]  [Capacity badge]      │
│ ─────────────────────────────────────────── │
│ KNOCKOUT ROW (only when data present):      │
│ 📅 Mon–Fri  🕗 8:00am–3:00pm  [✓ Self-Det]│
│ ─────────────────────────────────────────── │
│ ✨ AI-Powered Summary                       │
│ [Age chip] [Language chips]                 │
│ [Autism chip] [Down Syndrome chip] ← popSpec│
│ 💰 Funding & Administration                 │
│ ...                                         │
└────────────────────────────────────────────┘
```

**Knockout row rules:**
- Show the knockout row only when at least one of `daysOfOperation`, `hoursOfOperation`, or `selfDeterminationAccepted` is present
- `selfDeterminationAccepted`: green pill "✓ Self-Determination" (Yes), amber "? Self-Det" (Unknown), hide entirely (No — not a negative signal worth showing)
- All emoji in the knockout row must have `aria-hidden="true"` on their wrapper `<span>`

**Inactive badge:**
- When `licenseStatus === 'Inactive'`: full-width amber-50/amber-200 banner above the card header
- Text: "⚠️ License currently inactive — call to verify availability before visiting"
- When `licenseStatus === 'Revoked'`: filtered out in `filterPrograms()`, never shown on site

**Context:** The 4 existing Riverside programs don't have these fields yet (they predate the pipeline). Adding the UI now would display nothing. Wait until at least a few enriched programs exist to verify the display looks correct. Human: ~2hrs / CC: ~20min.

**Depends on:** Phase 2 pipeline live and having enriched at least a few programs with real `daysOfOperation` / `hoursOfOperation` values.

---

## T5 — Wire up hero ZIP search to program data

**What:** Make the hero ZIP input functional. Pass an `onSearch(zip: string)` prop from `App` to `HeroSection`. On submit, look up the ZIP in `zipMap`. If found: set `selectedState` + `selectedZip` and scroll to results. If not found: show inline message "No programs in this ZIP yet — we're expanding." with a "Browse all programs →" action.

**Why:** The hero ZIP input currently accepts input and does nothing. The first thing a family tries is broken. This erodes trust (the "goodwill reservoir" principle).

**Design spec:**
- Input: `type="text"` maxLength 5, pattern `[0-9]{5}`
- On submit: look up ZIP in `zipMap` (reverse lookup: build `zip → {state, county}` from `extractZipMap` output at startup)
- Found: call `onStateChange(state)`, `onZipChange(zip)`, `window.scrollTo({ top: resultsEl.getBoundingClientRect().top, behavior: 'smooth' })`
- Not found: show inline below input: "We don't have programs in this ZIP yet. [Browse all programs →]" (clears the zip and shows all results)
- The existing `selectedZip` already drives the filter bar — hero search just sets the same state

**Context:** Human: ~1hr / CC: ~15min. Don't implement until ProgramGrid has the RC-forward empty state (T6) — otherwise "not found" ZIP shows the old blank empty state.

**Depends on:** T6 (RC-forward empty state) should ship first.

---

## T6 — RC-forward empty state in ProgramGrid

**What:** Replace the current minimal empty state in `ProgramGrid` with a warm, actionable panel when zero programs are found for a filtered location.

**Why:** Families who get zero results need a clear next step. "No programs found — try a different county" is a dead end. The Regional Center can give them a direct list.

**Design spec:**
```
┌────────────────────────────────────────────┐
│  🔎                                         │
│  We don't have programs listed here yet.   │  slate-700 bold
│  Our database is expanding to cover all     │  slate-500
│  of California. In the meantime, your       │
│  Regional Center can give you a full list:  │
│                                             │
│  [RC name from FundingGuide]                │  slate-900 bold
│  [phone] · [website link]                   │  blue-600
│                                             │
│  [Try a different ZIP →]  ← calls clearZip  │
└────────────────────────────────────────────┘
```
- RC data: pass `selectedState` and `selectedCounty` to `ProgramGrid`, look up `getFundingGuide(state, undefined, county)` to get the RC contact
- "Try a different ZIP" clears `selectedZip` only (keeps state selected)
- If no state selected: show "Select a state above to find programs near you."
- If state selected but no RC data: show the basic message without RC contact

**Context:** Human: ~1hr / CC: ~20min.

**Depends on:** Nothing — can ship independently.

---

## T8 — Phase 7: Rolling re-enrichment for data freshness

**What:** Add a Phase 7 to the pipeline that re-enriches existing programs on a rolling basis — oldest `lastVerifiedDate` first — using whatever Gemini quota remains after higher-priority work (new programs, backfill, sentiment).

**Why:** Gemini-sourced fields (phone, website URL, hours, days of operation, sentiment bullets) are frozen at enrichment time and never refreshed. At ~25 programs/day with ~935 total, the full directory cycles in ~37 days automatically at zero cost within the free Gemini quota.

**Priority queue (lowest to highest):**
1. Phase 7 — re-enrich stale programs (oldest `lastVerifiedDate` first)
2. Phase 6 — sentiment backfill
3. Phase 5 — Gemini backfill for unenriched programs
4. Phase 2 — new CCLD programs (always first)

**Implementation notes:**
- Add `getStalestEnrichments(state, { olderThanDays = 90, limit = 20 })` to `checkpoint.js` — returns programs with oldest `lastVerifiedDate`, excluding programs already queued in higher phases
- Phase 7 runs only when Phases 2/5/6 have nothing left to process
- Re-enrichment resets `geminiEnriched` and `sentimentEnriched` flags so the program flows through normal enrichment again
- `lastVerifiedDate` in the JSON output drives the staleness check

**Context:** Don't build until county backfill is complete and the automated pipeline has been running in steady state for a few weeks. Human: ~30min / CC: ~45min.

**Depends on:** All counties fully enriched with sentiment (Phases 5/6 backlog cleared).

---

## T7 — Add aria-hidden to all decorative emoji in ProgramCard and RegionalCenterBanner

**What:** Add `aria-hidden="true"` to every decorative `<span>` wrapper around emoji in `ProgramCard.tsx` and `RegionalCenterBanner.tsx`.

**Why:** Screen readers read emoji aloud as their Unicode name: `💰` becomes "money bag", `📅` becomes "calendar". This produces broken speech output for blind users.

**Context:** Quick pass, ~20min with CC. Every `<span>📍</span>` → `<span aria-hidden="true">📍</span>`. Human: ~15min / CC: ~5min.

**Depends on:** Nothing — can ship anytime.
