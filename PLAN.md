# myHealth — Execution Plan (v1.1 / v1.2 / v1.3)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Phase 8 — v1.2 Enhancements
Current task: 8.4 — F3.7 Auto-archive empty categories
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

**v1.1 (SHIPPED)**

| Feature | PRD_V2 Section | Priority | Status |
|---------|---------------|----------|--------|
| F5.3–F5.4 Contact deduplication + merge | §F5 | HIGH | ✅ done |
| F6 Document-appointment link scoring | §F6 | HIGH | ✅ done |
| F2.2–F2.5 OCR pipeline | §F2 | HIGH | ✅ done |
| F3.2–F3.5 Many-to-many categories + bulk ops | §F3 | MED | ✅ done |
| F4 Apple Calendar integration (macOS) | §F4 | LOW | ✅ done |

**v1.2 (next)**

| Feature | PRD_V2 Section | Priority | Effort |
|---------|---------------|----------|--------|
| Advanced search filters (date range, category combo) | §F3/F6 | HIGH | Small |
| F3.4 Drag-to-organize categories | §F3 | SHOULD | Small |
| F3.7 Auto-archive empty categories | §F3 | SHOULD | Small |
| F4.5 Calendar conflict resolution UI | §F4 | SHOULD | Medium |
| PDF summary report export | Phase 2 | MED | Medium |

**v1.3+ (future)**

| Feature | PRD_V2 Section | Priority | Effort |
|---------|---------------|----------|--------|
| Outlook Calendar sync (Windows) | Phase 3 | MED | Large |
| iCalendar import/export (.ics) | Phase 3 | MED | Medium |
| AI appointment notes summarization | Phase 3 | LOW | Large |
| Medical code tagging (ICD-10) | Phase 3 | LOW | Medium |
| Multi-user vault support | Phase 3 | LOW | Large |

**Coverage requirement:** ≥ 80% across all new code

---

## Phase 0 — Database Schema Migrations (prerequisite for all phases)

### Sprint 0

[x] **0.1 — New v1.1 tables migration**
   - In `src-tauri/src/db/migrations.rs` add migration creating all seven new tables per ARCHITECTURE_V2 §3:
     - `clinics (id, user_id, name, address, phone, created_at)`
     - `document_appointments (document_id, appointment_id, score INTEGER, created_at)` — junction with score
     - `document_categories (document_id, category_id)` — junction
     - `appointment_categories (appointment_id, category_id)` — junction
     - `calendar_sources (id, user_id, source_type, name, external_id, is_active, last_synced_at)`
     - `calendar_events (id, user_id, source_id, external_event_id, title, start_time, end_time, location, notes, appointment_id, created_at)`
   - Add FK constraints; create indexes on all foreign keys
   - Done when: `cargo test` passes migration; `sqlite3 :memory:` confirms all 6 tables created; existing data rows unaffected

[x] **0.2 — Extend existing tables with v1.1 columns**
   - Add to `documents`: `extraction_status TEXT`, `extracted_text TEXT`, `extracted_at TEXT`, `extraction_error TEXT`, `parsed_filename TEXT`, `parser_confidence REAL`
   - Add to `appointments`: `clinic_id TEXT REFERENCES clinics(id)`
   - Add to `contacts`: `is_deduped_with TEXT`, `dedup_score REAL`
   - All new columns nullable (backwards compatible with existing rows)
   - Done when: `cargo test` passes; existing document/appointment/contact rows readable without errors; `SELECT extracted_text FROM documents WHERE id = ?` returns NULL for existing rows

---

## Phase 1 — Contact Deduplication (F5.3–F5.4)

### Sprint 1: Rust backend

[x] **1.1 — Levenshtein engine**
   - `strsim` crate is already listed in `src-tauri/Cargo.toml` — no addition needed
   - In `src-tauri/src/commands/contacts.rs` implement `find_duplicate_contacts`:
     - Signature: `find_duplicate_contacts(user_id: String, contact_id: Option<String>, threshold: f64)` (default threshold 0.85)
     - For each pair of contacts compute Levenshtein similarity on `name` field; also flag exact email or phone matches regardless of threshold
     - Return `Vec<DuplicateCandidate>` where each entry contains `{ contact, similarity_score: f64, match_reason: String }`
   - Done when: `cargo test contacts::` passes with vectors: (a) identical names → similarity 1.0, (b) "John Smith" vs "Jon Smyth" → 0.85–0.92, (c) "John Smith" vs "Jane Doe" → < 0.5; scan 200 contacts in < 500ms

[x] **1.2 — Merge command**
   - Implement `merge_contacts` Tauri command:
     - Signature: `merge_contacts(user_id: String, primary_id: String, duplicate_ids: Vec<String>)`
     - Re-point all `document_contacts` and `appointment_contacts` rows to `primary_id`
     - Merge non-null fields from duplicates into primary (email, phone, title, organization) where primary has null
     - Delete merged contact rows
     - Wrap in DB transaction; rollback on any error
   - Done when: `cargo test` verifies (a) all `document_contacts` rows re-pointed to primary_id, (b) all `appointment_contacts` rows re-pointed, (c) duplicate contact rows deleted, (d) transaction rolls back on FK violation

### Sprint 2: Frontend

[x] **1.3 — Duplicate detection UI in Contacts page**
   - Add "Find Duplicates" button to `src/app/(app)/contacts/page.tsx`
   - Calls `find_duplicate_contacts`; displays side-by-side comparison cards for each group
   - Each card shows both contacts' fields, similarity %, and "Merge" / "Keep Both" buttons
   - Done when: merging two visually confirmed duplicates updates list without page reload

[x] **1.4 — Upload dialog: duplicate check on "Save as Contact"**
   - Before calling `contacts_create` in `UploadDialog.tsx`, call `find_duplicate_contacts` with the candidate name
   - If similarity ≥ 0.85 match found, show inline "Possible duplicate: [name] — merge?" prompt
   - User can choose merge, create new, or cancel
   - Done when: saving a contact with name close to an existing one surfaces the merge prompt

[x] **1.5 — F5 tests** — coverage ≥ 80% for duplicate detection and merge flows

---

## Phase 2 — Document-Appointment Link Scoring (F6)

> **Note:** Signal 2 (doctor name match) reads `extracted_text` added in Task 0.2. The column exists from Phase 0 but is initially NULL; link scoring gracefully skips Signal 2 if NULL. Full scoring accuracy requires Phase 3 (OCR) to run first. OCR populates `extracted_text`; link scores auto-improve on next score call.

### Sprint 3: Rust backend

[x] **2.1 — Scoring engine (integer point model)**
   - Create `src-tauri/src/services/linking/scorer.rs` per ARCHITECTURE_V2 §9
   - Implement `score_document_appointment_links` command:
     - Signature: `score_document_appointment_links(user_id: String, document_id: String)`
     - For each appointment in DB accumulate integer points:
       - Signal 1: +3 if `|doc.document_date − appt.date| ≤ 3 days`
       - Signal 2: +3 if doctor name appears in `extracted_text` (Levenshtein distance ≤ 2)
       - Signal 3: +2 if document and appointment share a `category_id` (via `document_categories` / `appointment_categories`)
       - Signal 4: +2 if document's clinic context matches appointment's `clinic_id`
     - Return only pairs where `score ≥ 4`, ordered by score desc
     - Return `Vec<LinkCandidate>` where `LinkCandidate { appointment_id: String, score: u8, reasons: Vec<&str> }`
     - **TF-IDF is not used** for link scoring (FTS5 TF-IDF is for full-text search only)
   - Done when: `cargo test` passes with vectors: (a) date 3d apart → score +3 ≥ threshold, (b) date 10d apart → +0, (c) doctor name match → +3, (d) shared category → +2, (e) shared clinic → +2; score < 4 suppressed; score ≥ 4 returned; 200 appointments scored in < 200ms

[x] **2.2 — Link CRUD commands**
   - Implement Tauri commands per ARCHITECTURE_V2 §4:
     - `link_document_to_appointment(user_id: String, document_id: String, appointment_id: String, score: u8)`
     - `unlink_document_from_appointment(user_id: String, document_id: String, appointment_id: String)`
     - `get_document_links(user_id: String, document_id: String)` → linked appointments
     - `get_appointment_links(user_id: String, appointment_id: String)` → linked documents
   - All write operations wrapped in transactions
   - Done when: `cargo test` covers (a) create inserts `document_appointments` row, (b) unlink removes only that specific pair, (c) list commands return correct results, (d) all writes transactional

### Sprint 4: Frontend

[x] **2.3 — Link suggestion panel in Document detail**
   - In `src/app/(app)/documents/[id]/page.tsx` add "Suggested Links" section
   - On mount call `score_document_appointment_links`; render suggestion cards: appointment title, date, clinic, score (points)
   - "Link" button calls `link_document_to_appointment` + removes card; "Not Related" dismisses permanently for session
   - Done when: uploading a document close in date and clinic to an existing appointment shows a suggestion with score ≥ 4

[x] **2.4 — Linked documents sidebar in Appointment detail**
   - In `src/app/(app)/appointments/[id]/page.tsx` add linked documents panel
   - Calls `get_appointment_links`; shows document thumbnails with unlink button
   - Done when: linking a document from the document side appears in the appointment sidebar within 1 render cycle

[x] **2.5 — F6 tests** — coverage ≥ 80% for scoring, CRUD, and UI flows

---

## Phase 3 — OCR Pipeline (F2.2–F2.5)

> **Note:** `extracted_text` column created in Task 0.2. Phase 3 populates it. Link scoring (Phase 2) picks up populated values automatically on subsequent calls.

### Sprint 5: Rust backend

[x] **3.1 — OCR subprocess integration**
   - Tesseract 5.x must be available on target platform: macOS (`brew install tesseract`), Windows (bundled binary or system install), Linux (system package)
   - In `src-tauri/src/services/extraction/ocr.rs` implement async OCR via `tokio::process::Command::new("tesseract")`
   - Spawn **one subprocess per document** (not per page) to minimise process-spawn overhead
   - Per-page 10s timeout; on timeout append `[OCR_TIMEOUT]` marker and continue to next page
   - Done when: `cargo test` confirms subprocess extraction works end-to-end; `tesseract` CLI invocation correctly parses a test image file

[x] **3.2 — OCR extraction command**
   - In `src-tauri/src/services/extraction/mod.rs` add OCR branch:
     - After native `pdf-extract` pass, if extracted text < 50% expected character density, trigger OCR
     - Single Tesseract subprocess for whole document; emit Tauri event `ocr_progress { page: u32, total: u32, elapsed_ms: u64 }` per page
     - Emit event within 20ms of each page completing
   - Update `documents_run_extraction` to accept `emit_progress: bool` flag
   - Done when: `cargo test` covers (a) native-text path returns in < 500ms, (b) OCR-triggered path emits `ocr_progress` events, (c) 10s timeout appends `[OCR_TIMEOUT]` marker and continues, (d) `extracted_at` timestamp set on completion

[x] **3.3 — Cache extracted text**
   - `extracted_text TEXT` column already added in Task 0.2 migration
   - On extraction completion write text to `documents.extracted_text` and set `extraction_status = 'EXTRACTED'`
   - On next extraction call for same document ID, return cached value immediately if `extraction_status = 'EXTRACTED'`
   - Done when: second extraction call for same document ID returns in < 100ms (Tauri IPC round-trip including SQLCipher decryption)

### Sprint 6: Frontend

[x] **3.4 — Async progress bar in Upload dialog**
   - In `UploadDialog.tsx` listen for `ocr_progress` Tauri event via `listen()`
   - Show progress bar: "Extracting text — page N of M (Xs elapsed)"
   - Auto-dismiss when extraction complete
   - Done when: uploading a scanned PDF shows page-by-page progress updates; progress events render within 100ms of emission

[x] **3.5 — F2 tests** — coverage ≥ 80% for extraction, OCR, caching, and progress UI

---

## Phase 4 — Hierarchical Categories Many-to-Many (F3.2–F3.5)

> **Note:** `document_categories` and `appointment_categories` junction tables fully designed in ARCHITECTURE_V2 §3 and created in Task 0.1 migration. Phase 4 implements CRUD commands and UI only.

### Sprint 7: Backend & schema

[x] **4.1 — Junction table CRUD commands**
   - Junction tables exist from Task 0.1 migration — no schema discovery needed
   - Implement Tauri commands per ARCHITECTURE_V2 §4:
     - `assign_category_to_document(user_id: String, document_id: String, category_id: String)`
     - `unassign_category_from_document(user_id: String, document_id: String, category_id: String)`
     - `assign_category_to_appointment(user_id: String, appointment_id: String, category_id: String)`
     - `unassign_category_from_appointment(user_id: String, appointment_id: String, category_id: String)`
   - All write operations wrapped in transactions
   - Done when: `cargo test` covers document linked to 3 categories; query by any category returns it; unassign removes only the specific pair

[x] **4.2 — Bulk categorization command**
   - Implement `categories_bulk_link(user_id: String, entity_type: String, entity_ids: Vec<String>, category_id: String)`
   - Use a single DB transaction for all INSERTs (not one command per entity)
   - Done when: `cargo test` (single transaction) links 50 documents to one category in < 1s on CI runner

### Sprint 8: Frontend

[x] **4.3 — Multi-category picker in Document/Appointment forms**
   - Replace single `<select>` category with `CategoryPicker` multi-select component
   - Shows selected categories as removable chips; search/filter dropdown
   - Calls `assign_category_to_document` / `unassign_category_from_document` on add/remove
   - Done when: document can be assigned 3 categories; all 3 appear in category filter views

[x] **4.4 — Bulk categorization UI**
   - Add checkbox selection mode to `DocumentList.tsx`
   - "Assign Category" action bar appears on selection; calls `categories_bulk_link`
   - Done when: selecting 5 documents and assigning a category links all 5

[x] **4.5 — F3 tests** — coverage ≥ 80%

---

## Phase 7 — Upload Analysis Gap Closing (v1.2)

> Source: `docs/UPLOAD_ANALYSIS_GAPS.md` — 4 gaps identified in post-v1.1.0 code audit.

### Sprint 11

[x] **7.1 — Gap 3: Per-page OCR progress + timeout**
   - Files: `src-tauri/src/extraction/ocr.rs`, `src-tauri/src/extraction/mod.rs`
   - Use `pdftoppm` (Poppler) to split scanned PDFs into per-page PNGs in a temp dir
   - Call `extract_image_text_async(page_png)` per page — 10s `PER_CALL_TIMEOUT` applies correctly
   - Emit `ocr_progress(app, i, n, elapsed_ms)` after each page
   - Fall back to single whole-file Tesseract call if `pdftoppm` is unavailable
   - Prerequisite: `brew install poppler` on macOS
   - Done when: 3-page scanned PDF → progress bar updates at 1/3, 2/3, 3/3; slow page → `[OCR_TIMEOUT]`

[x] **7.2 — Gap 1: Test-type keyword normalisation**
   - File: `src-tauri/src/parsing/filename.rs`
   - Add `TEST_TYPE_MAP` constant; map raw tokens to canonical labels (e.g. `"bloodtest"` → `"Blood Work"`)
   - Done when: `parse_filename("BloodTest_2024_NHS")` returns tag `"Blood Work"`

[x] **7.3 — Gap 2: Clinic name extraction from filename**
   - File: `src-tauri/src/parsing/filename.rs`
   - Add `INSTITUTION_SUFFIXES`; emit `clinic:<Name>` tag for institution-bearing tokens
   - Done when: `parse_filename("StMarysHospital_2024_BloodTest")` returns tag `"clinic:St Marys Hospital"`

[x] **7.4 — Gap 4: International phone numbers**
   - File: `src-tauri/src/extraction/contact.rs`
   - Add E.164 fallback regex after existing UK pattern
   - Done when: PDF containing `+1 (555) 123-4567` returns that number in `ContactSuggestionDto.phone`

---

## Phase 5 — Apple Calendar Integration (F4, macOS only)

> **Timeline risk:** Phase 5 is LOW priority and HIGH effort. With the June 30 v1.1.0 target, this phase should be deferred to **v1.2 (Q3 2026)** unless explicit re-prioritisation is made. Tasks below are preserved for planning purposes.

### Sprint 9: Rust + macOS bindings

[x] **5.1 — EventKit Rust bindings**
   - Add `objc`, `block` crates to `src-tauri/Cargo.toml` (macOS-only deps)
   - Implement `calendar_request_permission`, `list_calendars`, `fetch_events` in macos.rs with real ObjC FFI
   - Guard all calendar code behind `#[cfg(target_os = "macos")]`

[x] **5.2 — Event import command**
   - Implemented `calendar_import_events`: reads `calendar_events WHERE is_imported=0`, creates appointments, marks `is_imported=1`
   - Re-running does not duplicate

[x] **5.3 — Bi-directional sync**
   - `calendar_sync` now persists `calendar_last_sync` in `settings` table after sync

### Sprint 10: Frontend + Settings

[x] **5.4 — Calendar sync settings UI**
   - `src/app/(app)/settings/page.tsx` has Calendar Sync section (permission status, sync sources, Sync Now button, last synced timestamp)

[x] **5.5 — F4 tests** — 10 unit tests covering import idempotency, appointment creation, settings upsert, toggle, upsert-on-conflict, row mapper; 267 tests total, all green

---

## Phase 6 — Release

[x] **6.1 — End-to-end smoke test**
   - Manual walkthrough of all v1.1 flows: duplicate detection, link scoring, OCR, multi-category, calendar sync
   - Verify performance targets from PRD_V2 §Non-Functional Requirements

[x] **6.2 — Bump version & tag**
   - Update `package.json` version to `1.1.0`
   - Update `src-tauri/tauri.conf.json` version to `1.1.0`
   - **Requires explicit user approval before running `git tag`** (see `docs/COMMIT_STRATEGY.md`)

[x] **6.3 — Verify GitHub Release**
   - Confirm 4 platform artifacts published; update README Known Issues if needed

---

## Phase 8 — v1.2 Enhancements

> **Target:** v1.2.0 — Q3 2026  
> Covers the 5 PRD_V2 Phase 2 items plus unimplemented v1.1 SHOULD requirements (F3.4, F3.7, F4.5).

### Sprint 12: Search + Category housekeeping

[x] **8.1 — Advanced search filters (Rust backend)**
   - Add `documents_search_filtered(user_id, query, date_from, date_to, category_ids, page, limit)` Tauri command in `src-tauri/src/commands/documents.rs`
   - `date_from` / `date_to`: optional ISO-8601 strings; filter on `documents.document_date`
   - `category_ids`: optional `Vec<String>`; JOIN via `document_categories` junction; requires ALL listed categories (AND semantics)
   - Combine with existing FTS5 full-text search when `query` is non-empty
   - Add `documentsSearchFiltered: 'documents_search_filtered'` to `src/lib/ipc.ts`
   - Done when: `cargo test` covers (a) date-range-only query returns docs within range, (b) multi-category AND filter returns only intersection, (c) combined text + date query, (d) empty filter returns unfiltered results; all under 200ms on 10 000 docs

[x] **8.2 — Advanced search UI**
   - Add filter bar to `src/app/(app)/documents/page.tsx`: date-from/date-to pickers + multi-select category chips
   - On filter change debounce 300ms, call `documents_search_filtered`; show result count
   - Done when: filtering by date range narrows document list; combining date + category further narrows; clearing filters restores full list

[x] **8.3 — F3.4 Drag-to-organize categories**
   - Install drag-and-drop dependencies first: `npm install @dnd-kit/core @dnd-kit/sortable` (not yet in `package.json`)
   - Add `category_reorder(user_id: String, category_id: String, new_parent_id: Option<String>, new_position: u32)` command in `src-tauri/src/commands/categories.rs`
   - Add `categoryReorder: 'category_reorder'` to `src/lib/ipc.ts`
   - In `src/app/(app)/categories/` render category tree as sortable list; on drop call `category_reorder`
   - Done when: dragging a subcategory to a new parent persists after page reload; tree depth limit 5 enforced (drop rejected if depth would exceed 5)

▶ **8.4 — F3.7 Auto-archive empty categories**
   - Add `categories_archive_stale(user_id: String, months_inactive: u32)` command in `src-tauri/src/commands/categories.rs`
   - Archive (set `is_archived = 1`) any category with zero linked documents/appointments for `months_inactive` months
   - Add `is_archived` column via migration v5 in `src-tauri/src/db/migrations.rs`; update `categories_list` to exclude archived by default; add `include_archived: bool` flag
   - Add `categoriesArchiveStale: 'categories_archive_stale'` to `src/lib/ipc.ts`
   - Expose "Auto-archive inactive categories" toggle in `src/app/(app)/settings/page.tsx` with configurable threshold (default 12 months)
   - Done when: `cargo test` verifies (a) category with 0 links for 13 months → archived; (b) category with 1+ links within 12 months → not archived; (c) settings persist threshold across restarts

### Sprint 13: Conflict resolution + PDF export

[ ] **8.5 — F4.5 Calendar conflict resolution UI**
   - Detect conflicts server-side: add `calendar_detect_conflicts(user_id: String)` command in `src-tauri/src/commands/calendar.rs`
   - Conflict = two `calendar_events` with overlapping `(start_time, end_time)` on the same calendar source
   - Return `Vec<ConflictPair> { event_a: CalendarEventDto, event_b: CalendarEventDto, overlap_minutes: u32 }`
   - Add `calendarDetectConflicts: 'calendar_detect_conflicts'` to `src/lib/ipc.ts`
   - Add "Conflicts" badge on Calendar Sync settings page (`src/app/(app)/settings/page.tsx`) showing count
   - "Resolve Conflicts" panel: side-by-side event cards; user can "Keep A", "Keep B", or "Keep Both"; chosen action calls `calendar_events_delete` or `calendar_events_keep_both`
   - Done when: two overlapping test events inserted → conflict detected → UI shows merge dialog → user keeps one → other deleted; zero conflicts → badge hidden

[ ] **8.6 — PDF summary report export**
   - Note: `export_pdf_bundle` (zip of original files) already exists in `src-tauri/src/commands/export.rs` — this task adds a new *formatted summary* PDF, distinct from the bundle.
   - Generate the summary PDF on the **frontend** using `pdf-lib` (`^1.17.1`, already in `package.json`) — no new Rust crate needed.
   - Add a thin `export_pdf_summary_bytes(user_id, date_from, date_to, include_documents, include_appointments, include_contacts)` Tauri command in `src-tauri/src/commands/export.rs` that returns the raw JSON data (documents list, appointment list, contacts list) for the given filters; the frontend assembles the PDF.
   - Frontend (`src/components/ExportDialog.tsx` or new `SummaryExportDialog.tsx`):
     - Use `pdf-lib` to create a PDF with cover page (user name, date range, timestamp) + one section per entity type listing title, date, category tags, and extracted text snippet (first 200 chars)
     - Prompt save path via `@tauri-apps/plugin-dialog` `save()` dialog; write bytes via Tauri `writeFile`
   - Add `exportPdfSummaryBytes: 'export_pdf_summary_bytes'` to `src/lib/ipc.ts`
   - Done when: `tsc --noEmit` passes; generated PDF is non-empty and opens in system viewer; `cargo test` covers the data-fetch command returning correct entity counts for given filters

[ ] **8.7 — v1.2 acceptance tests**
   - Run acceptance test cases from `docs/ACCEPTANCE_TESTS_V2.md`:
     - F7 (advanced search filters): TC-F7-01 through TC-F7-04
     - F8 (category drag-reorder + auto-archive): TC-F8-01 through TC-F8-03
     - F9 (calendar conflict resolution): TC-F9-01 through TC-F9-03
     - F10 (PDF summary export): TC-F10-01 through TC-F10-03
   - Also run `docs/MANUAL_TEST_GUIDE.md` checklists F7–F10
   - Add Rust unit tests for `documents_search_filtered`, `category_reorder`, `categories_archive_stale`, `calendar_detect_conflicts`, `export_pdf_summary_bytes`
   - Done when: ≥ 80% coverage on all new code; `cargo test` + `npx tsc --noEmit` both pass; all Phase 8 TC IDs manually verified

### Sprint 13 — Release

[ ] **8.8 — v1.2 smoke test**
   - Manual walkthrough: advanced search, drag-reorder categories, auto-archive toggle, conflict resolution, PDF export
   - Verify no regressions in v1.1 flows

[ ] **8.9 — Bump version & tag v1.2.0**
   - Update `package.json` version to `1.2.0`
   - Update `src-tauri/tauri.conf.json` version to `1.2.0`
   - **Requires explicit user approval before running `git tag`**

[ ] **8.10 — Verify GitHub Release**
   - Confirm 4 platform artifacts published; update README if needed

---

## Phase 9 — v1.3+ Extended Features

> **Target:** v1.3.0 — Q4 2026 / Q1 2027  
> Covers all 5 PRD_V2 Phase 3 items. Each is independently shippable; order by dependency then effort.

### Sprint 14: Calendar extensions

[ ] **9.1 — iCalendar import/export (.ics)**
   - Add `icalendar_import(user_id: String, file_path: String)` and `icalendar_export(user_id: String, appointment_ids: Vec<String>, file_path: String)` in `src-tauri/src/commands/calendar.rs`
   - Use `icalendar` crate (add to `src-tauri/Cargo.toml` — not yet present)
   - Import: parse VEVENT components → `appointments` rows; skip duplicates by `external_event_id`
   - Export: serialize selected appointments as VCALENDAR → write to chosen file path
   - Add `icalendarImport: 'icalendar_import', icalendarExport: 'icalendar_export'` to `src/lib/ipc.ts`
   - Add "Import .ics" + "Export .ics" buttons to Appointments page toolbar (`src/app/(app)/appointments/page.tsx`)
   - Done when: `cargo test` verifies (a) round-trip VEVENT → appointment → VEVENT preserves title/date/location; (b) duplicate import skips, no new row; (c) export produces valid .ics parseable by `icalendar` crate

[ ] **9.2 — Outlook Calendar sync (Windows)**
   - Windows-only (`#[cfg(target_os = "windows")]`) — no-op stubs compiled on macOS/Linux
   - Use Microsoft Graph REST API via `reqwest` (offline-first caveat: sync only when network available; clearly communicate this in UI)
   - Add `outlook_auth_url()` → OAuth2 PKCE flow via system browser; store refresh token encrypted in SQLite `settings`
   - Add `outlook_sync(user_id: String)` → fetch events from `/me/calendarView` for ±90 days; upsert into `calendar_events`
   - Add Outlook section in settings (Windows only); hidden on macOS/Linux
   - Done when: `cargo test` (mocked HTTP) verifies auth token storage + event upsert; integration test on Windows CI runner confirms sync returns events (use test account)

### Sprint 15: Intelligence features

[ ] **9.3 — AI appointment notes summarization (local heuristic)**
   - Offline-first: no external AI API. Implement rule-based extractive summarization in `src-tauri/src/services/summarizer.rs`:
     - Sentence scoring: TF-IDF weight using existing FTS5 term frequencies + position bias (first/last sentences)
     - Return top-3 ranked sentences as summary (extractive, not generative)
   - Add `summarize_appointment_notes(user_id: String, appointment_id: String)` Tauri command
   - Add `summarizeAppointmentNotes: 'summarize_appointment_notes'` to `src/lib/ipc.ts`
   - In appointment detail page `src/app/(app)/appointments/[id]/page.tsx`, add "Summarize Notes" button; show summary in collapsible panel
   - Done when: `cargo test` verifies (a) 10-sentence notes → 3-sentence summary, (b) notes < 3 sentences → return as-is; summary renders in UI without layout shift

[ ] **9.4 — Medical code tagging (ICD-10)**
   - Bundle a compressed ICD-10-CM lookup table (top 2 000 codes by frequency) as a Rust constant or embedded SQLite table; no network required
   - Add `icd10_suggest(text: String)` command in `src-tauri/src/commands/tags.rs` (new file):
     - Tokenize input, fuzzy-match against ICD-10 descriptions using Levenshtein distance ≤ 2
     - Return `Vec<Icd10Suggestion> { code: String, description: String, confidence: f32 }`
   - Add `icd10Suggest: 'icd10_suggest'` to `src/lib/ipc.ts`
   - In document detail and appointment detail pages, add "Suggest ICD-10 Codes" button; user can accept/reject suggestions stored as tags in `document_tags` / `appointment_tags`
   - Done when: `cargo test` verifies (a) "chest pain" → at least one suggestion with code `R07.*`; (b) gibberish input → empty result; (c) accepted tag persists to DB

[ ] **9.5 — Multi-user vault support**
   - Extend DB schema (migration v6): add `users (id, display_name, password_hash, created_at)` table; add `user_id` FK to `documents`, `appointments`, `contacts`, `categories`, `calendar_events`, `settings`
   - Add `auth_add_user(display_name: String, password: String)` and `auth_switch_user(user_id: String, password: String)` commands in `src-tauri/src/commands/auth.rs`
   - Add `authAddUser: 'auth_add_user', authSwitchUser: 'auth_switch_user'` to `src/lib/ipc.ts`
   - Each user has their own PBKDF2-derived SQLCipher key (key rotation on user switch via `PRAGMA rekey`)
   - Login screen (`src/app/page.tsx`) shows user picker; each user logs in with own password
   - Done when: `cargo test` verifies (a) two users can be created; (b) documents created by user A not visible when logged in as user B; (c) switching users re-encrypts connection; (d) deleting a user cascades all their rows

### Sprint 16 — Release

[ ] **9.6 — v1.3 smoke test**
   - Manual walkthrough of all new v1.3 flows on each platform
   - Confirm no regressions in v1.1 / v1.2 flows

[ ] **9.7 — Bump version & tag v1.3.0**
   - Update `package.json` version to `1.3.0`
   - Update `src-tauri/tauri.conf.json` version to `1.3.0`
   - **Requires explicit user approval before running `git tag`**

[ ] **9.8 — Verify GitHub Release**
   - Confirm 4 platform artifacts published; update README if needed

---

## Quick Reference

| Concern | File |
|---------|------|
| Feature requirements | `docs/PRD_V2.md` |
| Architecture | `docs/ARCHITECTURE_V2.md` |
| Acceptance tests | `docs/ACCEPTANCE_TESTS_V2.md` |
| Wireframes | `docs/WIREFRAMES_V2.md` |
| CI/CD pipeline | `.github/workflows/` |
| Commit strategy | `docs/COMMIT_STRATEGY.md` |
| **Where to resume** | **This file — find ▶** |
