# Design Document — Option A: Multi-Theme Panel Layout

**Version:** 2.0  
**Date:** 2026-05-10  
**Reference mockups:**
- `docs/frontend/redesign-A-calm.svg` — Clinical Teal (Calm)
- `docs/frontend/redesign-A-coffee.svg` — Warm Cream (Coffee)
- `docs/frontend/redesign-A-mint.svg` — Vibrant Teal (Mint)

**Status:** Proposed

---

## 1. Overview

Option A replaces the current labeled 220px sidebar with a compact **52px icon-only rail** and restructures the document view into three vertical panels: navigation rail → document list → content/detail pane. A persistent AI Insights strip runs along the right edge of the detail panel.

Three color themes are available. Visual identity is defined per theme (see §4). Target user: **power users who live inside the app** — privacy-conscious individuals managing large document collections who prefer information density over discoverability.

---

## 2. Layout Architecture

```
┌─────┬──────────────┬──────────────────────┬──────────┐
│ 52  │   300px      │   flex-1             │  240px   │
│ nav │ doc list     │   PDF preview        │ AI panel │
│ rail│              │                      │          │
└─────┴──────────────┴──────────────────────┴──────────┘
```

### 2.1 Icon Rail (52px fixed)

- Icons: Home, Documents (active), Search, Contacts, Timeline, Tags, Settings; Lock + Profile avatar pinned to bottom
- Active state: amber `#F0A500` left border (3px) + icon tint
- Tooltip on hover: 400ms delay, right-aligned, `role="tooltip"` + `aria-describedby`
- Every button: `aria-label` required (WCAG 1.1.1)
- `data-testid="nav-rail"`

### 2.2 Document List Panel (300px, resizable 240–400px)

- Virtualised scroll (react-virtuoso) for large collections
- Row: type icon + title (truncated 1 line) + date + category pill
- Flagged docs: amber `⚑` indicator + row tint `rgba(240,165,0,0.08)`
- Selected: `#1C2128` bg + amber 2px left border
- Filter bar: search input + category dropdown + date range picker
- `data-testid="document-list-panel"`

### 2.3 PDF Preview Panel (flex-1)

- pdfjs-dist rendered in `<canvas>` — full toolbar control, ~450KB gz
- Toolbar: zoom ±, rotate, page n/total, fullscreen toggle
- Non-PDF fallback: text preview
- `data-testid="document-preview-panel"`

### 2.4 AI Insights Panel (240px, collapsible)

Four sections render top-to-bottom. All data comes from local SQLite — no cloud calls.

#### 2.4.1 Summary

Plain-English summary surfaced from `extracted_info.summary` (populated during OCR pipeline). Displayed as 2–4 sentence paragraph, truncated at 300 chars with expand toggle. Falls back to "No summary available" when the field is empty.

#### 2.4.2 Flagged Lab Values

Reads `Vec<FlaggedValue>` from `get_flagged_lab_values(doc_id)` Rust command. Each row: analyte name + value + unit + status pill (`HIGH` red `#DC2626` / `LOW` amber `#D97706` / `BORDERLINE` orange `#F59E0B` / `NORMAL` green `#16A34A`). Empty state: "No flagged values found." Hides section entirely for non-lab documents.

#### 2.4.3 Extracted Details

Displays structured fields parsed from `extracted_info` JSON:
- **Doctor** — name from `extracted_info.doctor`
- **Clinic** — name from `extracted_info.clinic`
- **Date** — formatted `DD MMM YYYY` from `extracted_info.date`
- **Category** — document category pill
- **Tags** — comma-separated tag chips

Each field shows "—" when absent.

#### 2.4.4 Related Documents

Calls `get_linked_documents(doc_id)` which returns docs sharing the same doctor or clinic. Renders as compact list: type icon + title (truncated) + date. Max 5 items; "Show all" navigates to filtered document list. Empty state: "No related documents."

---

**Panel behaviour:**
- Collapse: chevron button, panel slides right 200ms ease, width transitions to 0
- `data-testid="ai-insights-panel"`

---

## 3. Component Breakdown

| Component | File | Responsibility |
|-----------|------|----------------|
| `VaultLayout` | `src/components/layout/VaultLayout.tsx` | Root 4-panel CSS Grid |
| `IconRail` | `src/components/layout/IconRail.tsx` | 52px nav rail + tooltips |
| `DocumentListPanel` | `src/components/documents/DocumentListPanel.tsx` | Virtualised list + filters |
| `DocumentPreviewPanel` | `src/components/documents/DocumentPreviewPanel.tsx` | pdfjs-dist renderer |
| `AiInsightsPanel` | `src/components/documents/AiInsightsPanel.tsx` | Entities + flags + linked docs |
| `FlaggedValueBadge` | `src/components/shared/FlaggedValueBadge.tsx` | LOW / HIGH / BORDERLINE pill |
| `tokens-vault.css` | `src/styles/tokens-vault.css` | Dark palette CSS variables |

---

## 4. CSS Token Changes

Three named themes ship with Option A. The active theme is stored in user settings and applied via `data-theme` on `<html>`. All existing screens use `--color-*` variables — every page must be audited for hardcoded Tailwind color classes before launch.

### 4.1 Calm — Clinical Teal

Medical trust. Best for users who want a clinical, focused environment.

```css
:root[data-theme="calm"] {
  --color-bg:             #EBF5F7;
  --color-surface:        #FFFFFF;
  --color-surface-raised: #DCEEF5;
  --color-border:         #C4E0E8;
  --color-text:           #1B3852;
  --color-text-secondary: #5A7A8C;
  --color-primary:        #1A93A7;
  --color-primary-dim:    rgba(26,147,167,0.12);
  --color-rail-bg:        #1A3347;
  --color-flagged-low:    #D97706;
  --color-flagged-high:   #DC2626;
  --color-flagged-ok:     #16A34A;
  --sidebar-width:        52px;
  --doc-list-width:       300px;
  --ai-panel-width:       240px;
}
```

### 4.2 Coffee — Warm Cream

Human and warm. Best for users who find clinical themes cold or clinical.

```css
:root[data-theme="coffee"] {
  --color-bg:             #EDE8DF;
  --color-surface:        #FAF7F2;
  --color-surface-raised: #EDE0CF;
  --color-border:         #D9CFC4;
  --color-text:           #2C1F12;
  --color-text-secondary: #8C7B6B;
  --color-primary:        #C8956A;
  --color-primary-dim:    rgba(200,149,106,0.12);
  --color-rail-bg:        #3D2B1A;
  --color-flagged-low:    #D97706;
  --color-flagged-high:   #DC2626;
  --color-flagged-ok:     #16A34A;
  --sidebar-width:        52px;
  --doc-list-width:       300px;
  --ai-panel-width:       240px;
}
```

### 4.3 Mint — Vibrant Teal

Fresh and clear. Best for users who want energy and clarity without clinical coldness.

```css
:root[data-theme="mint"] {
  --color-bg:             #F0FAFA;
  --color-surface:        #FFFFFF;
  --color-surface-raised: #E0F7F6;
  --color-border:         #C2E8E8;
  --color-text:           #162E2E;
  --color-text-secondary: #5A9E9E;
  --color-primary:        #17C3B2;
  --color-primary-dim:    rgba(23,195,178,0.12);
  --color-rail-bg:        #1C3535;
  --color-flagged-low:    #D97706;
  --color-flagged-high:   #DC2626;
  --color-flagged-ok:     #16A34A;
  --sidebar-width:        52px;
  --doc-list-width:       300px;
  --ai-panel-width:       240px;
}
```

**Scope risk:** All existing screens use `--color-*` variables. The active theme applies globally via `data-theme` on `<html>`. Every page must be audited for hardcoded Tailwind color classes before launch.

---

## 5. New Rust Commands Required

| Command | Input | Output | Effort |
|---------|-------|--------|--------|
| `get_flagged_lab_values` | `doc_id: String` | `Vec<FlaggedValue>` (`name`, `value`, `unit`, `status: LOW\|HIGH\|BORDERLINE\|NORMAL`) | 1 day |
| `get_linked_documents` | `doc_id: String` | `Vec<DocSummary>` (docs sharing same doctor/clinic) | 0.5 day |
| `get_document_preview_url` | `doc_id: String` | `String` (local file:// path for PDF) | 0.5 day |

All read-only. No schema changes — `flagged_values` read from existing `extracted_info` JSON column.

---

## 6. Implementation Effort Estimate

| Area | Detail | Estimate |
|------|--------|----------|
| CSS tokens + dark theme scaffolding | Token file, ThemeProvider, Tauri window bg, existing-component audit | **2 days** |
| `IconRail` | Icons, active state, tooltips, aria, keyboard nav | **1.5 days** |
| `DocumentListPanel` | react-virtuoso integration, filter bar, flagged row, selection state | **2 days** |
| `DocumentPreviewPanel` | pdfjs-dist setup, canvas renderer, toolbar, fallback text view | **2.5 days** |
| `AiInsightsPanel` | Entity display, flagged values, linked docs, collapse animation | **2 days** |
| `VaultLayout` CSS Grid | 4-panel grid, resize handle, AI panel collapse at <1400px | **1 day** |
| Rust commands (3) | `get_flagged_lab_values`, `get_linked_documents`, `get_document_preview_url` | **2 days** |
| Feature flag / migration | Settings toggle, existing routes preserved, no-op on flag=off | **1 day** |
| Unit + integration tests | Component tests + Rust command tests | **2 days** |
| E2E tests | Playwright flows (see `e2e/redesign-A-vault.spec.ts`) | **1.5 days** |
| **Total** | | **~17.5 days** |

**Optimistic:** 13 days  
**Realistic:** 17–18 days  
**Pessimistic:** 24 days (pdfjs-dist integration issues; full dark-theme component audit takes longer than expected)

**Solo developer schedule:**
- Week 1: Tokens + component audit + IconRail + DocumentListPanel
- Week 2: PDF preview + AI panel + Rust commands
- Week 3: Layout, feature flag, tests, accessibility audit, polish

---

## 7. Risk Assessment

### R-A1 — PDF Renderer Integration (MEDIUM-HIGH)

**Issue:** Tauri v2's embedded WebKit cannot render PDF to `<canvas>` natively. The canonical solution (pdfjs-dist) ships ~450KB gzipped — well above the 300KB app-page JS budget defined in `rules/web/performance.md`. Bundling it unconditionally bloats every page load, not just document detail views.

**Root cause detail:** pdfjs-dist includes a worker script (`pdf.worker.js`, ~380KB gz) plus the main library (~70KB gz). Both must be loaded before a PDF can render. There is no tree-shakeable subset.

**Mitigation options (in order of preference):**

1. **Dynamic import + code-split worker** — `const pdfjsLib = await import('pdfjs-dist')` fires only when user opens a PDF. Next.js splits this into a separate chunk at build time. Bundle stays under 300KB for all other pages. Worker URL must be set explicitly: `pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`. This is the recommended path.

2. **`<iframe>` via Tauri `asset://` protocol** — serve the PDF file through Tauri's custom asset protocol, then embed it in `<iframe src="asset://...">`. The OS-native PDF viewer (Preview on macOS) renders it — zero JS bundle cost. Limitation: no custom toolbar, no page-level text selection from JS, no highlight/annotation. Acceptable for v1 if dynamic import is infeasible.

3. **Tauri shell `open` command** — open the file in the system default PDF viewer (`tauri::api::shell::open`). Simplest path, leaves the app entirely. Use as last resort fallback only.

**Decision gate:** Spike option 1 in week 1. Measure chunk size after dynamic import. If still over budget or WebKit worker URL resolution fails, fall back to option 2. Record result in `docs/LESSONS_LEARNT.md`.

**Impact if unmitigated:** In-app PDF preview (the core UX differentiator of Option A) is lost or degrades to an external viewer — undermines the panel layout's purpose.

---

### R-A2 — Dark Theme Scope (HIGH)

**Issue:** Switching from CSS variable tokens to `data-theme="vault"` requires every existing component to use token variables, not hardcoded Tailwind classes. Current codebase has mixed usage (e.g. `text-gray-500` rather than `text-[var(--color-text-secondary)]`).

**Mitigation:** Run a grep audit (`grep -r 'text-gray\|bg-white\|border-gray' src/`) before starting. Budget 1–2 days for token migration across all pages (Dashboard, Contacts, Clinics, Notes, Settings, Timeline, Trash). Do not ship partial dark mode.

**Impact if unmitigated:** Settings, Clinics, and Notes pages render with white/light backgrounds inside dark shell — looks broken.

---

### R-A3 — Icon-Only Navigation Accessibility (MEDIUM)

**Issue:** Icon-only rail without visible labels fails WCAG 2.1 SC 1.3.1 and SC 2.4.6 for users relying on screen readers or low-vision magnification.

**Mitigation:** Every `<button>` and `<a>` in rail must have `aria-label`. Tooltip implemented as `role="tooltip"` with `aria-describedby`. Run axe-core in CI on `VaultLayout` storybook story before merge.

**Impact if unmitigated:** Accessibility regression vs. current labeled sidebar — potential WCAG non-compliance.

---

### R-A4 — Layout Overflow at 1280px (LOW)

**Issue:** 52 + 300 + preview + 240 = 1340px minimum. Most 13" MacBooks run at 1280px effective resolution.

**Mitigation:** Auto-collapse AI panel below 1400px (`@container` or JS resize observer). Document minimum supported width = 1280px.

**Impact if unmitigated:** AI panel overflows or is unusable on 13" MacBook Air.

---

### R-A5 — Virtualised List Edge Cases (LOW)

**Issue:** react-virtuoso requires stable key + height estimation. Documents with long titles or multi-line metadata cause variable row heights that may cause layout thrash on rapid scroll.

**Mitigation:** Cap title to one line (ellipsis). Cap metadata to one line. Fixed row height = 56px. Test with fixture of 1000+ documents.

**Impact if unmitigated:** Scroll jank or incorrect row positions on large collections.

---

## 8. Phase 2 — System-Wide Theme Switcher (Lower Priority)

Phase 1 ships one hardcoded theme (Calm recommended as default). Phase 2 adds a user-facing theme picker.

**Scope:**
- Settings page: radio group — Calm / Coffee / Mint
- Theme stored in SQLite `user_settings` table (key: `ui_theme`, values: `calm` | `coffee` | `mint`)
- Applied at app boot: read setting → set `data-theme` on `<html>` before first paint (avoids flash)
- No CSS-in-JS required — pure CSS custom properties switch instantly

**Effort:** ~2 days (settings UI + persistence + flash-of-wrong-theme guard)

**Risk:** Low. All token variables already defined per theme. No component changes needed if Phase 1 token audit is complete.

**Dependency:** Phase 1 token audit must be complete before Phase 2 ships — partial token migration + theme switching = guaranteed visual regressions.

---

## 9. Open Questions

1. Which theme ships as the Phase 1 default — Calm recommended but final decision deferred to user testing.
2. PDF scroll position and zoom level: persist per-document in localStorage or Zustand?
3. AI Insights panel collapse state: persist across sessions?
4. Feature flag delivery: env var / settings toggle / build-time constant?
5. Resize handle on document list panel: persist width in localStorage?
