# myHealth — Execution Plan (v1.1 / v1.2 / v1.3)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Phase 25 — Code Quality & Performance Hardening — Task 25.3 next
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

**v1.4 (after v1.3)**

| Feature | PRD_V3 Section | Priority | Effort |
|---------|---------------|----------|--------|
| V3-F4 Tag auto-extraction (invoice type, provider, specialty, activity date) | §V3-F4 | MUST | M |
| V3-F5 Timeline uses medical activity date + prescribed format | §V3-F5 | MUST | M |
| V3-F2 Contact auto-creation (UK phone regex + full save flow) | §V3-F2 | MUST | M |
| V3-F1 Category auto-creation when suggestion accepted | §V3-F1 | MUST | S |
| V3-F3 Clinic: company reg no, multi-address, clinic↔contact link | §V3-F3 | MUST | L |

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

[x] **8.4 — F3.7 Auto-archive empty categories**
   - Add `categories_archive_stale(user_id: String, months_inactive: u32)` command in `src-tauri/src/commands/categories.rs`
   - Archive (set `is_archived = 1`) any category with zero linked documents/appointments for `months_inactive` months
   - Add `is_archived` column via migration v5 in `src-tauri/src/db/migrations.rs`; update `categories_list` to exclude archived by default; add `include_archived: bool` flag
   - Add `categoriesArchiveStale: 'categories_archive_stale'` to `src/lib/ipc.ts`
   - Expose "Auto-archive inactive categories" toggle in `src/app/(app)/settings/page.tsx` with configurable threshold (default 12 months)
   - Done when: `cargo test` verifies (a) category with 0 links for 13 months → archived; (b) category with 1+ links within 12 months → not archived; (c) settings persist threshold across restarts

### Sprint 13: Conflict resolution + PDF export

[x] **8.5 — F4.5 Calendar conflict resolution UI**
   - Detect conflicts server-side: add `calendar_detect_conflicts(user_id: String)` command in `src-tauri/src/commands/calendar.rs`
   - Conflict = two `calendar_events` with overlapping `(start_time, end_time)` on the same calendar source
   - Return `Vec<ConflictPair> { event_a: CalendarEventDto, event_b: CalendarEventDto, overlap_minutes: u32 }`
   - Add `calendarDetectConflicts: 'calendar_detect_conflicts'` to `src/lib/ipc.ts`
   - Add "Conflicts" badge on Calendar Sync settings page (`src/app/(app)/settings/page.tsx`) showing count
   - "Resolve Conflicts" panel: side-by-side event cards; user can "Keep A", "Keep B", or "Keep Both"; chosen action calls `calendar_events_delete` or `calendar_events_keep_both`
   - Done when: two overlapping test events inserted → conflict detected → UI shows merge dialog → user keeps one → other deleted; zero conflicts → badge hidden

[x] **8.6 — PDF summary report export**
   - Note: `export_pdf_bundle` (zip of original files) already exists in `src-tauri/src/commands/export.rs` — this task adds a new *formatted summary* PDF, distinct from the bundle.
   - Generate the summary PDF on the **frontend** using `pdf-lib` (`^1.17.1`, already in `package.json`) — no new Rust crate needed.
   - Add a thin `export_pdf_summary_bytes(user_id, date_from, date_to, include_documents, include_appointments, include_contacts)` Tauri command in `src-tauri/src/commands/export.rs` that returns the raw JSON data (documents list, appointment list, contacts list) for the given filters; the frontend assembles the PDF.
   - Frontend (`src/components/ExportDialog.tsx` or new `SummaryExportDialog.tsx`):
     - Use `pdf-lib` to create a PDF with cover page (user name, date range, timestamp) + one section per entity type listing title, date, category tags, and extracted text snippet (first 200 chars)
     - Prompt save path via `@tauri-apps/plugin-dialog` `save()` dialog; write bytes via Tauri `writeFile`
   - Add `exportPdfSummaryBytes: 'export_pdf_summary_bytes'` to `src/lib/ipc.ts`
   - Done when: `tsc --noEmit` passes; generated PDF is non-empty and opens in system viewer; `cargo test` covers the data-fetch command returning correct entity counts for given filters

[x] **8.7 — v1.2 acceptance tests**
   - Run acceptance test cases from `docs/ACCEPTANCE_TESTS_V2.md`:
     - F7 (advanced search filters): TC-F7-01 through TC-F7-04
     - F8 (category drag-reorder + auto-archive): TC-F8-01 through TC-F8-03
     - F9 (calendar conflict resolution): TC-F9-01 through TC-F9-03
     - F10 (PDF summary export): TC-F10-01 through TC-F10-03
   - Also run `docs/MANUAL_TEST_GUIDE.md` checklists F7–F10
   - Add Rust unit tests for `documents_search_filtered`, `category_reorder`, `categories_archive_stale`, `calendar_detect_conflicts`, `export_pdf_summary_bytes`
   - Done when: ≥ 80% coverage on all new code; `cargo test` + `npx tsc --noEmit` both pass; all Phase 8 TC IDs manually verified

### Sprint 13 — Release

[x] **8.8 — v1.2 smoke test**
   - Manual walkthrough: advanced search, drag-reorder categories, auto-archive toggle, conflict resolution, PDF export
   - Verify no regressions in v1.1 flows
   - Automated Playwright smoke: 18/18 passed (NEXT_PUBLIC_SKIP_AUTH=1 bypass added to AuthGuard for dev)

[x] **8.8a — Settings: "Reset App Data" danger zone**
   - **Why:** The only password recovery path is the CLI reset script; users should not need a terminal for this.
   - **Rust:** Add `app_reset_data(confirm: bool)` Tauri command in `src-tauri/src/commands/auth.rs`
     - Returns early with error if `!confirm` (double-safety guard)
     - Deletes `myhealth.db`, `myhealth.salt`, `myhealth.kdf` from app data dir
     - Emits Tauri event `app_data_reset` so the frontend can redirect to setup
   - **Frontend:** Add "Danger Zone" section at the bottom of `src/app/(app)/settings/page.tsx`
     - "Reset All App Data" button → confirmation dialog ("This will permanently delete all your health records and cannot be undone. Type RESET to confirm.")
     - On confirm, call `app_reset_data(true)` → listen for `app_data_reset` event → navigate to `/` (setup/unlock screen)
   - Add `appResetData: 'app_reset_data'` to `src/lib/ipc.ts`
   - Done when: clicking Reset in Settings → confirmation dialog → wipes data → redirected to fresh setup screen; `cargo test` covers (a) `confirm=false` returns error, (b) `confirm=true` deletes all three files

[x] **8.9 — Bump version & tag v1.2.0**
   - Update `package.json` version to `1.2.0`
   - Update `src-tauri/tauri.conf.json` version to `1.2.0`
   - **Requires explicit user approval before running `git tag`**

[x] **8.10 — Verify GitHub Release**
   - Confirm 4 platform artifacts published; update README if needed

---

## Phase 9 — v1.3+ Extended Features

> **Target:** v1.3.0 — Q4 2026 / Q1 2027  
> Covers all 5 PRD_V2 Phase 3 items. Each is independently shippable; order by dependency then effort.

### Sprint 14: Calendar extensions

[x] **9.1 — iCalendar import/export (.ics)**
   - Add `icalendar_import(user_id: String, file_path: String)` and `icalendar_export(user_id: String, appointment_ids: Vec<String>, file_path: String)` in `src-tauri/src/commands/calendar.rs`
   - Use `icalendar` crate (add to `src-tauri/Cargo.toml` — not yet present)
   - Import: parse VEVENT components → `appointments` rows; skip duplicates by `external_event_id`
   - Export: serialize selected appointments as VCALENDAR → write to chosen file path
   - Add `icalendarImport: 'icalendar_import', icalendarExport: 'icalendar_export'` to `src/lib/ipc.ts`
   - Add "Import .ics" + "Export .ics" buttons to Appointments page toolbar (`src/app/(app)/appointments/page.tsx`)
   - Done when: `cargo test` verifies (a) round-trip VEVENT → appointment → VEVENT preserves title/date/location; (b) duplicate import skips, no new row; (c) export produces valid .ics parseable by `icalendar` crate

[x] **9.2 — Outlook Calendar sync (Windows)**
   - Windows-only (`#[cfg(target_os = "windows")]`) — no-op stubs compiled on macOS/Linux
   - Use Microsoft Graph REST API via `reqwest` (offline-first caveat: sync only when network available; clearly communicate this in UI)
   - Add `outlook_auth_url()` → OAuth2 PKCE flow via system browser; store refresh token encrypted in SQLite `settings`
   - Add `outlook_sync(user_id: String)` → fetch events from `/me/calendarView` for ±90 days; upsert into `calendar_events`
   - Add Outlook section in settings (Windows only); hidden on macOS/Linux
   - Done when: `cargo test` (mocked HTTP) verifies auth token storage + event upsert; integration test on Windows CI runner confirms sync returns events (use test account)

### Sprint 15: Intelligence features

[x] **9.3 — AI appointment notes summarization (local heuristic)**
   - Offline-first: no external AI API. Implement rule-based extractive summarization in `src-tauri/src/services/summarizer.rs`:
     - Sentence scoring: TF-IDF weight using existing FTS5 term frequencies + position bias (first/last sentences)
     - Return top-3 ranked sentences as summary (extractive, not generative)
   - Add `summarize_appointment_notes(user_id: String, appointment_id: String)` Tauri command
   - Add `summarizeAppointmentNotes: 'summarize_appointment_notes'` to `src/lib/ipc.ts`
   - In appointment detail page `src/app/(app)/appointments/[id]/page.tsx`, add "Summarize Notes" button; show summary in collapsible panel
   - Done when: `cargo test` verifies (a) 10-sentence notes → 3-sentence summary, (b) notes < 3 sentences → return as-is; summary renders in UI without layout shift

[x] **9.4 — Medical code tagging (ICD-10)**
   - Bundle a compressed ICD-10-CM lookup table (top 2 000 codes by frequency) as a Rust constant or embedded SQLite table; no network required
   - Add `icd10_suggest(text: String)` command in `src-tauri/src/commands/tags.rs` (new file):
     - Tokenize input, fuzzy-match against ICD-10 descriptions using Levenshtein distance ≤ 2
     - Return `Vec<Icd10Suggestion> { code: String, description: String, confidence: f32 }`
   - Add `icd10Suggest: 'icd10_suggest'` to `src/lib/ipc.ts`
   - In document detail and appointment detail pages, add "Suggest ICD-10 Codes" button; user can accept/reject suggestions stored as tags in `document_tags` / `appointment_tags`
   - Done when: `cargo test` verifies (a) "chest pain" → at least one suggestion with code `R07.*`; (b) gibberish input → empty result; (c) accepted tag persists to DB

[x] **9.5 — Multi-user vault support**
   - Extend DB schema (migration v6): add `users (id, display_name, password_hash, created_at)` table; add `user_id` FK to `documents`, `appointments`, `contacts`, `categories`, `calendar_events`, `settings`
   - Add `auth_add_user(display_name: String, password: String)` and `auth_switch_user(user_id: String, password: String)` commands in `src-tauri/src/commands/auth.rs`
   - Add `authAddUser: 'auth_add_user', authSwitchUser: 'auth_switch_user'` to `src/lib/ipc.ts`
   - Each user has their own PBKDF2-derived SQLCipher key (key rotation on user switch via `PRAGMA rekey`)
   - Login screen (`src/app/page.tsx`) shows user picker; each user logs in with own password
   - Done when: `cargo test` verifies (a) two users can be created; (b) documents created by user A not visible when logged in as user B; (c) switching users re-encrypts connection; (d) deleting a user cascades all their rows

### Sprint 16 — Release

[x] **9.6 — v1.3 smoke test**
   - Manual walkthrough of all new v1.3 flows on each platform
   - Confirm no regressions in v1.1 / v1.2 flows

[x] **9.7 — Bump version & tag v1.3.0**
   - Update `package.json` version to `1.3.0`
   - Update `src-tauri/tauri.conf.json` version to `1.3.0`
   - **Requires explicit user approval before running `git tag`**

[x] **9.8 — Verify GitHub Release**
   - Confirm 4 platform artifacts published; update README if needed

---

## Phase 10 — v1.4 Upload Intelligence (PRD_V3)

> **Target:** v1.4.0 — Q4 2026  
> **Source:** `docs/PRD_V3.md` — 5 feature gaps identified from physiotherapy invoice upload smoke test (2026-04-30).  
> **Implementation priority order (from PRD_V3):** V3-F4 → V3-F5 → V3-F2 → V3-F1 → V3-F3

### Sprint 17: Schema migrations

[x] **10.0 — V3 DB schema migrations**
   - Migration v6 in `src-tauri/src/db/migrations.rs`:
     - `ALTER TABLE clinics ADD COLUMN company_registration_number TEXT`
     - `CREATE TABLE clinic_addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE, address TEXT NOT NULL, is_primary INTEGER NOT NULL DEFAULT 0)`
     - `ALTER TABLE documents ADD COLUMN activity_date TEXT` — ISO-8601 medical activity date; separate from `document_date` (filename-parsed) and `created_at` (upload timestamp)
   - Verify `timeline_entries.event_date` reads from `documents.activity_date` (not `created_at`) — document in migration comment if fix needed
   - Done when: `cargo test` passes migration; all three schema changes present; existing rows unaffected (new columns NULL for existing rows)

### Sprint 18: Rust extraction backend

[x] **10.1 — V3-F4 Tag auto-extraction (all 4 tag types)**
   - File: `src-tauri/src/services/extraction/mod.rs` and/or `src-tauri/src/parsing/tags.rs` (new file if needed)
   - **Type tags:** Scan extracted text for keywords `INVOICE`, `RECEIPT`, `BILL`, `REFERRAL`, `PRESCRIPTION`, `REPORT`, `SUMMARY`, `DISCHARGE`; emit the matched keyword lowercased as a tag
   - **Provider name tags:** Every doctor/provider name already detected (contact suggestion pipeline) must also be emitted as a tag
   - **Specialty tags:** The category keyword extracted for V3-F1 (e.g. `PHYSIOTHERAPY`, `CARDIOLOGY`) must also be emitted as a tag
   - **Activity date tags:** The medical activity date (see 10.2) emitted as a tag in `YYYY-MM-DD` format
   - **De-duplicate** all tags case-insensitively before returning
   - Add `extractionTagsAutoExtract: 'extraction_tags_auto_extract'` or extend existing extraction command result to include `auto_tags: Vec<String>`
   - Done when: `cargo test` verifies (a) PDF with "INVOICE" → tag `"invoice"`; (b) provider "John Green" detected → tag `"John Green"`; (c) keyword `PHYSIOTHERAPY` → tag `"PHYSIOTHERAPY"`; (d) activity date `2023-03-09` → tag `"2023-03-09"`; (e) duplicate tags de-duplicated; all 4 tags present for physiotherapy invoice fixture

[x] **10.2 — V3-F5 Activity date extraction + timeline entry format**
   - **Activity date extraction** in `src-tauri/src/services/extraction/mod.rs`:
     - Priority 1: Scan PDF body for labelled date patterns: `Date of Service`, `Invoice Date`, `Appointment Date`, `Date:` followed by `DD/MM/YYYY`, `DD Month YYYY`, `YYYY-MM-DD`
     - Priority 2: Filename-parsed `document_date`
     - Priority 3: Upload timestamp (`created_at`)
     - Store resolved date in `documents.activity_date` (ISO-8601)
   - **Timeline entry format** in `src-tauri/src/commands/timeline.rs` (or wherever timeline entries are created):
     - Format: `{YYYY-MM-DD} {SPECIALTY} with {Title} {Provider Name}` when specialty and provider detected
     - Fallback: substitute document type for specialty if no specialty; clinic name for provider if no provider name
     - Timeline `event_date` must use `activity_date`; never `created_at`
   - Done when: `cargo test` verifies (a) labelled body date → `activity_date` = body date; (b) no body date + filename date → `activity_date` = filename date; (c) no body or filename date → `activity_date` = upload timestamp; (d) timeline entry for physio invoice → description `"2023-03-09 PHYSIOTHERAPY with Mr John Green"`; (e) `event_date` = `2023-03-09`, not upload date

[x] **10.3 — V3-F2 Phone regex expansion + contact save command**
   - File: `src-tauri/src/services/extraction/contact.rs`
   - Extend phone regex to match:
     - UK mobile: `07\d{3}\s?\d{6}` (e.g. `07544 370440`)
     - UK landline: `01\d{3}\s?\d{6}`, `02\d\s?\d{4}\s?\d{4}`
     - International: already handled by E.164 fallback from Task 7.4 — verify still working
   - `ContactSuggestionDto` must include `name`, `phone`, `email`, `title` (salutation) fields — add missing fields if absent
   - Verify `contacts_create` Tauri command accepts and persists all four fields from the DTO
   - `document_contacts` junction: ensure a record is created linking the new contact to the document when "Save as Contact" is invoked (V3-F2.6)
   - Done when: `cargo test` verifies (a) `07544 370440` matched; (b) `01234 567890` matched; (c) `+44 20 7946 0958` matched; (d) `ContactSuggestionDto` contains name + phone + email + title for physio invoice fixture; (e) `contacts_create` persists all four fields

[x] **10.4 — V3-F1 Category auto-creation from specialty keyword**
   - File: `src-tauri/src/commands/categories.rs`
   - Add `categories_create_if_not_exists(user_id: String, name: String)` command:
     - Case-insensitive lookup: if a category with the same name (normalised to title-case) already exists, return its `id`
     - If not found, create it with a default colour and return the new `id`
   - Add `categoriesCreateIfNotExists: 'categories_create_if_not_exists'` to `src/lib/ipc.ts`
   - The specialty keyword from extraction (already used for tags in 10.1) is normalised to title-case for category name (e.g. `PHYSIOTHERAPY` → `"Physiotherapy"`)
   - Done when: `cargo test` verifies (a) calling with `"Physiotherapy"` when none exists → creates and returns new id; (b) calling again → returns same id, count unchanged; (c) calling with `"physiotherapy"` (lowercase) → returns same id as `"Physiotherapy"`

[x] **10.5 — V3-F3 Clinic extraction: company reg, multi-address, clinic↔contact link**
   - **Extraction** in `src-tauri/src/services/extraction/clinic.rs` (extend or create):
     - Extract company registration number via pattern `Company Registration (?:No|Number|No\.|Number:)[.:\s]*(\d{6,8})`
     - Extract up to 5 postal addresses from PDF body (lines matching UK postcode pattern `[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}` as anchor)
     - Normalise clinic name to title-case
   - **Schema** (migration done in 10.0): `clinic_addresses` table + `company_registration_number` column
   - **Commands** in `src-tauri/src/commands/clinics.rs`:
     - Extend `clinics_create` to accept `company_registration_number: Option<String>` and `addresses: Vec<String>`; insert addresses into `clinic_addresses`
     - Add `clinics_link_contact(clinic_id: String, contact_id: String)` for `clinic_contacts` junction
     - Add `clinics_create_if_not_exists(user_id, name, ...)` — same idempotency pattern as 10.4
   - Add IPC keys to `src/lib/ipc.ts`
   - Done when: `cargo test` verifies (a) `Company Registration No: 6780032` → `company_registration_number = "6780032"`; (b) 3 postal addresses extracted → 3 `clinic_addresses` rows; (c) duplicate name → returns existing id; (d) `clinics_link_contact` inserts junction row; (e) `clinics_create_if_not_exists` → idempotent

### Sprint 19: Frontend — upload dialog integration

[x] **10.6 — Upload dialog: tags pre-populated + editable (V3-F4)**
   - File: `src/components/UploadDialog.tsx` (or equivalent upload dialog component)
   - On reaching the review step, call extraction result's `auto_tags` and pre-populate the tags input field
   - Tags field must remain editable: user can add/remove before saving
   - De-duplicate tags display (case-insensitive)
   - Done when: uploading physio invoice fixture → tags field shows `invoice`, `John Green`, `PHYSIOTHERAPY`, `2023-03-09`; user can delete or add a tag before saving; saved document has the final edited tags

[x] **10.7 — Upload dialog: category suggestion banner + auto-create (V3-F1)**
   - Add dismissible suggestion banner below the tags field in the review step
   - Banner shows: category name (title-cased specialty), source label `"Detected from document content"`, **Accept** and **Dismiss** buttons
   - Accept → calls `categories_create_if_not_exists` → assigns returned category id to document → dismisses banner
   - Dismiss → banner hidden for this session; no category created or assigned
   - Done when: uploading physio invoice fixture → banner shows `"Physiotherapy — Detected from document content"`; Accept creates/reuses category and assigns; Dismiss shows nothing; banner not shown again on re-review within same session

[x] **10.8 — Upload dialog: contact card save flow + duplicate detection (V3-F2)**
   - Contact suggestion card (already rendered from prior work) must now show all fields: name, phone, email, title
   - "Save as Contact" button:
     1. Calls `find_duplicate_contacts` with candidate name + email
     2. If similarity ≥ 0.85 match → show inline merge prompt ("Possible duplicate: [name] — merge or create new?")
     3. If no match → call `contacts_create` with all four fields → create `document_contacts` junction record → show success state on card
   - Closing dialog without saving must NOT auto-save the contact
   - Done when: uploading physio fixture → card shows `John Green / 07544 370440 / jg@johngreenphysio.com`; Save persists all fields; existing contact with same name shows merge prompt; close without save → no contact created

[x] **10.9 — Upload dialog: clinic suggestion card + save (V3-F3)**
   - Add clinic suggestion card to upload dialog review step (below contact card)
   - Card shows: clinic name, company registration number (if found), detected address count
   - "Save as Clinic" button:
     1. Calls `clinics_create_if_not_exists` with name, company_reg_no, addresses
     2. If a contact was saved in the same session (10.8), calls `clinics_link_contact` automatically
     3. Duplicate name → inline merge prompt
   - Done when: uploading physio fixture → card shows `"John Green Physiotherapy Ltd / Reg: 6780032 / 3 addresses"`; Save creates clinic with addresses; contact link created automatically; duplicate name → merge prompt

[x] **10.10 — Upload dialog: timeline description pre-fill + editable (V3-F5)**
   - In the review step, pre-populate the timeline description field with the formatted string from 10.2
   - Format: `{YYYY-MM-DD} {SPECIALTY} with {Title} {Provider Name}` (falling back per V3-F5.6/F5.7)
   - Field must be editable before the user clicks Save
   - Timeline entry `event_date` saved as `activity_date` value (not upload date)
   - Done when: uploading physio fixture → timeline field shows `"2023-03-09 PHYSIOTHERAPY with Mr John Green"` pre-filled; user can edit; saved timeline entry has `event_date = 2023-03-09`

### Sprint 20: Tests + Release

[x] **10.11 — V3 acceptance tests**
   - Run Playwright test cases from `docs/ACCEPTANCE_TESTS_V3.md` (20 cases, suites V3-F1 through V3-F5)
   - Add Rust unit tests for all new/modified extraction functions: `categories_create_if_not_exists`, `clinics_create_if_not_exists`, phone regex patterns, activity date priority resolution, tag de-duplication
   - Done when: ≥ 80% coverage on all Phase 10 new code; `cargo test` + `npx tsc --noEmit` both pass; all V3 TC IDs manually verified

[x] **10.12 — v1.4 smoke test**
   - Manual walkthrough using `sample-Upload (09Mar2023-16_31_26).pdf` fixture:
     - Upload → verify tags: `invoice`, `John Green`, `PHYSIOTHERAPY`, `2023-03-09`
     - Verify category suggestion banner shows `Physiotherapy` → Accept → category assigned
     - Verify contact card shows all fields → Save → contact linked to document
     - Verify clinic card shows company reg + address count → Save → clinic linked to contact
     - Verify timeline entry: date `2023-03-09`, description `"2023-03-09 PHYSIOTHERAPY with Mr John Green"`
   - Verify no regressions in v1.1 / v1.2 / v1.3 flows

[x] **10.13 — Bump version & tag v1.4.0**
   - Update `package.json` version to `1.4.0`
   - Update `src-tauri/tauri.conf.json` version to `1.4.0`
   - **Requires explicit user approval before running `git tag`**

[x] **10.14 — Verify GitHub Release**
   - Confirmed 4 platform artifacts published: macOS aarch64/x64 .dmg, Linux .AppImage, Windows .msi

---

## Phase 11 — V3 Integration Test Gap Closure

> Goal: Close all AC coverage gaps identified in the PRD_V3 audit. All tests use `open_test_db()` → `rusqlite::Connection::open_in_memory()` + `db::migrations::run(&conn)`, bypassing Tauri `State` entirely.

### Sprint 21: V3 Integration Tests

[x] **11.1 — V3-F1 integration test: `categories_create_if_not_exists` idempotency**
   - Test 1: specialty name `"physiotherapy"` → stored as `"Physiotherapy"` (title-case normalisation)
   - Test 2: second call with `"PHYSIOTHERAPY"` (case variant) → returns same `id`, no duplicate row
   - Done when: both tests green with `cargo test v3_integration`

[x] **11.2 — V3-F2 integration test: contact persisted + `document_contacts` junction created**
   - Insert a contact row directly via SQL using `open_test_db()`
   - Call `documents_link_contact` SQL logic to insert into `document_contacts`
   - Assert row exists in `document_contacts` with correct `(document_id, contact_id)`
   - Test idempotency: second INSERT OR IGNORE must not produce an error or duplicate
   - Done when: 2 tests green

[x] **11.3 — V3-F2.5 integration test: duplicate contact detection**
   - Call `duplicates_of()` with a primary contact `"John Green"` and near-duplicate `"Jon Green"`
   - Assert near-duplicate flagged above the 0.85 threshold
   - Assert a clearly different name `"Dr Sarah White"` is NOT flagged
   - Done when: 1 test green, no false positives

[x] **11.4 — V3-F3 integration test: clinic creation + addresses + `clinic_contacts` junction**
   - Insert clinic via direct SQL (mirrors `clinics_create_if_not_exists` logic)
   - Insert row into `clinic_addresses`; assert `is_primary = 1`
   - Insert row into `clinic_contacts`; assert `(clinic_id, contact_id)` pair exists
   - Test INSERT OR IGNORE idempotency on `clinic_contacts`
   - Done when: 3 tests green

[x] **11.5 — V3-F5 integration test: `format_timeline_description` edge cases**
   - Test with clinic name as provider token (mixed-case): `"2023-03-09 PHYSIOTHERAPY with City Physio Clinic"`
   - Test with no specialty tag present: falls back to `"DOCUMENT"` → `"2023-03-09 DOCUMENT"`
   - (Note: 3-level `resolve_activity_date` fallback already covered in `documents.rs` — do not duplicate)
   - Done when: 2 tests green

---

## Phase 12 — Upload Gap Closure (v1.5)

> Goal: Close the 4 open gaps from `docs/UPLOAD_ANALYSIS_GAPS.md` and the 2 open PRD_V3 phone-regex requirements. Each task ships implementation + unit tests + Playwright e2e coverage.
> Order: Gap 3 first (user-visible high-priority), then Gap 1, Gap 2, Gap 4.

### Sprint 22: Per-Page OCR (High — Gap 3 / F2.3 + F2.4)

[x] **12.1 — Split scanned PDF into per-page images via `pdftoppm`**
   - File: `src-tauri/src/extraction/ocr.rs`
   - Add `split_pdf_pages(path: &Path, out_dir: &Path) -> Result<Vec<PathBuf>>` that shells out to `pdftoppm -r 150 -png` and returns sorted PNG paths.
   - Unit test: supply `tests/fixtures/sample.pdf`; assert at least 1 PNG produced in temp dir.
   - Done when: unit test passes; `pdftoppm` listed as bundle prerequisite in `docs/ARCHITECTURE_V2.md`.

[x] **12.2 — Per-page OCR loop with individual 10 s timeout**
   - File: `src-tauri/src/extraction/ocr.rs`
   - Refactor `extract_image_text_async` → `extract_pages_async(pages: &[PathBuf], app: &AppHandle, total: usize) -> String`.
   - For each page: `tokio::time::timeout(PER_CALL_TIMEOUT, tesseract(page))` → on timeout append `"[OCR_TIMEOUT]"` and continue.
   - Emit `ocr_progress(page_i, total)` after each page.
   - Unit tests: (a) single-page returns text; (b) simulated timeout page emits marker and loop continues.
   - Done when: 2 unit tests pass; `emit_ocr_progress` no longer hardcodes `page=1, total=1`.

[x] **12.3 — Wire per-page loop into extraction pipeline**
   - File: `src-tauri/src/extraction/mod.rs`
   - Replace single `extract_image_text_async` call with `extract_pages_async` using page list from `split_pdf_pages`.
   - Integration test: upload a 2-page scanned PDF fixture → assert extracted text contains both pages' content (no `[OCR_TIMEOUT]` for normal PDFs).
   - Done when: integration test passes; existing extraction tests still pass (375+).

[x] **12.4 — E2E: progress bar updates at each OCR page**
   - File: `e2e/upload-ocr-progress.spec.ts` (new)
   - Use Playwright to upload the 2-page scanned PDF fixture.
   - Assert the progress bar label shows `"1 / 2"` then `"2 / 2"` before disappearing.
   - Assert extracted text is non-empty in the document detail view.
   - Done when: Playwright test passes on local dev server (`pnpm tauri dev`).

---

### Sprint 23: Test-Type Keyword Normalisation (Medium — Gap 1 / F1.3)

[x] **12.5 — Add `TEST_TYPE_MAP` to filename parser**
   - File: `src-tauri/src/parsing/filename.rs`
   - Add `TEST_TYPE_MAP: &[(&str, &str)]` covering ≥ 20 canonical test types (Blood Work, CBC, Lipid Panel, MRI, CT Scan, X-Ray, Ultrasound, ECG, Echocardiogram, DEXA Scan, Mammogram, Colonoscopy, Endoscopy, Biopsy, Urinalysis, Stool Test, PET Scan, Spirometry, Audiogram, Vision Test).
   - After token loop: scan each token case-insensitively; replace first matching token with canonical label.
   - Unit tests:
     - `parse_filename("BloodTest_2024_NHS")` → tags contain `"Blood Work"`, not `"bloodtest"`.
     - `parse_filename("MRI_Spine_2023-06-01")` → tags contain `"MRI"`.
     - `parse_filename("Appointment_2024")` → no spurious test-type tag added.
   - Done when: 3 unit tests pass; no existing filename tests regress.

[x] **12.6 — E2E: test-type tag shown in upload dialog**
   - File: `e2e/upload-filename-tags.spec.ts` (new)
   - Upload a file named `BloodTest_2024-01-15.pdf`.
   - Assert the upload dialog tag chip reads `"Blood Work"` (not `"bloodtest"`).
   - Done when: Playwright test passes.

---

### Sprint 24: Clinic Name Extraction from Filename (Medium — Gap 2 / F1.4)

[x] **12.7 — Add `INSTITUTION_SUFFIXES` detector to filename parser**
   - File: `src-tauri/src/parsing/filename.rs`
   - Add `INSTITUTION_SUFFIXES: &[&str]` = `["hospital", "clinic", "surgery", "medical", "centre", "center", "nhs", "trust", "infirmary", "practice", "health"]`.
   - After date-removal pass: if a token (or adjacent token pair) contains an institution suffix, emit `clinic:<TitleCasedName>` tag and remove matched tokens from the generic pool.
   - Unit tests:
     - `parse_filename("StMarysHospital_2024_BloodTest")` → tags contain `"clinic:St Marys Hospital"`.
     - `parse_filename("CityClinic_Invoice_2023-03-09")` → tags contain `"clinic:City Clinic"`.
     - `parse_filename("Report_2024")` → no spurious `clinic:` tag emitted.
   - Done when: 3 unit tests pass; no existing filename tests regress.

[x] **12.8 — E2E: clinic tag shown in upload dialog**
   - File: `e2e/upload-filename-tags.spec.ts` (extend existing spec)
   - Upload a file named `StMarysHospital_2024-06-15.pdf`.
   - Assert upload dialog tag chip reads `"clinic:St Marys Hospital"`.
   - Done when: Playwright test passes.

---

### Sprint 25: International Phone Regex (Low — Gap 4 / V3-F2.1 + V3-F2.2)

[x] **12.9 — Extend phone regex to UK mobile, landline, and international E.164**
   - File: `src-tauri/src/extraction/contact.rs`
   - Replace single UK regex with a two-tier match function `extract_phone(text: &str) -> Option<String>`:
     1. **UK landline/mobile** (existing patterns, kept): `(?:\+44\s?|0)[12378]\d[\d\s\-]{7,11}\d`
     2. **Generic E.164 fallback**: `\+\d{1,3}[\s\-]?\(?\d{1,4}\)?[\d\s\-]{6,14}\d`
   - Return first UK match if present; else first E.164 match.
   - Unit tests (all in `extraction/contact.rs`):
     - UK mobile `07544 370440` → returned.
     - UK landline `020 7946 0958` → returned.
     - US number `+1 (555) 123-4567` → returned.
     - EU number `+33 1 23 45 67 89` → returned.
     - No phone in text → `None`.
   - Done when: 5 unit tests pass; PRD_V3 V3-F2.1 and V3-F2.2 marked ✅.

[x] **12.10 — E2E: international phone appears in contact suggestion card**
   - File: `e2e/upload-contact-suggestion.spec.ts` (new)
   - Upload a PDF fixture containing `+1 (555) 123-4567` in its body text.
   - Assert contact suggestion card in upload dialog shows `+1 (555) 123-4567`.
   - Done when: Playwright test passes.

---

## Phase 13 — Contacts ↔ Appointments Link (v1.6)

> **Problem:** The "by-doctor" timeline view shows "No doctor assigned" even when contacts exist.
> Root cause: `doctor_name` / `clinic_name` on appointments are plain-text fields — they are never
> linked to the Contacts table. The `appointment_contacts` junction table exists in the schema but
> has no Rust commands and is invisible to the frontend.
>
> **Fix:** Wire the existing `appointment_contacts` table end-to-end so that when a user creates or
> edits an appointment they can pick a doctor/clinic from their Contacts. The timeline then groups
> by contact name instead of free-text string.

### Layer map

| Layer | Files touched |
|-------|---------------|
| Rust commands | `src-tauri/src/commands/appointments.rs` |
| TypeScript type | `src/store/appointmentsStore.ts` |
| Data hook | `src/hooks/useAppointments.ts` |
| Appointment form | `src/components/appointments/AppointmentForm.tsx` |
| Timeline page | `src/app/(app)/timeline/page.tsx` |
| E2E tests | `e2e/timeline-by-doctor.spec.ts` (new) |
| Unit tests | `src/hooks/__tests__/useAppointments.test.ts` (update) |

---

[x] **13.1 — Rust: expose appointment_contacts commands**
   - File: `src-tauri/src/commands/appointments.rs`
   - Add three Tauri commands:
     - `appointment_link_contact(appointment_id: String, contact_id: String)` — `INSERT OR IGNORE INTO appointment_contacts`
     - `appointment_unlink_contact(appointment_id: String, contact_id: String)` — `DELETE FROM appointment_contacts`
     - `contacts_for_appointment(appointment_id: String) -> Vec<ContactRow>` — `SELECT contacts.* FROM contacts JOIN appointment_contacts ON …`
   - Register all three in `lib.rs` invoke handler.
   - Unit tests in `appointments.rs` (in-memory DB):
     - link → contacts_for_appointment returns the linked contact
     - unlink → contacts_for_appointment returns empty
     - duplicate link is a no-op (no error)
   - Done when: `cargo test` passes; all three commands registered in `lib.rs`.

[x] **13.2 — TypeScript: hydrate contact_ids on Appointment**
   - File: `src/store/appointmentsStore.ts`
     - Add `contact_ids: string[]` field to `Appointment` interface (default `[]`).
   - File: `src/hooks/useAppointments.ts`
     - After fetching the appointments list, call `contacts_for_appointment` for each appointment (parallel `Promise.all`).
     - Merge results into each `Appointment` as `contact_ids`.
   - Done when: `npx tsc --noEmit` clean; existing appointment hook tests pass.
   - Note: `contact_ids: string[]` already in interface; Rust list commands already call `fetch_contact_ids` — no N+1 needed.

[x] **13.3 — AppointmentForm: add contact picker for Doctor / Clinic**
   - File: `src/components/appointments/AppointmentForm.tsx`
   - Import `useContacts` hook.
   - Below the free-text "Doctor" input, add a contact picker:
     - Shows contacts with `role === 'doctor'` or `role === 'specialist'`.
     - Single-select; displays name + specialty.
     - Selecting a contact writes `doctor_name` from `contact.name` AND calls `appointment_link_contact`.
     - Clearing the selection calls `appointment_unlink_contact`.
   - Similarly for "Clinic / Hospital": picker shows `role === 'clinic'`.
   - Keep free-text inputs as fallback when no matching contacts exist.
   - Done when: `npx tsc --noEmit` clean; can pick a contact in the form and save.

[x] **13.4 — Timeline: group by contact name in by-doctor view**
   - File: `src/app/(app)/timeline/page.tsx`
   - Import `useContacts`.
   - In the `doctorGroups` memo:
     - For each appointment, look up `contact_ids` on the appointment.
     - If any contact with `role === 'doctor'` or `role === 'specialist'` is linked, use `contact.name` as the group key.
     - Fall back to `appt.doctor_name` text if no contact is linked (backward compat).
   - Done when: appointments linked to a contact appear under that contact's name; unlinked appointments still appear under their free-text doctor name or "No doctor assigned".

[x] **13.5 — Unit tests: useAppointments contact hydration**
   - File: `src/hooks/__tests__/useAppointments.test.ts`
   - Mock `contacts_for_appointment` Tauri command.
   - Assert `contact_ids` is populated on loaded appointments.
   - Assert empty array when command returns no contacts.
   - Done when: tests pass; coverage ≥ 80 % on changed hook lines.

[x] **13.6 — E2E: timeline by-doctor shows contact name**
   - File: `e2e/timeline-by-doctor.spec.ts` (new)
   - Scenario A — linked contact:
     1. Create a contact: name "Dr. Alice Brown", role "doctor".
     2. Create an appointment: title "Annual check-up".
     3. Edit appointment → pick "Dr. Alice Brown" from contact picker.
     4. Open Timeline → By Doctor tab.
     5. Assert group header "Dr. Alice Brown" is visible.
     6. Assert "Annual check-up" appears under that header.
   - Scenario B — unlinked appointment:
     1. Create an appointment with free-text doctor_name "Dr. Unknown".
     2. Open Timeline → By Doctor tab.
     3. Assert group header "Dr. Unknown" is visible (fallback path).
   - Scenario C — no doctor:
     1. Create an appointment with no doctor name and no linked contact.
     2. Open Timeline → By Doctor tab.
     3. Assert group header "No doctor assigned" is visible.
   - Done when: all three Playwright scenarios pass.

[x] **13.7 — Commit & push**
   - Run pre-commit checklist: `npx tsc --noEmit` + `cargo fmt` + `cargo clippy`.
   - Commit message: `feat: link appointments to contacts; timeline by-doctor uses contact names`
   - Push to `origin/develop`; verify CI green.
   - Done when: CI passes on develop.

---

---

## Phase 14 — Encrypted Backup Export / Import (v1.7)

> **PRD:** F8.6, F8.7  
> **Goal:** Allow users to export a full encrypted backup of `myhealth.db` + salt files as a single `.myhealth` archive, and import it on the same or another machine.

### Sprint 26: Rust backend

[x] **14.1 — Backup export command**
   - File: `src-tauri/src/commands/backup.rs` (new)
   - Implement `backup_export(dest_path: String)` Tauri command:
     - Copy `myhealth.db`, `myhealth.salt`, `myhealth.kdf` into a temp dir
     - Bundle as a `.zip` renamed to `.myhealth` (extension signals our format)
     - Write to `dest_path` (user-chosen via save dialog)
   - The archive itself is not re-encrypted — the DB is already AES-256 encrypted via SQLCipher; the archive is a container only
   - Done when: `cargo test` verifies (a) exported archive contains all 3 files; (b) archive file size > 0; (c) writing to a read-only path returns a descriptive error

[x] **14.2 — Backup import command**
   - File: `src-tauri/src/commands/backup.rs`
   - Implement `backup_import(src_path: String)` Tauri command:
     - Validate the archive contains all 3 expected files
     - Stop the active DB connection (close SQLCipher handle)
     - Overwrite app data dir files; restart DB connection
     - Return error if archive is invalid or missing files
   - Done when: `cargo test` verifies (a) valid archive → files restored; (b) invalid archive → error returned, existing files untouched; (c) missing file in archive → error

[x] **14.3 — Register in lib.rs + IPC keys**
   - Add `backupExport: 'backup_export'`, `backupImport: 'backup_import'` to `src/lib/ipc.ts`
   - Register both commands in `lib.rs` invoke handler

### Sprint 27: Frontend

[x] **14.4 — Backup UI in Settings**
   - File: `src/app/(app)/settings/page.tsx`
   - Add "Backup & Restore" section (above "Danger Zone"):
     - "Export Backup" button → `@tauri-apps/plugin-dialog` `save()` dialog → calls `backup_export`
     - "Import Backup" button → `open()` dialog (filter `.myhealth`) → calls `backup_import` → confirmation dialog warning data will be replaced → on confirm execute; navigate to unlock screen after success
   - Done when: export writes a `.myhealth` file to the chosen path; import replaces data and redirects to unlock

[x] **14.5 — F8.6/F8.7 tests**
   - `cargo test` covers export + import round-trip
   - TypeScript: `npx tsc --noEmit` clean
   - Done when: coverage ≥ 80% on new backup code; manual smoke: export → wipe → import → data intact

[x] **14.6 — Commit & push**
   - Pre-commit: `npx tsc --noEmit` + `cargo fmt` + `cargo clippy`
   - Commit: `feat: encrypted backup export and import (F8.6, F8.7)`
   - Push to `origin/develop`; verify CI green

---

## Phase 15 — System Notification Reminders (v1.8)

> **PRD:** F2.6  
> **Goal:** Trigger OS system notifications 15 min, 1 hour, and 1 day before a scheduled appointment.

### Sprint 28: Rust + Tauri

[x] **15.1 — Reminders schema migration**
   - Migration v7 in `src-tauri/src/db/migrations.rs`:
     - `CREATE TABLE appointment_reminders (id TEXT PRIMARY KEY, appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE, remind_at TEXT NOT NULL, offset_label TEXT NOT NULL, is_fired INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`
     - Index on `(remind_at, is_fired)` for efficient polling
   - Done when: `cargo test` confirms table created; existing appointments unaffected

[x] **15.2 — Reminder scheduler command**
   - File: `src-tauri/src/commands/reminders.rs` (new)
   - `reminders_schedule(appointment_id: String, appointment_datetime: String)`:
     - Compute 3 `remind_at` timestamps (−1d, −1h, −15min) from `appointment_datetime`
     - `INSERT OR REPLACE` into `appointment_reminders`
   - `reminders_cancel(appointment_id: String)`: delete all reminder rows for the appointment
   - Done when: `cargo test` verifies (a) 3 rows created for a future appointment; (b) past offsets skipped (no row created for already-passed times); (c) cancel deletes all rows

[x] **15.3 — Background polling + OS notification**
   - In `src-tauri/src/lib.rs` setup: spawn a `tokio` task that polls `appointment_reminders WHERE remind_at <= now AND is_fired = 0` every 60 seconds
   - For each due row: send OS notification via `tauri-plugin-notification` (title = appointment title, body = "Appointment in X"); set `is_fired = 1`
   - Add `tauri-plugin-notification` to `src-tauri/Cargo.toml` and `tauri.conf.json` permissions
   - Done when: `cargo test` (mocked clock) verifies due reminder triggers notification payload; `is_fired` set to 1 after firing; no duplicate fires

[x] **15.4 — Register in lib.rs + IPC keys**
   - Add `remindersSchedule: 'reminders_schedule'`, `remindersCancel: 'reminders_cancel'` to `src/lib/ipc.ts`
   - Register in `lib.rs`

### Sprint 29: Frontend

[x] **15.5 — Reminder UI in AppointmentForm**
   - File: `src/components/appointments/AppointmentForm.tsx`
   - Add "Reminders" section below date/time:
     - Three checkboxes: "15 minutes before", "1 hour before", "1 day before" (all checked by default for future appointments)
     - On save: call `reminders_schedule` if any box checked and appointment is in the future; call `reminders_cancel` if all unchecked
   - Done when: creating an appointment → 3 reminder rows in DB; unchecking all → rows deleted; past appointment → checkboxes disabled

[x] **15.6 — F2.6 tests**
   - `cargo test` covers scheduler, polling (mocked), cancel
   - Done when: coverage ≥ 80%; `npx tsc --noEmit` clean

[x] **15.7 — Commit & push**
   - Pre-commit: `npx tsc --noEmit` + `cargo fmt` + `cargo clippy`
   - Commit: `feat: system notification reminders for appointments (F2.6)`
   - Push to `origin/develop`; verify CI green

---

## Phase 16 — Recurring Appointments (v1.9)

> **PRD:** F2.7  
> **Goal:** Allow appointments to recur weekly or monthly; each occurrence is a separate row linked to a recurrence series.

### Sprint 30: Rust + schema

[x] **16.1 — Recurrence schema migration**
   - Migration v8 in `src-tauri/src/db/migrations.rs`:
     - `CREATE TABLE recurrence_series (id TEXT PRIMARY KEY, rule TEXT NOT NULL CHECK(rule IN ('weekly','monthly')), interval_n INTEGER NOT NULL DEFAULT 1, until_date TEXT, created_at TEXT NOT NULL)`
     - `ALTER TABLE appointments ADD COLUMN recurrence_series_id TEXT REFERENCES recurrence_series(id)`
   - Done when: `cargo test` passes migration; existing appointment rows unaffected (`recurrence_series_id` NULL)

[x] **16.2 — Recurrence expansion command**
   - File: `src-tauri/src/commands/recurrence.rs` (new)
   - `recurrence_create(base_appointment_id: String, rule: String, interval_n: u32, until_date: Option<String>, occurrences: u32)`:
     - Creates a `recurrence_series` row
     - Clones the base appointment `occurrences` times, advancing date per rule; links all to `recurrence_series_id`
     - Max 104 occurrences (2 years weekly) enforced
   - `recurrence_delete_series(series_id: String, from_occurrence: Option<String>)`:
     - Delete all occurrences from `from_occurrence` onwards (or all if None)
   - Done when: `cargo test` verifies (a) weekly rule → dates spaced 7 days; (b) monthly rule → same day-of-month next month; (c) `until_date` respected; (d) max 104 enforced; (e) delete-from removes correct subset

[x] **16.3 — Register in lib.rs + IPC keys**
   - Add `recurrenceCreate: 'recurrence_create'`, `recurrenceDeleteSeries: 'recurrence_delete_series'` to `src/lib/ipc.ts`
   - Register in `lib.rs`

### Sprint 31: Frontend

[x] **16.4 — Recurrence UI in AppointmentForm**
   - File: `src/components/appointments/AppointmentForm.tsx`
   - Add "Repeat" dropdown: None / Weekly / Monthly
   - When Weekly or Monthly: show "Repeat every N [weeks/months]" stepper + "Until" date picker
   - On save: call `recurrence_create` if repeat ≠ None
   - Done when: creating a weekly appointment for 4 weeks creates 4 appointment rows; all appear in calendar view

[x] **16.5 — Delete series confirmation**
   - On deleting a recurring appointment, show modal: "Delete this occurrence only" / "Delete this and all following" / "Delete all in series"
   - Calls `recurrence_delete_series` with appropriate `from_occurrence`
   - Done when: "this and following" deletes correct subset; "all" deletes entire series

[x] **16.6 — F2.7 tests**
   - `cargo test` covers expansion, until_date, max cap, delete variants
   - Done when: coverage ≥ 80%; `npx tsc --noEmit` clean

[x] **16.7 — Commit & push**
   - Pre-commit: `npx tsc --noEmit` + `cargo fmt` + `cargo clippy`
   - Commit: `feat: recurring appointments weekly/monthly (F2.7)`
   - Push to `origin/develop`; verify CI green

---

## Phase 17 — Note Links + Note Version History (v1.10)

> **PRD:** F3.4, F3.5  
> **Goal:** Allow notes to be linked to appointments or documents; preserve the last 10 saved versions of each note.

### Sprint 32: Schema + Rust

[x] **17.1 — Note links + versions schema migration**
   - Migration v9 in `src-tauri/src/db/migrations.rs`:
     - `CREATE TABLE note_links (id TEXT PRIMARY KEY, note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, entity_type TEXT NOT NULL CHECK(entity_type IN ('appointment','document')), entity_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(note_id, entity_type, entity_id))`
     - `CREATE TABLE note_versions (id TEXT PRIMARY KEY, note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE, content TEXT NOT NULL, saved_at TEXT NOT NULL)`
     - Index on `note_versions(note_id, saved_at DESC)` for efficient version fetch
   - Done when: `cargo test` confirms both tables created

[x] **17.2 — Note links CRUD commands**
   - File: `src-tauri/src/commands/notes.rs`
   - `note_link(note_id: String, entity_type: String, entity_id: String)` — `INSERT OR IGNORE INTO note_links`
   - `note_unlink(note_id: String, entity_type: String, entity_id: String)` — `DELETE FROM note_links`
   - `links_for_note(note_id: String)` → `Vec<NoteLinkDto>`
   - `notes_for_entity(entity_type: String, entity_id: String)` → `Vec<NoteDto>`
   - Done when: `cargo test` verifies link/unlink/list round-trip; duplicate link is no-op

[x] **17.3 — Note version commands**
   - File: `src-tauri/src/commands/notes.rs`
   - On every `notes_update` call: `INSERT INTO note_versions(id, note_id, content, saved_at)` before updating the note body
   - After insert, delete oldest rows if count > 10: `DELETE FROM note_versions WHERE note_id = ? AND id NOT IN (SELECT id FROM note_versions WHERE note_id = ? ORDER BY saved_at DESC LIMIT 10)`
   - `note_versions_list(note_id: String)` → `Vec<NoteVersionDto>` ordered newest first
   - `note_version_restore(note_id: String, version_id: String)` → restores content from that version (saves a new version of the current content first)
   - Done when: `cargo test` verifies (a) 11 saves → only 10 versions kept; (b) restore updates note content; (c) restore creates version of previous content

[x] **17.4 — Register in lib.rs + IPC keys**
   - Add `noteLink`, `noteUnlink`, `linksForNote`, `notesForEntity`, `noteVersionsList`, `noteVersionRestore` to `src/lib/ipc.ts`
   - Register all in `lib.rs`

### Sprint 33: Frontend

[x] **17.5 — Note links UI**
   - File: `src/app/(app)/notes/[id]/page.tsx`
   - Add "Linked To" panel in note detail sidebar:
     - "Link to Appointment" dropdown (searchable, shows upcoming/recent appointments)
     - "Link to Document" dropdown (searchable, shows documents list)
     - Linked items shown as chips with unlink button
   - Calls `note_link` on add; `note_unlink` on remove
   - Done when: linking a note to an appointment shows it in the appointment detail page under "Linked Notes"

[x] **17.6 — Linked notes in Appointment and Document detail**
   - File: `src/app/(app)/appointments/[id]/page.tsx` — add "Notes" panel calling `notes_for_entity('appointment', id)`
   - File: `src/app/(app)/documents/[id]/page.tsx` — add "Notes" panel calling `notes_for_entity('document', id)`
   - Each panel lists linked note titles; click navigates to note detail
   - Done when: notes linked from the note side appear here without page reload

[x] **17.7 — Note version history UI**
   - File: `src/app/(app)/notes/[id]/page.tsx`
   - Add "Version History" button in note toolbar; opens side drawer
   - Drawer lists up to 10 versions with timestamp; "Restore" button on each
   - Restore calls `note_version_restore`; editor updates with restored content
   - Done when: saving a note 3 times shows 3 versions; restoring v1 sets editor content to v1 text

[x] **17.8 — F3.4/F3.5 tests**
   - `cargo test` covers link CRUD, version capping at 10, restore sequence
   - Done when: coverage ≥ 80%; `npx tsc --noEmit` clean

[x] **17.9 — Commit & push**
   - Pre-commit: `npx tsc --noEmit` + `cargo fmt` + `cargo clippy`
   - Commit: `feat: note links to appointments/documents + note version history (F3.4, F3.5)`
   - Push to `origin/develop`; verify CI green

---

## Phase 18 — Gap Closure (v1.6 patch)

Closes G-01 through G-12 identified in the 2026-05-02 gap analysis.

### [x] 18.1 — Create synthetic PDF test fixtures (G-06, G-07)
- Create `src-tauri/tests/fixtures/no-date-physio.pdf` — minimal valid PDF with text "Physiotherapy Session Dr. Jones" but no date in content or filename
- Create `src-tauri/tests/fixtures/no-date-no-filename.pdf` — minimal valid PDF with generic text, no date anywhere
- Done when: both files exist, are valid PDFs, and `cargo test` passes (fixture load does not panic)

### [x] 18.2 — Fix/verify date-extraction fallback path (G-06, G-07)
- Run `cargo test extract_activity_date` to confirm the two new fixtures hit the fallback (`None`) path
- If the test does not exist, add it to `src-tauri/src/commands/upload_intelligence.rs` (or wherever date extraction lives)
- Done when: `cargo test` shows the fallback tests passing

### [x] 18.3 — Per-page OCR progress bar verification (G-01)
- Locate the OCR progress event emit in `src-tauri/src/commands/` (search for `emit` near `ocr` or `pdftoppm`)
- Write a Rust integration test that invokes the OCR pipeline on a 3-page scanned PDF fixture and asserts 3 progress events are emitted (pages 1, 2, 3)
- Done when: `cargo test ocr_progress` passes with ≥ 1 assertion per page

### [x] 18.4 — contact-suggestion testid in UploadDialog (G-03)
- Open `src/components/UploadDialog.tsx` (or wherever the contact suggestion card renders)
- Ensure the merge button has `data-testid="contact-suggestion-merge"`
- Add a vitest test asserting the testid appears when a contact suggestion is present
- Done when: `npx vitest run` passes and testid is in the DOM

### [x] 18.5 — clinic-suggestion testid in UploadDialog (G-04)
- Same as 18.4 but for clinic suggestion card: `data-testid="clinic-suggestion-merge"`
- Done when: `npx vitest run` passes and testid is in the DOM

### [x] 18.6 — Clinic↔contact auto-link at upload-confirm (G-05)
- Find the upload-confirm handler and verify it calls `contacts_link_clinic` (or equivalent IPC) when both a contact and clinic are extracted
- If the call is missing, add it
- Add a vitest mock test asserting the IPC call is made on confirm when both suggestions are present
- Done when: `npx vitest run` passes; IPC call confirmed in test

### [x] 18.7 — Apple Calendar smoke test scaffold (G-02)
- Add a `#[cfg(target_os = "macos")]` Rust test in `src-tauri/src/commands/calendar.rs` (or equivalent) that calls the calendar read command and asserts it returns `Ok(_)` (even if 0 events)
- Add a `// MANUAL: run on device with calendar permission granted` comment for the permission-dependent path
- Done when: `cargo test calendar_smoke` passes (or is `#[ignore]`-tagged for CI with a clear reason)

### [x] 18.8 — Performance benchmark: document list (G-09)
- Write a Rust benchmark or integration test that inserts 1000 document rows and times a `documents_list` query
- Assert elapsed < 500ms
- Done when: test passes on dev machine; result logged to `docs/PERF_RESULTS.md`

### [x] 18.9 — Performance benchmark: cold start (G-08)
- Add a `docs/PERF_RESULTS.md` with a manual measurement section
- Measure and record cold start time (app launch to unlock screen visible); assert <2s
- Done when: `docs/PERF_RESULTS.md` has cold-start result with timestamp

### [x] 18.10 — Performance benchmark: calendar sync (G-10)
- Add timing to the Apple Calendar sync command (or measure via the Rust test from 18.7)
- Assert 100-event sync < 5000ms
- Record result in `docs/PERF_RESULTS.md`
- Done when: result recorded; test or measurement confirms <5s

### [x] 18.11 — Accessibility audit with axe-core (G-11)
- Add `axe-core` dev dependency: `npm install -D axe-core @axe-core/react` (if not present)
- Write a vitest test that renders each main page component (Documents, Appointments, Notes, Contacts, Timeline, Search) and runs axe; assert 0 violations
- Done when: `npx vitest run` passes with 0 axe violations across all pages

### [x] 18.12 — Keyboard navigation audit (G-12)
- Add a Playwright E2E test (or vitest keyboard test) that:
  1. Opens the app to the Documents page
  2. Tabs through all interactive elements
  3. Asserts focus never gets trapped and all buttons/links are reachable
- Done when: test passes; any focus-trap bugs found are fixed

### [x] 18.13 — Commit & push
- Pre-commit: `npx tsc --noEmit` + `cargo fmt` + `cargo clippy`
- Commit: `feat: gap closure — fixtures, OCR progress, a11y, perf benchmarks (G-01–G-12)`
- Push to `origin/develop`; verify CI green
- Done when: CI green on develop branch

---

---

## Phase 19 — Code Quality & Performance Hardening

> Source: code review findings (v1.2) not yet implemented. See `docs/STATUS.md` §8.

### [x] **19.1 — Add missing DB indexes (H3)**
- All 6 required indexes already present in SCHEMA_V4 (`migrations.rs` lines 6-19).
- Verified by `migration_v4_creates_indexes` test. No new migration needed.

### [x] **19.2 — OCR per-page progress + timeout (F2.3/F2.4)**
- In `src-tauri/src/commands/documents.rs` emit Tauri progress events per page during OCR
- Add configurable timeout (default 60s) per page; cancel remaining pages on timeout
- Frontend: show page X/N progress bar in upload modal
- Done when: uploading a 5-page PDF shows page-by-page progress; timeout test passes

### [x] **19.3 — CommandError enum (M2)**
- In `src-tauri/src/commands/mod.rs` define `CommandError` enum with variants: `DbLocked`, `NotFound`, `InvalidInput(String)`, `Internal(String)`
- Implement `serde::Serialize` + `From<rusqlite::Error>`
- Replace `String` return type in all commands with `Result<T, CommandError>`
- Done when: `cargo clippy` clean; frontend can distinguish error variants

### [x] **19.4 — Zustand selector hooks (M5)**
- In `src/hooks/useDocuments.ts` replace 11-value destructure with per-slice selectors
- Pattern: `const documents = useDocumentStore(s => s.documents)` (one value per hook call)
- Done when: `tsc --noEmit` clean; re-render count for non-document state changes drops to 0

### [x] **19.5 — Commit & push**
- Pre-commit: `npx tsc --noEmit` + `cargo fmt` + `cargo clippy`
- Commit: `perf: add DB indexes, OCR progress, CommandError enum, Zustand selectors`
- Push to `origin/develop`; verify CI green
- Done when: CI green on develop branch

---

## Phase 20 — Upload Gap Closure: Doc Title Tag + Dual Timeline Events (v1.6 patch)

> Source: manual test feedback 2026-05-02 — "Registration Form" tag missing; Timeline showing upload date instead of medical event date.

### [x] **20.1 — Gap 1 (Option C): Document title extraction via `extract_doc_title()`**
- Added `extract_doc_title(text: &str) -> Option<String>` in `src-tauri/src/extraction/mod.rs`
  - Scans first 3 non-empty OCR lines; accepts title-case heading ≤5 words, 2–60 chars, not ending in `:`, fewer than 1/3 digits
- Added step 5 in `auto_extract_tags()` calling `extract_doc_title()`; emits `title:<heading>` tag
- Added 6 unit tests covering: Registration Form extraction, label-line skip, digit-heavy skip, >5 word skip, no-title-case fallback, full pipeline tag output
- **PRD_V4.md** created with LLM-assisted extraction (Option D) as a future Enhancement with 8 acceptance criteria
- Done when: `cargo test` passes; uploading "Registration Form" PDF shows `title:Registration Form` tag ✅ (manual test confirmed)

### [x] **20.2 — Gap 2 (Option B+C): Dual timeline events per document**
- `docToEvent()` in `src/app/(app)/timeline/page.tsx` now uses `activity_date` only (medical event date)
- `docToUploadEvent()` new function — emits "Uploaded: \<filename\>" event at `created_at` (upload timestamp)
- `buildDocTitle()` checks `title:` prefixed tag first, stripping prefix for display
- `allEvents` useMemo changed from `map(docToEvent)` to `flatMap` — always emits upload event; emits activity event only when `activity_date` is non-null
- Done when: `npx tsc --noEmit` passes; Timeline shows two entries per document when `activity_date` is set ✅ (manual test confirmed)

### [x] **20.3 — Commit & push**
- Pre-commit: `npx tsc --noEmit` ✅ + `cargo fmt` ✅ + `cargo clippy` ✅
- Commit: `feat: add doc title extraction and dual timeline events` (32b581c)
- Push to `origin/develop`; CI green ✅

---

## Phase 21 — Tag & Timeline Feedback Fixes (PRD_V3.md v3.1 changes)

**Scope:** Manual testing of the "Registration Form" upload revealed two bugs and one missing feature:
1. Document title tag stored with `title:` prefix — must be stored clean.
2. Upload events appear in Chronological view — they must be exclusive to a new "By Uploaded Date" view.
3. No way to set `activity_date` after upload for documents where it was not extracted.

### [x] **21.1 — Remove `title:` prefix from Rust extraction + update tests**
- In `src-tauri/src/extraction/mod.rs`, `auto_extract_tags()` step 5 (line ~289): change `format!("title:{title}")` → store `title` directly
- Update test `auto_tags_includes_title_tag()` (line ~626) to assert `"Registration Form"` (no prefix)
- Done when: `cargo test` passes and the assertion is on the plain string `"Registration Form"`

### [x] **21.2 — Fix TypeScript `buildDocTitle()` to identify title tags without prefix**
- In `src/app/(app)/timeline/page.tsx`, rewrite `buildDocTitle()` (lines ~44–60):
  - Remove `tags.find((t) => t.startsWith('title:'))` logic
  - New heuristic: a title tag is a mixed-case tag that is NOT all-lowercase (type), NOT all-uppercase (specialty), NOT `YYYY-MM-DD` (date), and does NOT start with a professional title prefix ("Mr", "Dr", "Mrs", "Ms", "Prof", "Sr")
- Done when: `npx tsc --noEmit` passes and timeline displays `"Registration Form"` as doc title (no prefix visible)

### [x] **21.3 — Add "By Uploaded Date" view and move upload events there**
- In `src/app/(app)/timeline/page.tsx`:
  - Add `'by-uploaded-date'` to `type ViewMode`
  - Restructure `allEvents` useMemo: in `chronological`/`by-category`/`by-doctor` modes, only emit `docToEvent(d)` (when `activity_date` exists) — do NOT include `docToUploadEvent(d)`
  - Add rendering branch for `by-uploaded-date`: show all docs sorted by `created_at` descending using `docToUploadEvent(d)`; include documents without `activity_date`
  - Add "By Uploaded Date" tab to `viewTabs`
- Done when: `npx tsc --noEmit` passes; Chronological shows no upload events; "By Uploaded Date" tab shows all documents including ones without activity_date

### [x] **21.4 — Add `activity_date` editing to document detail page**
- Locate `DocumentDetailClient.tsx` (or equivalent document detail component)
- Add an "Activity Date" date input field; show it always, pre-populate with `activity_date` if set
- Wire a save button that calls Tauri IPC `update_document_activity_date(documentId, activityDate)`
- Add the Rust IPC command `update_document_activity_date` in `src-tauri/src/commands/` if not already present (UPDATE `documents SET activity_date = ?1 WHERE id = ?2`)
- Done when: `npx tsc --noEmit` + `cargo clippy` pass; opening a document without activity_date shows empty editable field; entering a date and saving persists it; Timeline Chronological view reflects it

### [x] **21.5 — E2E tests for Phase 21 changes**
- Add Playwright tests to `e2e/` covering:
  - Tag chip for "Registration Form" shows no "title:" prefix
  - Chronological view has no rows with label containing "Uploaded:"
  - "By Uploaded Date" tab exists and shows all documents
  - Document detail activity_date field saves and Timeline updates
- Done when: `pnpm e2e` passes for all four scenarios

### [x] **21.6 — Commit & push**
- Pre-commit: `npx tsc --noEmit` + `cargo fmt --all` + `cargo clippy -- -D warnings`
- Commit: `fix: clean tag prefix, By Uploaded Date view, activity_date editing`
- Push to `origin/develop`; CI green

---

## Phase 22 — V3-F6: Auto-Create Appointment from Invoice Upload

**PRD reference:** `docs/PRD_V3.md` → V3-F6

### [x] **22.1 — New Rust command `appointments_suggest_from_document`**
- Add to `src-tauri/src/commands/documents.rs`:
  - `AppointmentSuggestion` struct: `{ appt_date: String, title: String, doctor_name: Option<String>, specialty: Option<String> }`
  - `appointments_suggest_from_document(id: String, state) -> Result<Option<AppointmentSuggestion>, CommandError>`
  - Query `documents` table for `activity_date` and `auto_tags` JSON column (or re-run extraction)
  - Return `None` if no `activity_date` OR none of the auto_tags match `invoice|receipt|bill`
  - Build suggestion: `appt_date` = `activity_date`, `doctor_name` = first doctor candidate from tags, `specialty` = first UPPERCASE-only tag, `title` = constructed string
- Register command in `src-tauri/src/lib.rs` (import + invoke_handler entry)
- Done when: `cargo clippy -- -D warnings` passes

### [x] **22.2 — Frontend `ApptSuggestionBanner` component**
- Create `src/components/documents/ApptSuggestionBanner.tsx`
- Props: `suggestion: { apptDate: string; title: string; doctorName?: string; specialty?: string }`, `onConfirm: () => void`, `onDismiss: () => void`
- UI: dismissible banner showing the pre-filled appointment details with "Create Appointment" and "Dismiss" buttons
- Done when: `npx tsc --noEmit` passes

### [x] **22.3 — Wire into `documents/page.tsx` `handleUploaded()`**
- After `links_score_candidates` returns null (no `suggestion`), call `appointments_suggest_from_document({ id: doc.id })`
- If non-null, store in `apptSuggestion` state and show `ApptSuggestionBanner`
- On confirm: call `appointments_create` with pre-filled data, then `link_document_to_appointment`, then dismiss banner
- On dismiss: clear state
- V3-F6.8: if `links_score_candidates` returned non-null, skip the `appointments_suggest_from_document` call
- Done when: `npx tsc --noEmit` passes

### [x] **22.4 — Unit tests**
- Add tests to `src/app/(app)/documents/__tests__/` (or create file):
  - Banner renders with correct date and doctor name
  - "Create Appointment" calls `appointments_create` then `link_document_to_appointment`
  - "Dismiss" clears the banner without creating an appointment
  - `links_score_candidates` match → no appt suggestion banner shown
  - Document without invoice tag → no appt suggestion banner
- Done when: `pnpm test` passes with ≥80% branch coverage on the new code

### [x] **22.5 — Commit & push**
- Pre-commit: `npx tsc --noEmit` + `cargo fmt --all` + `cargo clippy -- -D warnings`
- Commit: `feat: auto-create appointment from invoice upload (V3-F6)`
- Push to `origin/develop`; CI green

---

## Phase 23 — Post-Release Fixes (V3-F6 Manual Testing 2026-05-03)

**PRD reference:** `docs/PRD_V3.md` → Post-Release Fixes section (V3-F6.9, V3-F6.11)

### [x] **23.1 — Fix: appt_date stored without time component (V3-F6.9)**

**Problem:** `appt_date` from suggestion banner is stored as `YYYY-MM-DD`. The edit form's `<input type="datetime-local">` requires `YYYY-MM-DDThh:mm`. `isoToDatetimeLocal` slices to 16 chars but `"YYYY-MM-DD"` is only 10 — field renders empty.

**Files to change:**
1. `src/components/appointments/AppointmentForm.tsx` — fix `isoToDatetimeLocal`: `iso.length === 10 ? iso + 'T00:00' : iso.slice(0, 16)`
2. `src/app/(app)/documents/page.tsx` — in `handleApptSuggestionConfirm`, normalise `appt_date` before `appointments_create`: append `T00:00:00` when no `T` present

**Done when:** Opening Edit on an appointment created from an invoice shows the correct pre-populated date.

### [x] **23.2 — Fix: auto-created appointments default to "completed" (V3-F6.11)**

**Problem:** Invoice appointments default to `status = "scheduled"`. Invoices are past services.

**Files to change:**
1. `src/app/(app)/documents/page.tsx` — in `handleApptSuggestionConfirm`, add `status: 'completed'` to the `appointments_create` input object

**Done when:** An appointment created via the invoice suggestion banner has `status = "completed"`.

### [x] **23.3 — Commit & push**

- Pre-commit: `npx tsc --noEmit`
- Commit: `fix: prepopulate date in appointment edit form and default invoice appointments to completed`
- Push to `origin/develop`; CI green

---

## Phase 24 — Merge View and Edit appointment screens (V3-F7.1)

**PRD reference:** `docs/PRD_V3.md` → V3-F7.1

### [x] **24.1 — Implement inline edit mode on appointment detail page**

**Goal:** Single `/appointments/view?id=` page that shows read-only details AND allows editing inline. No separate edit mode on the list page for existing appointments.

**Changes:**
1. `src/app/(app)/appointments/view/AppointmentDetailClient.tsx`
   - Add `isEditing` state (default `false`)
   - Add "Edit" button in the header section
   - When `isEditing`, render `AppointmentForm` with `initial={appt}` instead of read-only `<dl>`
   - On `onSave`: call `appointments_update` via `useAppointments` hook or direct invoke, update `appt` state, set `isEditing = false`
   - On `onCancel`: set `isEditing = false`
2. `src/components/appointments/AppointmentCard.tsx`
   - Remove the separate "Edit" button
   - Rename "View" link text to "Open" (clearer intent)
3. `src/app/(app)/appointments/page.tsx`
   - Remove `editingAppt` state and `handleEdit` function (no longer needed for existing appointments)
   - Remove `showForm` logic for edit mode; keep only for new appointments
   - Simplify `handleSave` — only handles create path now

**Done when:** Clicking "Open" on any appointment card navigates to detail page; clicking "Edit" on detail page renders editable form pre-filled; saving updates the appointment in place; "New" on list page still creates via inline form.

### [x] **24.2 — TypeScript check + commit & push**

- Pre-commit: `npx tsc --noEmit`
- Commit: `feat: merge appointment view and edit into single detail page (V3-F7.1)`
- Push to `origin/develop`; CI green

---

## Phase 25 — Code Quality & Performance Hardening (Remaining Open Items)

> Source: `docs/STATUS.md §8` — items deferred from Phase 19 code review.

### [x] **25.1 — Reduce Tauri command boilerplate (H5)**

**Goal:** Define a `CommandContext` helper struct in `src-tauri/src/commands/mod.rs` that wraps the repeated `conn.lock()` / error-string pattern used in every command handler.

**Changes:**
1. `src-tauri/src/commands/mod.rs`
   - Add `pub struct CommandContext { conn: Arc<Mutex<Connection>> }`
   - Add `impl CommandContext { fn db(&self) -> Result<MutexGuard<Connection>, CommandError> }`
   - Remove repeated `conn.lock().map_err(|e| e.to_string())?` boilerplate from call sites
2. Update at least the 5 most-duplicated command files to use `CommandContext`

**Done when:** `cargo clippy -- -D warnings` clean; `cargo test` passes (453+ tests); boilerplate lines reduced by ≥30%.

---

### [x] **25.2 — Refactor extraction pipeline (H6)**

**Goal:** Split `extraction/mod.rs` God Object into pure, testable functions.

**Changes:**
1. `src-tauri/src/extraction/mod.rs`
   - Extract `parse_doctors(text: &str) -> Vec<String>` as a standalone pure function
   - Extract `parse_contacts(text: &str) -> Vec<ContactCandidate>` as a standalone pure function
   - Keep orchestrating `auto_extract_tags()` calling these sub-functions
2. Add unit tests for each pure function

**Done when:** `cargo test` passes; `cargo clippy` clean; extraction module no longer a single `>300 line` block mixing OCR + parsing + scoring.

---

### ▶ **25.3 — Zustand selector hooks (M5)**

**Goal:** Replace wide destructures in hooks with per-value selectors to reduce unnecessary re-renders.

**Changes:**
1. `src/hooks/useDocuments.ts` — replace the 11-value destructure with individual `useDocumentStore(s => s.field)` calls
2. Apply the same pattern to `useAppointments.ts` and `useNotes.ts` where applicable

**Done when:** `tsc --noEmit` clean; Vitest passes.

---

### [ ] **25.4 — Virtualize DocumentList for >30 items (L3)**

**Goal:** Prevent layout jank when the document list grows large.

**Changes:**
1. Install `react-window` (`npm install react-window @types/react-window`)
2. `src/components/documents/DocumentList.tsx` — wrap the list in `FixedSizeList` from `react-window`
3. Keep existing search/filter logic intact

**Done when:** `tsc --noEmit` clean; rendering 100+ document rows does not cause scroll jank; Vitest passes.

---

### [ ] **25.5 — Extract inline dashboard helpers (L6)**

**Goal:** Move inline formatting helpers defined inside `dashboard/page.tsx` to `src/lib/formatting.ts` so they are not recreated per render and can be unit tested.

**Changes:**
1. Create `src/lib/formatting.ts` with extracted helpers
2. Update `dashboard/page.tsx` to import from there
3. Add unit tests in `src/lib/__tests__/formatting.test.ts`

**Done when:** `tsc --noEmit` clean; Vitest passes; no inline helpers remain in dashboard component.

---

### [ ] **25.6 — Commit & push Phase 25**

- Pre-commit: `npx tsc --noEmit` + `cargo fmt --all` + `cargo clippy -- -D warnings`
- Commit: `refactor: reduce command boilerplate, extraction refactor, Zustand selectors, list virtualisation (Phase 25)`
- Push to `origin/develop`; CI green

---

## Quick Reference

| Concern | File |
|---------|------|
| Feature requirements (v1 + v1.1) | `docs/PRD_V2.md` |
| Feature requirements (v1.4 upload intelligence) | `docs/PRD_V3.md` |
| LLM-assisted extraction enhancement (future) | `docs/PRD_V4.md` |
| Implementation vs requirements gap analysis | `docs/V3_GAP.md` |
| Unified quality status | `docs/STATUS.md` |
| Architecture | `docs/ARCHITECTURE_V2.md` |
| Acceptance tests (v1.2) | `docs/ACCEPTANCE_TESTS_V2.md` |
| Acceptance tests (v1.4 upload) | `docs/ACCEPTANCE_TESTS_V3.md` |
| Wireframes | `docs/WIREFRAMES_V2.md` |
| CI/CD pipeline | `.github/workflows/` |
| Commit strategy | `docs/COMMIT_STRATEGY.md` |
| **Where to resume** | **This file — find ▶** |
