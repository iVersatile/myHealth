# Design Document — Option D: macOS Bento Dashboard

**Version:** 1.0  
**Date:** 2026-05-10  
**Reference mockup:** `docs/frontend/redesign-D-bento.svg`  
**Status:** Proposed

---

## 1. Overview

Option D replaces the current document-list-first layout with a **bento grid dashboard** as the home screen. Users see their health at a glance through variable-size tiles: recent documents, a health score ring, flagged lab values, upcoming reminders, timeline, doctor roster, and activity chart. Navigation uses a labeled sidebar (matching existing width) rather than an icon rail. Visual identity: Apple-inspired light `#F5F5F7` background with white tile surfaces, Apple Blue `#007AFF` accent.

Target user: **casual-to-moderate users** — individuals who open the app weekly for health check-ins, prefer visual summaries over dense lists, and are familiar with iOS/macOS design language.

---

## 2. Layout Architecture

```
┌──────────────┬────────────────────────────────────────┐
│   220px      │  flex-1 — Bento Grid                   │
│   sidebar    │                                         │
│   (existing) │  ┌──────────┬──────────┬──────────┐   │
│              │  │ Recent   │ Health   │ Flagged  │   │
│              │  │ Docs     │ Score    │ Values   │   │
│              │  │ (2×1)    │ (1×1)    │ (1×2)    │   │
│              │  ├──────────┴──────────┼──────────┤   │
│              │  │ Timeline  (2×1)     │ Reminders│   │
│              │  ├────────────────────┤  (1×1)   │   │
│              │  │ Doctors   (2×1)    ├──────────┤   │
│              │  ├────────────────────┤ Activity │   │
│              │  │ Quick Actions(2×1) │ Chart    │   │
│              │  └────────────────────┴──────────┘   │
└──────────────┴────────────────────────────────────────┘
```

Grid: `repeat(3, 1fr)` columns, `auto` rows, `16px` gap. Tiles use `grid-column: span N` / `grid-row: span N`.

### 2.1 Sidebar

Existing `Sidebar.tsx` — 220px, labeled items, no structural change needed. Bento grid replaces the content area at `/` (Dashboard route).

### 2.2 Bento Grid Tiles

| Tile | Grid span | Content |
|------|-----------|---------|
| **Recent Documents** | col 1–2, row 1 | 5 most-recently uploaded docs; each row: type icon + title + date + category pill; click → `/documents?id=X` |
| **Health Score** | col 3, row 1 | SVG ring (0–100) + score number + trend arrow (↑↓→); green ≥80, amber 50–79, red <50 |
| **Flagged Lab Values** | col 3, rows 1–2 | HIGH/LOW values from last 90 days; each row: test name + value + unit + status pill |
| **Timeline** | col 1–2, row 2 | Horizontal scroll of last 6 events (date bubble + title); click → `/timeline` |
| **Reminders** | col 3, row 2 | Next 3 upcoming reminders; empty state CTA to create |
| **Doctors** | col 1–2, row 3 | Horizontal card row of top 4 doctors (avatar initials + name + specialty); click → `/contacts?id=X` |
| **Activity Chart** | col 3, rows 3–4 | Sparkline of uploads-per-week (last 12 weeks); SVG, no external charting lib |
| **Quick Actions** | col 1–2, row 4 | 3 buttons: Upload Document, Add Reminder, Export Records |

`data-testid` per tile: `bento-tile-recent-docs`, `bento-tile-health-score`, `bento-tile-flagged-values`, `bento-tile-timeline`, `bento-tile-reminders`, `bento-tile-doctors`, `bento-tile-activity-chart`, `bento-tile-quick-actions`.

---

## 3. Component Breakdown

| Component | File | Responsibility |
|-----------|------|----------------|
| `BentoLayout` | `src/components/layout/BentoLayout.tsx` | CSS Grid container, responsive breakpoints |
| `BentoTile` | `src/components/shared/BentoTile.tsx` | White card surface, shadow, `colSpan`/`rowSpan` props, hover lift |
| `RecentDocsTile` | `src/components/dashboard/RecentDocsTile.tsx` | 5 recent docs list via `get_recent_documents` |
| `HealthScoreTile` | `src/components/dashboard/HealthScoreTile.tsx` | SVG ring + score + trend via `get_health_score` |
| `FlaggedValuesTile` | `src/components/dashboard/FlaggedValuesTile.tsx` | Flagged lab values via `get_flagged_lab_values_recent` |
| `TimelineTile` | `src/components/dashboard/TimelineTile.tsx` | Horizontal scroll via `get_timeline_events` |
| `RemindersTile` | `src/components/dashboard/RemindersTile.tsx` | Upcoming reminders, link to reminders page |
| `DoctorsTile` | `src/components/dashboard/DoctorsTile.tsx` | Top 4 doctor cards from existing contacts data |
| `ActivityChartTile` | `src/components/dashboard/ActivityChartTile.tsx` | SVG sparkline via `get_upload_activity` |
| `QuickActionsTile` | `src/components/dashboard/QuickActionsTile.tsx` | 3 action buttons wired to existing dialogs/routes |
| `tokens-bento.css` | `src/styles/tokens-bento.css` | Light palette CSS variables |

---

## 4. CSS Token Changes

```css
:root[data-theme="bento"] {
  --color-bg:             #F5F5F7;
  --color-surface:        #FFFFFF;
  --color-surface-raised: #FFFFFF;
  --color-border:         rgba(0,0,0,0.08);
  --color-text:           #1D1D1F;
  --color-text-secondary: #6E6E73;
  --color-primary:        #007AFF;
  --color-primary-dim:    rgba(0,122,255,0.10);
  --color-success:        #34C759;
  --color-warning:        #FF9500;
  --color-danger:         #FF3B30;
  --tile-shadow:          0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
  --tile-radius:          16px;
  --tile-gap:             16px;
  --sidebar-width:        220px;
}
```

**Scope:** Light theme only. Existing `--color-*` variables already have sensible light defaults; `tokens-bento.css` overrides surface and accent values only. No existing pages need auditing for dark-mode breakage (contrast with Option A's HIGH risk).

---

## 5. New Rust Commands Required

| Command | Input | Output | Effort |
|---------|-------|--------|--------|
| `get_health_score` | _(none)_ | `HealthScore { score: u8, trend: String }` — derived from metadata completeness ratio + flagged lab value ratio + reminder adherence | 1.5 days |
| `get_recent_documents` | `limit: u8` | `Vec<DocSummary>` (id, title, date, category, doc_type) ordered by `created_at DESC` | 0.25 days |
| `get_timeline_events` | `limit: u8` | `Vec<TimelineEvent>` (id, date, title, event_type) | 0.25 days |
| `get_flagged_lab_values_recent` | `days: u32` | `Vec<FlaggedValue>` (name, value, unit, status, date) for last N days | 0.5 days |
| `get_upload_activity` | `weeks: u8` | `Vec<WeekActivity>` (week_start: String, count: u32) | 0.5 days |

`get_recent_documents` and `get_timeline_events` are simple `ORDER BY … LIMIT` queries. `get_health_score` is the only non-trivial command — score formula requires dedicated Rust unit tests.

---

## 6. Implementation Effort Estimate

| Area | Detail | Estimate |
|------|--------|----------|
| CSS tokens + bento scaffolding | Token file, BentoLayout CSS Grid, BentoTile base card | **1 day** |
| `HealthScoreTile` | SVG ring, score formula in Rust, trend arrow | **2 days** |
| `RecentDocsTile` | Rust command + tile render + click navigation | **1 day** |
| `FlaggedValuesTile` | Rust command + status pills + empty state | **1 day** |
| `TimelineTile` | Horizontal scroll, event bubbles, Rust command | **1 day** |
| `RemindersTile` | Query existing reminders table + empty state CTA | **0.5 days** |
| `DoctorsTile` | Reuse existing contacts query + avatar initials | **0.5 days** |
| `ActivityChartTile` | SVG sparkline, Rust command | **1.5 days** |
| `QuickActionsTile` | 3 buttons wired to existing dialogs/routes | **0.5 days** |
| `BentoTile` shared component | `colSpan`/`rowSpan` props, hover animation | **0.5 days** |
| Responsive breakpoints | 2-column at <1200px, 1-column at <768px | **1 day** |
| Rust commands (5) | See §5 above | **3 days** |
| Unit + integration tests | Component + Rust command tests | **2 days** |
| E2E tests | Playwright flows (see `e2e/redesign-D-bento.spec.ts`) | **1 day** |
| **Total** | | **~16 days** |

**Optimistic:** 12 days  
**Realistic:** 15–17 days  
**Pessimistic:** 21 days (health score formula complexity; SVG sparkline edge cases; grid responsive behaviour at 1280px)

**Solo developer schedule:**
- Week 1: Tokens + BentoLayout + BentoTile + HealthScoreTile + Rust commands
- Week 2: Remaining tiles (RecentDocs, Flagged, Timeline, Doctors, Activity) + unit tests
- Week 3: Responsive breakpoints, E2E tests, accessibility audit, polish

---

## 7. Risk Assessment

### R-D1 — Health Score Formula Validity (MEDIUM-HIGH)

**Issue:** The score formula (metadata completeness + flagged lab ratio + reminder adherence) is novel with no baseline. Users may distrust or misinterpret a score that does not match their intuition about their own records.

**Mitigation:**
1. Show score breakdown on hover: "Metadata: 80% · Lab flags: 2 HIGH · Reminders: 6/10 met."
2. Label prominently as "Records Completeness Score" — not a clinical health score.
3. Make formula transparent in Settings → About.
4. Gate behind a feature flag; default off until user-validated.

**Impact if unmitigated:** Users lose trust in the app if the score feels arbitrary or alarming.

---

### R-D2 — Grid Overflow at 1280px (MEDIUM)

**Issue:** 3-column bento grid + 220px sidebar ≈ 1300px minimum. 13" MacBooks run at ~1280px effective resolution.

**Mitigation:**
- Drop to 2-column grid below 1280px (`@container` or media query). Wide tiles reflow to full 2-col width.
- Drop to 1-column below 768px (handles narrow window resize).
- Set `minWidth: 800` in `tauri.conf.json` window constraints.

**Impact if unmitigated:** Grid tiles overflow or overlap on 13" MacBook at default resolution.

---

### R-D3 — Health Score Rust Complexity (MEDIUM)

**Issue:** `get_health_score` joins documents, extracted_info (JSON parsing), reminders, and contacts. Multi-table joins with JSON column parsing can be slow on large datasets and hard to debug.

**Mitigation:**
- Implement as 3 separate sub-queries combined in Rust (not a single SQL JOIN) for debuggability.
- Cache result with 5-minute TTL in a `dashboard_cache` settings row.
- Dedicated Rust unit tests for each sub-metric independently.

**Impact if unmitigated:** Slow dashboard load; incorrect scores; hard-to-diagnose query failures.

---

### R-D4 — SVG Sparkline Edge Cases (LOW)

**Issue:** Zero uploads across multiple weeks produces degenerate SVG paths (vertical line, NaN coordinates). First-time users with <2 weeks of data will see broken or empty charts.

**Mitigation:**
- Pad data to minimum 4 weeks with zero-count entries.
- Show "Start uploading documents to see activity" empty state when all values are zero.
- Clamp Y-axis minimum to 1 to avoid zero-height path segments.

**Impact if unmitigated:** Broken SVG for new users; console errors visible in Tauri devtools.

---

### R-D5 — Dashboard as Landing Page Regression (LOW)

**Issue:** Replacing `/` (currently redirects to `/documents`) with a bento dashboard changes navigation assumptions. Existing E2E tests that `goto('/')` will land on the bento grid instead of documents.

**Mitigation:**
- Keep `/documents` route fully functional and accessible via sidebar.
- Dashboard links into `/documents`, `/timeline`, `/contacts` — no orphaned content.
- Audit existing E2E tests for `goto('/')` assumptions before shipping; update or guard behind feature flag redirect.

**Impact if unmitigated:** Existing E2E suite failures on route assumptions; users who open the app expecting documents see an unfamiliar screen.

---

## 8. Open Questions

1. Should the health score be opt-in or shown by default?
2. Tile order: should users be able to drag-and-drop reorder tiles? (adds `dnd-kit` dependency)
3. Bento theme: system-wide or only on the dashboard route?
4. Activity chart: uploads per week, or app-opens per week?
5. Flagged values tile: which date window (last 30 / 60 / 90 days)?
6. Doctors tile: sorted by most recent document date, or alphabetically?
