# myHealth — Execution Plan (v1.2 / v1.3)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Task 38.5 complete. Next: Task 38.6 — Pre-commit checks + commit.
```

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

**v1.4+ (future)**

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

▶ [ ] **38.6 — Pre-commit checks + commit**
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

[ ] **39.1 — Rust command `documents_content_search`**
   - Input: `query: String`
   - SQL: FTS5 snippet on `extracted_text` JOIN documents; ORDER BY `activity_date ASC`
   - Return: `Vec<ContentSearchResult>` — `{id, title, activity_date, snippet, provider_tag}`
   - Plus `ContentSearchSummary` — `{first_date, last_date, doc_count, unique_providers}`
   - Done when: `cargo test` passes with fixture docs

[ ] **39.2 — Frontend: Content Search page / panel**
   - Route or slide-over panel; search input → `invoke('documents_content_search', { query })`
   - Summary bar + vertical timeline list of result cards
   - Each card: title, date, provider, highlighted snippet, link to document detail
   - Done when: `npx tsc --noEmit` passes; manual smoke shows grouped timeline

[ ] **39.3 — Unit + E2E tests**
   - Unit: mock invoke; assert summary bar values; assert cards in date order
   - E2E: upload 2 docs with "hypertension" in OCR text at different dates → search → 2 cards chronological → summary count 2
   - Done when: all tests pass

[ ] **39.4 — Pre-commit checks + commit**
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

[ ] **40.1 — DB migration: `document_entities` table**
   - Columns: `id, document_id, entity_type (medication|diagnosis|lab_value|referral), name, value, unit, raw_text, created_at`
   - Done when: migration runs cleanly; `cargo test` passes

[ ] **40.2 — Rust entity extraction module (regex-based, conservative)**
   - New module `src-tauri/src/extraction/entities.rs`
   - Medication: `Lisinopril 10mg`, `metformin 500 mg` patterns
   - Diagnosis: after "Diagnosis:", "Assessment:", "Impression:" labels
   - Lab value: `HbA1c: 6.2%`, `eGFR 72 mL/min`, `BP 130/85` patterns
   - Referral: "referred to", "referral to", "please see" patterns
   - Conservative — prefer false negatives; empty result is fine
   - Done when: `cargo test` passes with fixture texts for each entity type

[ ] **40.3 — Wire extraction into OCR pipeline for ALL document types**
   - After `extracted_text` written to `documents`, call entity extraction → INSERT into `document_entities`
   - Done when: uploading any PDF with recognisable text populates `document_entities`

[ ] **40.4 — Rust command `document_entities_get`**
   - Input: `document_id: i64`
   - Return: `Vec<DocumentEntity>` grouped by `entity_type`
   - Done when: `cargo test` passes

[ ] **40.5 — Surface entities in document detail UI**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`
   - On mount, invoke `document_entities_get`; if non-empty render "Extracted Info" section
   - Group by type: Medications, Conditions, Lab Results, Referrals
   - Hide section entirely when entity list is empty
   - Done when: `npx tsc --noEmit` passes; manual smoke shows entities on GP notes upload

[ ] **40.6 — Unit tests**
   - Rust: entity extraction positive + negative cases per pattern type
   - Frontend: render with entities → section visible and grouped; empty → hidden
   - Done when: `npx vitest run` + `cargo test` pass

[ ] **40.7 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: structured entity extraction from all documents (Gap 3)`
