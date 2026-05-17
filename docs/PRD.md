# myHealth — Product Requirements Document (Consolidated)

**Version:** 2.0 (consolidated from v1.0, v1.1, v1.3, v4.0)
**Last updated:** 2026-05-09
**Status key:** ✅ Shipped · 🔶 Planned (Phase 46) · 🔷 Post-MVP/Deferred

---

## 1. Product Overview

myHealth is a local-first, offline-only desktop health records manager for macOS. All data is stored on-device in AES-256 encrypted SQLite (SQLCipher). There are no network calls, no telemetry, and no cloud sync.

**Distribution:** GitHub Releases (no App Store)
**Stack:** Tauri v2 (Rust) + Next.js 14 + TypeScript + Tailwind CSS + Zustand + SQLite/SQLCipher + FTS5

### Non-Functional Requirements

| Requirement | Target |
|---|---|
| Accessibility | WCAG 2.1 AA |
| Network access | None (offline-only, forever) |
| Encryption | AES-256 SQLCipher, key derived via PBKDF2-SHA512 from master password |
| Startup time | < 2 seconds |
| Search latency | < 200 ms |
| Test coverage | ≥ 80% before any phase is complete |
| Distribution | GitHub Releases only; no App Store |
| Telemetry | None — no analytics, no crash reporting, no external SDKs with network access |

---

## 2. Feature Catalogue

### F1 — Document Management

| ID | Feature | Status |
|---|---|---|
| F1.1 | Upload PDF/image documents via drag-and-drop or file picker | ✅ |
| F1.2 | Generate thumbnail for uploaded documents | ✅ |
| F1.3 | Assign one or more categories to a document | ✅ |
| F1.4 | Attach freeform notes to a document | ✅ |
| F1.5 | Tag documents with user-defined and auto-extracted tags | ✅ |
| F1.6 | View document in full-screen PDF/image viewer | ✅ |
| F1.7 | Soft-delete documents (move to Trash; restore or permanently delete) | ✅ |
| F1.8 | Auto-extract text from PDFs and index in FTS5 for full-text search | ✅ |
| F1.9 | Intelligent filename parsing: detect date, document type, provider from filename | ✅ |
| F1.10 | PDF text extraction pipeline (Rust pdfium); async progress indicator with OCR fallback | ✅ |
| F1.11 | OCR via Tesseract for scanned/image-only PDFs | ✅ |
| F1.12 | activity_date field: editable on document detail page; used as canonical event date | ✅ |
| F1.13 | Auto-extract tag candidates: type tag (invoice/receipt/bill), provider name, specialty keyword, activity_date, document title | ✅ |
| F1.14 | Category auto-creation from specialty keyword when suggestion accepted in upload dialog | ✅ |

### F2 — Appointments

| ID | Feature | Status |
|---|---|---|
| F2.1 | Create / edit / delete appointments | ✅ |
| F2.2 | Calendar view and list view of appointments | ✅ |
| F2.3 | Appointment reminders (macOS notifications) | ✅ |
| F2.4 | Recurring appointments | ✅ |
| F2.5 | Link documents to appointments | ✅ |
| F2.6 | Auto-create appointment from invoice/receipt/bill document upload (V3-F6) | ✅ |
| F2.7 | Auto-created appointment: `appt_date` includes `T00:00:00`; title editable; `status = completed` for invoices | ✅ |
| F2.8 | Merge view/edit appointment screens — single route with `isEditing` toggle state | ✅ |

### F3 — Notes

| ID | Feature | Status |
|---|---|---|
| F3.1 | Rich-text note editor (markdown or WYSIWYG) | ✅ |
| F3.2 | Tag notes | ✅ |
| F3.3 | Pin notes | ✅ |
| F3.4 | Link notes to documents or appointments | ✅ |
| F3.5 | Note edit history / version trail | ✅ |
| F3.6 | Auto-extract clinical notes from uploaded PDF text and pre-populate notes field in upload dialog (detect "Notes:", "Clinical Notes:", "Assessment:", "Plan:", "Impression:" section headers in OCR text) | 🔲 |
| F3.7 | Note content for uploaded documents follows four rules (evaluated in priority order, no char cap). Rule 1 (invoice — "invoice" in auto_tags): content = full document body text; title = "[date] Invoice - [clinic name]". Rule 2 (imaging — "Radiology" in auto_tags): content = full document body text; title = "[date] Diagnostic Imaging Report" (or "- [clinic name]" suffix when present). Rule 3 (clinical notes section found): content = extracted clinical notes section; title = "[date] Clinical Notes - [clinic name]". Rule 4 (fallback): content = first consecutive non-empty lines joined with ", " up to ~120 chars; title = "[date] Document - [clinic name]". | 🔲 |
| F3.8 | Notes list default sort: pinned notes first, then by note_date (the `[DD Mon YYYY]` date parsed from the note title), then by created_at. Opening or editing a note must not change its position in the list. `note_date TEXT` column added to `notes` table; populated on create/update from title. | 🔲 |

### F4 — Contacts

| ID | Feature | Status |
|---|---|---|
| F4.1 | Store contacts: name, role, phone, email, address | ✅ |
| F4.2 | Contact roles: GP, specialist, physiotherapist, etc. | ✅ |
| F4.3 | Link contacts to appointments | ✅ |
| F4.4 | Quick-copy contact details | ✅ |
| F4.5 | Contact suggestion banner in upload dialog (auto-creation from extracted provider name) | ✅ |
| F4.6 | Contact auto-creation: UK phone regex `07XXX XXXXXX`, save flow, Levenshtein dedup | ✅ |
| F4.7 | Doctor name lifecycle: `ApptSuggestionBanner` with editable `doctor_name` + "No doctor" checkbox; `DoctorSuggestionBanner` follow-up "Yes, keep name" / "No, it's a service" | ✅ |
| F4.8 | Contact extraction: match ALLCAPS-surname names without title prefix (e.g. "Mary Margaret MURPHY") — requires 2+ Title-case words before ALLCAPS surname to avoid false positives | 🔲 |
| F4.9 | Contact extraction: match GP/role-labelled names (e.g. "GP: Vaibhav SHARMA", "Consultant: James BROWN") via role-label prefix pattern | 🔲 |
| F4.10 | Contacts list default sort: alphabetical by name at all times. Opening a contact detail or upserting a contact in the store must not change its list position. After any upsert the in-memory array is re-sorted by name. | 🔲 |

### F5 — Clinics

| ID | Feature | Status |
|---|---|---|
| F5.1 | Clinic record: name, company registration number, multi-address (`clinic_addresses` table) | ✅ |
| F5.2 | Clinic ↔ Contact linking (clinic employs contacts) | ✅ |
| F5.3 | Clinic tree view on `/clinics` page (clinics table unified) | ✅ |
| F5.4 | Clinic phone + email auto-extraction: supplemental OCR pass on JPEG images embedded in PDFs (via `pdfimages -j` + Tesseract) when phone/email absent from text layer; phone and email surfaced on clinic suggestion card in upload review step | 🔲 |
| F5.5 | Clinic name extraction: scan the last 30% of document text first (footer/letterhead region) before falling back to full-text scan; this captures clinic names that appear only at the end of medical reports (e.g. "Cleveland Clinic" in footer). | 🔲 |
| F5.6 | Clinic rename cascade: when a clinic's name is updated via `clinics_update`, all dependent `documents.clinic_name` and `appointments.clinic_name` text fields are updated atomically in the same transaction so clinic↔document and clinic↔appointment links are preserved. | 🔲 |
| F5.7 | Clinic name extraction — header-zone heuristic + NHS/hospital suffix support: (a) scan the first 10–15 lines of OCR text for a short (≤6 words) line that resembles an institutional name — ALL-CAPS or Title-Case, optionally containing `&`, no digits — to capture bare abbreviations like "RB&HH" that have no company suffix or clinic-type keyword; (b) extend the company-suffix regex to also match lines ending with "Hospital", "NHS Trust", "NHS Foundation Trust", "Health Centre", "Medical Centre", "Infirmary" alongside existing Ltd/plc/LLP. Header-zone scan is tried third (after `first_clinic` and `extract_clinic_name_by_company_suffix`) within the OCR fallback path. | 🔲 |
| F5.8 | Draft entity deduplication: when a draft contact or clinic has a non-null `merge_candidate_id`, the draft review UI surfaces a "Possible duplicate" warning badge showing the existing record's name. The user is offered two explicit actions: "Merge with existing" (calls `merge_draft_entity` with draft-wins field defaults) and "Create as new" (calls `accept_draft_entity`). No silent auto-merge; user always decides. | 🔲 |

### F6 — Timeline

| ID | Feature | Status |
|---|---|---|
| F6.1 | Chronological timeline view of all health events (documents, appointments, notes, symptoms, medications) | ✅ |
| F6.2 | Filter timeline by entity type | ✅ |
| F6.3 | Group by date or entity type | ✅ |
| F6.4 | "By Uploaded Date" vs "By Activity Date" tabs | ✅ |
| F6.5 | Click-to-detail from timeline card | ✅ |
| F6.6 | Timeline filter by doctor/contact (timeline-by-doctor view) | ✅ |

### F7 — Search

| ID | Feature | Status |
|---|---|---|
| F7.1 | FTS5 full-text search across all document text | ✅ |
| F7.2 | Unified content search: documents, notes, symptoms, medications in one results page | ✅ |
| F7.3 | Results grouped by entity type with type badge | ✅ |
| F7.4 | Keyword highlight in results | ✅ |
| F7.5 | Cmd+K global search trigger | ✅ |
| F7.6 | **Filter results by entity type** — chip row: All / Document / Note / Symptom / Medication | 🔶 Phase 46 |
| F7.7 | **Filter results by date range** — From / To date inputs, server-side filtering | 🔶 Phase 46 |
| F7.8 | Summary bar reflects filtered count ("4 of 12 results — 4 Documents") | 🔶 Phase 46 |

### F8 — PDF Export Bundle

| ID | Feature | Status |
|---|---|---|
| F8.1 | Select records for export | ✅ |
| F8.2 | Generate PDF bundle from selected records | ✅ |
| F8.3 | Filter by title and date range for export | ✅ |
| F8.4 | Save PDF bundle to user-chosen location | ✅ |

### F9 — Settings & Security

| ID | Feature | Status |
|---|---|---|
| F9.1 | Master password setup and change | ✅ |
| F9.2 | Auto-lock after inactivity | ✅ |
| F9.3 | Theme: light / dark / system | ✅ |
| F9.4 | Data directory configuration | ✅ |
| F9.5 | Backup (export encrypted archive) | ✅ |
| F9.6 | Restore from backup | ✅ |
| F9.7 | Wipe all data | ✅ |
| F9.8 | iCalendar export of appointments | ✅ |

### F10 — Symptoms & Medications

| ID | Feature | Status |
|---|---|---|
| F10.1 | Log symptoms with date, severity, notes | ✅ |
| F10.2 | Log medications with dose, frequency, start/end dates | ✅ |
| F10.3 | Symptoms and medications indexed in FTS5 and appear in content search | ✅ |

### F11 — Trash

| ID | Feature | Status |
|---|---|---|
| F11.1 | Trash screen at `/trash` showing soft-deleted items | ✅ |
| F11.2 | Restore individual items from Trash | ✅ |
| F11.3 | Permanently delete individual items from Trash | ✅ |
| F11.4 | Empty Trash (permanently delete all) | ✅ |
| F11.5 | "Moved to Trash" toast on all delete actions | ✅ |

---

## 3. V3 Feature Detail (All Shipped)

### V3-F1 — Category Auto-Creation
When user accepts a specialty suggestion in the upload dialog, the category is automatically created if it does not exist. Previously required manual creation first.

### V3-F2 — Contact Auto-Creation
- Extracts contact name and phone from PDF text using regex (UK format `07XXX XXXXXX`)
- Presents "Save as contact?" banner in upload dialog
- Levenshtein deduplication prevents duplicate contacts
- Save flow: name, role, phone pre-populated; user confirms

### V3-F3 — Clinic Data Model
- Clinics stored in unified `clinics` table
- `clinic_addresses` join table for multi-location clinics
- Company registration number field
- Clinic ↔ Contact linking via `clinic_contacts` join table
- Tree view on `/clinics` page showing clinic → address → contacts hierarchy

### V3-F4 — Tag Auto-Extraction Rules
Tags auto-populated on upload from extracted text:
1. **Type tag:** invoice / receipt / bill (from keyword scan)
2. **Provider name:** extracted from letterhead / signature block
3. **Specialty keyword:** e.g. "physiotherapy", "cardiology"
4. **Activity date:** formatted `YYYY-MM-DD`
5. **Document title:** extracted without "title:" prefix

### V3-F5 — Timeline Activity Date
- Timeline uses `activity_date` (not upload date) as primary sort key
- Two tabs: "Chronological" (by activity_date) and "By Uploaded Date"
- `activity_date` editable on document detail page

### V3-F6 — Auto-Appointment from Invoice
When a document upload is classified as invoice/receipt/bill:
- Auto-creates a linked appointment
- `appt_date` = extracted `activity_date` + `T00:00:00` suffix
- Title pre-filled from document title (editable in `ApptSuggestionBanner`)
- `status = completed` (invoice implies past event)

### V3-F7 — Merged View/Edit Appointment Screen
Single route `/appointments/[id]` with `isEditing` boolean state. No separate `/edit` route. Edit button toggles inline edit mode.

### V3-F8 — Clinic Tree View
Clinics page shows tree: Clinic → Addresses → Associated Contacts. Implemented as unified `clinics` table with tree view component.

### V3-F9 — Doctor Name Lifecycle
Two-step banner flow:
1. **ApptSuggestionBanner** (upload dialog): editable `doctor_name` field + "No doctor" checkbox
2. **DoctorSuggestionBanner** (post-upload): "Yes, keep name" / "No, it's a service" to confirm or dismiss extracted doctor attribution

### V3-F10 — Notes Auto-Extraction from PDF Text (Planned)
Auto-extract clinical notes section from uploaded PDF text and pre-populate notes field in the upload dialog confirm step.

**Detection:** Scan OCR/extracted text for section headers: "Notes:", "Clinical Notes:", "Assessment:", "Plan:", "Impression:". Capture text from matched header to the next recognised header or end of document.

**UX:** Pre-fill the notes textarea in the upload dialog with the extracted clinical text (editable before save). If no headers found, leave the field empty.

**Files to change:**
- `src-tauri/src/extraction/` — new `extract_clinical_notes(text: &str) -> Option<String>` function
- `src-tauri/src/commands/documents.rs` — return `clinical_notes` in `ExtractionSuggestions`
- `src/components/documents/UploadDialog.tsx` — pre-fill notes textarea when `clinical_notes` is present

---

## 4. Post-MVP: LLM-Assisted Tag Extraction (Deferred)

> **Status: 🔷 Deferred — Post-MVP**

On-device LLM (llama.cpp, Mistral 7B Q4 or Phi-3 Mini) to enhance tag and entity extraction beyond regex heuristics.

**Constraints:**
- Model ≤ 4 GB on disk
- Extraction ≤ 10 seconds per document
- Zero network traffic — model and inference fully local
- Opt-in toggle in Settings (default: off)
- Graceful degradation: if model unavailable, silently falls back to regex extraction
- JSON schema validation on all LLM output before use

**Scope of extraction:**
- Document type classification (more nuanced than keyword scan)
- Provider entity recognition
- Medication name + dose extraction from prescription scans
- Symptom phrase extraction from consultation letters

**Trigger for promotion to MVP:** User feedback indicates regex heuristics miss > 20% of provider names or medication doses in real-world documents.

---

## 4. F9 — Batch Document Upload with Draft Entity Flow (v1.5)

### Overview

Users upload multiple documents at once (or single documents via the same pipeline). Every extracted entity — tags, appointments, contacts, clinics, symptoms, medications — is saved as a *draft* requiring explicit human acceptance before promotion to main data. Failed documents roll back independently; other documents in the batch are unaffected.

### User Story

> "As a user with a backlog of medical documents, I want to upload 30 PDFs at once and have the app extract all entities automatically, then review and accept or reject each on my own schedule — without extraction blocking my workflow."

---

### F9.1 — Batch Upload UI

- Multi-file picker (Ctrl/Cmd+click multi-select)
- Folder / directory select
- Drag-and-drop zone accepting multiple files simultaneously
- Per-file progress indicator: `Queued → Processing → Done / Failed`
- Failed files display error inline; remaining files continue uninterrupted
- `data-testid="batch-upload-zone"`

---

### F9.2 — Draft Entity Schema

**New column on entity tables:**

| Table | New column |
|-------|-----------|
| `contacts` | `is_draft BOOLEAN NOT NULL DEFAULT 0` |
| `clinics` | `is_draft BOOLEAN NOT NULL DEFAULT 0` |
| `appointments` | `is_draft BOOLEAN NOT NULL DEFAULT 0` |
| `symptoms` | `is_draft BOOLEAN NOT NULL DEFAULT 0` |
| `medications` | `is_draft BOOLEAN NOT NULL DEFAULT 0` |
| `document_tags` (join) | `is_draft BOOLEAN NOT NULL DEFAULT 0` |

Tag label rows in the `tags` table are **not** flagged — the tag label may already exist; the *association* (`document_tags` row) is what is draft.

**New column on `documents` table:**

| Column | Type | Purpose |
|--------|------|---------|
| `batch_upload_id` | `TEXT` | UUID generated per upload session; single upload = batch of 1 |

All existing rows default to `is_draft = 0` — no regression. Migration via `ALTER TABLE ... ADD COLUMN`.

---

### F9.3 — Draft Entity Pipeline (Upload)

- After OCR + extraction, all entities saved with `is_draft = TRUE`
- Applies to **both** single upload and batch upload (same code path)
- **Per-document transaction:** `BEGIN TRANSACTION` before saving document + entities; `ROLLBACK` on any OCR or extraction failure for that document; other documents in the batch are unaffected
- **Duplicate handling:** if extracted entity closely matches an existing non-draft entity (same name / phone / CRN match), create the draft entity and set `merge_candidate_id = <existing entity id>`; do not auto-merge
- `batch_upload_id` UUID stamped on all documents in the same upload session

---

### F9.4 — Draft Entity Review UI

Draft items appear **inline** on each existing entity page:

- Contacts, Clinics, Appointments, Symptoms, Medications pages
- Draft items: dashed border + **DRAFT** badge, listed in a "Drafts" subsection above main list
- Count banner at page top: _"3 draft items awaiting review"_ (hidden when zero drafts)
- Tags: draft associations shown on document detail page with **DRAFT** badge per tag chip

**Per-entity actions:**

| Action | Behaviour |
|--------|-----------|
| **Accept** | `UPDATE SET is_draft = 0` — promotes entity to main data |
| **Reject** | Soft-delete (same as existing Trash flow; recoverable) |
| **Merge** | Shown when `merge_candidate_id` set — absorbs draft into existing record; draft row deleted |

---

### F9.5 — Non-regression Constraints

- All existing queries filter `WHERE is_draft = 0` (or `is_draft IS NULL`) by default
- Draft entities excluded from: document list, timeline, content search (FTS5), calendar, all aggregates
- Draft entities do **not** appear in suggestion banners (DoctorSuggestionBanner, ApptSuggestionBanner)
- Trash / soft-delete flow unchanged for non-draft entities

---

### Acceptance Criteria

| # | Scenario | Expected |
|---|----------|----------|
| AC-1 | Select 5 PDFs → batch upload | All 5 extracted; all entities appear with DRAFT badge on entity pages |
| AC-2 | Simulate 1 OCR failure in batch of 5 | Failed doc absent; 4 committed with drafts; no orphan entities from failed doc |
| AC-3 | Accept draft contact | Contact appears normally in Contacts list; no DRAFT badge |
| AC-4 | Reject draft appointment | Appointment soft-deleted; visible in Trash |
| AC-5 | Merge draft contact with merge_candidate | Draft absorbed; no duplicate in Contacts |
| AC-6 | Search / timeline with pending drafts | Draft entities absent from all results |
| AC-7 | Single upload | Same draft flow; `is_draft = 1` on all extracted entities |
| E2E | `e2e/batch-upload.spec.ts` | All ACs covered |

---

## 5. Phase 46 Detail — Content Search Filters

> **PRD reference:** F7.6, F7.7, F7.8 above

**Goal:** Add entity-type filter chips and optional date range to `/content-search`. Extend `content_search` Rust command to accept `entity_types`, `date_from`, `date_to` optional params.

**Acceptance criteria:**
- Filter chips: All | Document | Note | Symptom | Medication — clicking re-queries server-side
- Date range: From + To `<input type="date">` fields; clear button
- Summary bar: "4 of 12 results — 4 Documents" when filtered; original format when unfiltered
- Backward compat: no params = current behaviour preserved
- Tests: Rust unit (filter SQL logic) + frontend unit (chip interaction) + E2E (chip → result count changes)

**Files to change:**
- `src-tauri/src/commands/search.rs` — extend command signature and SQL
- `src/app/(app)/content-search/page.tsx` — chips + date range UI
- `src/app/(app)/content-search/__tests__/content-search-filters.test.tsx` — new unit test
- `e2e/content-search-filters.spec.ts` — new E2E spec

---

## 6. User Test Feedback Log

| ID | Feedback | Resolution | Status |
|---|---|---|---|
| UTF-01 | Tags not auto-populated from document content | V3-F4 tag auto-extraction implemented | ✅ |
| UTF-02 | Category not suggested during upload | V3-F1 category auto-creation from specialty keyword | ✅ |
| UTF-03 | Contact not suggested during upload | V3-F2 + F4.5 contact suggestion banner | ✅ |
| UTF-04 | Appointment title used wrong specialty / patient listed as doctor | V3-F9 doctor name lifecycle banners | ✅ |
| UTF-05 | Specialty tag missing from document after upload | V3-F4 specialty keyword tag extraction | ✅ |
| UTF-06 | Clinic address extraction fails on "London Clinic" style PDFs | Improved address regex in Rust extraction | ✅ |
| UTF-07 | Upload dialog shows no clinical notes from "Upload (30Jan2023-17_52_15).pdf" despite document containing Notes/Assessment/Plan sections | Missing requirement → F3.6 added; V3-F10 implementation planned | 🔲 |
| UTF-08 | Contact extraction missed untitled name (Mary Margaret MURPHY), GP-labelled name (GP: Vaibhav SHARMA), and phone "+44 (0) 203 423 7500" partially matched | Implementation gaps → F4.8, F4.9; phone regex fix in contact.rs | 🔲 |
| UTF-09 | Evewell invoice upload yielded no clinic phone or email — footer "T 020 3974 0950 \| E info@evewell.com" is baked into an embedded JPEG; pdftotext cannot see it and OCR_DENSITY_THRESHOLD is not triggered because the text layer is dense enough | Missing requirement → F5.4 added; Phase 116 supplemental OCR pass planned | 🔲 |
| UTF-10 | Note content showed full invoice line including price (e.g. "COVID-19 PCR Test  £120.00") instead of description only; non-invoice docs showed 3000-char raw text dump instead of brief first-line summary | Missing requirement → F3.7 added; Phase 117 smart note content rules planned | 🔲 |
| UTF-11 | Physio invoice (Upload 09Mar2023) note content was wrong — "INVOICE – NO: IoPM001" only, not full text; root cause: price regex `\d+\.\d{2}` doesn't match `£180` (no decimal). Rule 1 revised: detect via "invoice" auto-tag, use full body text (no cap) instead of stripped descriptions | Implementation gap → F3.7 revised; Phase 117 Rule 1 revised | 🔲 |
| UTF-12 | Diagnostic Imaging Report (Upload 30Jan2023) produced title "[date] Clinical Notes" and wrong content — imaging docs matched "Findings" clinical-notes header; note title should be "[date] Diagnostic Imaging Report" and content = full body text. Missing Rule 2: detect via "Radiology" auto_tag (set when "mri"/"ct scan"/"ultrasound" found in text), insert before clinical-notes check | Missing requirement → F3.7 updated to 4 rules; Phase 117 Rule 2 added | 🔲 |

---

## 8. Pre-Release E2E Acceptance Test Cases (v1.9 gate)

> **Purpose:** These 3 real-PDF upload scenarios must pass as automated E2E tests before the v1.9 tag. Each test injects pre-extracted OCR text into the Tauri mock (hybrid OCR strategy) so Tesseract is not required in CI, but the full entity-extraction and draft-creation pipeline runs against real data.

### Case 1 — Single Invoice: auto-tags + appointment + contact/clinic

**Fixture PDF:** `ecg-invoice-london-clinic-2023.pdf`

**Content summary:**
- Invoice for an ECG test at London Clinic
- Invoice date: 10 December 2023
- Service/appointment date: 23 November 2023
- Doctor is new (not in DB); specialty: cardiology

**Upload flow:** Single-file upload, category = `Medical Invoice`

**Expected outcomes:**
| # | Outcome | Detail |
|---|---------|--------|
| 1 | Document created | `category = "Medical Invoice"` |
| 2 | Tags from filename | Date tag from upload timestamp in filename |
| 3 | Tags from content | `ecg`, `cardiology`, `london clinic`, doctor name, invoice date |
| 4 | Draft contact created | New doctor with `is_draft = 1` |
| 5 | Draft clinic created | "London Clinic" with `is_draft = 1` |
| 6 | Appointment suggestion | Date 23 Nov 2023 surfaced in UploadDialog banner |
| 7 | User accepts appointment | Appointment created with `activity_date = 2023-11-23` |
| 8 | Draft contact visible | Contacts list shows draft card with Accept/Edit/Reject |
| 9 | Accept contact | `is_draft` set to `FALSE` |

---

### Case 2 — GP Notes: auto-tags + appointment + contact/clinic + notes entry

**Fixture PDF:** `gp-notes-sharma-2023.pdf`

**Content summary:**
- GP letter from an existing GP (already in DB)
- Contains appointment date in document body
- Includes Assessment / Plan sections for a notes entry

**Upload flow:** Single-file upload, category = `GP Notes`

**Expected outcomes:**
| # | Outcome | Detail |
|---|---------|--------|
| 1 | Document created | `category = "GP Notes"` |
| 2 | Tags from content | Date, specialty, GP name |
| 3 | No duplicate contact | Existing GP matched; no new draft contact |
| 4 | Draft clinic created (if new) | `is_draft = 1` if not already in DB |
| 5 | Appointment suggestion | Date from document body surfaced |
| 6 | User accepts appointment | Appointment created, linked to document |
| 7 | Notes entry created | Note record linked to document with extracted Assessment/Plan text |

---

### Case 3 — Batch Upload (3 docs): draft appointments + contacts + clinics + symptoms + medications

**Fixture PDFs (3 files):**

| File | Content |
|------|---------|
| `skin-invoice-2023.pdf` | Invoice from a new skin doctor at a new clinic; contains symptom description and medication prescription |
| `neurology-scan-letter-2019.pdf` | Letter from neurologist re: brain aneurysm scan on 21 Nov 2019; stable, no size change |
| `gynaecology-invoice-2023.pdf` | Invoice from a gynaecologist with 3 line items: consultation, smear test, medication |

**Upload flow:** Multi-file select, batch upload (all 3), category = `Medical Invoice`

**Contacts:** 2 new doctors (skin + gynaecologist); 1 existing neurologist already in DB

**Expected outcomes:**
| # | Outcome | Detail |
|---|---------|--------|
| 1 | 3 documents created | Each shares the same `batch_upload_id` |
| 2 | Skin invoice — draft contact | New skin doctor, `is_draft = 1` |
| 3 | Skin invoice — draft clinic | New dermatology clinic, `is_draft = 1` |
| 4 | Skin invoice — draft symptom | Symptom from content, `is_draft = 1` |
| 5 | Skin invoice — draft medication | Medication from content, `is_draft = 1` |
| 6 | Skin invoice — draft appointment | Service date from invoice, `is_draft = 1` |
| 7 | Neurology letter — tags | `aneurysm`, `imaging`, `neurology`, doctor name, clinic name, date |
| 8 | Neurology letter — draft appointment | Scan date 21 Nov 2019, `is_draft = 1` |
| 9 | Neurology letter — existing contact | Matched to existing DB record; no new draft |
| 10 | Gynaecology invoice — tags | `consultation`, `smear test`, `medication` as separate tags |
| 11 | Gynaecology invoice — draft contact | New gynaecologist, `is_draft = 1` |
| 12 | Gynaecology invoice — draft clinic | New clinic, `is_draft = 1` |
| 13 | Draft entities visible | All draft contacts/clinics/symptoms/medications show draft label + Accept/Edit/Reject |
| 14 | Accept one entity | `is_draft = FALSE`; entity appears in normal list |
| 15 | Reject one entity | Entity removed from DB |

---

### Hybrid OCR Strategy (all 3 cases)

Real PDF files used as fixtures. In E2E tests, Tesseract OCR is bypassed by injecting pre-extracted text via the Tauri invoke mock — the full Rust entity-extraction and draft-creation pipeline runs against the injected text. Production Tesseract behaviour is covered by manual smoke tests.

---

## 9. Implementation Gaps Identified (Audit 2026-05-12)

> **Source:** Audit of `documents_extract_suggestions` in `src-tauri/src/commands/documents.rs`

| Entity type | Auto-created as draft during OCR? | Gap |
|---|---|---|
| contacts | ✅ Yes | — |
| clinics | ✅ Yes | — |
| appointments | ✅ Yes — Phase 62 complete (`documents.rs` lines 2586–2611) | — |
| symptoms | ✅ Yes — Phase 62 complete (`documents.rs` lines 2643–2667) | — |
| medications | ✅ Yes — Phase 62 complete (`documents.rs` lines 2614–2641) | — |

---

## 7. Backup Index

| File | Content | Backed up as |
|---|---|---|
| PRD.md (v1.0) | MVP feature set F1–F8 | `docs/PRD_v1.0_backup.md` |
| PRD_V2.md (v1.1) | Intelligent parsing, OCR, hierarchical categories, Apple Calendar, contact auto-creation, doc-appt linking | `docs/PRD_v1.1_backup.md` |
| PRD_V3.md (v1.3) | V3-F1 through V3-F9 (all now shipped) | `docs/PRD_v1.3_backup.md` |
| PRD_V4.md | LLM-assisted extraction (post-MVP, deferred) | `docs/PRD_v4_backup.md` |
