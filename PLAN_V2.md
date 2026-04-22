# myHealth v1.1 — Execution Plan

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Current: Phase 4 — Sprint 8
Task 4.4 — Bulk categorization UI
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

| Feature | PRD_V2 Section | Priority | Effort |
|---------|---------------|----------|--------|
| F5.3–F5.4 Contact deduplication + merge | §F5 | HIGH | Medium |
| F6 Document-appointment link scoring | §F6 | HIGH | Large |
| F2.2–F2.5 OCR pipeline | §F2 | HIGH | Large |
| F3.2–F3.5 Many-to-many categories + bulk ops | §F3 | MED | Medium |
| F4 Apple Calendar integration (macOS) | §F4 | LOW | Large |

**Release target:** v1.1.0 — Q2 2026 (end of June 2026)
**Coverage requirement:** ≥ 80% across all new code

> **Timeline note (2026-04-22):** 10 sprints × 2 weeks = 20 weeks; end of June is 10 weeks away. To meet the deadline, Phase 5 (Apple Calendar, F4) should target v1.2 (Q3 2026) unless explicitly re-prioritised. Phases 0–4 fit comfortably in 10 weeks.

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

▶ **4.4 — Bulk categorization UI**
   - Add checkbox selection mode to `DocumentList.tsx`
   - "Assign Category" action bar appears on selection; calls `categories_bulk_link`
   - Done when: selecting 5 documents and assigning a category links all 5

[ ] **4.5 — F3 tests** — coverage ≥ 80%

---

## Phase 5 — Apple Calendar Integration (F4, macOS only)

> **Timeline risk:** Phase 5 is LOW priority and HIGH effort. With the June 30 v1.1.0 target, this phase should be deferred to **v1.2 (Q3 2026)** unless explicit re-prioritisation is made. Tasks below are preserved for planning purposes.

### Sprint 9: Rust + macOS bindings

[ ] **5.1 — EventKit Rust bindings**
   - Add `objc`, `cocoa`, `core-foundation` crates to `src-tauri/Cargo.toml`
   - Create `src-tauri/src/commands/calendar.rs`
   - Implement `calendar_request_permission` (async EventKit access request)
   - Implement `calendar_list_calendars` (returns `Vec<CalendarInfo>`)
   - Guard all calendar code behind `#[cfg(target_os = "macos")]`
   - Done when: permission dialog appears on macOS; non-macOS returns `Err("not supported")`

[ ] **5.2 — Event import command**
   - Implement `calendar_import_events`: query EventKit for events in last 24 months matching user keywords
   - Map to `Appointment` shape; insert via existing appointment commands (skip duplicates by EventKit event ID stored in `calendar_events.external_event_id`)
   - Done when: `cargo test` (mocked EventKit via `#[cfg(test)]`) imports 5 events; re-running does not duplicate; 100 events import in < 5s

[ ] **5.3 — Bi-directional sync**
   - Implement `calendar_sync`: push new appointments to EventKit; pull new EventKit events → appointments
   - Store last sync timestamp in `settings` table key `calendar_last_sync`
   - Done when: creating an appointment creates a matching Calendar event (manual verify on macOS)

### Sprint 10: Frontend + Settings

[ ] **5.4 — Calendar sync settings UI**
   - In `src/app/(app)/settings/page.tsx` add "Calendar Sync" section (conditional on macOS via Tauri `platform()`)
   - Permission status indicator; keyword list editor; "Sync Now" button; "Last synced: X" timestamp
   - Windows/Linux: render "Not available on this platform" message
   - Done when: macOS shows full UI; Windows shows disabled message

[ ] **5.5 — F4 tests** — coverage ≥ 80% (mock EventKit on CI; real integration test documented for manual macOS run)

---

## Phase 6 — Release

[ ] **6.1 — End-to-end smoke test**
   - Manual walkthrough of all v1.1 flows: duplicate detection, link scoring, OCR, multi-category, calendar sync
   - Verify performance targets from PRD_V2 §Non-Functional Requirements

[ ] **6.2 — Bump version & tag**
   - Update `package.json` version to `1.1.0`
   - Update `src-tauri/tauri.conf.json` version to `1.1.0`
   - **Requires explicit user approval before running `git tag`** (see `docs/COMMIT_STRATEGY.md`)

[ ] **6.3 — Verify GitHub Release**
   - Confirm 4 platform artifacts published; update README Known Issues if needed

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
