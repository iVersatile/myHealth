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

### F5 — Clinics

| ID | Feature | Status |
|---|---|---|
| F5.1 | Clinic record: name, company registration number, multi-address (`clinic_addresses` table) | ✅ |
| F5.2 | Clinic ↔ Contact linking (clinic employs contacts) | ✅ |
| F5.3 | Clinic tree view on `/clinics` page (clinics table unified) | ✅ |

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

---

## 7. Backup Index

| File | Content | Backed up as |
|---|---|---|
| PRD.md (v1.0) | MVP feature set F1–F8 | `docs/PRD_v1.0_backup.md` |
| PRD_V2.md (v1.1) | Intelligent parsing, OCR, hierarchical categories, Apple Calendar, contact auto-creation, doc-appt linking | `docs/PRD_v1.1_backup.md` |
| PRD_V3.md (v1.3) | V3-F1 through V3-F9 (all now shipped) | `docs/PRD_v1.3_backup.md` |
| PRD_V4.md | LLM-assisted extraction (post-MVP, deferred) | `docs/PRD_v4_backup.md` |
