# myHealth — Execution Plan (v1.3)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Phase: 50 — PDF Summary Report Export
```

▶ **50.1** — Design PDF report structure and Rust command

---

## Status Legend

```
[x]  complete
[ ]  pending
▶    next action (exactly one at any time)
```

---

## Scope Reference

**v1.1 (SHIPPED — Phases 0–32)**

| Feature | Source | Status |
|---------|--------|--------|
| F2.2–F2.5 OCR pipeline | PRD_V2 §F2 | ✅ |
| F3.2–F3.5 Many-to-many categories + bulk ops | PRD_V2 §F3 | ✅ |
| F4 Apple Calendar integration (macOS) | PRD_V2 §F4 | ✅ |
| F5.3–F5.4 Contact deduplication + merge | PRD_V2 §F5 | ✅ |
| F6 Document-appointment link scoring | PRD_V2 §F6 | ✅ |
| V3-F1 Category auto-creation when suggestion accepted | PRD_V3 §V3-F1 | ✅ |
| V3-F2 Contact auto-creation (UK phone regex + full save) | PRD_V3 §V3-F2 | ✅ |
| V3-F3 Clinic: CRN, multi-address, clinic↔contact link | PRD_V3 §V3-F3 | ✅ |
| V3-F4 Tag auto-extraction (type, provider, specialty, date) | PRD_V3 §V3-F4 | ✅ |
| V3-F5 Timeline tabs (Chronological, By Category, By Doctor, By Uploaded Date) | PRD_V3 §V3-F5 | ✅ |
| Trash / restore / permanent-delete | Phase 32 | ✅ |

**v1.2 (SHIPPED — Phases 33–35)**

| Feature | Source | Status |
|---------|--------|--------|
| V3-F5 Editable activity_date on document detail page | PRD_V3 §V3-F5 | ✅ Phase 33 |
| V3-F6 Auto-create appointment suggestion from invoice upload | PRD_V3 §V3-F6 | ✅ Phase 34 |
| E2E green gate (all tests passing) | — | ✅ Phase 35 |

**v1.3a (SHIPPED — Phases 36–37)**

| Feature | Source | Status |
|---------|--------|--------|
| Advanced search filters (date range, category combo) | PRD_V2 §F3/F6 | ✅ Phase 36 |
| F3.4 Drag-to-organize categories | PRD_V2 §F3 | ✅ Phase 37 |
| F3.7 Auto-archive empty categories | PRD_V2 §F3 | ✅ Phase 37 |

**v1.8 Content Intelligence (SHIPPED — Phases 38–42)**

| Feature | Source | Status |
|---------|--------|--------|
| Surface `extracted_text` + Notes auto-tag + FTS5 content search | Gap 1 | ✅ Phase 38 |
| Cross-document content search + timeline grouping + summary | Gap 2 | ✅ Phase 39 |
| Structured entity extraction (medications, diagnoses, lab values, referrals) | Gap 3 | ✅ Phase 40 |
| E2E gap closing (6 gaps) | Phase 41 | ✅ Phase 41 |
| FTS5 index fix: extracted_text not returning in search | Phase 42 | ✅ Phase 42 |

**v1.4 (SHIPPED — Phases 43–49)**

| Feature | Source | Status |
|---------|--------|--------|
| Notes UX — create-from-context, OCR prefill, linked notes panel, empty-state | Phase 43 | ✅ Phase 43 |
| Symptom entity (CRUD + linking + FTS5) | Phase 44 | ✅ Phase 44 |
| Medication entity (CRUD + linking + FTS5) | Phase 44 | ✅ Phase 44 |
| Unified content search: documents + notes + symptoms + medications | Phase 45 | ✅ Phase 45 |
| Content search filters: entity-type chips + date range | Phase 46 | ✅ Phase 46 |
| CI fix: Next.js static export + dynamic routes | Phase 47 | ✅ Phase 47 |
| Hardcoded filter tech debt cleanup | Phase 48 | ✅ Phase 48 |
| OCR text preview in upload review step | Phase 49 | ✅ Phase 49 |

**v1.3b (in progress — Phases 50–62)**

| Feature | Source | Priority | Effort | Status |
|---------|--------|----------|--------|--------|
| PDF summary report export | PRD_V2 Phase 2 | MED | Medium | ⬜ Phase 50 |
| Batch Document Upload with Draft Entity Flow | PRD §F9 | HIGH | Large | ⬜ Phases 58–62 |
| UX Redesign — Option A (Multi-Theme Panel Layout) | docs/frontend/redesign-design-A.md | HIGH | Large | ⬜ Phases 51–57 |

> **Execution order:** 50 → 58 → 59 → 60 → 61 → 62 → 51 → 52 → 53 → 54 → 55 → 56 → 57
> Batch upload (58–62) executes before redesign-A (51–57) despite higher phase numbers.

**v1.5+ (future)**

| Feature | Source | Priority | Effort |
|---------|--------|----------|--------|
| F4.5 Calendar conflict resolution UI | PRD_V2 §F4 | SHOULD | Medium |
| LLM-assisted extraction (on-device Mistral 7B via llama.cpp) | PRD_V4 | POST-MVP | Large |
| Outlook Calendar sync (Windows) | PRD_V2 Phase 3 | MED | Large |
| iCalendar import/export (.ics) | PRD_V2 Phase 3 | MED | Medium |
| AI appointment notes summarization | PRD_V2 Phase 3 | LOW | Large |
| Medical code tagging (ICD-10) | PRD_V2 Phase 3 | LOW | Medium |
| Multi-user vault support | PRD_V2 Phase 3 | LOW | Large |
| System-wide theme switcher (Calm / Coffee / Mint picker) | redesign-design-A.md §8 | LOW | Small |

**Coverage requirement:** ≥ 80% across all new code

---

## Phase 50 — PDF Summary Report Export

**Goal:** Generate a portable PDF summary report for a document (or set of documents) — includes metadata, extracted entities, linked appointments, and OCR text excerpt. User can export via a button on the document detail page.

**Done when:**
- "Export Report" button on document detail page triggers PDF generation
- Generated PDF contains: document title, date, category, doctor, clinic, extracted entities (medications, diagnoses, lab values), linked appointments, first 400 chars of OCR text
- File saved to user's chosen location via Tauri file dialog
- Unit + E2E tests pass

### Sprint 50

[ ] **50.1 — Design report structure + Rust command `documents_export_report`**
   - Input: `document_id: String`
   - Fetch document metadata, entities, linked appointments from SQLite
   - Return `ReportData` struct (title, date, category, doctor, clinic, entities grouped by type, appointments, ocr_excerpt)
   - No PDF rendering in Rust — return data; rendering happens in frontend
   - Done when: `cargo test` passes with fixture data; struct serialises to JSON correctly

[ ] **50.2 — Frontend: PDF rendering with `@react-pdf/renderer`**
   - Add `@react-pdf/renderer` (lightweight, no worker) — check bundle size impact
   - If > 50KB gz impact, use dynamic import to keep page budget under 300KB
   - Create `src/components/documents/DocumentReport.tsx` — `<Document>` + `<Page>` with sections for metadata, entities, appointments, OCR excerpt
   - Done when: `npx tsc --noEmit` passes; PDF renders correctly in dev

[ ] **50.3 — Wire "Export Report" button on DocumentDetailClient**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`
   - Add "Export Report" button in header actions
   - On click: `invoke('documents_export_report', { documentId })` → render PDF → trigger download via `URL.createObjectURL`
   - Add `data-testid="export-report-btn"` to button
   - Done when: clicking button downloads a PDF file

[ ] **50.4 — Unit test: report data assembly**
   - Mock `invoke('documents_export_report')` returning fixture data
   - Assert `export-report-btn` present; assert clicking triggers download (mock URL.createObjectURL)
   - Done when: `npx vitest run` passes

[ ] **50.5 — E2E spec: PDF export flow**
   - File: `e2e/pdf-export.spec.ts`
   - Upload `medical-invoice.pdf` → navigate to document detail
   - Assert `export-report-btn` is visible
   - Click → assert file download triggered (Playwright download event)
   - Done when: `npx playwright test e2e/pdf-export.spec.ts` passes

[ ] **50.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: PDF summary report export from document detail (Phase 50)`

---

## Phase 58 — Batch Upload: Schema Migration

**Goal:** Add `is_draft` column to entity tables and `batch_upload_id` to `documents`. All existing queries must exclude draft rows. No data lost on existing records.

**Done when:**
- Migration adds `is_draft BOOLEAN NOT NULL DEFAULT 0` to: `contacts`, `clinics`, `appointments`, `symptoms`, `medications`, `document_tags`
- Migration adds `batch_upload_id TEXT` to `documents`
- All existing list/search queries (`contacts_list`, `clinics_list`, `appointments_list`, `symptoms_list`, `medications_list`, FTS5 content search, timeline, suggestion banners) have `WHERE is_draft = 0` (or join equivalent) confirmed by grep
- `cargo test` passes
- `npx tsc --noEmit` passes

### Sprint 58

[ ] **58.1 — SQLite migration: add `is_draft` + `batch_upload_id` columns**
   - Add migration in `src-tauri/src/db/migrations.rs` (next version number)
   - `ALTER TABLE contacts ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0`
   - Same for `clinics`, `appointments`, `symptoms`, `medications`
   - `ALTER TABLE document_tags ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0`
   - `ALTER TABLE documents ADD COLUMN batch_upload_id TEXT`
   - Done when: migration runs without error on clean + existing DB

[ ] **58.2 — Grep audit: find all list/search queries missing `is_draft` filter**
   - `grep -rn 'SELECT.*FROM contacts\|SELECT.*FROM clinics\|SELECT.*FROM appointments\|SELECT.*FROM symptoms\|SELECT.*FROM medications' src-tauri/src/`
   - Add `AND is_draft = 0` to all production list queries; exclude from FTS5 idx if entity row is draft
   - Done when: all list commands return only non-draft rows

[ ] **58.3 — Rust unit tests: existing queries unaffected**
   - Insert fixture with `is_draft = 1`; assert it does NOT appear in list results
   - Insert fixture with `is_draft = 0`; assert it DOES appear
   - Done when: `cargo test` passes

[ ] **58.4 — Pre-commit checks + commit**
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - `npx tsc --noEmit`
   - Commit: `feat: schema migration — is_draft entity columns + batch_upload_id (Phase 58)`

---

## Phase 59 — Batch Upload: Draft Pipeline + Per-Document Transactions

**Goal:** Extend the OCR upload pipeline to write entities in draft mode with per-document SQLite transactions. Failed document rolls back its own entities; other docs unaffected.

**Done when:**
- `upload_document` (or new `upload_document_batch`) Rust command wraps each document in `BEGIN … COMMIT/ROLLBACK`
- Extracted entities saved with `is_draft = 1`; `batch_upload_id` set to the UUID for the session
- Duplicate detection: if extracted entity matches existing (`merge_candidate_id` stored on draft row)
- On OCR/extraction failure for a single doc: that doc + its entities rolled back; batch continues
- `cargo test` passes with fixture covering success + per-doc failure scenarios

### Sprint 59

[ ] **59.1 — Per-document transaction wrapper in Rust**
   - In `src-tauri/src/commands/documents.rs`
   - Wrap existing entity insert calls in explicit `BEGIN` / `COMMIT` / `ROLLBACK` per document
   - `batch_upload_id` = caller-supplied UUID (frontend generates one UUID per upload session)
   - Done when: unit test confirms rollback on simulated OCR error leaves other docs intact

[ ] **59.2 — Draft entity writes**
   - All entity inserts (contacts, clinics, appointments, symptoms, medications, document_tags) during upload set `is_draft = 1`
   - Single upload treated same as batch of 1 — same code path
   - Done when: after upload, `SELECT is_draft FROM contacts WHERE …` returns 1

[ ] **59.3 — Duplicate detection + `merge_candidate_id`**
   - Before inserting draft entity, query for existing non-draft entity with same name/identifier
   - If found: set `merge_candidate_id = <existing_entity_id>` on the draft row
   - Done when: uploading a doc with a known doctor populates `merge_candidate_id` on the draft contact

[ ] **59.4 — Rust unit tests: transaction rollback + duplicate detection**
   - Test 1: simulate OCR failure on doc 2 of 3 → docs 1 and 3 committed; doc 2 rolled back
   - Test 2: existing contact "Dr Smith" exists; upload new doc with "Dr Smith" → draft contact has `merge_candidate_id` set
   - Done when: both tests pass

[ ] **59.5 — Pre-commit checks + commit**
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - `npx tsc --noEmit`
   - Commit: `feat: draft entity pipeline with per-doc transactions + duplicate detection (Phase 59)`

---

## Phase 60 — Batch Upload: UI (Multi-File, Folder, Drag-and-Drop)

**Goal:** Extend the upload dialog to support batch selection — multi-file picker (Ctrl/Cmd+click), folder/directory select, and drag-and-drop zone. Show per-file progress and per-file error state.

**Done when:**
- Upload dialog accepts: multi-file picker, folder select, drag-and-drop zone (all three entry points)
- Each file shows: queued → processing → done / error status in the dialog
- Failed files show error inline; batch continues for remaining files
- On batch complete: toast "N documents uploaded — X entities pending review"
- `data-testid="batch-upload-zone"`, `data-testid="upload-file-row"` present
- Unit + E2E tests pass

### Sprint 60

[ ] **60.1 — Multi-file + folder select in UploadDialog**
   - `src/components/documents/UploadDialog.tsx`
   - `<input type="file" multiple>` already exists — ensure `webkitdirectory` attribute toggleable for folder select
   - Button group: "Select Files" | "Select Folder"
   - `data-testid="batch-upload-zone"`
   - Done when: selecting 3 files queues 3 rows in dialog

[ ] **60.2 — Drag-and-drop zone**
   - `onDragOver` / `onDrop` handlers on drop zone
   - Accept `application/pdf` + `image/*`
   - Visual: dashed border + "Drop files here" label when dragging
   - Done when: dragging files from Finder drops them into queue

[ ] **60.3 — Per-file progress row**
   - `data-testid="upload-file-row"` per queued file
   - States: Queued (grey) → Processing (spinner) → Done (green ✓) → Error (red ✗ + error message)
   - Upload runs sequentially (one at a time) — no parallel OCR to avoid DB contention
   - Done when: 3-file upload shows all 3 rows cycling through states

[ ] **60.4 — Batch complete toast**
   - On all files processed: `toast("N documents uploaded — X entities pending review")` where X = count of `is_draft = 1` entities from this `batch_upload_id`
   - Count via new Rust command `get_draft_entity_count(batch_upload_id: String) → u32`
   - Done when: toast fires with correct counts

[ ] **60.5 — Unit + E2E tests**
   - Unit: mock 3 invoke calls (2 success, 1 failure); assert rows show correct states; assert toast fires
   - E2E: `e2e/batch-upload.spec.ts` — drop 2 PDFs → assert 2 rows done → assert toast with count
   - Done when: all tests pass

[ ] **60.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - Commit: `feat: batch upload UI — multi-file, folder, drag-drop, per-file progress (Phase 60)`

---

## Phase 61 — Batch Upload: Draft Review UI on Entity Pages

**Goal:** Inline draft entity cards on Contacts, Clinics, Appointments, Symptoms, and Medications pages. Each draft row shows a DRAFT badge with Accept / Reject / (if `merge_candidate_id`) Merge actions.

**Done when:**
- Each entity list page shows draft rows above non-draft rows with visible DRAFT badge
- Accept: flips `is_draft = 0` on entity (and its `document_tags` rows) → entity appears normally
- Reject: soft-deletes the draft entity (same Trash flow as doc soft-delete)
- Merge: opens merge dialog (if `merge_candidate_id` set) — user picks which fields to keep; result is one non-draft entity
- Accepted/rejected entities removed from draft section immediately (optimistic update)
- Unit + E2E tests pass

### Sprint 61

[ ] **61.1 — Rust command `get_draft_entities`**
   - Input: `entity_type: String` ("contact" | "clinic" | "appointment" | "symptom" | "medication")
   - Return: `Vec<DraftEntityRow>` — entity fields + `id`, `merge_candidate_id`, `batch_upload_id`, `source_document_id`
   - Register in `lib.rs`
   - Done when: `cargo test` passes with fixture draft rows

[ ] **61.2 — Rust command `accept_draft_entity`**
   - Input: `entity_type: String`, `entity_id: String`
   - `UPDATE <table> SET is_draft = 0 WHERE id = ?`
   - Also flip `is_draft = 0` on related `document_tags` rows where applicable
   - Done when: `cargo test` confirms entity flipped to non-draft and appears in normal list query

[ ] **61.3 — Rust command `reject_draft_entity`**
   - Input: `entity_type: String`, `entity_id: String`
   - Soft-delete: `UPDATE <table> SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?` (reuse existing Trash pattern)
   - Done when: `cargo test` confirms entity no longer in draft or normal list

[ ] **61.4 — Draft section on entity list pages**
   - Contacts (`src/app/(app)/contacts/page.tsx`), Clinics, Appointments, Symptoms, Medications
   - Fetch drafts via `get_draft_entities` on page load
   - Render draft cards above normal list with DRAFT badge (amber pill)
   - Accept button → `accept_draft_entity` → remove card optimistically
   - Reject button → `reject_draft_entity` → remove card optimistically + toast "Draft rejected"
   - If `merge_candidate_id` set: show "Merge" button (opens merge dialog — Phase 61.5)
   - `data-testid="draft-entity-card"`, `data-testid="draft-accept-btn"`, `data-testid="draft-reject-btn"`
   - Done when: draft cards appear; Accept/Reject work; page renders without TypeScript errors

[ ] **61.5 — Merge dialog**
   - `src/components/shared/MergeEntityDialog.tsx`
   - Shows draft entity fields side-by-side with existing entity fields
   - User picks winner per field (radio group per field)
   - On confirm: `merge_draft_entity(entity_type, draft_id, existing_id, field_choices)` Rust command
   - Rust: apply chosen fields to existing entity; soft-delete draft
   - Done when: merge resolves to one non-draft entity with chosen field values

[ ] **61.6 — Unit + E2E tests**
   - Unit: mock draft list; assert DRAFT badge renders; assert Accept removes card; assert Reject fires toast
   - E2E: `e2e/draft-review.spec.ts` — upload PDF → navigate to Contacts → assert draft card → click Accept → assert card gone → assert contact in normal list
   - Done when: all tests pass

[ ] **61.7 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: draft review UI — DRAFT badge, Accept/Reject/Merge on entity pages (Phase 61)`

---

## Phase 62 — Batch Upload: Full Test Suite + Coverage Gate

**Goal:** Close any remaining test gaps for the draft entity pipeline. Confirm 80% coverage across all new Phase 58–61 code. CI green.

**Done when:**
- `npx vitest run --coverage` shows ≥ 80% on all new components and hooks from Phases 58–61
- `cargo test` passes for all new Rust commands (58–61)
- All E2E specs from Phases 60–61 pass: `npx playwright test e2e/batch-upload.spec.ts e2e/draft-review.spec.ts`
- `npx tsc --noEmit` passes
- CI green on develop branch

### Sprint 62

[ ] **62.1 — Coverage audit: identify gaps**
   - Run `npx vitest run --coverage`; identify files < 80%
   - Run `cargo test`; identify any untested command paths
   - Done when: gap list known

[ ] **62.2 — Fill frontend coverage gaps**
   - Add missing unit tests for: `UploadDialog` batch mode, draft entity hooks, `MergeEntityDialog`
   - Done when: all new frontend files ≥ 80%

[ ] **62.3 — Fill Rust coverage gaps**
   - Add missing tests for: transaction rollback edge cases, `merge_draft_entity` field-choice logic
   - Done when: `cargo test` passes with all edge cases covered

[ ] **62.4 — Full E2E run**
   - `npx playwright test e2e/batch-upload.spec.ts e2e/draft-review.spec.ts`
   - Fix any flaky or failing specs
   - Done when: both specs exit 0

[ ] **62.5 — Pre-commit checks + commit + CI**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Push to `origin/develop`; confirm CI green
   - Commit: `test: batch upload full test suite — 80% coverage gate (Phase 62)`

---

## Phase 51 — UX Redesign A: CSS Token Foundation + Theme Scaffolding

**Goal:** Lay the CSS token foundation for Option A's three themes (Calm / Coffee / Mint). Audit all existing components for hardcoded Tailwind colour classes and migrate them to `--color-*` variables. Apply `data-theme="calm"` as the Phase 1 default on `<html>`.

**Reference:** `docs/frontend/redesign-design-A.md` §4

**Done when:**
- `src/styles/tokens-vault.css` exists with all three `[data-theme]` blocks
- `<html>` has `data-theme="calm"` applied at boot (no flash)
- Grep audit `grep -r 'text-gray\|bg-white\|border-gray' src/` returns 0 results in app routes
- All existing pages (Dashboard, Documents, Contacts, Clinics, Notes, Timeline, Trash, Settings, Symptoms, Medications, Content Search) render correctly under the Calm theme
- `npx tsc --noEmit` passes

### Sprint 51

[ ] **51.1 — Create `src/styles/tokens-vault.css` with 3 theme blocks**
   - `[data-theme="calm"]`, `[data-theme="coffee"]`, `[data-theme="mint"]` — full variable sets per §4.1–4.3
   - Import in `src/app/globals.css`
   - Apply `data-theme="calm"` to `<html>` in `src/app/layout.tsx`
   - Done when: CSS variables resolve in browser DevTools under Calm theme

[ ] **51.2 — Grep audit: find all hardcoded Tailwind colour classes in app routes**
   - Run: `grep -rn 'text-gray\|bg-white\|bg-gray\|border-gray\|text-slate\|bg-slate\|text-zinc\|text-neutral' src/app src/components`
   - Produce a list; categorise: safe (test/story files) vs must-fix (production UI)
   - Done when: full list documented as a comment in this task; count of must-fix items known

[ ] **51.3 — Migrate hardcoded colours → CSS variables (batch 1: Documents, Dashboard, Sidebar)**
   - Replace `text-gray-*` → `text-[var(--color-text)]` or `text-[var(--color-text-secondary)]`
   - Replace `bg-white` → `bg-[var(--color-surface)]`
   - Replace `border-gray-*` → `border-[var(--color-border)]`
   - Files: `src/app/(app)/documents/`, `src/app/(app)/page.tsx`, `src/components/layout/Sidebar.tsx`
   - Done when: `npx tsc --noEmit` passes; visual smoke on Calm theme OK

[ ] **51.4 — Migrate hardcoded colours → CSS variables (batch 2: all remaining pages)**
   - Files: Contacts, Clinics, Notes, Timeline, Trash, Settings, Symptoms, Medications, Content Search
   - Done when: grep audit returns 0 must-fix results

[ ] **51.5 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - Commit: `feat: CSS token foundation — 3 themes (Calm/Coffee/Mint), full colour audit (Phase 51)`

---

## Phase 52 — UX Redesign A: IconRail Component

**Goal:** Build the 52px icon-only navigation rail that replaces the current 220px labeled sidebar. The existing sidebar stays but is feature-flagged off when Option A is active.

**Reference:** `docs/frontend/redesign-design-A.md` §2.1, §3

**Done when:**
- `src/components/layout/IconRail.tsx` renders with correct icons, active state, tooltips
- Every button has `aria-label`; tooltips use `role="tooltip"` + `aria-describedby`
- `data-testid="nav-rail"` present
- Feature flag `NEXT_PUBLIC_REDESIGN_A=true` in `.env.local` toggles between old sidebar and new rail
- Keyboard navigation works (Tab order, Enter/Space activation)
- Unit + E2E tests pass

### Sprint 52

[ ] **52.1 — Feature flag setup**
   - Add `NEXT_PUBLIC_REDESIGN_A` env var check in layout
   - When `true`: render `<IconRail>` (52px) instead of `<Sidebar>` (220px)
   - When `false` (default): existing layout unchanged
   - Done when: toggling env var switches layouts; no TypeScript errors

[ ] **52.2 — `IconRail` component**
   - `src/components/layout/IconRail.tsx`
   - Icons: Home, Documents, Search, Contacts, Timeline, Tags, Settings (top group); Lock + Profile avatar (bottom group)
   - Active state: amber `#F0A500` 3px left border + icon tint
   - Tooltip: 400ms delay, right-aligned, `role="tooltip"` + `aria-describedby` on each button
   - `aria-label` on every button
   - `data-testid="nav-rail"`
   - Done when: `npx tsc --noEmit` passes; visual smoke under Calm theme

[ ] **52.3 — Keyboard navigation**
   - Tab order follows visual top-to-bottom order
   - Enter/Space activates nav item
   - Escape closes any open tooltip
   - Done when: full keyboard nav works without mouse

[ ] **52.4 — Unit tests**
   - `src/components/layout/__tests__/IconRail.test.tsx`
   - Assert all nav buttons render with correct `aria-label`
   - Assert active route applies amber border class
   - Assert tooltip renders on hover after 400ms (mock timers)
   - Done when: `npx vitest run` passes

[ ] **52.5 — E2E spec (basic nav)**
   - File: `e2e/redesign-A-icon-rail.spec.ts`
   - With `REDESIGN_A=true`: assert `nav-rail` visible; assert clicking Documents navigates to `/documents`
   - Assert sidebar NOT rendered when flag on
   - Done when: `npx playwright test e2e/redesign-A-icon-rail.spec.ts` passes

[ ] **52.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - Commit: `feat: IconRail component — 52px nav rail with tooltips, aria, keyboard nav (Phase 52)`

---

## Phase 53 — UX Redesign A: DocumentListPanel

**Goal:** Virtualised document list panel (300px) with filter bar, category pills, flagged-doc indicators, and row selection state.

**Reference:** `docs/frontend/redesign-design-A.md` §2.2, §3

**Done when:**
- `src/components/documents/DocumentListPanel.tsx` renders virtualised list via `react-virtuoso`
- Filter bar: search input + category dropdown + date range picker
- Flagged docs: amber `⚑` indicator + row tint
- Selected row: `#1C2128` bg + amber 2px left border
- `data-testid="document-list-panel"` present
- Only rendered when `NEXT_PUBLIC_REDESIGN_A=true`

### Sprint 53

[ ] **53.1 — `react-virtuoso` integration**
   - Add `react-virtuoso` to `package.json` if not present
   - `DocumentListPanel.tsx` — `<Virtuoso>` component with fixed row height 56px
   - Row: type icon + title (1-line ellipsis) + date + category pill
   - `data-testid="document-list-panel"`
   - Done when: renders 1000+ items without scroll jank

[ ] **53.2 — Filter bar**
   - Search input (debounced 300ms) + category dropdown + date range picker
   - Filters invoke `documents_search_filtered` (already implemented in Phase 36)
   - Done when: filtering by category shows only matching docs

[ ] **53.3 — Flagged docs + selection state**
   - Flagged: amber `⚑` + row tint `rgba(240,165,0,0.08)`
   - Selected: `#1C2128` bg + amber 2px left border
   - On row click: emit selected doc to parent
   - Done when: clicking a row highlights it; parent receives doc id

[ ] **53.4 — Unit + E2E tests**
   - Unit: mock 50 docs; assert virtualised list renders; assert filter narrows results
   - E2E: `e2e/redesign-A-doc-list.spec.ts` — assert `document-list-panel` visible; assert filter works
   - Done when: all tests pass

[ ] **53.5 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - Commit: `feat: DocumentListPanel — virtualised, filter bar, flagged indicators (Phase 53)`

---

## Phase 54 — UX Redesign A: DocumentPreviewPanel (pdfjs-dist spike + implementation)

**Goal:** Render PDFs in-app via pdfjs-dist with dynamic import (R-A1 mitigation). Fallback: iframe via Tauri `asset://` if dynamic import fails or exceeds bundle budget.

**Reference:** `docs/frontend/redesign-design-A.md` §2.3, §7 R-A1

**Done when:**
- `src/components/documents/DocumentPreviewPanel.tsx` renders PDF pages on canvas
- pdfjs-dist loaded via dynamic import (chunk size measured and under 300KB gz)
- Toolbar: zoom ±, rotate, page n/total, fullscreen toggle
- Non-PDF fallback: text preview showing `extracted_text`
- `data-testid="document-preview-panel"` present
- Result of spike (dynamic import vs iframe) documented in `docs/LESSONS_LEARNT.md`

### Sprint 54

[ ] **54.1 — Spike: dynamic import of pdfjs-dist — measure chunk size**
   - `const pdfjsLib = await import('pdfjs-dist')`
   - Set `GlobalWorkerOptions.workerSrc` to bundled worker URL
   - Run `next build` and measure chunk size
   - If ≤ 300KB gz: proceed with option 1 (dynamic import)
   - If > 300KB gz: implement option 2 (iframe via Tauri `asset://`)
   - Document result in `docs/LESSONS_LEARNT.md`
   - Done when: decision made and documented

[ ] **54.2 — `DocumentPreviewPanel` component (chosen strategy)**
   - `src/components/documents/DocumentPreviewPanel.tsx`
   - Canvas-based rendering (pdfjs) OR iframe with `asset://` URL
   - Toolbar: zoom in/out, rotate, page counter, fullscreen
   - Non-PDF fallback: render `extracted_text` in scrollable `<pre>`
   - `data-testid="document-preview-panel"`
   - Done when: `npx tsc --noEmit` passes; PDF renders in dev

[ ] **54.3 — Rust command `get_document_preview_url`**
   - `src-tauri/src/commands/documents.rs`
   - Input: `doc_id: String`
   - Return: `String` — local `file://` or `asset://` path to the PDF file
   - Register in `lib.rs`
   - Done when: `cargo test` passes; frontend can invoke and receive a valid path

[ ] **54.4 — Unit + E2E tests**
   - Unit: mock invoke returning a path; assert `document-preview-panel` renders
   - E2E: `e2e/redesign-A-pdf-preview.spec.ts` — upload PDF → select in list panel → assert preview panel visible
   - Done when: all tests pass

[ ] **54.5 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: DocumentPreviewPanel — pdfjs-dist dynamic import, canvas render, toolbar (Phase 54)`

---

## Phase 55 — UX Redesign A: AiInsightsPanel + Rust Commands

**Goal:** Build the 240px AI Insights Panel with 4 sections: Summary, Flagged Lab Values, Extracted Details, Related Documents. All data from local SQLite — no cloud calls.

**Reference:** `docs/frontend/redesign-design-A.md` §2.4, §5

**Done when:**
- `src/components/documents/AiInsightsPanel.tsx` renders all 4 sections for selected document
- `get_flagged_lab_values` Rust command implemented + tested
- `get_linked_documents` Rust command implemented + tested
- Panel collapse animation (200ms ease) works
- `data-testid="ai-insights-panel"` present
- `FlaggedValueBadge` component handles HIGH/LOW/BORDERLINE/NORMAL status pills

### Sprint 55

[ ] **55.1 — Rust command `get_flagged_lab_values`**
   - Input: `doc_id: String`
   - Read `flagged_values` from `extracted_info` JSON column (already stored by Phase 40 entity extraction)
   - Return: `Vec<FlaggedValue>` — `{name, value, unit, status: LOW|HIGH|BORDERLINE|NORMAL}`
   - Register in `lib.rs`
   - Done when: `cargo test` passes with fixture data

[ ] **55.2 — Rust command `get_linked_documents`**
   - Input: `doc_id: String`
   - Return docs sharing the same doctor or clinic as the input doc
   - Return: `Vec<DocSummary>` — `{id, title, activity_date, doc_type}` max 10 items
   - Register in `lib.rs`
   - Done when: `cargo test` passes; docs from same doctor returned

[ ] **55.3 — `FlaggedValueBadge` component**
   - `src/components/shared/FlaggedValueBadge.tsx`
   - HIGH: red `#DC2626`, LOW: amber `#D97706`, BORDERLINE: orange `#F59E0B`, NORMAL: green `#16A34A`
   - `data-testid="flagged-status-pill"`
   - Done when: all 4 status variants render correctly

[ ] **55.4 — `AiInsightsPanel` component**
   - `src/components/documents/AiInsightsPanel.tsx`
   - Section 1 — Summary: `extracted_info.summary`, truncated at 300 chars with expand toggle
   - Section 2 — Flagged Lab Values: rows from `get_flagged_lab_values`; hide section for non-lab docs
   - Section 3 — Extracted Details: Doctor, Clinic, Date, Category, Tags from `extracted_info`
   - Section 4 — Related Documents: list from `get_linked_documents`, max 5 with "Show all" link
   - Collapse: chevron button, 200ms ease slide animation
   - `data-testid="ai-insights-panel"`
   - Done when: all 4 sections render; collapse animation works

[ ] **55.5 — Unit + E2E tests**
   - Unit: `src/components/documents/__tests__/AiInsightsPanel.test.tsx`
     - Mock both Rust commands; assert all 4 sections render; assert HIGH badge colour
     - Assert "Show all" navigates to filtered document list
   - E2E: `e2e/redesign-A-ai-insights.spec.ts` — select doc → assert `ai-insights-panel` visible; assert at least one section renders
   - Done when: all tests pass

[ ] **55.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: AiInsightsPanel — 4 sections, FlaggedValueBadge, linked docs, Rust commands (Phase 55)`

---

## Phase 56 — UX Redesign A: VaultLayout + Responsive Behaviour

**Goal:** Wire all four panels into a CSS Grid root layout (`VaultLayout`). Auto-collapse AI panel below 1400px. Resize handle on DocumentListPanel (240–400px, persisted in localStorage).

**Reference:** `docs/frontend/redesign-design-A.md` §2, §3, §7 R-A4

**Done when:**
- `src/components/layout/VaultLayout.tsx` implements 4-panel CSS Grid
- AI panel auto-collapses below 1400px viewport width
- DocumentList panel width resizable 240–400px; persisted in localStorage
- All 4 `data-testid` attributes present: `nav-rail`, `document-list-panel`, `document-preview-panel`, `ai-insights-panel`
- Layout works at 1280px minimum width
- Feature flag `NEXT_PUBLIC_REDESIGN_A=true` gates entire layout

### Sprint 56

[ ] **56.1 — `VaultLayout` CSS Grid**
   - `src/components/layout/VaultLayout.tsx`
   - CSS Grid: `52px` rail | `var(--doc-list-width, 300px)` list | `1fr` preview | `var(--ai-panel-width, 240px)` AI
   - Import and compose: `<IconRail>`, `<DocumentListPanel>`, `<DocumentPreviewPanel>`, `<AiInsightsPanel>`
   - Done when: all 4 panels render side-by-side

[ ] **56.2 — AI panel auto-collapse below 1400px**
   - `ResizeObserver` on root container; when width < 1400px collapse AI panel (width → 0, toggle button visible)
   - Collapse animation: 200ms ease as per §2.4
   - Done when: resizing viewport to 1280px hides AI panel; toggle button restores it

[ ] **56.3 — Resizable DocumentListPanel width**
   - Drag handle between list and preview panels
   - Clamp: 240px min, 400px max
   - Persist in `localStorage('doc-list-width')`; restore on mount
   - Done when: drag resize works; survives page reload

[ ] **56.4 — Feature flag wiring in root layout**
   - `src/app/(app)/layout.tsx` (or root layout)
   - When `NEXT_PUBLIC_REDESIGN_A=true`: render `<VaultLayout>` replacing existing `<Sidebar>` + content layout
   - When false: existing layout unchanged (no regression)
   - Done when: toggle env var switches layouts; both work correctly

[ ] **56.5 — E2E spec: layout + responsive**
   - File: `e2e/redesign-A-vault-layout.spec.ts`
   - TC-A-01: 1440px — all 4 panels visible
   - TC-A-02: 1280px — AI panel collapsed, toggle button visible
   - TC-A-03: click toggle → AI panel expands
   - Done when: all TCs pass

[ ] **56.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - Commit: `feat: VaultLayout — 4-panel CSS Grid, AI panel auto-collapse, resizable list (Phase 56)`

---

## Phase 57 — UX Redesign A: Full E2E Suite + Accessibility Audit

**Goal:** Run the full redesign-A E2E suite (`e2e/redesign-D-bento.spec.ts` style). Run axe-core accessibility audit on VaultLayout. Fix any WCAG violations. Close any remaining gaps.

**Reference:** `docs/frontend/redesign-design-A.md` §7 R-A3; `e2e/redesign-D-bento.spec.ts` (model for spec structure)

**Done when:**
- All redesign-A E2E specs pass (`npx playwright test e2e/redesign-A-*`)
- No axe-core violations on VaultLayout at 1440px and 1280px
- Icon-only rail passes WCAG 2.1 SC 1.3.1 and SC 2.4.6 (`aria-label` on all buttons)
- `npx tsc --noEmit` passes
- CI green on develop branch

### Sprint 57

[ ] **57.1 — Run full redesign-A E2E suite; fix failures**
   - `npx playwright test e2e/redesign-A-*`
   - Triage each failure: testid mismatch vs timing vs implementation gap
   - Fix all failures
   - Done when: all redesign-A specs exit 0

[ ] **57.2 — axe-core accessibility audit**
   - Add `@axe-core/playwright` if not present
   - Run audit on `/documents` with `REDESIGN_A=true` at 1440px and 1280px
   - Fix any WCAG violations (focus on aria-label, role=tooltip, colour contrast)
   - Done when: audit returns 0 violations

[ ] **57.3 — Keyboard navigation end-to-end**
   - Tab through IconRail → DocumentListPanel → PreviewPanel → AiInsightsPanel without mouse
   - Verify focus indicators visible at each step
   - Done when: full keyboard flow confirmed

[ ] **57.4 — Pre-commit checks + commit + CI**
   - `npx tsc --noEmit`
   - Push to `origin/develop`; confirm CI green
   - Commit: `feat: Redesign-A full E2E suite + accessibility audit — all specs passing (Phase 57)`
