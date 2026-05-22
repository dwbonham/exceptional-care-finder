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

**What:** Update `src/components/ProgramCard.tsx` to display `daysOfOperation`, `hoursOfOperation`, `parentOrganization`, and `selfDeterminationAccepted` when they are present on a program record.

**Why:** These are high-value fields for families. "Is this program open Monday–Friday?" and "Does this program accept Self-Determination funding?" are among the most common questions parents ask.

**Context:** The 4 existing Riverside programs don't have these fields yet (they predate the pipeline). Adding the UI now would display nothing. Wait until at least a few enriched programs exist to verify the display looks correct. Human: ~2hrs / CC: ~20min.

**Depends on:** Phase 2 pipeline live and having enriched at least a few programs with real `daysOfOperation` / `hoursOfOperation` values.
