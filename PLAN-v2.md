# myHealth v1.1.0 — Execution Plan

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task.

---

## RESUME POINT (always current)

```
▶ Phase 18 — Task 18.1: F4 Apple Calendar Sync — Swift plugin scaffold
```

---

## Status Legend

```
[x]  complete
[ ]  pending
▶    next action (exactly one at any time)
```

---

## Feature Summary

| ID | Feature | Effort |
|----|---------|--------|
| F1 | Filename date/tag parsing | 3–4 days |
| F2 | PDF text + OCR extraction | 6–8 days |
| F3 | Medical category hierarchy | 4–5 days |
| F4 | Apple Calendar sync (macOS) | 5–7 days |
| F5 | Contact auto-creation from documents | 3–4 days |
| F6 | Document–appointment linking + Timeline v2 | 8–11 days |
| — | Integration, QA, release v1.1.0 | 3–4 days |
| **Total** | | **32–43 days** |

---

## Phase 14 — Schema v2 Migrations

[x] **14.1 — Write migration SQL**
   - Create `src-tauri/src/db/migrations/v2.sql`
   - Add tables: `categories`, `document_categories`, `appointment_categories`, `clinics`, `document_appointments`, `calendar_sources`, `calendar_events`
   - Add columns: `documents.document_date TEXT`, `documents.extracted_metadata TEXT`, `contacts.clinic_id TEXT`, `contacts.specialty TEXT`
   - Schema:
     ```sql
     CREATE TABLE categories (
       id TEXT PRIMARY KEY,
       name TEXT NOT NULL,
       parent_id TEXT REFERENCES categories(id),
       color_hex TEXT NOT NULL DEFAULT '#6B7280',
       is_system INTEGER NOT NULL DEFAULT 1,
       sort_order INTEGER NOT NULL DEFAULT 0
     );
     CREATE TABLE document_categories (
       document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
       category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
       PRIMARY KEY (document_id, category_id)
     );
     CREATE TABLE appointment_categories (
       appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
       category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
       PRIMARY KEY (appointment_id, category_id)
     );
     ALTER TABLE documents ADD COLUMN document_date TEXT;
     ALTER TABLE documents ADD COLUMN extracted_metadata TEXT;
     CREATE TABLE clinics (
       id TEXT PRIMARY KEY, name TEXT NOT NULL,
       address TEXT, phone TEXT, created_at TEXT NOT NULL
     );
     ALTER TABLE contacts ADD COLUMN clinic_id TEXT REFERENCES clinics(id);
     ALTER TABLE contacts ADD COLUMN specialty TEXT;
     CREATE TABLE document_appointments (
       id TEXT PRIMARY KEY,
       document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
       appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
       link_type TEXT NOT NULL DEFAULT 'related',
       confidence TEXT NOT NULL DEFAULT 'manual',
       created_at TEXT NOT NULL,
       UNIQUE (document_id, appointment_id)
     );
     CREATE TABLE calendar_sources (
       id TEXT PRIMARY KEY, external_id TEXT NOT NULL UNIQUE,
       name TEXT NOT NULL, color_hex TEXT,
       enabled INTEGER NOT NULL DEFAULT 1, last_synced_at TEXT
     );
     CREATE TABLE calendar_events (
       id TEXT PRIMARY KEY, external_id TEXT NOT NULL UNIQUE,
       calendar_id TEXT NOT NULL REFERENCES calendar_sources(id),
       appointment_id TEXT REFERENCES appointments(id),
       title TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT,
       location TEXT, notes TEXT,
       is_imported INTEGER NOT NULL DEFAULT 0, last_synced_at TEXT NOT NULL
     );
     ```
   - Done when: `sqlite3 :memory: < v2.sql` exits 0

[x] **14.2 — Wire migration into migrations.rs**
   - Bump schema version to 2 in `src-tauri/src/db/migrations.rs`
   - Apply v2.sql when current version < 2
   - Done when: `cargo test` passes migration round-trip (v1 DB upgraded to v2)

[x] **14.3 — Seed system categories**
   - Insert default system categories in migration: Cardiology, Dermatology, General, Lab Results, Imaging, Prescriptions, Surgery, Other
   - `is_system = 1` (cannot be deleted by user)
   - Done when: fresh DB has 8 categories after migration

[x] **14.4 — Update FTS5 index for new fields**
   - Extend `search_index` virtual table to include `extracted_metadata` and `category_name`
   - Update `src-tauri/src/commands/search.rs` to populate new fields on upsert
   - Done when: `cargo test` covers FTS5 search hitting extracted_metadata

[x] **14.5 — Update documents Rust model**
   - Add `document_date: Option<String>` and `extracted_metadata: Option<String>` to `Document` struct in `src-tauri/src/commands/documents.rs`
   - Done when: `cargo test` passes serialization round-trip

[x] **14.6 — Schema v2 tests** — `cargo test` coverage ≥ 80% for new tables

---

## Phase 15 — F1: Filename Date & Tag Parsing

[x] **15.1 — Rust filename parser**
   - Create `src-tauri/src/parsing/filename.rs`
   - Patterns to recognise (extract as `document_date`):
     - `DDMMMYYYY` → `01Dec2024`
     - `DD-Mon-YYYY` → `01-Dec-2024`
     - `YYYYMMDD` → `20241201`
     - `YYYY-MM-DD` → `2024-12-01`
     - 4-digit year alone → tag as `year:YYYY`, no full date
   - Extract remaining tokens as candidate tags (split on `_`, `-`, spaces; skip stopwords)
   - Return: `ParsedFilename { document_date: Option<NaiveDate>, tags: Vec<String> }`
   - Done when: `cargo test` passes for all 5 date patterns + tag extraction

[x] **15.2 — Apply parser on upload**
   - In `documents_upload` command: call `parse_filename`, set `document_date` if extracted
   - Merge parsed tags with any user-provided tags (deduplicate, lowercase)
   - `document_date` from filename takes precedence over user-entered date
   - Done when: uploading `BloodTest_01Dec2024_NHS.pdf` sets `document_date = 2024-12-01` and tags `['blood test', 'nhs']`

[x] **15.3 — F1 tests** — `cargo test` coverage ≥ 80% for filename module

---

## Phase 16 — F2: PDF Text & OCR Extraction

[x] **16.1 — Add Rust dependencies**
   - Add to `src-tauri/Cargo.toml`:
     - `pdf-extract = "0.7"` (text-based PDFs)
     - `leptess = "0.14"` (Tesseract OCR bindings for images)
     - `image = "0.25"` (image decoding for JPEG/PNG)
   - Done when: `cargo build` exits 0

[x] **16.2 — PDF text extractor**
   - Create `src-tauri/src/extraction/pdf.rs`
   - Function: `extract_pdf_text(path: &Path) -> Result<String>`
   - Use `pdf-extract`; fall back to empty string if error
   - Done when: `cargo test` extracts text from a sample text-based PDF

[x] **16.3 — OCR extractor for images**
   - Create `src-tauri/src/extraction/ocr.rs`
   - Function: `extract_image_text(path: &Path) -> Result<String>`
   - Use `leptess` with `eng` language data
   - Support: JPEG, PNG, TIFF
   - Done when: `cargo test` extracts text from a sample scanned image

[x] **16.4 — Extraction orchestrator**
   - Create `src-tauri/src/extraction/mod.rs`
   - Route by file extension: `.pdf` → pdf extractor; `.jpg`/`.jpeg`/`.png` → OCR
   - Store result in `documents.extracted_metadata` as JSON `{"text": "...", "extracted_at": "..."}`
   - Extraction runs async after upload (non-blocking)
   - Done when: uploading a PDF populates `extracted_metadata` within 5 s

[x] **16.5 — Tauri command: get extraction status**
   - Add `documents_get_extraction_status(id)` returning `{status: "pending"|"done"|"failed", text_length: usize}`
   - Done when: frontend can poll status

[x] **16.6 — F2 tests** — coverage ≥ 80% for extraction module

---

## Phase 17 — F3: Medical Category Hierarchy

[x] **17.1 — Rust category commands**
   - Create `src-tauri/src/commands/categories.rs`
   - Commands: `categories_list`, `categories_create`, `categories_update`, `categories_delete` (user-created only), `categories_assign_document`, `categories_assign_appointment`, `categories_unassign`
   - Done when: `cargo test` covers CRUD + assignment

[x] **17.2 — Category picker UI component**
   - Create `src/components/categories/CategoryPicker.tsx`
   - Multi-select with parent/child indentation
   - System categories shown first (not deletable); user categories below with delete button
   - Done when: component renders with mock data

[x] **17.3 — Wire categories to Documents**
   - Add category multi-select to `UploadDialog.tsx` and `DocumentDetail` page
   - Call `categories_assign_document` / `categories_unassign` on change
   - Done when: assigning a category to a document persists and reloads correctly

[x] **17.4 — Wire categories to Appointments**
   - Add category multi-select to `AppointmentForm.tsx`
   - Done when: assigning a category to an appointment persists

[x] **17.5 — F3 tests** — coverage ≥ 80%

---

## Phase 18 — F4: Apple Calendar Sync (macOS only)

[ ] **18.1 — Swift Tauri plugin scaffold**
   - Create `src-tauri/src/plugins/calendar/` with Swift source
   - Plugin: `myhealth-calendar-plugin`
   - Request `NSCalendarsUsageDescription` permission
   - Add `com.apple.security.personal-information.calendars` entitlement to `src-tauri/entitlements.plist`
   - Done when: `cargo build` compiles on macOS with plugin linked

[ ] **18.2 — List available calendars**
   - Swift function: `listCalendars() -> [[String: String]]` — returns `[{id, title, color}]`
   - Tauri command: `calendar_list_sources`
   - Done when: IPC returns user's calendar list on macOS

[ ] **18.3 — Sync selected calendars**
   - Swift function: `fetchEvents(calendarIds: [String], from: Date, to: Date) -> [[String: Any]]`
   - Tauri command: `calendar_sync(source_ids: Vec<String>)` — upsert into `calendar_events`
   - Sync window: 1 year back + 2 years forward
   - Done when: `calendar_sync` populates `calendar_events` from a real macOS calendar

[ ] **18.4 — Calendar settings UI**
   - Add "Calendar Sync" section to `src/app/settings/page.tsx`
   - List available calendars with toggle switches
   - "Sync Now" button; show last synced timestamp
   - Done when: toggling a calendar and syncing updates `calendar_sources.enabled` and populates events

[ ] **18.5 — F4 tests** — unit tests for sync logic; integration skipped on non-macOS CI

---

## Phase 19 — F5: Contact Auto-Creation from Documents

[ ] **19.1 — Rust clinic commands**
   - Create `src-tauri/src/commands/clinics.rs`
   - Commands: `clinics_list`, `clinics_create`, `clinics_update`, `clinics_delete`
   - Done when: `cargo test` passes CRUD

[ ] **19.2 — Doctor name extraction from metadata**
   - In `extraction/pdf.rs` and `extraction/ocr.rs`: extract candidate doctor names using regex patterns (e.g., `Dr\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+`)
   - Store in `extracted_metadata` JSON under key `"doctor_candidates": [...]`
   - Done when: `cargo test` extracts "Dr. John Smith" from a sample text

[ ] **19.3 — Duplicate detection**
   - Rust function: `find_similar_contact(name: &str, conn: &Connection) -> Option<Contact>`
   - Use Levenshtein distance ≤ 2 for fuzzy match against existing contacts
   - Done when: "Dr. J. Smith" matches existing "Dr. John Smith"

[ ] **19.4 — Auto-creation suggestion UI**
   - After document upload + extraction: if `doctor_candidates` present and no existing contact matches, show banner: "Create contact for Dr. X?"
   - User can accept (opens pre-filled `ContactForm`) or dismiss
   - Done when: banner appears and pre-fills form correctly

[ ] **19.5 — F5 tests** — coverage ≥ 80%

---

## Phase 20 — F6: Document–Appointment Linking + Timeline v2

[ ] **20.1 — Rust link commands**
   - Create `src-tauri/src/commands/links.rs`
   - Commands: `links_create(document_id, appointment_id, link_type)`, `links_delete(id)`, `links_list_for_document(document_id)`, `links_list_for_appointment(appointment_id)`
   - Done when: `cargo test` passes CRUD

[ ] **20.2 — Link scoring engine**
   - Rust function: `score_link_candidates(doc: &Document, appointments: &[Appointment]) -> Vec<(AppointmentId, u8)>`
   - Scoring: date within ±3 days (+3), doctor name match (+3), shared category (+2), shared clinic (+2)
   - Return candidates with score ≥ 4, sorted descending
   - Done when: `cargo test` verifies scoring logic

[ ] **20.3 — Link suggestion on upload**
   - After upload + extraction: call `score_link_candidates`; surface top suggestion as dismissible card
   - User confirms → `links_create` with `confidence = 'auto'`
   - User dismisses → no link created
   - Done when: uploading a blood-test PDF near a recent appointment surfaces the suggestion

[ ] **20.4 — Manual link UI in Document Detail**
   - Add "Linked Appointments" section to `src/app/documents/[id]/page.tsx`
   - Search & select appointments; call `links_create` with `confidence = 'manual'`
   - Done when: user can manually link/unlink

[ ] **20.5 — Timeline v2 — condition/doctor views**
   - Refactor `src/app/timeline/page.tsx`:
     - Add view toggle: Chronological | By Category | By Doctor
     - "By Category" groups events under category names with color swatch
     - "By Doctor" groups events under contact name
     - Each group shows: documents list, appointments list, linked items highlighted
   - Done when: all three views render with live data

[ ] **20.6 — Condition color highlighting**
   - Use `categories.color_hex` to tint timeline group headers and event badges
   - Color picker in category edit form
   - Done when: changing a category color updates the timeline in real time

[ ] **20.7 — F6 tests** — coverage ≥ 80%

---

## Phase 21 — Integration, QA & Release v1.1.0

[ ] **21.1 — End-to-end smoke test**
   - Manual walkthrough:
     1. Upload `BloodTest_01Dec2024_NHS.pdf` → verify date parsed, tags extracted
     2. PDF text extracted → confirm metadata populated
     3. Assign "Lab Results" category
     4. Sync a macOS calendar → confirm events appear
     5. Link document to a recent appointment (auto-suggestion)
     6. View Timeline "By Category" — confirm "Lab Results" group shows document + appointment
     7. Add clinic; create doctor contact with clinic assignment
   - Done when: all 7 steps pass without errors

[ ] **21.2 — Performance check**
   - OCR on a 5-page scanned PDF must complete in < 30 s
   - Timeline "By Category" with 100+ events must render in < 500 ms
   - Done when: both thresholds met

[ ] **21.3 — CI green**
   - All GitHub Actions checks pass on `develop` branch
   - Done when: `gh run list --branch develop` shows latest run green

[ ] **21.4 — Bump version & tag v1.1.0**
   - Update `package.json` and `src-tauri/tauri.conf.json` version to `1.1.0`
   - `git tag v1.1.0 && git push origin v1.1.0`
   - Done when: tag exists on remote

[ ] **21.5 — Verify GitHub Release v1.1.0**
   - Confirm 4 artifacts uploaded: `aarch64.dmg`, `x64.dmg`, `x64_en-US.msi`, `amd64.AppImage`
   - Done when: all 4 confirmed in GitHub Releases page

---

## Quick Reference

| Concern | File |
|---------|------|
| v1.0 MVP plan | `PLAN.md` |
| Feature requirements | `docs/PRD.md` |
| DB schema & IPC | `docs/ARCHITECTURE.md` |
| All screen layouts | `docs/WIREFRAMES.md` |
| CI/CD pipeline | `.github/workflows/` |
| **Where to resume** | **This file — find ▶** |
