# Design System — Exceptional Care Finder

## Product Context
- **What this is:** A public directory helping parents find state-funded adult day programs for adults with developmental disabilities in California
- **Who it's for:** Parents and caregivers of adults with autism, Down syndrome, cerebral palsy, intellectual disabilities — navigating a complex state system, often under significant stress
- **Space/industry:** Civic tech / disability services / healthcare directory
- **Project type:** React SPA — search + filter tool with program cards and map

## Memorable Thing
> "This is a site that actually wants to help me."

Every design decision should serve this north star. The site should feel like it was made by a person who cares — not like another government portal built to satisfy a state contract.

## Aesthetic Direction
- **Direction:** Warm Civic — editorial warmth meets civic reliability
- **Decoration level:** Intentional — subtle warmth (soft shadows, the parchment background itself). No gradients, no decorative blobs, no pattern overlays for their own sake
- **Mood:** The feeling of a trusted friend's recommendation scrawled on good stationery. Competent and caring. Like a really good social worker who can also design.
- **What it is NOT:** Cold government portal, generic healthcare SaaS, childlike/playful (wrong stakes), luxury (exclusionary)

## Typography

- **Display/Hero:** [Fraunces](https://fonts.google.com/specimen/Fraunces) — optical serif variable font with warmth and personality. Use at 28px+. Italic variant for accent phrases ("Adult Day Program Finder"). No government or disability services directory uses a serif — it signals "a person wrote this for you." Weight 600 upright, 400 italic.
- **Body:** [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) — humanist sans, warmer than Inter, clean enough to stay out of the way for long reading. Use at 14–18px. Weight 400 (body), 500 (emphasis), 600 (strong).
- **UI/Labels/Filters/Badges:** [DM Sans](https://fonts.google.com/specimen/DM+Sans) — slightly rounder, snappy at small sizes, excellent for filter chips and badge labels. Use at 10–16px.
- **Data/Capacity numbers:** DM Sans with `font-variant-numeric: tabular-nums` — numbers align without reaching for monospace
- **Code:** JetBrains Mono (pipeline/admin use only — not in the public-facing UI)

### Font Loading
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,600&family=Instrument+Sans:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Type Scale
| Level       | Size  | Font            | Weight | Usage                          |
|-------------|-------|-----------------|--------|--------------------------------|
| hero        | 48–56px | Fraunces      | 600    | Hero headline                  |
| h1          | 36–42px | Fraunces      | 600    | Page titles                    |
| h2          | 28–32px | Fraunces      | 600    | Section headers, sidebar title |
| h3          | 20–22px | Fraunces      | 600    | Card names                     |
| body-lg     | 18px  | Instrument Sans | 400    | Hero subheadline               |
| body        | 16px  | Instrument Sans | 400    | FAQ answers, summaries         |
| body-sm     | 14px  | Instrument Sans | 400    | Card body text                 |
| ui          | 14px  | DM Sans         | 500    | Filter labels, nav items       |
| label       | 12px  | DM Sans         | 700    | Badge text, section labels     |
| caption     | 11px  | DM Sans         | 700    | Uppercase tracking labels      |

## Color

- **Approach:** Balanced — navy for structure/trust, terracotta for warmth/action, amber for highlights. Color is meaningful, not decorative.

### Palette

| Token               | Hex       | Name            | Usage                                             |
|---------------------|-----------|-----------------|---------------------------------------------------|
| `--bg`              | `#FAF7F2` | Warm Parchment  | Page background — nothing like any government site |
| `--surface`         | `#FFFFFF` | White           | Card surfaces, modals — float on parchment        |
| `--text`            | `#1C1917` | Warm Near-Black | Primary text — warm tint, not pure black          |
| `--muted`           | `#78716C` | Stone 500       | Secondary info, county labels, legal entity names |
| `--navy`            | `#1E3A5F` | Deep Navy       | Sidebar headers, filter selects, trust elements   |
| `--navy-light`      | `#EFF4FA` | Navy Light      | Filter select backgrounds, info surfaces          |
| `--terracotta`      | `#C2410C` | Terracotta      | Primary CTAs, map pins, card left border accent   |
| `--terracotta-hover`| `#A33509` | Terracotta Dark | Button hover state                                |
| `--tc-light`        | `#FEF2EE` | Terracotta Tint | Button outline hover background                   |
| `--amber`           | `#D97706` | Amber           | Population badges, active filters, license status |
| `--amber-light`     | `#FEF3C7` | Amber Light     | Badge backgrounds                                 |
| `--border`          | `#E7E5E4` | Stone 200       | All borders                                       |

### Semantic Colors
| Purpose   | Background  | Text/Border  |
|-----------|-------------|--------------|
| Success   | `#ECFDF5`   | `#065F46` / `#A7F3D0` |
| Warning   | `#FEF3C7`   | `#92400E` / `#FDE68A` |
| Error     | `#FEF2F2`   | `#991B1B` / `#FECACA` |
| Info      | `#EFF4FA`   | `#1E3A5F` / `#BFDBFE` |

### Contrast Ratios
- Terracotta `#C2410C` on White: **4.8:1** — WCAG AA ✓
- Navy `#1E3A5F` on White: **10.3:1** — WCAG AAA ✓
- Near-Black `#1C1917` on Parchment `#FAF7F2`: **15.1:1** — WCAG AAA ✓
- Dark Amber `#92400E` on Amber Light `#FEF3C7`: **5.2:1** — WCAG AA ✓

### Dark Mode
Not implemented. The warm-parchment aesthetic is the brand identity. Dark mode would undermine it and isn't expected for a civic/government-adjacent directory.

## Spacing

- **Base unit:** 8px
- **Density:** Comfortable — users are stressed and often less tech-savvy. Give them room.

| Token | Value | Usage                              |
|-------|-------|------------------------------------|
| 2xs   | 4px   | Icon gaps, tight inline spacing    |
| xs    | 8px   | Badge gaps, tight row spacing      |
| sm    | 16px  | Card internal section gap          |
| md    | 20–24px | Card padding, component gap      |
| lg    | 32px  | Between card sections              |
| xl    | 48px  | Between page-level sections        |
| 2xl   | 64px  | Hero section vertical padding      |

## Layout

- **Approach:** Grid-disciplined with editorial hero — strict column grid for search/results (predictability while scanning 20 cards), more expressive for hero headline and About page
- **Max content width:** 1200px
- **Grid:** 12 columns desktop, 6 tablet, 4 mobile
- **Card grid:** `repeat(auto-fill, minmax(340px, 1fr))` — 3 across at 1200px, 2 at tablet
- **Sidebar:** 340px fixed width alongside the main content column

### Border Radius Scale
| Token    | Value  | Usage                              |
|----------|--------|------------------------------------|
| sm       | 6px    | Filter selects, small chips        |
| md       | 10px   | Buttons, inputs, small cards       |
| lg       | 16px   | Program cards, panels              |
| full     | 9999px | Badges, pills, hero tag            |

## Motion

- **Approach:** Minimal-functional — only transitions that aid comprehension. No decorative animation. Nothing that makes the site feel like a product demo.

| Duration  | Range      | Usage                                    |
|-----------|------------|------------------------------------------|
| micro     | 50–100ms   | Hover states, button press, icon swap    |
| short     | 150–250ms  | Filter results update, card hover lift   |
| medium    | 250–400ms  | Accordion expand/collapse, modal open    |
| long      | 400–700ms  | Page transitions (use sparingly)         |

- **Easing:** enter: `ease-out` · exit: `ease-in` · move: `ease-in-out`
- **Card hover:** `translateY(-1px)` + shadow upgrade — subtle, not bouncy

## Component Patterns

### Program Cards
- `border-left: 4px solid var(--terracotta)` on every card
- Program name in Fraunces, 18px, weight 600
- Legal entity name in DM Sans caption style
- Population specialization badges: amber tint, violet tint (existing pattern — keep as-is)
- AI summary box: blue-50 background (existing — keep)
- Community sentiment bullet dots: terracotta (upgrade from blue-400)
- Action buttons: terracotta primary, terracotta outline for map

### Filter Bar
- Background: white surface on parchment
- Select elements: navy-light background, navy text, 1.5px navy border
- Result count: muted label with terracotta number

### Hero Section
- Photo background with `rgba(0,0,0,0.45)` dark overlay (current — keep)
- Headline: Fraunces with italic on the accent phrase
- Tag line pill: `bg-white/15` with `border-white/25`
- Subheadline: 18–20px Instrument Sans, blue-100 text (visible on dark overlay)
- Trust indicators: DM Sans, blue-200 text

### Sidebar / Funding Guide
- Header: navy background, Fraunces title in white
- FAQ questions: DM Sans 14px, weight 600, navy color
- FAQ answers: Instrument Sans 13px, muted color

## Decisions Log

| Date       | Decision                              | Rationale                                                                 |
|------------|---------------------------------------|---------------------------------------------------------------------------|
| 2026-05-24 | Initial design system created         | /design-consultation; research of 211.org, DDS, regional center sites     |
| 2026-05-24 | Fraunces over sans for display        | No comparable site uses a serif — signals "made by a person who cares"    |
| 2026-05-24 | Parchment background (#FAF7F2)        | Breaks from every government/healthcare site; warmth without decoration   |
| 2026-05-24 | Terracotta as primary action color    | California earth tone; warm, encouraging; nothing like the blue-gray field|
| 2026-05-24 | Navy retained in palette              | Parents navigating a state system need credibility/trust signal           |
| 2026-05-24 | No dark mode                          | Warm-parchment aesthetic is the brand; dark mode would undermine it       |
