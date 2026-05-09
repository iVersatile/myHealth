# myHealth — Execution Plan (v1.2 / v1.3)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Phase: 49 — Missing Notes After Document Upload: Analysis + Fix
Task:  49.3 — Update tauri-mock.js EXTRACTION_MAP with extracted_text_preview
```

▶ **49.3** — Update `tauri-mock.js` EXTRACTION_MAP with `extracted_text_preview`

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
| F2.2–F2.5 OCR pipeline | PRD_V2 §F2 | ✅ done |
| F3.2–F3.5 Many-to-many categories + bulk ops | PRD_V2 §F3 | ✅ done |
| F4 Apple Calendar integration (macOS) | PRD_V2 §F4 | ✅ done |
| F5.3–F5.4 Contact deduplication + merge | PRD_V2 §F5 | ✅ done |
| F6 Document-appointment link scoring | PRD_V2 §F6 | ✅ done |
| V3-F1 Category auto-creation when suggestion accepted | PRD_V3 §V3-F1 | ✅ done |
| V3-F2 Contact auto-creation (UK phone regex + full save) | PRD_V3 §V3-F2 | ✅ done |
| V3-F3 Clinic: CRN, multi-address, clinic↔contact link | PRD_V3 §V3-F3 | ✅ done |
| V3-F4 Tag auto-extraction (type, provider, specialty, date) | PRD_V3 §V3-F4 | ✅ done |
| V3-F5 Timeline tabs (Chronological, By Category, By Doctor, By Uploaded Date) | PRD_V3 §V3-F5 | ✅ done |
| Trash / restore / permanent-delete | Phase 32 | ✅ done |

**v1.2 (in progress — Phases 33–35)**

| Feature | Source | Priority | Status |
|---------|--------|----------|--------|
| V3-F5 Editable activity_date on document detail page | PRD_V3 §V3-F5 | MUST | ⬜ Phase 33 |
| V3-F6 Auto-create appointment suggestion from invoice upload | PRD_V3 §V3-F6 | MUST | ⬜ Phase 34 |
| E2E green gate (all tests passing) | — | MUST | ⬜ Phase 35 |

**v1.3 (next)**

| Feature | Source | Priority | Effort |
|---------|--------|----------|--------|
| Advanced search filters (date range, category combo) | PRD_V2 §F3/F6 | HIGH | Small |
| F3.4 Drag-to-organize categories | PRD_V2 §F3 | SHOULD | Small |
| F3.7 Auto-archive empty categories | PRD_V2 §F3 | SHOULD | Small |
| PDF summary report export | PRD_V2 Phase 2 | MED | Medium |

**v1.8 (planned — Phases 38–40)**

| Feature | Gap | Priority | Effort |
|---------|-----|----------|--------|
| Surface `extracted_text` + Notes auto-tag + FTS5 content search | Gap 1 | HIGH | Small |
| Cross-document content search + timeline grouping + summary | Gap 2 | HIGH | Medium |
| Structured entity extraction (medications, diagnoses, lab values, referrals) — universal | Gap 3 | HIGH | Medium |

**v1.4 (Phases 43–45)**

| Feature | Source | Priority | Effort |
|---------|--------|----------|--------|
| Notes UX — Option B (create-from-context, OCR prefill, linked notes panel, empty-state onboarding) | Manual test feedback 2026-05-08 | HIGH | Medium |
| Symptom entity (CRUD + linking + FTS5) | Manual test feedback 2026-05-08 | HIGH | Medium |
| Medication entity (CRUD + linking + FTS5) | Manual test feedback 2026-05-08 | HIGH | Medium |
| Unified content search: documents + notes + symptoms + medications | Manual test feedback 2026-05-08 | HIGH | Small |

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

**Coverage requirement:** ≥ 80% across all new code

---

## Phase 47 — CI Fix: Next.js Static Export + Dynamic Routes

**Goal:** Build & Release fails on all 4 platforms because `'use client'` and `generateStaticParams()` cannot coexist in the same file. Fix by splitting each dynamic `[id]` page into a server wrapper (holds `generateStaticParams`) and a client component (holds all hooks/state).

**Done when:** `next build` succeeds locally or on CI; Build & Release passes on all 4 platforms.

### Sprint 47

[x] **47.1 — Split medications/view/[id] into server wrapper + client component**
   - Move all hook/state/router logic from `page.tsx` into `ViewMedicationClient.tsx` (`'use client'`)
   - `page.tsx` becomes a server component: no `'use client'`, exports `generateStaticParams() { return [] }`, renders `<ViewMedicationClient />`
   - Files: `src/app/(app)/medications/view/[id]/page.tsx` + new `src/app/(app)/medications/view/[id]/ViewMedicationClient.tsx`

[x] **47.2 — Split symptoms/view/[id] into server wrapper + client component**
   - Same pattern as 47.1
   - Files: `src/app/(app)/symptoms/view/[id]/page.tsx` + new `src/app/(app)/symptoms/view/[id]/ViewSymptomClient.tsx`

[x] **47.3 — Verify next build passes + commit + push + retag v1.8.0**
   - Run `npx tsc --noEmit` (local Node 20 can do type check even if full build fails)
   - Commit, push to develop, wait for Lint + Tests green
   - Then retag: delete remote v1.8.0, push new tag, verify Build & Release passes all 4 platforms

---

## Phase 33 — V3-F5: Editable Activity Date on Document Detail Page

**Goal:** Let users correct the auto-extracted `activity_date` directly on the document detail page.
Backend (`documents_update`) already accepts `activity_date: Option<String>` — only frontend work needed.

**Done when:** Clicking the date on a document detail page renders an editable input; saving it calls `documents_update` with the new date; the timeline immediately reflects the change.

### Sprint 33

[x] **33.1 — Add editable activity_date field to document detail page**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx:407,414` — both testids already present
   - Status: IMPLEMENTED (verified 2026-05-05)

[x] **33.2 — Verify activity_date edit wiring is complete**
   - Read `DocumentDetailClient.tsx` around lines 400–430
   - Confirm `invoke('documents_update', { documentId, activityDate })` is wired to the Save button
   - Confirm local state updates on success (no page reload required)
   - If wiring is missing, add it now
   - Done when: manual smoke test confirms date change persists after save

[x] **33.3 — Unit test for activity_date edit**
   - File: `src/app/(app)/documents/__tests__/detail-activity-date.test.tsx`
   - Mock `invoke('documents_update')`; assert called with correct `activityDate`
   - Assert save button disabled while loading, re-enabled on success
   - Done when: `npx vitest run` passes

[x] **33.4 — E2E spec: activity_date editing**
   - File: `e2e/v3-f5-detail.spec.ts` (new)
   - Upload doc → navigate to detail → change activity_date → save → verify timeline Chronological shows new date
   - Done when: `npx playwright test e2e/v3-f5-detail.spec.ts` passes

[x] **33.5 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - Commit: `feat: verify and test editable activity_date (V3-F5)`

---

## Phase 34 — V3-F6: Auto-create Appointment Suggestion from Invoice Upload

**Goal:** When an invoice is uploaded and extraction finds a date + provider, surface a dismissible "Create appointment?" banner (`doctor-suggestion-banner`) on the upload confirmation screen. Accepting pre-fills and opens the New Appointment dialog.

**Done when:** Banner appears when extraction yields provider name; Accept opens pre-filled appointment dialog; Dismiss hides without side effects.

### Sprint 34

[x] **34.1 — Rust command `appointments_suggest_from_document`**
   - `src-tauri/src/commands/documents.rs:1393` — command implemented
   - Registered in `src-tauri/src/lib.rs:47,149`
   - Status: IMPLEMENTED (verified 2026-05-05)

[x] **34.2 — `DoctorSuggestionBanner` component**
   - `src/components/documents/DoctorSuggestionBanner.tsx:95` — testid present, component exists
   - Status: IMPLEMENTED (verified 2026-05-05)
   - Note: component is in `documents/`, not `appointments/` — correct location

[x] **34.3 — Verify banner wiring in upload flow**
   - `documents/page.tsx:handleUploaded` calls `appointments_suggest_from_document` after upload
   - Accept calls `handleApptSuggestionConfirm` → `appointments_create` + `link_document_to_appointment`
   - Dismiss calls `setApptSuggestion(null)`
   - `ApptSuggestionBanner` now has `data-testid="appt-suggestion-banner"`
   - Status: IMPLEMENTED (verified 2026-05-07)

[x] **34.4 — Rust unit test for `appointments_suggest_from_document`**
   - In `#[cfg(test)]` mod in `documents.rs` (near line 1393) or `appointments.rs`
   - Doc with provider → `Some(suggestion)`; doc without provider → `None`
   - Done when: `cargo test` passes

[x] **34.5 — Unit test for banner integration**
   - Mock `invoke('appointments_suggest_from_document')` returning a suggestion
   - Assert `doctor-suggestion-banner` visible; clicking Accept fires `onAccept`
   - Done when: `npx vitest run` passes

[x] **34.6 — E2E spec: V3-F6 suggestion banner**
   - File: `e2e/v3-f6.spec.ts` (new; `v3-f8-clinic-contact-creation.spec.ts` covers adjacent flows but not appointment creation)
   - Upload invoice with provider → banner appears → Accept → appointment dialog pre-filled
   - Upload doc without provider → banner does NOT appear
   - Start `test.skip`; un-skip after 34.4 manual verification
   - Done when: `npx playwright test e2e/v3-f6.spec.ts` passes

[x] **34.7 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: appointment suggestion banner from invoice upload (V3-F6)`

---

## Phase 35 — E2E Green Gate

**Goal:** All Playwright E2E specs pass in CI with zero skips on implemented features.

**Done when:** `npx playwright test` exits 0; CI `e2e` job green; no `test.skip` on implemented features.

### Failure Bucket 1 — Strict-mode violation in upload specs

**Root cause:** Selector `/save|confirm/i` matches "Save as Contact", "Save as Clinic", and "Confirm Upload" simultaneously.
**Fix:** Change to `getByRole('button', { name: /confirm upload/i })` in all affected specs.

[x] **35.1 — Fix strict-mode regex in upload E2E specs**
   - `grep -r "save|confirm" e2e/` to find all occurrences
   - Replace with `/confirm upload/i` or exact button role where context is ambiguous
   - Done when: `npx playwright test --grep "upload"` passes without strict-mode errors

### Failure Bucket 2 — Missing `detail-activity-date-input` / `detail-activity-date-save`

**Root cause:** Document detail page lacked editable activity_date field. Fixed in Phase 33.

[x] **35.2 — Verify Phase 33 testids resolve all v3-f5 E2E failures**
   - `npx playwright test e2e/v3-f5*`
   - Done when: all v3-f5 specs pass

### Failure Bucket 3 — Missing `doctor-suggestion-banner`

**Root cause:** V3-F6 not implemented. Fixed in Phase 34.

[x] **35.3 — Verify Phase 34 resolves all v3-f6 E2E failures**
   - `npx playwright test e2e/v3-f6*`
   - Done when: all v3-f6 specs pass

### Failure Bucket 4 — Missing edit button/link in appointment detail and clinic row

**Root cause:** `verify-edit-entities.spec.ts` uses role selectors:
- TC-EDIT-02: `getByRole('button', { name: /^edit$/i })` on appointment detail page
- TC-EDIT-04: `clinicRow.getByRole('link', { name: /edit/i }).or(getByRole('button', { name: /edit/i }))` on clinic list row
These elements likely don't exist in the UI (not a testid naming issue).

[x] **35.4 — Add missing edit button to appointment detail page**
   - Locate appointment detail component; add an "Edit" button that opens the edit dialog
   - Done when: TC-EDIT-02 passes

[x] **35.5 — Add missing edit link/button to clinic list row**
   - Locate clinic list row component (`clinic-row` testid); add an Edit link/button
   - Done when: TC-EDIT-04 passes

### Failure Bucket 5 — Timeline selector / timing issues

**Root cause:** Timeline tabs exist (4 tabs: chronological, by-category, by-doctor, by-uploaded-date) but E2E specs may have fragile selectors or missing `waitFor` calls.

[x] **35.6 — Fix timeline E2E selector and timing issues**
   - Read `e2e/v3-f5-timeline.spec.ts` and `e2e/timeline-by-doctor.spec.ts`
   - Identify testid mismatch vs timing issue; add `waitForSelector` where needed
   - Done when: `npx playwright test e2e/v3-f5-timeline.spec.ts e2e/timeline-by-doctor.spec.ts` passes

[x] **35.7 — Full suite run + CI verification**
   - `npx playwright test` — all pass, exit 0
   - Push to `origin/develop`; confirm CI `e2e` job green
   - Done when: CI green

[x] **35.8 — Commit**
   - `test: fix E2E green gate — all 5 failure buckets resolved`

---

## Phase 36 — Advanced Search Filters

**Goal:** Filter document list by date range, category combination, and document type simultaneously.

**Done when:** Search panel has date-from/to pickers and multi-select category filter; results update without page reload; existing FTS5 text search still works.

### Sprint 36

[x] **36.1 — Backend: extend `documents_search` with filter params**
   - Add optional params: `date_from: Option<String>`, `date_to: Option<String>`, `category_ids: Option<Vec<i64>>`
   - Extend SQL WHERE with BETWEEN and JOIN on `document_categories`
   - Done when: `cargo test` passes with new filter tests
   - Status: ALREADY IMPLEMENTED — `documents_search_filtered` command exists, registered, 4 tests green

[x] **36.2 — Frontend: advanced search panel UI**
   - Collapsible filter panel below search bar in document list
   - Date-range pickers + multi-select category chips
   - Debounce 300 ms then re-invoke search on change
   - Done when: `npx tsc --noEmit` passes; manual smoke shows filtered results
   - Status: ALREADY IMPLEMENTED — DocumentList.tsx has full filter panel, tsc clean

[x] **36.3 — Unit + E2E tests**
   - Unit: mock invoke, assert filter params passed correctly
   - E2E: upload 2 docs with different dates → filter → only correct doc visible
   - Done when: all tests pass
   - Status: 18/18 unit tests pass; 3/3 E2E (TC-FILTER-01/02/03) pass

[x] **36.4 — Pre-commit checks + commit**
   - `feat: advanced search filters (date range, category combo)`
   - Status: tsc clean, no Rust changes, test commit pushed — CI running

---

## Phase 37 — Category UX Improvements

**Goal:** F3.4 drag-to-organize categories; F3.7 auto-archive empty categories.

**Done when:** Categories can be reordered via drag and order persists; categories with 0 documents for >30 days are auto-archived and hidden from default view.

### Sprint 37

[x] **37.1 — F3.4: drag-to-reorder categories**
   - Verify `@dnd-kit/sortable` is already in `package.json`; add if missing
   - On drop: invoke `categories_reorder` (new Rust command) with new order array
   - Done when: drag reorder persists across app restarts

[x] **37.2 — F3.7: auto-archive empty categories**
   - Rust: on app launch, mark categories with 0 documents as `archived_at` if created >30 days ago
   - Frontend: hide archived from default list; add "Show archived" toggle
   - Done when: empty category disappears from list; backdated test confirms archive logic

[x] **37.3 — Tests + commit**
   - Unit tests for archive logic; E2E for drag reorder
   - `feat: category drag-to-organize and auto-archive (F3.4, F3.7)`

---

## Phase 38–40 — v1.8: Document Content Intelligence

### Overview

Three interlocking features that turn raw OCR text (`extracted_text`) into searchable, structured, actionable information.

| Gap | Feature | Description |
|-----|---------|-------------|
| Gap 1 | Extracted text surface + Notes auto-tag | Show `extracted_text` in document detail UI; auto-tag as "Notes" when document type is free-form clinical notes; make content searchable via FTS5 |
| Gap 2 | Cross-document content search & timeline grouping | Search all `extracted_text` for a term (e.g. "hypertension"); group results chronologically; surface timeline + simple conclusions |
| Gap 3 | Structured entity extraction (universal) | During every OCR pipeline pass, attempt to extract medications, diagnoses, lab values, referrals from ALL document types — empty result is acceptable |

---

## Phase 38 — Gap 1: Surface Extracted Text + Notes Auto-Tag + FTS5 Search

**Goal:** Users can read the full OCR text on the document detail page. Documents that are free-form clinical notes (not invoices, registration forms, test results, or referral letters) are auto-tagged "Notes". The `extracted_text` column is indexed and returned by existing `documents_search`.

**Done when:**
- Document detail page shows an "Extracted Text" collapsible section with the raw OCR text
- After upload, if no structured type tag is set (i.e. not invoice/registration/test-result/referral), the "Notes" tag is auto-applied
- Searching "hypertension" in the document search bar returns documents whose `extracted_text` contains the word

### Sprint 38

[x] **38.1 — Verify FTS5 index covers `extracted_text`**
   - Read `src-tauri/src/db/migrations.rs`; find the `documents_fts` virtual table definition
   - If `extracted_text` is not in the FTS5 column list, add it in a new migration
   - Done when: `cargo test` passes and FTS search returns hits from `extracted_text`

[x] **38.2 — Extend `documents_search` to search `extracted_text`**
   - `src-tauri/src/commands/documents.rs` — `documents_search` command
   - Confirm the FTS match query includes `extracted_text`; update if not
   - Done when: `cargo test` with a fixture doc that has text in `extracted_text` returns it on keyword search

[x] **38.3 — Auto-tag "Notes" during extraction pipeline**
   - In the Rust OCR/extraction path, after tags are resolved:
     - If no type-tag is present (not one of: invoice, registration, test-result, referral, prescription), emit tag "Notes"
   - Done when: uploading a plain GP notes PDF causes "Notes" to appear in the document's tag list without user action

[x] **38.4 — Surface `extracted_text` in document detail UI**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`
   - Add a collapsible `<details>` section labelled "Extracted Text" below existing metadata
   - Show `doc.extracted_text` inside; hide section entirely if `extracted_text` is null/empty
   - Done when: `npx tsc --noEmit` passes; document with OCR text shows the section

[x] **38.5 — Unit tests**
   - Rust: auto-tag logic → doc with/without type tag → assert "Notes" added or not
   - Frontend: render `DocumentDetailClient` with `extracted_text` → section visible; without → hidden
   - Done when: `npx vitest run` + `cargo test` pass

[x] **38.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: surface extracted_text, Notes auto-tag, FTS5 full-content search (Gap 1)`

---

## Phase 39 — Gap 2: Cross-Document Content Search & Timeline Grouping

**Goal:** A dedicated "Content Search" flow lets users search a term across all document `extracted_text` fields, see results grouped by date (chronological timeline), and read a simple auto-generated summary (e.g. "First mention: 2021-03-12 · 7 documents · 3 providers").

**Done when:**
- New "Content Search" entry point reachable from the main nav or search bar
- Backend returns `{document_id, title, activity_date, snippet, provider}` sorted by `activity_date ASC`
- Frontend renders a vertical timeline with one card per document (snippet + provider + date)
- Summary bar shows: first-mention date, document count, unique provider count

### Sprint 39

[x] **39.1 — Rust command `documents_content_search`**
   - Input: `query: String`
   - SQL: FTS5 snippet on `extracted_text` JOIN documents; ORDER BY `activity_date ASC`
   - Return: `Vec<ContentSearchResult>` — `{id, title, activity_date, snippet, provider_tag}`
   - Plus `ContentSearchSummary` — `{first_date, last_date, doc_count, unique_providers}`
   - Done when: `cargo test` passes with fixture docs

[x] **39.2 — Frontend: Content Search page / panel**
   - Route or slide-over panel; search input → `invoke('documents_content_search', { query })`
   - Summary bar + vertical timeline list of result cards
   - Each card: title, date, provider, highlighted snippet, link to document detail
   - Done when: `npx tsc --noEmit` passes; manual smoke shows grouped timeline

[x] **39.3 — Unit + E2E tests**
   - Unit: mock invoke; assert summary bar values; assert cards in date order
   - E2E: upload 2 docs with "hypertension" in OCR text at different dates → search → 2 cards chronological → summary count 2
   - Done when: all tests pass

[x] **39.4 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: cross-document content search with timeline grouping (Gap 2)`

---

## Phase 40 — Gap 3: Structured Entity Extraction (Universal)

**Goal:** During every OCR pipeline pass, attempt to extract structured medical entities from document text. Entities: medications (name + dose), diagnoses/conditions, lab values (name + value + unit), referrals (specialty + provider). Results stored in `document_entities` table. Empty extraction is acceptable — not forced.

**Done when:**
- `document_entities` table exists (migration)
- Extraction runs automatically after OCR for ALL document types
- Extracted entities visible in document detail UI grouped by type
- Empty extraction produces no UI section

### Sprint 40

[x] **40.1 — DB migration: `document_entities` table**
   - Columns: `id, document_id, entity_type (medication|diagnosis|lab_value|referral), name, value, unit, raw_text, created_at`
   - Done when: migration runs cleanly; `cargo test` passes

[x] **40.2 — Rust entity extraction module (regex-based, conservative)**
   - New module `src-tauri/src/extraction/entities.rs`
   - Medication: `Lisinopril 10mg`, `metformin 500 mg` patterns
   - Diagnosis: after "Diagnosis:", "Assessment:", "Impression:" labels
   - Lab value: `HbA1c: 6.2%`, `eGFR 72 mL/min`, `BP 130/85` patterns
   - Referral: "referred to", "referral to", "please see" patterns
   - Conservative — prefer false negatives; empty result is fine
   - Done when: `cargo test` passes with fixture texts for each entity type

[x] **40.3 — Wire extraction into OCR pipeline for ALL document types**
   - After `extracted_text` written to `documents`, call entity extraction → INSERT into `document_entities`
   - Done when: uploading any PDF with recognisable text populates `document_entities`

[x] **40.4 — Rust command `document_entities_get`**
   - Input: `document_id: i64`
   - Return: `Vec<DocumentEntity>` grouped by `entity_type`
   - Done when: `cargo test` passes

[x] **40.5 — Surface entities in document detail UI**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`
   - On mount, invoke `document_entities_get`; if non-empty render "Extracted Info" section
   - Group by type: Medications, Conditions, Lab Results, Referrals
   - Hide section entirely when entity list is empty
   - Done when: `npx tsc --noEmit` passes; manual smoke shows entities on GP notes upload

[x] **40.6 — Unit tests**
   - Rust: entity extraction positive + negative cases per pattern type
   - Frontend: render with entities → section visible and grouped; empty → hidden
   - Done when: `npx vitest run` + `cargo test` pass

[x] **40.7 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: structured entity extraction from all documents (Gap 3)`

---

## Phase 41 — E2E Gap Closing

**Goal:** Add E2E test coverage for the six uncovered areas identified in the post-Phase-40 gap survey. After this phase every implemented feature has at least one passing E2E spec.

**Gap inventory:**

| # | Area | Missing coverage | Testids needed |
|---|------|-----------------|----------------|
| G1 | Extracted Text section | No E2E for `<details>` section visible after upload | `detail-extracted-text` on `<details>` element |
| G2 | Content Search | No E2E for `content-search-input` → `summary-bar` flow | Already have testids |
| G3 | Extracted Info section | No E2E for "Extracted Info" visible after upload | `detail-extracted-info` on container |
| G4 | Trash flows | No E2E for restore / delete-permanently / empty-trash | `trash-restore-btn`, `trash-delete-permanently-btn`, `trash-empty-btn` |
| G5 | Category multi-select filter | No E2E for filtering by category combination | `advanced-filter-category` or existing chip testids |
| G6 | Auto-archive toggle | No E2E for "Show archived" toggle on categories page | `show-archived-toggle` |

**Done when:** All 6 gaps have at least one passing E2E spec; `npx playwright test` exits 0; CI green.

### Sprint 41

[x] **41.1 — Add missing testids to UI components**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`:
     - Add `data-testid="detail-extracted-text"` to the `<details>` element for Extracted Text (around line 672)
     - Add `data-testid="detail-extracted-info"` to the Extracted Info container `<div>` (around line 686)
   - `src/app/(app)/trash/page.tsx` or `TrashClient.tsx`:
     - Add `data-testid="trash-restore-btn"` to Restore button
     - Add `data-testid="trash-delete-permanently-btn"` to Delete Permanently button
     - Add `data-testid="trash-empty-btn"` to Empty Trash button
   - Done when: `npx tsc --noEmit` passes; testids visible in DOM

[x] **41.2 — E2E spec: Gap 1 — Extracted Text section**
   - File: `e2e/gap1-extracted-text.spec.ts`
   - Upload `medical-invoice.pdf` (has OCR text) → navigate to document detail
   - Assert `detail-extracted-text` element is in DOM (section rendered)
   - Assert `<summary>` text is "Extracted Text"
   - Done when: `npx playwright test e2e/gap1-extracted-text.spec.ts` passes

[x] **41.3 — E2E spec: Gap 3 — Extracted Info section**
   - File: `e2e/gap3-extracted-info.spec.ts`
   - Upload `medical-invoice.pdf` → navigate to detail
   - Assert `detail-extracted-info` is visible (entities extracted)
   - Assert at least one group heading ("Medications" | "Conditions" | "Lab Results" | "Referrals") is visible
   - Done when: `npx playwright test e2e/gap3-extracted-info.spec.ts` passes

[x] **41.4 — E2E spec: Gap 2 — Content Search**
   - File: `e2e/gap2-content-search.spec.ts`
   - Upload `medical-invoice.pdf` and `BloodTest_2024-01-15.pdf`
   - Navigate to Content Search (main nav link or `/content-search`)
   - Type shared keyword (e.g. "Dr" or "2024") into `content-search-input`
   - Assert `summary-bar` shows doc count ≥ 1
   - Assert at least one result card is visible
   - Done when: `npx playwright test e2e/gap2-content-search.spec.ts` passes

[x] **41.5 — E2E spec: Gap 4 — Trash flows**
   - File: `e2e/trash-flows.spec.ts`
   - **TC-TRASH-01 (restore):** Upload doc → delete → navigate to `/trash` → click `trash-restore-btn` → doc back in document list
   - **TC-TRASH-02 (delete permanently):** Upload doc → delete → trash → `trash-delete-permanently-btn` → doc gone from trash
   - **TC-TRASH-03 (empty trash):** Upload 2 docs → delete both → trash → `trash-empty-btn` → trash is empty
   - Done when: all 3 TCs pass

[x] **41.6 — E2E spec: Gap 5 — Category multi-select filter**
   - File: `e2e/gap5-category-filter.spec.ts`
   - Upload doc A, assign category "Cardiology"
   - Upload doc B, assign category "Neurology"
   - Open advanced filter panel → select "Cardiology" chip
   - Assert only doc A is visible; doc B absent
   - Clear filter → both visible again
   - Done when: `npx playwright test e2e/gap5-category-filter.spec.ts` passes

[x] **41.7 — E2E spec: Gap 6 — Auto-archive show/hide toggle**
   - File: `e2e/gap6-auto-archive.spec.ts`
   - Create a category with 0 documents (or rely on existing auto-archive logic)
   - Navigate to `/clinics` or `/categories` page; assert archived category hidden by default
   - Click `show-archived-toggle`; assert archived category now visible
   - Add `data-testid="show-archived-toggle"` if missing (check `src/app/(app)/clinics/page.tsx`)
   - Done when: `npx playwright test e2e/gap6-auto-archive.spec.ts` passes

[x] **41.8 — Full suite run + pre-commit checks + commit**
   - `npx playwright test` — all pass, exit 0
   - `npx tsc --noEmit`
   - Push to `origin/develop`; confirm CI green
   - Commit: `test: E2E gap closing — Extracted Text, Extracted Info, Content Search, Trash, category filter, auto-archive (Phase 41)`

---

## Phase 42 — Content Search Bug Fix: Registration Form Not Returned

**Manual test feedback (2026-05-08):**
Searching "Registration Form" or "registration" returns no results even though a registration form PDF was uploaded.

**Expected:** FTS5 content search returns the registration form document when queried with "registration".

**Root cause hypothesis:** FTS5 `documents_fts` may not cover `extracted_text`, or `extracted_text` is NULL for registration form documents (OCR pipeline may not run / may fail silently for this document type).

**Done when:**
- Searching "registration" returns the registration form document
- E2E test passes: upload registration form PDF → content search "registration" → result card visible

### Sprint 42

[x] **42.1 — Diagnose: check FTS5 index and extracted_text population**
   - Root cause: `documents_run_extraction` wrote `extracted_text` to `documents` table but never called `upsert_search_index` — FTS5 row retained empty string from upload time
   - Done when: root cause identified; note findings in 42.2 ✓

[x] **42.2 — Fix: ensure FTS5 indexes extracted_text and OCR runs for registration forms**
   - Fix: added `upsert_search_index` call after `UPDATE documents SET extracted_text = ...` in `documents_run_extraction` (`documents.rs` ~line 1373)
   - Uses `load_doc(conn, &id)` then calls `upsert_search_index` matching all other call sites
   - Done ✓

[x] **42.3 — E2E test: content search returns registration form**
   - File: `e2e/content-search-registration.spec.ts` — created
   - Uses `medical-invoice.pdf` (contains "Company Registration No: 5432109")
   - Searches "registration" → asserts summary-bar count ≥ 1
   - Done ✓

[x] **42.4 — Pre-commit checks + commit**
   - `npx tsc --noEmit` ✓
   - `cargo fmt --all` ✓ `cargo clippy -- -D warnings` ✓
   - Done ✓

---

## Phase 43 — Notes UX (Option B): Create-from-Context, OCR Prefill, Linked Notes Panel

**Goal:** Fix UX gaps in the existing Notes entity (Option B model — many-to-many links).  
Keep `documents.notes` plain-text field as a short "quick note" annotation; the richer linked Notes entity handles journal/clinical notes.  
New affordances: "Add Note" button on DocumentDetail that creates a linked note and optionally prefills from OCR extracted_text; linked notes panel on detail pages; empty-state onboarding.

**Done when:** User can create a note directly from a document detail page, optionally prefilling from OCR text; linked notes appear in a panel on that page; Notes list page shows onboarding empty state with a "Create your first note" CTA.

### Sprint 43

[x] **43.1 — "Add Note" button on DocumentDetail (linked, OCR prefill)**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`
   - Add "Add Note" button in the header actions area (near existing "Edit" / "Delete")
   - On click: `router.push('/notes/new?linkedDocumentId=<id>')`
   - Done when: button renders; clicking navigates to `/notes/new` with correct query param

[x] **43.2 — NoteEditorClient: accept `linkedDocumentId` query param and auto-link**
   - Created `src/app/(app)/notes/new/page.tsx` — reads `linkedDocumentId`, calls `createNote()`, calls `invoke('note_link', ...)`, redirects to editor
   - Editor's existing `links_for_note` load shows the chip automatically on arrival
   - Done when: creating a note from DocumentDetail auto-links it; chip visible in editor ✓

[x] **43.3 — OCR prefill toggle in NoteEditorClient**
   - Added `linkedDocumentId` searchParam read; fetches `extracted_text` from already-loaded `docs`
   - Toggle renders when `linkedDocExtractedText` non-null; ON → `editor.commands.setContent(...)` + auto-save
   - Done when: toggle visible when extracted_text available; toggling ON populates editor content ✓

[x] **43.4 — Linked notes panel on DocumentDetailClient**
   - Below the "Quick Note" field, add a "Notes" section
   - Load: `invoke('notes_for_entity', { entityType: 'document', entityId: id })`
   - Render each note as a card with title, snippet (first 80 chars of content), created_at
   - Each card links to `/notes/view/<noteId>`
   - Show "No linked notes yet" empty state with "Add Note" link
   - Done when: panel renders linked notes; clicking a card navigates to note editor

[x] **43.5 — Linked notes panel on AppointmentDetailClient**
   - Mirror task 43.4 for `src/app/(app)/appointments/view/AppointmentDetailClient.tsx`
   - `notes_for_entity` call already present (line 85) — wire result into a rendered panel
   - Done when: appointment detail shows linked notes panel identical in structure to document detail

[x] **43.6 — Notes list page: empty-state onboarding**
   - `src/app/(app)/notes/page.tsx` (or NoteListClient equivalent)
   - When `notes_list` returns empty array: render full-page onboarding empty state
   - Content: "No notes yet — start capturing clinical observations, symptoms, or follow-up thoughts."
   - CTA button: "Create your first note" → navigates to `/notes/new`
   - Done when: fresh vault with no notes shows onboarding state; button navigates correctly

[x] **43.7 — Unit tests + E2E spec + pre-commit + commit**
   - Unit: `src/app/(app)/notes/__tests__/note-ocr-prefill.test.tsx` — mock `invoke`; assert toggle renders when extracted_text present; assert editor content set on toggle
   - E2E: `e2e/notes-ux.spec.ts`
     - TC-NOTES-01: upload doc → document detail → "Add Note" → verify note linked to doc
     - TC-NOTES-02: new note from doc with extracted_text → toggle on → editor contains OCR text
     - TC-NOTES-03: empty notes list → onboarding CTA visible → click → /notes/new
   - `npx tsc --noEmit` ✓
   - Commit: `feat: Notes UX — create-from-context, OCR prefill, linked panels, empty-state (Phase 43)`

---

## Phase 44 — Symptom and Medication Entities (CRUD + Linking + FTS5)

**Goal:** Add two new first-class entities — Symptom and Medication — each with full CRUD, bi-directional linking to documents/appointments/notes, and FTS5 indexing so they appear in content search results.

**Done when:** User can log symptoms and medications; each can be linked to documents or appointments; both appear in content search results; Rust tests + frontend unit tests + E2E pass.

### Sprint 44

[x] **44.1 — Rust: symptoms table + CRUD commands**
   - Migration: `CREATE TABLE IF NOT EXISTS symptoms (id TEXT PRIMARY KEY, name TEXT NOT NULL, severity INTEGER CHECK(severity BETWEEN 1 AND 10), onset_date TEXT, notes TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
   - Commands: `symptoms_list`, `symptoms_get`, `symptoms_create`, `symptoms_update`, `symptoms_delete` (soft), `symptoms_hard_delete`
   - Register all in `lib.rs`
   - Done when: `cargo test` passes for all symptom commands

[x] **44.2 — Rust: medications table + CRUD commands**
   - Migration: `CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY, name TEXT NOT NULL, dosage TEXT, frequency TEXT, start_date TEXT, end_date TEXT, notes TEXT, deleted_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`
   - Commands: `medications_list`, `medications_get`, `medications_create`, `medications_update`, `medications_delete` (soft), `medications_hard_delete`
   - Register all in `lib.rs`
   - Done when: `cargo test` passes for all medication commands

[x] **44.3 — Rust: entity_links table (generic) + link/unlink commands for symptoms + medications**
   - Check if `note_links` pattern can be extended or add a generic `entity_links (id, from_type, from_id, to_type, to_id, created_at)` table
   - Commands: `symptom_link`, `symptom_unlink`, `links_for_symptom`, `medication_link`, `medication_unlink`, `links_for_medication`
   - Done when: link/unlink round-trip tests pass

[x] **44.4 — Rust: FTS5 indexing for symptoms and medications**
   - After create/update of symptom: call `upsert_search_index(conn, id, 'symptom', name + " " + notes)`
   - After create/update of medication: call `upsert_search_index(conn, id, 'medication', name + " " + notes + " " + dosage)`
   - After soft-delete: call `upsert_search_index` with empty body (or delete row from `search_index`)
   - Done when: `SELECT * FROM search_index WHERE entity_type='symptom'` returns rows after symptom creation

[x] **44.5 — Rust: cargo fmt + clippy + tests**
   - `cargo fmt --all` ✓
   - `cargo clippy -- -D warnings` ✓
   - `cargo test --all` ✓
   - Done when: all Rust checks green

[x] **44.6 — Frontend: Symptoms list + create/edit pages**
   - `src/app/(app)/symptoms/page.tsx` — list view with `symptoms_list`; empty-state "Log your first symptom"
   - `src/app/(app)/symptoms/new/page.tsx` and `/symptoms/view/[id]/page.tsx` — create/edit form
   - Fields: name (required), severity (1–10 slider), onset_date (date picker), notes (textarea)
   - Nav: add "Symptoms" link to sidebar nav
   - Done when: user can create, view, edit, soft-delete a symptom

[x] **44.7 — Frontend: Medications list + create/edit pages**
   - Mirror task 44.6 for medications
   - Fields: name (required), dosage, frequency, start_date, end_date, notes
   - Nav: add "Medications" link to sidebar nav
   - Done when: user can create, view, edit, soft-delete a medication

[x] **44.8 — Frontend: link symptoms/medications to documents and appointments**
   - DocumentDetailClient: "Link Symptom" and "Link Medication" buttons → searchable dropdown → `symptom_link` / `medication_link`
   - AppointmentDetailClient: same pattern
   - Render linked chips; unlink on ✕
   - Done when: symptom and medication chips appear on document and appointment detail pages

[x] **44.9 — Unit tests for Symptoms + Medications frontend**
   - `src/app/(app)/symptoms/__tests__/symptoms-crud.test.tsx`
   - `src/app/(app)/medications/__tests__/medications-crud.test.tsx`
   - Mock `invoke`; assert list renders; assert create calls correct command; assert delete softly removes from list
   - Done when: `npx vitest run` passes

[x] **44.10 — E2E spec + pre-commit + commit**
   - `e2e/symptoms-medications.spec.ts`
     - TC-SYM-01: create symptom "Headache" severity 7 → appears in list
     - TC-MED-01: create medication "Ibuprofen 400mg" → appears in list
     - TC-LINK-01: link symptom to a document → chip visible on document detail
   - `npx tsc --noEmit` ✓, `cargo fmt` ✓, `cargo clippy` ✓
   - Commit: `feat: Symptom and Medication entities — CRUD, linking, FTS5 (Phase 44)`

---

## Phase 45 — Unified Content Search: Documents + Notes + Symptoms + Medications

**Goal:** Expand the content search page (`/content-search`) to return results from all four entity types, grouped by type in the results list, with type-labelled cards that navigate to the correct detail page.

**Done when:** Searching a term returns matching documents, notes, symptoms, and medications; each result card shows the entity type label and links to the correct page; summary bar shows total count across all types.

### Sprint 45

[x] **45.1 — Rust: expand `content_search` command to include all entity types**
   - `src-tauri/src/commands/search.rs` (or wherever `content_search` lives)
   - Change FTS5 query: remove any `entity_type = 'document'` filter; return all matching rows
   - Return `entity_type` field in each result row
   - Done when: `cargo test` includes a test that a symptom indexed in `search_index` is returned by `content_search`

[x] **45.2 — Frontend: update ContentSearchClient to handle multi-type results**
   - `src/app/(app)/content-search/` — update result rendering
   - Each result card: show coloured type badge (`Document` / `Note` / `Symptom` / `Medication`)
   - Link per type: documents → `/documents/view/<id>`, notes → `/notes/view/<id>`, symptoms → `/symptoms/view/<id>`, medications → `/medications/view/<id>`
   - Group results by entity_type with section headers, or sort by relevance with inline type badge
   - Done when: searching "ibuprofen" returns medication card; searching "headache" returns symptom card

[x] **45.3 — Frontend: summary bar shows breakdown by type**
   - `data-testid="summary-bar"` — update text to e.g. "4 results — 2 Documents, 1 Note, 1 Medication"
   - Done when: summary bar reflects multi-type counts

[x] **45.4 — Unit test: multi-type result rendering**
   - `src/app/(app)/content-search/__tests__/content-search-multi-type.test.tsx`
   - Mock `invoke('content_search')` returning one result per entity type
   - Assert 4 cards render; assert type badges present; assert correct hrefs
   - Done when: `npx vitest run` passes

[x] **45.5 — E2E spec + pre-commit + commit**
   - `e2e/content-search-multi-type.spec.ts`
     - Create note "Annual checkup notes" → search "checkup" → note card visible
     - Create symptom "Migraine" → search "migraine" → symptom card visible
     - Create medication "Amoxicillin" → search "amoxicillin" → medication card visible
   - `npx tsc --noEmit` ✓, `cargo fmt` ✓, `cargo clippy` ✓
   - Commit: `feat: unified content search — documents + notes + symptoms + medications (Phase 45)`

---

## Phase 46 — Content Search Filters: Entity-Type Chips + Date Range

**Goal:** Add entity-type filter chips and an optional date range picker to the `/content-search` page, and extend the `content_search` Rust command to accept these filters. This is the only genuine remaining feature gap (PRD F6.5 "Filter results by type").

**Done when:** The `/content-search` page has clickable entity-type filter chips (All / Document / Note / Symptom / Medication) and an optional date range that narrow results server-side; the summary bar reflects the filtered count; all tests pass.

### Sprint 46

[x] **46.0 — Rust: V25 migration — add `activity_date` to `search_index` FTS5 + update `upsert_search_index`**
   - **Blocker:** `search_index` FTS5 virtual table (created in V20) has no `activity_date` column; date filtering in 46.1 cannot be implemented without it. FTS5 tables cannot be ALTERed — must drop and recreate.
   - File: `src-tauri/migrations/` — add V25 migration
     - `DROP TABLE IF EXISTS search_index;`
     - Recreate with identical columns + `activity_date TEXT` appended
   - File: `src-tauri/src/commands/documents.rs` (or wherever `upsert_search_index` is defined)
     - Add `activity_date: Option<&str>` as 9th parameter
     - Update INSERT statement to include `activity_date`
   - Find all call sites of `upsert_search_index` (grep: `upsert_search_index`) and pass the document/entity activity_date value (or `None` for entities that have no date)
   - Done when: `cargo test` passes; `search_index` table has `activity_date` column; all existing search tests still pass

[x] **46.1 — Rust: extend `content_search` command with optional filters**
   - File: `src-tauri/src/commands/search.rs`
   - Add optional params: `entity_types: Option<Vec<String>>`, `date_from: Option<String>`, `date_to: Option<String>`
   - If `entity_types` is non-empty, add `WHERE entity_type IN (…)` clause to FTS5 query
   - If `date_from`/`date_to` provided, filter on `activity_date` column in `search_index` (added by V25 migration in 46.0)
   - Keep backward compat: if all params None, behaviour identical to current
   - Done when: `cargo test` includes a test asserting entity_type filter returns only matching types; date range test filters by date

[x] **46.2 — Frontend: add entity-type filter chip row**
   - File: `src/app/(app)/content-search/page.tsx`
   - Add chip row above results: **All** | **Document** | **Note** | **Symptom** | **Medication**
   - Active chip highlighted; clicking changes state and re-triggers search
   - "All" deselects all specific filters
   - Pass `entity_types` to `invoke('content_search', { query, entityTypes: [...] })`
   - Done when: clicking "Document" chip re-runs search and only Document cards render

[x] **46.3 — Frontend: add date range inputs**
   - Same file as 46.2
   - Add two `<input type="date">` fields: "From" and "To" (collapsible or always visible)
   - On change, re-trigger search with `dateFrom` / `dateTo` params
   - Clear button resets both fields and re-searches
   - Done when: entering a date range filters results to only entries within that range

[x] **46.4 — Frontend: summary bar reflects filtered count**
   - Update `data-testid="summary-bar"` to show filtered count
   - When filters active: "4 of 12 results — 4 Documents"
   - When no filters: original behaviour "12 results — 2 Documents, …"
   - Done when: summary bar text changes correctly when filters applied/cleared

[x] **46.5 — Unit tests: filter chip interactions**
   - File: `src/app/(app)/content-search/__tests__/content-search-filters.test.tsx`
   - Mock `invoke` returning mixed-type results
   - Assert: clicking "Document" chip triggers invoke with `entityTypes: ['document']`
   - Assert: date range inputs trigger invoke with `dateFrom`/`dateTo`
   - Assert: "All" chip clears entity filters
   - Assert: summary bar shows filtered count
   - Done when: `npx vitest run` passes

[x] **46.6 — Rust unit tests: filter logic**
   - File: `src-tauri/src/commands/search.rs` (or adjacent test module)
   - Test: `entity_types = ['document']` filters out notes/symptoms/medications
   - Test: `date_from = '2024-01-01', date_to = '2024-12-31'` excludes entries outside range
   - Test: no filters → all entity types returned
   - Done when: `cargo test` passes

[x] **46.7 — E2E spec + pre-commit + commit**
   - File: `e2e/content-search-filters.spec.ts`
   - Setup: upload one document + create one note with searchable text
   - Search for term that matches both → both appear
   - Click "Document" chip → only document card visible; note card gone
   - Click "All" → both reappear
   - Enter date range that excludes document → document gone
   - `npx tsc --noEmit` ✓, `cargo fmt` ✓, `cargo clippy` ✓
   - Commit: `feat: content search entity-type filter chips + date range (Phase 46)`

---

## Phase 48 — Hardcoded Filter Tech Debt

**Goal:** Eliminate hard-coded filter values (roles, categories, statuses, entity labels) found during code review (2026-05-09). Prioritised H → M; LOW items deferred to v1.5+.

**Done when:** All HIGH items resolved; no duplicate role arrays; category list driven by backend command; appointment status validated at IPC boundary; entity-type config centralised.

### Priority H3 — Quick fix: shared role constants (30 min)

[x] **48.1 — Export `DOCTOR_ROLES` / `CLINIC_ROLES` from `contactsStore.ts`**
   - Current: `AppointmentForm.tsx:16-17` redeclares `['doctor', 'specialist', 'physio', 'dentist', 'nurse', 'other']` inline, duplicating the identical array already in `contactsStore.ts`
   - Fix: add `export const DOCTOR_ROLES = [...]` and `export const CLINIC_ROLES = [...]` in `contactsStore.ts`; import them in `AppointmentForm.tsx` and remove the local declarations
   - `npx tsc --noEmit` must pass
   - Done when: no duplicate role arrays exist in the codebase (`grep -r "DOCTOR_ROLES\|doctor.*specialist.*physio" src/` shows single definition)

### Priority H1 — Backend-driven categories (medium)

[x] **48.2 — Add `documents_valid_categories` Tauri command**
   - New command in `src-tauri/src/commands/documents.rs` (or `categories.rs`)
   - Returns `Vec<String>` — the list of all valid category names (currently hard-coded in frontend filter panel)
   - Frontend (`src/components/documents/DocumentList.tsx` or wherever category chips are built) fetches on init via `invoke('documents_valid_categories')`; replaces static array
   - Done when: `cargo test` includes a test asserting the command returns a non-empty list; frontend chip list is driven by the invoke result

### Priority H2 — Appointment status validation at IPC boundary (medium)

[x] **48.3 — Validate appointment statuses at IPC boundary**
   - Current: frontend uses string literals `'scheduled' | 'completed' | 'cancelled'` with no Rust-side enum check
   - Fix: define `AppointmentStatus` enum in Rust (or use a `match` guard in the update command); return an error if an unknown status string is received
   - TypeScript side: create `type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'` in `src/types/appointments.ts` (or equivalent); use it wherever status is set/read
   - Done when: passing `'bogus'` to `appointments_update` returns a Tauri error; TypeScript type is used at all call sites

### Priority M1 — Centralise entity-type labels + routes (medium)

[x] **48.4 — Create `src/lib/entities.ts` entity config map**
   - Current: entity-type labels (`'Document'`, `'Note'`, `'Symptom'`, `'Medication'`) and their route prefixes are repeated across ContentSearchClient, result cards, badge renderers, and link builders
   - Fix: create `src/lib/entities.ts` exporting:
     ```ts
     export const ENTITY_CONFIG = {
       document:   { label: 'Document',   route: '/documents/view'   },
       note:       { label: 'Note',        route: '/notes/view'       },
       symptom:    { label: 'Symptom',     route: '/symptoms/view'    },
       medication: { label: 'Medication',  route: '/medications/view' },
     } as const
     ```
   - Replace all inline string literals / switch blocks with lookups from `ENTITY_CONFIG`
   - Done when: `npx tsc --noEmit` passes; no bare `'/documents/view'` strings outside `entities.ts`

### Priority M2/M3 — Extraction tag / specialty constants (flag for future)

[x] **48.5 — Add TODO comments on extraction tag and specialty constant blocks**
   - `src-tauri/src/commands/documents.rs` — tag extraction constants (type tags, specialty list)
   - Add: `// TODO(hardcoded): move to DB config table (Phase 48 deferred to v1.5)`
   - No functional change — just guards against silent drift
   - Done when: TODO comments are present; no code changed

[x] **48.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `refactor: eliminate hardcoded filter values — roles, categories, statuses, entity config (Phase 48)`

---

## Phase 49 — Missing Notes After Document Upload: Analysis + Fix

### Problem Statement

Users report that notes are missing after uploading a document. Specifically, the upload dialog shows a "Notes" textarea but the saved document does not surface any OCR-extracted note content.

**Root cause (confirmed 2026-05-09):**

`UploadDialog.tsx` has a manual notes textarea (`const [notes, setNotes] = useState('')` at line 95; rendered at lines 862–869). This textarea is bound to manual user input only — it is **never pre-populated** from the extraction result. The `ExtractionSuggestions` struct (Rust) has no `clinical_notes` field, so OCR-extracted note content is invisible during the upload flow.

The raw OCR text is stored in `documents.extracted_text` and surfaced on the document detail page (Phase 38 — "Extracted Text" collapsible section). That panel already solves the read-back problem for existing documents. The gap is in the upload-time UX: users expect the upload dialog to show them what was found in the document so they can annotate accordingly.

### Fix Options

| Option | Description | Effort | Trade-off |
|--------|-------------|--------|-----------|
| **A — Pre-fill notes textarea from extraction** | Add `clinical_notes: Option<String>` to `ExtractionSuggestions` in Rust; populate from `extracted_text` trimmed to ~400 chars; pre-fill the manual notes textarea in `UploadDialog.tsx` | Medium (Rust + frontend) | Simple; but merges OCR content and user annotation into the same field — confusing if user wants to keep them separate |
| **B — Keep notes manual; rely on detail-page Extracted Text panel** | No change to upload flow; add a dismissible info banner in `UploadDialog` at review step: "Full extracted text will be available on the document detail page" | Small (one banner line) | Honest UX contract; no risk of OCR noise in manual notes field; detail-page panel already exists (Phase 38) |
| **C — Read-only OCR preview in upload dialog** | Add a non-editable "OCR Preview" block in the upload review step showing the first ~300 chars of `extracted_text`; manual notes textarea remains separate | Medium (UI only; extraction already returns `extracted_text`) | Clearest separation of concerns; users can see extracted text without it polluting their notes |

**Recommendation: Option C** — show a collapsible read-only "Extracted Text Preview" in the upload review step. Manual notes stay separate. This matches the pattern already used on the document detail page and avoids silently writing OCR noise into the user's own notes.

### Sprint 49

[x] **49.1 — Rust: include `extracted_text_preview` in `ExtractionSuggestions`**
   - `src-tauri/src/commands/documents.rs` — `ExtractionSuggestions` struct
   - Add field: `extracted_text_preview: Option<String>` — first 400 chars of `extracted_text`, trimmed
   - Populate it in the extraction command that returns `ExtractionSuggestions`
   - Done when: `cargo test` passes; field present in JSON response

[x] **49.2 — Frontend: collapsible OCR preview in UploadDialog review step**
   - `src/components/documents/UploadDialog.tsx`
   - In the review step (after upload, when `ExtractionSuggestions` is shown): if `extractedTextPreview` is non-empty, render a collapsible `<details>` block
     - `<summary>Extracted Text Preview</summary>`
     - `<p className="text-sm text-gray-500 whitespace-pre-wrap">{extractedTextPreview}</p>`
   - Do NOT pre-fill the notes textarea — keep manual notes separate
   - Add `data-testid="upload-extracted-text-preview"` to the `<details>` element
   - Done when: `npx tsc --noEmit` passes; preview visible in upload review step when OCR text exists; hidden when absent

▶ [ ] **49.3 — Update `tauri-mock.js` EXTRACTION_MAP with `extracted_text_preview`**
   - All entries in `EXTRACTION_MAP` that have OCR-like content: add `extracted_text_preview: 'Sample extracted text...'`
   - Entries with no extracted text: set `extracted_text_preview: null`
   - Done when: E2E tests that check for `upload-extracted-text-preview` use correct mock data

[ ] **49.4 — E2E spec: upload-extracted-text-preview visible after upload**
   - File: `e2e/upload-ocr-preview.spec.ts`
   - **TC-OCR-01:** Upload `medical-invoice.pdf` (has `extracted_text_preview` in mock) → review step → assert `upload-extracted-text-preview` is present in DOM
   - **TC-OCR-02:** Upload `no-date-physio.pdf` (no preview in mock) → review step → assert `upload-extracted-text-preview` is NOT present
   - Done when: both TCs pass

[ ] **49.5 — Unit test: UploadDialog renders preview when present**
   - `src/components/documents/UploadDialog.test.tsx`
   - Mock extraction result with `extracted_text_preview: 'Blood pressure: 130/85'`
   - Assert `upload-extracted-text-preview` element is in DOM
   - Assert manual notes textarea is empty (OCR content not leaked into notes)
   - Done when: `npx vitest run` passes

[ ] **49.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: show OCR text preview in upload review step — read-only collapsible (Phase 49)`
