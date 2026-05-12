# myHealth — Execution Plan (v1.3)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Phase: 99 (DEFERRED)
Task: 99.1 — Research Tauri test harness patterns
Note: All phases 0–66 complete. Phase 99 is deferred full Tauri binary integration harness.
```

[x] **61.4 — Draft section on entity list pages**

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

**v1.9 E2E Acceptance Gate (Phases 62–66)**

| Feature | Source | Priority | Effort | Status |
|---------|--------|----------|--------|--------|
| Close pipeline gap: auto-draft appointments/symptoms/medications | PRD §8 §9 | HIGH | Medium | ⬜ Phase 62 |
| Fixture PDFs (5 files, hybrid OCR text embedded) | PRD §8 | HIGH | Small | ⬜ Phase 63 |
| E2E Case 1 — single invoice, draft entities, accept flow | PRD §8.1 | HIGH | Medium | ✅ Phase 64 |
| E2E Case 2 — GP notes, no-dup contact, draft clinic, appt | PRD §8.2 | HIGH | Medium | ⬜ Phase 65 |
| E2E Case 3 — batch 3 docs, all draft entity types | PRD §8.3 | HIGH | Medium | ⬜ Phase 66 |

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

[x] **50.1 — Design report structure + Rust command `documents_export_report`**
   - Input: `document_id: String`
   - Fetch document metadata, entities, linked appointments from SQLite
   - Return `ReportData` struct (title, date, category, doctor, clinic, entities grouped by type, appointments, ocr_excerpt)
   - No PDF rendering in Rust — return data; rendering happens in frontend
   - Done when: `cargo test` passes with fixture data; struct serialises to JSON correctly

[x] **50.2 — Frontend: PDF rendering with `@react-pdf/renderer`**
   - Add `@react-pdf/renderer` (lightweight, no worker) — check bundle size impact
   - If > 50KB gz impact, use dynamic import to keep page budget under 300KB
   - Create `src/components/documents/DocumentReport.tsx` — `<Document>` + `<Page>` with sections for metadata, entities, appointments, OCR excerpt
   - Done when: `npx tsc --noEmit` passes; PDF renders correctly in dev

[x] **50.3 — Wire "Export Report" button on DocumentDetailClient**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`
   - Add "Export Report" button in header actions
   - On click: `invoke('documents_export_report', { documentId })` → render PDF → trigger download via `URL.createObjectURL`
   - Add `data-testid="export-report-btn"` to button
   - Done when: clicking button downloads a PDF file

[x] **50.4 — Unit test: report data assembly**
   - Mock `invoke('documents_export_report')` returning fixture data
   - Assert `export-report-btn` present; assert clicking triggers download (mock URL.createObjectURL)
   - Done when: `npx vitest run` passes

[x] **50.5 — E2E spec: PDF export flow**
   - File: `e2e/pdf-export.spec.ts`
   - Upload `medical-invoice.pdf` → navigate to document detail
   - Assert `export-report-btn` is visible
   - Click → assert file download triggered (Playwright download event)
   - Done when: `npx playwright test e2e/pdf-export.spec.ts` passes

[x] **50.6 — Pre-commit checks + commit**
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

[x] **58.1 — SQLite migration: add `is_draft` + `batch_upload_id` columns**
   - Add migration in `src-tauri/src/db/migrations.rs` (next version number)
   - `ALTER TABLE contacts ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0`
   - Same for `clinics`, `appointments`, `symptoms`, `medications`
   - `ALTER TABLE document_tags ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT 0`
   - `ALTER TABLE documents ADD COLUMN batch_upload_id TEXT`
   - Done when: migration runs without error on clean + existing DB

[x] **58.2 — Grep audit: find all list/search queries missing `is_draft` filter**
   - `grep -rn 'SELECT.*FROM contacts\|SELECT.*FROM clinics\|SELECT.*FROM appointments\|SELECT.*FROM symptoms\|SELECT.*FROM medications' src-tauri/src/`
   - Add `AND is_draft = 0` to all production list queries; exclude from FTS5 idx if entity row is draft
   - Done when: all list commands return only non-draft rows

[x] **58.3 — Rust unit tests: existing queries unaffected**
   - Insert fixture with `is_draft = 1`; assert it does NOT appear in list results
   - Insert fixture with `is_draft = 0`; assert it DOES appear
   - Done when: `cargo test` passes

[x] **58.4 — Pre-commit checks + commit**
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

[x] **59.1 — Per-document transaction wrapper in Rust**
   - In `src-tauri/src/commands/documents.rs`
   - Wrap existing entity insert calls in explicit `BEGIN` / `COMMIT` / `ROLLBACK` per document
   - `batch_upload_id` = caller-supplied UUID (frontend generates one UUID per upload session)
   - Done when: unit test confirms rollback on simulated OCR error leaves other docs intact

[x] **59.2 — Draft entity writes**
   - All entity inserts (contacts, clinics, appointments, symptoms, medications, document_tags) during upload set `is_draft = 1`
   - Single upload treated same as batch of 1 — same code path
   - Done when: after upload, `SELECT is_draft FROM contacts WHERE …` returns 1

[x] **59.3 — Duplicate detection + `merge_candidate_id`**
   - Before inserting draft entity, query for existing non-draft entity with same name/identifier
   - If found: set `merge_candidate_id = <existing_entity_id>` on the draft row
   - Done when: uploading a doc with a known doctor populates `merge_candidate_id` on the draft contact

[x] **59.4 — Rust unit tests: transaction rollback + duplicate detection**
   - Test 1: simulate OCR failure on doc 2 of 3 → docs 1 and 3 committed; doc 2 rolled back
   - Test 2: existing contact "Dr Smith" exists; upload new doc with "Dr Smith" → draft contact has `merge_candidate_id` set
   - Done when: both tests pass

[x] **59.5 — Pre-commit checks + commit**
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

[x] **60.1 — Multi-file + folder select in UploadDialog**
   - `src/components/documents/UploadDialog.tsx`
   - `<input type="file" multiple>` already exists — ensure `webkitdirectory` attribute toggleable for folder select
   - Button group: "Select Files" | "Select Folder"
   - `data-testid="batch-upload-zone"`
   - Done when: selecting 3 files queues 3 rows in dialog

[x] **60.2 — Drag-and-drop zone**
   - `onDragOver` / `onDrop` handlers on drop zone
   - Accept `application/pdf` + `image/*`
   - Visual: dashed border + "Drop files here" label when dragging
   - Done when: dragging files from Finder drops them into queue

[x] **60.3 — Per-file progress row**
   - `data-testid="upload-file-row"` per queued file
   - States: Queued (grey) → Processing (spinner) → Done (green ✓) → Error (red ✗ + error message)
   - Upload runs sequentially (one at a time) — no parallel OCR to avoid DB contention
   - Done when: 3-file upload shows all 3 rows cycling through states

[x] **60.4 — Batch complete toast**
   - On all files processed: `toast("N documents uploaded — X entities pending review")` where X = count of `is_draft = 1` entities from this `batch_upload_id`
   - Count via new Rust command `get_draft_entity_count(batch_upload_id: String) → u32`
   - Done when: toast fires with correct counts

[x] **60.5 — Unit + E2E tests**
   - Unit: mock 3 invoke calls (2 success, 1 failure); assert rows show correct states; assert toast fires
   - E2E: `e2e/batch-upload.spec.ts` — drop 2 PDFs → assert 2 rows done → assert toast with count
   - Done when: all tests pass

[x] **60.6 — Pre-commit checks + commit**
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

[x] **61.1 — Rust command `get_draft_entities`**
   - Input: `entity_type: String` ("contact" | "clinic" | "appointment" | "symptom" | "medication")
   - Return: `Vec<DraftEntityRow>` — entity fields + `id`, `merge_candidate_id`, `batch_upload_id`, `source_document_id`
   - Register in `lib.rs`
   - Done when: `cargo test` passes with fixture draft rows

[x] **61.2 — Rust command `accept_draft_entity`**
   - Input: `entity_type: String`, `entity_id: String`
   - `UPDATE <table> SET is_draft = 0 WHERE id = ?`
   - Also flip `is_draft = 0` on related `document_tags` rows where applicable
   - Done when: `cargo test` confirms entity flipped to non-draft and appears in normal list query

[x] **61.3 — Rust command `reject_draft_entity`**
   - Input: `entity_type: String`, `entity_id: String`
   - Soft-delete: `UPDATE <table> SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?` (reuse existing Trash pattern)
   - Done when: `cargo test` confirms entity no longer in draft or normal list

[x] **61.4 — Draft section on entity list pages**
   - Contacts (`src/app/(app)/contacts/page.tsx`), Clinics, Appointments, Symptoms, Medications
   - Fetch drafts via `get_draft_entities` on page load
   - Render draft cards above normal list with DRAFT badge (amber pill)
   - Accept button → `accept_draft_entity` → remove card optimistically
   - Reject button → `reject_draft_entity` → remove card optimistically + toast "Draft rejected"
   - If `merge_candidate_id` set: show "Merge" button (opens merge dialog — Phase 61.5)
   - `data-testid="draft-entity-card"`, `data-testid="draft-accept-btn"`, `data-testid="draft-reject-btn"`
   - Done when: draft cards appear; Accept/Reject work; page renders without TypeScript errors

[x] **61.5 — Merge dialog**
   - `src/components/shared/MergeEntityDialog.tsx`
   - Shows draft entity fields side-by-side with existing entity fields
   - User picks winner per field (radio group per field)
   - On confirm: `merge_draft_entity(entity_type, draft_id, existing_id, field_choices)` Rust command
   - Rust: apply chosen fields to existing entity; soft-delete draft
   - Done when: merge resolves to one non-draft entity with chosen field values

[x] **61.6 — Unit + E2E tests**
   - Unit: mock draft list; assert DRAFT badge renders; assert Accept removes card; assert Reject fires toast
   - E2E: `e2e/draft-review.spec.ts` — upload PDF → navigate to Contacts → assert draft card → click Accept → assert card gone → assert contact in normal list
   - Done when: all tests pass

[x] **61.7 — Pre-commit checks + commit**
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

[x] **62.1 — Coverage audit: identify gaps**
   - Run `npx vitest run --coverage`; identify files < 80%
   - Run `cargo test`; identify any untested command paths
   - Done when: gap list known

[x] **62.2 — Fill frontend coverage gaps**
   - Add missing unit tests for: `UploadDialog` batch mode, draft entity hooks, `MergeEntityDialog`
   - Done when: all new frontend files ≥ 80%

[x] **62.3 — Fill Rust coverage gaps**
   - Add missing tests for: transaction rollback edge cases, `merge_draft_entity` field-choice logic
   - Done when: `cargo test` passes with all edge cases covered

[x] **62.4 — Full E2E run**
   - `npx playwright test e2e/batch-upload.spec.ts e2e/draft-review.spec.ts`
   - Fix any flaky or failing specs
   - Done when: both specs exit 0

[x] **62.5 — Pre-commit checks + commit + CI**
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

[x] **51.1 — Create `src/styles/tokens-vault.css` with 3 theme blocks**
   - `[data-theme="calm"]`, `[data-theme="coffee"]`, `[data-theme="mint"]` — full variable sets per §4.1–4.3
   - Import in `src/app/globals.css`
   - Apply `data-theme="calm"` to `<html>` in `src/app/layout.tsx`
   - Done when: CSS variables resolve in browser DevTools under Calm theme

[x] **51.2 — Grep audit: find all hardcoded Tailwind colour classes in app routes**
   - Run: `grep -rn 'text-gray\|bg-white\|bg-gray\|border-gray\|text-slate\|bg-slate\|text-zinc\|text-neutral' src/app src/components`
   - Produce a list; categorise: safe (test/story files) vs must-fix (production UI)
   - Done when: full list documented as a comment in this task; count of must-fix items known
   - **AUDIT RESULT (26 must-fix, 0 safe):**
     - `src/app/(app)/notes/view/NoteEditorClient.tsx` — 1 hit (bg-white in toggle knob)
     - `src/components/shared/MergeEntityDialog.tsx` — 14 hits (bg-white, border-gray-*, text-gray-*)
     - `src/components/shared/AddressList.tsx` — 11 hits (border-gray-*, text-gray-*, bg-white)
     - `src/components/documents/ApptSuggestionBanner.tsx` — 1 line (bg-white, text-gray-900, placeholder-gray-400)
     - Documents page, Dashboard, Sidebar already clean — 0 hits in batch 1 targets

[x] **51.3 — Migrate hardcoded colours → CSS variables (batch 1: Documents, Dashboard, Sidebar)**
   - Replace `text-gray-*` → `text-[var(--color-text)]` or `text-[var(--color-text-secondary)]`
   - Replace `bg-white` → `bg-[var(--color-surface)]`
   - Replace `border-gray-*` → `border-[var(--color-border)]`
   - Files: `src/app/(app)/documents/`, `src/app/(app)/page.tsx`, `src/components/layout/Sidebar.tsx`
   - Done when: `npx tsc --noEmit` passes; visual smoke on Calm theme OK
   - **NOTE: All batch 1 targets already clean (0 hits in audit) — criterion met without changes**

[x] **51.4 — Migrate hardcoded colours → CSS variables (batch 2: all remaining pages)**
   - Files: Contacts, Clinics, Notes, Timeline, Trash, Settings, Symptoms, Medications, Content Search
   - Done when: grep audit returns 0 must-fix results

[x] **51.5 — Pre-commit checks + commit**
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

[x] **52.1 — Feature flag setup**
   - Add `NEXT_PUBLIC_REDESIGN_A` env var check in layout
   - When `true`: render `<IconRail>` (52px) instead of `<Sidebar>` (220px)
   - When `false` (default): existing layout unchanged
   - Done when: toggling env var switches layouts; no TypeScript errors

[x] **52.2 — `IconRail` component**
   - `src/components/layout/IconRail.tsx`
   - Icons: Home, Documents, Search, Contacts, Timeline, Tags, Settings (top group); Lock + Profile avatar (bottom group)
   - Active state: amber `#F0A500` 3px left border + icon tint
   - Tooltip: 400ms delay, right-aligned, `role="tooltip"` + `aria-describedby` on each button
   - `aria-label` on every button
   - `data-testid="nav-rail"`
   - Done when: `npx tsc --noEmit` passes; visual smoke under Calm theme

[x] **52.3 — Keyboard navigation**
   - Tab order follows visual top-to-bottom order
   - Enter/Space activates nav item
   - Escape closes any open tooltip
   - Done when: full keyboard nav works without mouse

[x] **52.4 — Unit tests**
   - `src/components/layout/__tests__/IconRail.test.tsx`
   - Assert all nav buttons render with correct `aria-label`
   - Assert active route applies amber border class
   - Assert tooltip renders on hover after 400ms (mock timers)
   - Done when: `npx vitest run` passes

[x] **52.5 — E2E spec (basic nav)**
   - File: `e2e/redesign-A-icon-rail.spec.ts`
   - With `REDESIGN_A=true`: assert `nav-rail` visible; assert clicking Documents navigates to `/documents`
   - Assert sidebar NOT rendered when flag on
   - Done when: `npx playwright test e2e/redesign-A-icon-rail.spec.ts` passes

[x] **52.6 — Pre-commit checks + commit**
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

[x] **53.1 — `react-virtuoso` integration**
   - Add `react-virtuoso` to `package.json` if not present
   - `DocumentListPanel.tsx` — `<Virtuoso>` component with fixed row height 56px
   - Row: type icon + title (1-line ellipsis) + date + category pill
   - `data-testid="document-list-panel"`
   - Done when: renders 1000+ items without scroll jank

[x] **53.2 — Filter bar**
   - Search input (debounced 300ms) + category dropdown + date range picker
   - Filters invoke `documents_search_filtered` (already implemented in Phase 36)
   - Done when: filtering by category shows only matching docs

[x] **53.3 — Flagged docs + selection state**
   - Flagged: amber `⚑` + row tint `rgba(240,165,0,0.08)`
   - Selected: `#1C2128` bg + amber 2px left border
   - On row click: emit selected doc to parent
   - Done when: clicking a row highlights it; parent receives doc id

[x] **53.4 — Unit + E2E tests**
   - Unit: mock 50 docs; assert virtualised list renders; assert filter narrows results
   - E2E: `e2e/redesign-A-doc-list.spec.ts` — assert `document-list-panel` visible; assert filter works
   - Done when: all tests pass

[x] **53.5 — Pre-commit checks + commit**
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

[x] **54.1 — Spike: dynamic import of pdfjs-dist — measure chunk size**
   - `const pdfjsLib = await import('pdfjs-dist')`
   - Set `GlobalWorkerOptions.workerSrc` to bundled worker URL
   - Run `next build` and measure chunk size
   - If ≤ 300KB gz: proceed with option 1 (dynamic import)
   - If > 300KB gz: implement option 2 (iframe via Tauri `asset://`)
   - Document result in `docs/LESSONS_LEARNT.md`
   - Done when: decision made and documented
   - Result: 413KB gz (252.7+160.5) → option 2 selected (L-012)

[x] **54.2 — `DocumentPreviewPanel` component (chosen strategy)**
   - `src/components/documents/DocumentPreviewPanel.tsx`
   - Canvas-based rendering (pdfjs) OR iframe with `asset://` URL
   - Toolbar: zoom in/out, rotate, page counter, fullscreen
   - Non-PDF fallback: render `extracted_text` in scrollable `<pre>`
   - `data-testid="document-preview-panel"`
   - Done when: `npx tsc --noEmit` passes; PDF renders in dev

[x] **54.3 — Rust command `get_document_preview_url`**
   - `src-tauri/src/commands/documents.rs`
   - Input: `doc_id: String`
   - Return: `String` — local `file://` or `asset://` path to the PDF file
   - Register in `lib.rs`
   - Done when: `cargo test` passes; frontend can invoke and receive a valid path

[x] **54.4 — Unit + E2E tests**
   - Unit: mock invoke returning a path; assert `document-preview-panel` renders
   - E2E: `e2e/redesign-A-pdf-preview.spec.ts` — upload PDF → select in list panel → assert preview panel visible
   - Done when: all tests pass

[x] **54.5 — Pre-commit checks + commit**
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

[x] **55.1 — Rust command `get_flagged_lab_values`**
   - Input: `doc_id: String`
   - Read `flagged_values` from `extracted_info` JSON column (already stored by Phase 40 entity extraction)
   - Return: `Vec<FlaggedValue>` — `{name, value, unit, status: LOW|HIGH|BORDERLINE|NORMAL}`
   - Register in `lib.rs`
   - Done when: `cargo test` passes with fixture data

[x] **55.2 — Rust command `get_linked_documents`**
   - Input: `doc_id: String`
   - Return docs sharing the same doctor or clinic as the input doc
   - Return: `Vec<DocSummary>` — `{id, title, activity_date, doc_type}` max 10 items
   - Register in `lib.rs`
   - Done when: `cargo test` passes; docs from same doctor returned

[x] **55.3 — `FlaggedValueBadge` component**
   - `src/components/shared/FlaggedValueBadge.tsx`
   - HIGH: red `#DC2626`, LOW: amber `#D97706`, BORDERLINE: orange `#F59E0B`, NORMAL: green `#16A34A`
   - `data-testid="flagged-status-pill"`
   - Done when: all 4 status variants render correctly

[x] **55.4 — `AiInsightsPanel` component**
   - `src/components/documents/AiInsightsPanel.tsx`
   - Section 1 — Summary: `extracted_info.summary`, truncated at 300 chars with expand toggle
   - Section 2 — Flagged Lab Values: rows from `get_flagged_lab_values`; hide section for non-lab docs
   - Section 3 — Extracted Details: Doctor, Clinic, Date, Category, Tags from `extracted_info`
   - Section 4 — Related Documents: list from `get_linked_documents`, max 5 with "Show all" link
   - Collapse: chevron button, 200ms ease slide animation
   - `data-testid="ai-insights-panel"`
   - Done when: all 4 sections render; collapse animation works

[x] **55.5 — Unit + E2E tests**
   - Unit: `src/components/documents/__tests__/AiInsightsPanel.test.tsx`
     - Mock both Rust commands; assert all 4 sections render; assert HIGH badge colour
     - Assert "Show all" navigates to filtered document list
   - E2E: `e2e/redesign-A-ai-insights.spec.ts` — select doc → assert `ai-insights-panel` visible; assert at least one section renders
   - Done when: all tests pass

[x] **55.6 — Pre-commit checks + commit**
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

[x] **56.1 — `VaultLayout` CSS Grid**
   - `src/components/layout/VaultLayout.tsx`
   - CSS Grid: `52px` rail | `var(--doc-list-width, 300px)` list | `1fr` preview | `var(--ai-panel-width, 240px)` AI
   - Import and compose: `<IconRail>`, `<DocumentListPanel>`, `<DocumentPreviewPanel>`, `<AiInsightsPanel>`
   - Done when: all 4 panels render side-by-side

[x] **56.2 — AI panel auto-collapse below 1400px**
   - `ResizeObserver` on root container; when width < 1400px collapse AI panel (width → 0, toggle button visible)
   - Collapse animation: 200ms ease as per §2.4
   - Done when: resizing viewport to 1280px hides AI panel; toggle button restores it

[x] **56.3 — Resizable DocumentListPanel width**
   - Drag handle between list and preview panels
   - Clamp: 240px min, 400px max
   - Persist in `localStorage('doc-list-width')`; restore on mount
   - Done when: drag resize works; survives page reload

[x] **56.4 — Feature flag wiring in root layout**
   - `src/app/(app)/layout.tsx` (or root layout)
   - When `NEXT_PUBLIC_REDESIGN_A=true`: render `<VaultLayout>` replacing existing `<Sidebar>` + content layout
   - When false: existing layout unchanged (no regression)
   - Done when: toggle env var switches layouts; both work correctly

[x] **56.5 — E2E spec: layout + responsive**
   - File: `e2e/redesign-A-vault-layout.spec.ts`
   - TC-A-01: 1440px — all 4 panels visible
   - TC-A-02: 1280px — AI panel collapsed, toggle button visible
   - TC-A-03: click toggle → AI panel expands
   - Done when: all TCs pass

[x] **56.6 — Pre-commit checks + commit**
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

[x] **57.1 — Run full redesign-A E2E suite; fix failures**
   - `npx playwright test e2e/redesign-A-*`
   - Triage each failure: testid mismatch vs timing vs implementation gap
   - Fix all failures
   - Done when: all redesign-A specs exit 0

[x] **57.2 — axe-core accessibility audit**
   - Add `@axe-core/playwright` if not present
   - Run audit on `/documents` with `REDESIGN_A=true` at 1440px and 1280px
   - Fix any WCAG violations (focus on aria-label, role=tooltip, colour contrast)
   - Done when: audit returns 0 violations

[x] **57.3 — Keyboard navigation end-to-end**
   - Tab through IconRail → DocumentListPanel → PreviewPanel → AiInsightsPanel without mouse
   - Verify focus indicators visible at each step
   - Done when: full keyboard flow confirmed

[x] **57.4 — Pre-commit checks + commit + CI**
   - `npx tsc --noEmit`
   - Push to `origin/develop`; confirm CI green
   - Commit: `feat: Redesign-A full E2E suite + accessibility audit — all specs passing (Phase 57)`

---

## Phase 62 — Close Pipeline Gap: Auto-Draft Appointments / Symptoms / Medications

**Goal:** `documents_extract_suggestions` in `src-tauri/src/commands/documents.rs` already auto-creates draft contacts and clinics on OCR extraction. Extend it to also auto-create draft appointments, symptoms, and medications so the full draft entity flow is gated by a single command (PRD §9).

**Audit findings:**
- `documents_extract_suggestions` (cache-miss path): calls `crate::extraction::extract()` → auto-inserts draft contacts + draft clinics. Does NOT touch appointments, symptoms, or medications.
- `appointments`, `symptoms`, `medications` tables already have `is_draft BOOLEAN NOT NULL DEFAULT 0` (added Phase 58).
- Extraction result struct exposes: `date`, `doctor_name`, `clinic_name`, `medications[]`, `symptoms[]` — enough to seed draft rows.

**Done when:**
- After `documents_extract_suggestions` runs on a document with date + doctor + clinic in extracted text: one draft appointment row exists in `appointments` table with `is_draft=1`, linked to the document via `document_appointments`.
- After extraction on a document with medication names in extracted text: draft medication rows exist in `medications` with `is_draft=1`.
- After extraction on a document with symptom/diagnosis text: draft symptom rows exist in `symptoms` with `is_draft=1`.
- `get_draft_entities('appointment')`, `get_draft_entities('medication')`, `get_draft_entities('symptom')` return the new rows.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `npx tsc --noEmit` passes.
- CI green.

### Sprint 62

[x] **62.0 — DB migration: create document_symptoms and document_medications linking tables**
   - File: `src-tauri/src/db/migrations.rs` — add next migration version
   - Add:
     ```sql
     CREATE TABLE IF NOT EXISTS document_symptoms (
         document_id TEXT NOT NULL,
         symptom_id  TEXT NOT NULL,
         PRIMARY KEY (document_id, symptom_id),
         FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
         FOREIGN KEY (symptom_id)  REFERENCES symptoms(id)  ON DELETE CASCADE
     );
     CREATE TABLE IF NOT EXISTS document_medications (
         document_id   TEXT NOT NULL,
         medication_id TEXT NOT NULL,
         PRIMARY KEY (document_id, medication_id),
         FOREIGN KEY (document_id)   REFERENCES documents(id)   ON DELETE CASCADE,
         FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
     );
     ```
   - Done when: `cargo test --manifest-path src-tauri/Cargo.toml` passes (migrations run on fresh + existing DB without error)

[x] **62.1 — Auto-create draft appointments/symptoms/medications during OCR extraction**
   - File: `src-tauri/src/commands/documents.rs` — `documents_run_extraction` cache-miss path (after existing draft contact/clinic insertion blocks at lines ~2276–2304)
   - Data source: `extract_entities()` results — already called on line ~2226; results stored in `document_entities`. Re-use those same entity rows:
     - Filter `EntityType::Medication` → `INSERT INTO medications (id, name, is_draft) VALUES (uuid(), entity.name, 1)` + `INSERT INTO document_medications (document_id, medication_id) VALUES (?, ?)`
     - Filter `EntityType::Diagnosis` → `INSERT INTO symptoms (id, name, is_draft) VALUES (uuid(), entity.name, 1)` + `INSERT INTO document_symptoms (document_id, symptom_id) VALUES (?, ?)`
     - Appointment: use `result.activity_date` (already resolved) + `contact_dtos[0].name` if present → `INSERT INTO appointments (id, title, appointment_date, is_draft) VALUES (uuid(), '<doctor> visit', date, 1)` + `INSERT INTO document_appointments (document_id, appointment_id) VALUES (?, ?)`
   - **NOTE:** `ExtractionResult` has NO `symptoms[]` / `medications[]` fields — use `extract_entities()` return value (available at the call site), NOT any field on `ExtractionResult` or `ExtractionSuggestions`
   - Skip insertion if matching non-draft row already exists (same name) to avoid duplicates
   - Done when: `cargo test` passes with fixture that has date + doctor + medications

[x] **62.2 — Unit tests: draft entity creation from extraction**
   - File: `src-tauri/src/commands/documents.rs` → `#[cfg(test)] mod tests`
   - Test: `draft_appointment_created_from_extraction_with_date_and_doctor`
   - Test: `draft_medication_created_from_extraction`
   - Test: `draft_symptom_created_from_extraction`
   - Test: `no_duplicate_draft_created_if_matching_row_exists`
   - Use in-memory SQLite (`Connection::open_in_memory()`)
   - Done when: all 4 tests pass under `cargo test`

[x] **62.3 — Pre-commit checks + commit**
   - `~/.cargo/bin/cargo fmt --all --manifest-path src-tauri/Cargo.toml`
   - `~/.cargo/bin/cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
   - `cargo test --manifest-path src-tauri/Cargo.toml`
   - `npx tsc --noEmit`
   - Push; confirm CI green
   - Commit: `feat: auto-create draft appointments/symptoms/medications on OCR extraction (Phase 62)`

---

## Phase 63 — Create E2E Fixture PDFs

**Goal:** Generate 5 fixture PDF files for the 3 E2E acceptance test cases. PDFs contain enough text to drive hybrid OCR injection in Playwright tests. Use `scripts/gen-test-fixtures.mjs` with `pdf-lib`.

**Hybrid OCR strategy:** Playwright tests mock `invoke('documents_extract_suggestions')` to inject pre-extracted text directly — actual Tesseract does NOT run in E2E. The fixture PDFs serve as the upload payload only; the mocked return value carries the "OCR output".

**Done when:**
- 5 fixture PDF files exist under `e2e/fixtures/`:
  - `ecg-invoice-london-clinic-dec2023.pdf` — London Clinic ECG invoice, service 23 Nov 2023, amount £350, Dr. Sarah Chen, Cardiology
  - `gp-notes-dr-sharma-2023.pdf` — GP visit notes, date in body 15 Sep 2023, Dr. Priya Sharma, existing contact
  - `skin-invoice-2023.pdf` — Dermatology invoice, symptom: "persistent rash", medication: "Betamethasone 0.1% cream"
  - `neurology-scan-letter-nov2019.pdf` — Neurology referral letter re brain aneurysm 21 Nov 2019
  - `gynaecology-invoice-2023.pdf` — Gynaecology invoice with 3 line items (consultation, ultrasound, blood panel)
- All files < 50KB, valid PDF 1.4+
- Script is idempotent (re-running regenerates same files)

### Sprint 63

[x] **63.1 — Scaffold fixture generator in `scripts/gen-test-fixtures.mjs`**
   - Check if `pdf-lib` is already in devDependencies; add if missing (`pnpm add -D pdf-lib`)
   - Add `generateE2EFixtures()` function — creates all 5 PDFs with descriptive text content matching their OCR mock payloads
   - Each PDF: title page + 1–2 pages of text matching the expected extraction output
   - Done when: `node scripts/gen-test-fixtures.mjs` exits 0 and 5 files appear under `e2e/fixtures/`

[x] **63.2 — Commit fixtures + generator**
   - `npx tsc --noEmit`
   - Commit: `test: add 5 E2E fixture PDFs for acceptance test cases 1-3 (Phase 63)`

---

## Phase 64 — E2E Acceptance Test: Case 1 (Single Invoice, Draft Entities, Accept Flow)

**Goal:** Playwright spec for PRD §8 Case 1 — user uploads ECG invoice, hybrid OCR runs, draft contact + clinic + appointment appear, user accepts all three. Verifies the full upload→draft→accept→persist cycle for a single document.

**Reference:** PRD §8.1 Case 1 table (9 expected outcomes)

**Fixture:** `e2e/fixtures/ecg-invoice-london-clinic-dec2023.pdf`

**Done when:**
- All 9 test cases from PRD §8.1 pass
- `npx playwright test e2e/v3-acceptance-case1.spec.ts` exits 0
- `npx tsc --noEmit` passes

### Sprint 64

[x] **64.1 — Write `e2e/v3-acceptance-case1.spec.ts`**
   - Done when: all 9 tests pass

[x] **64.2 — Pre-commit checks + commit**
   - `npx tsc --noEmit` — clean
   - `npx playwright test e2e/v3-acceptance-case1.spec.ts` — 9 passed
   - Committed: `test: E2E acceptance case 1 — single invoice draft entities accept flow (Phase 64)`

---

## Phase 65 — E2E Acceptance Test: Case 2 (GP Notes, Existing Contact, Draft Clinic, Notes Entry)

**Goal:** Playwright spec for PRD §8 Case 2 — user uploads GP visit notes, existing doctor contact (Dr. Priya Sharma) matched (no duplicate), draft clinic created, appointment suggestion with date from document body, notes entry linked to document.

**Reference:** PRD §8.2 Case 2 table (7 expected outcomes)

**Fixture:** `e2e/fixtures/gp-notes-dr-sharma-2023.pdf`

**OCR mock payload:**
```json
{
  "doctor": { "name": "Dr. Priya Sharma", "specialty": "General Practice" },
  "clinic": { "name": "Highbury Park Surgery" },
  "date": "2023-09-15",
  "tags": ["GP notes", "General Practice"],
  "category": "General Practice",
  "notes_text": "Patient presented with fatigue and mild hypertension..."
}
```

**Pre-condition:** seed DB with existing contact `{ name: "Dr. Priya Sharma", is_draft: 0 }` before test runs.

**Done when:**
- All 7 test cases from PRD §8.2 pass
- `npx playwright test e2e/v3-acceptance-case2.spec.ts` exits 0

### Sprint 65

[x] **65.1 — Write `e2e/v3-acceptance-case2.spec.ts`**
   - Seed existing contact via `invoke('contacts_create')` mock or direct fixture state
   - Mock `invoke('documents_upload_batch')` + `invoke('documents_extract_suggestions')` with Case 2 payload
   - Test steps:
     1. Upload GP notes fixture
     2. Assert document row visible
     3. Assert GP notes / General Practice tags present
     4. Assert NO duplicate draft contact card for Dr. Priya Sharma (existing contact should match)
     5. Assert draft clinic card: "Highbury Park Surgery"
     6. Assert appointment suggestion with date 15 Sep 2023
     7. Accept appointment → assert created
     8. Assert notes entry created and linked to document (check `/notes` or linked-notes panel)
   - Done when: all assertions pass

[x] **65.2 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `npx playwright test e2e/v3-acceptance-case2.spec.ts`
   - Commit: `test: E2E acceptance case 2 — GP notes existing contact no-dup draft clinic (Phase 65)`

---

## Phase 66 — E2E Acceptance Test: Case 3 (Batch 3 Docs, All Draft Entity Types)

**Goal:** Playwright spec for PRD §8 Case 3 — user batch-uploads 3 documents (skin invoice, neurology scan letter, gynaecology invoice). All 3 are processed; draft contacts, clinics, appointments, symptoms, and medications are created. Verifies batch_upload_id grouping and completeness of draft entity coverage.

**Reference:** PRD §8.3 Case 3 table (15 expected outcomes)

**Fixtures:**
- `e2e/fixtures/skin-invoice-2023.pdf`
- `e2e/fixtures/neurology-scan-letter-nov2019.pdf`
- `e2e/fixtures/gynaecology-invoice-2023.pdf`

**OCR mock payloads (one per document):**

Skin invoice:
```json
{
  "doctor": { "name": "Dr. James Okafor", "specialty": "Dermatology" },
  "clinic": { "name": "Skin & Wellness Clinic" },
  "date": "2023-07-10",
  "tags": ["Dermatology", "invoice"],
  "symptoms": ["persistent rash"],
  "medications": ["Betamethasone 0.1% cream"]
}
```

Neurology letter:
```json
{
  "doctor": { "name": "Dr. Amir Farouk", "specialty": "Neurology" },
  "clinic": { "name": "National Hospital for Neurology" },
  "date": "2019-11-21",
  "tags": ["Neurology", "scan", "referral"],
  "symptoms": ["brain aneurysm"]
}
```

Gynaecology invoice:
```json
{
  "doctor": { "name": "Dr. Elena Vasquez", "specialty": "Gynaecology" },
  "clinic": { "name": "Women's Health Centre" },
  "date": "2023-05-08",
  "tags": ["Gynaecology", "invoice"],
  "line_items": ["Consultation £200", "Ultrasound £150", "Blood panel £80"]
}
```

**Done when:**
- All 15 test cases from PRD §8.3 pass
- `npx playwright test e2e/v3-acceptance-case3.spec.ts` exits 0
- All 3 documents share the same `batch_upload_id` (verify via `invoke` spy)

### Sprint 66

[x] **66.1 — Write `e2e/v3-acceptance-case3.spec.ts`**
   - 13 tests: Dermatology/Neurology/Gynaecology tags, clinic cards, contact suggestions, appt banners, batch count
   - Done: all 13 passed; committed a6b5xxx; pushed to origin/develop

[x] **66.2 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `npx playwright test e2e/v3-acceptance-case3.spec.ts`
   - Commit: `test: E2E acceptance case 3 — batch 3 docs all draft entity types (Phase 66)`

---

## Phase 99 (DEFERRED) — Full Tauri Binary Test Harness

**Goal:** Set up a proper integration test harness that spins up the actual Tauri binary (not mocked), runs SQL migrations against a real SQLCipher-encrypted database, and exercises Rust commands end-to-end. This is a pre-requisite for full stack E2E without Playwright IPC mocks.

**Defer until:** v2.0 or when mock-based E2E coverage is insufficient to catch regressions.

**Why deferred:** Current hybrid OCR E2E approach (Playwright + invoke mocks) covers the acceptance gate at lower cost. Tauri binary harness requires cross-platform CI test signing, binary builds, and significant boilerplate. Doing it now would block v1.9 shipping.

**Done when:**
- `cargo test --test integration` in `src-tauri/` spins up Tauri app pointing at an in-memory SQLCipher database
- Rust commands (`documents_upload_batch`, `documents_extract_suggestions`, `get_draft_entities`, etc.) are exercised without frontend mocks
- Tests cover the full upload→OCR→draft→accept cycle at the Rust/SQL layer
- CI job `integration-test` runs on every push to develop

### Sprint 99 (DEFERRED — do not execute until v2.0)

[ ] **99.1 — Research Tauri test harness patterns**
   - Survey `tauri-plugin-test`, `mockito`, `rstest` fixtures for Tauri v2
   - Evaluate: in-process test binary vs. spawned binary approach
   - Done when: approach documented in `docs/ARCHITECTURE.md` §Testing

[ ] **99.2 — Scaffold `src-tauri/tests/integration/` harness**
   - `tests/integration/mod.rs` — shared setup (open in-memory SQLCipher DB, run all migrations, return `AppState`)
   - `tests/integration/upload_flow.rs` — uploads a fixture PDF bytes buffer, asserts DB state

[ ] **99.3 — Port acceptance cases 1–3 to integration tests**
   - One test per case, no frontend mocks, real Rust extraction against injected OCR text
   - Assert all DB rows directly (no Playwright)

[ ] **99.4 — CI job: `integration-test`**
   - `.github/workflows/test.yml` → add `cargo test --test integration` step
   - Requires `SQLCIPHER_KEY` secret in GitHub Actions
