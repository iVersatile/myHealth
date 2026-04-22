# myHealth — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-04-19  
**Status:** Draft  

---

## 1. Overview

myHealth is a local-first, encrypted desktop application for managing personal health records. All data is stored on-device in an encrypted SQLite database. No cloud accounts, no subscriptions, no telemetry.

### 1.1 Problem Statement

Health records are scattered across emails, paper folders, hospital portals, and phone photos. When a doctor asks for history, patients struggle to retrieve the right document at the right time. Existing solutions require cloud accounts, subscriptions, or phone-only storage.

### 1.2 Goals

- Single source of truth for all personal health data
- Works offline, no internet required
- Data never leaves the device unless the user exports it
- Zero recurring cost after installation

### 1.3 Non-Goals (MVP)

- Cloud sync or multi-device support
- Sharing records with healthcare providers
- OCR / AI analysis of documents
- Mobile (iOS / Android) versions
- Insurance billing or claims management

---

## 2. User Personas

### Persona A — The Organised Adult (Primary)
Age 30–55. Manages their own health plus a family member's. Wants to find any document within 30 seconds. Comfortable with basic desktop software.

### Persona B — The Senior Patient
Age 60+. Has many specialists and chronic conditions. Primarily needs reminders and a simple list view. Not technical.

### Persona C — The Caregiver
Manages health records for an elderly parent or child with a chronic condition. Needs contacts, appointment history, and timeline.

---

## 3. Feature Requirements

### F1 — Document Management

| ID | Requirement |
|----|-------------|
| F1.1 | Upload files: PDF, JPG, PNG, HEIC, TIFF, DOCX |
| F1.2 | Auto-generate thumbnail for image types |
| F1.3 | Categorise: Diagnosis, Lab Result, Imaging, Prescription, Letter, Other |
| F1.4 | Add free-text notes to any document |
| F1.5 | Tag documents with user-defined tags |
| F1.6 | View PDF inline; open image fullscreen |
| F1.7 | Soft delete with 30-day trash and permanent delete |
| F1.8 | Display file size, upload date, category |
| F1.9 | Auto-extract document date from filename during upload (patterns: YYYY-MM-DD, YYYYMMDD, DD-Mon-YYYY) and pre-populate the document date field |
| F1.10 | Extract healthcare provider / doctor names from PDF text content during upload and present as labelled suggestions in the review step |
| F1.11 | Two-step upload UX: step 1 uploads the file and runs auto-extraction; step 2 presents extracted metadata (date, provider names, tags) for user review and edit before confirming |
| F1.12 | When a document date is auto-detected during upload, pre-populate a tag with the date value (e.g. `2024-03-15`) in the review step; user may remove before confirming |
| F1.13 | Suggest a medical category based on PDF text content analysis during the upload review step; displayed as a labelled suggestion that the user can accept or dismiss (does not override the category field automatically) |
| F1.14 | Auto-populate the document notes field with a brief plain-text content summary from PDF extraction during the upload review step; user may edit or clear before confirming |

### F2 — Appointments

| ID | Requirement |
|----|-------------|
| F2.1 | CRUD: create, read, update, delete appointments |
| F2.2 | Fields: title, doctor, clinic, specialty, date/time, duration, location, notes, status |
| F2.3 | Status: scheduled, completed, cancelled, missed |
| F2.4 | Link documents to an appointment |
| F2.5 | Calendar view (month) + list view |
| F2.6 | System notification reminder (15 min, 1 hour, 1 day before) |
| F2.7 | Recurring appointments (weekly / monthly) |

### F3 — Notes

| ID | Requirement |
|----|-------------|
| F3.1 | Rich-text editor (bold, italic, lists, headings) |
| F3.2 | Tag notes |
| F3.3 | Pin important notes |
| F3.4 | Link notes to appointments or documents |
| F3.5 | Note history / versions (last 10 saves) |

### F4 — Contacts

| ID | Requirement |
|----|-------------|
| F4.1 | Store: name, specialty, phone, email, clinic, address, notes |
| F4.2 | Role types: GP, Specialist, Dentist, Physio, Pharmacist, Hospital, Other |
| F4.3 | Link contact to appointments |
| F4.4 | Quick-copy phone / email |
| F4.5 | When doctor or clinic names are extracted from a document during upload, present a dismissible "Add to Contacts?" suggestion in the review step; if accepted, pre-fill the contact creation form with the extracted name; user may edit or cancel |

### F5 — Timeline

| ID | Requirement |
|----|-------------|
| F5.1 | Chronological view of all events (documents uploaded, appointments, notes) |
| F5.2 | Filter by type, date range, category |
| F5.3 | Group by month/year |
| F5.4 | Click event to open detail |

### F6 — Search

| ID | Requirement |
|----|-------------|
| F6.1 | Full-text search across documents (filename, notes, tags), appointments, notes, contacts |
| F6.2 | Results grouped by entity type |
| F6.3 | Highlight matched terms |
| F6.4 | Keyboard shortcut: Cmd/Ctrl+K |
| F6.5 | Filter results by type |

### F7 — PDF Export Bundle

| ID | Requirement |
|----|-------------|
| F7.1 | Select records to include in export |
| F7.2 | Generate a single PDF bundle: cover page, table of contents, embedded documents |
| F7.3 | Custom title and date range filter |
| F7.4 | Save to user-chosen location |

### F8 — Settings & Security

| ID | Requirement |
|----|-------------|
| F8.1 | Set master password (used to derive encryption key) |
| F8.2 | Change master password (re-encrypts database) |
| F8.3 | Auto-lock after N minutes of inactivity |
| F8.4 | Theme: light / dark / system |
| F8.5 | Data directory location (default: `~/.myHealth/`) |
| F8.6 | Export full backup (encrypted `.myhealth` archive) |
| F8.7 | Import backup |
| F8.8 | Wipe all data |

---

## 4. Non-Functional Requirements

### 4.1 Privacy & Security

- All data encrypted at rest: SQLCipher AES-256-CBC
- Key derived via PBKDF2 (SHA-512, 64,000 iterations)
- No network requests from the application
- No crash reporting, analytics, or telemetry
- No third-party SDKs with network access

### 4.2 Performance

- App startup (cold): < 2 seconds
- Document list render (1,000 items): < 500 ms
- Search response: < 200 ms for < 10,000 records
- File upload (50 MB PDF): < 3 seconds including thumbnail generation

### 4.3 Accessibility

- WCAG 2.1 AA compliance
- Full keyboard navigation
- Screen reader compatible (ARIA labels)
- Supports macOS and Windows system accessibility APIs via Tauri

### 4.4 Reliability

- Database transaction integrity (WAL mode)
- Graceful handling of corrupted files
- No data loss on crash (WAL ensures atomicity)

### 4.5 Platform

- macOS 13+ (Apple Silicon + Intel)
- Windows 10/11 (x64)
- Linux (Ubuntu 22.04+, AppImage) — best-effort support

---

## 5. Feature Roadmap

### Phase 1 — MVP (v1.0)

- Document upload/view (F1)
- Appointments CRUD (F2, no recurring)
- Notes (F3, no version history)
- Contacts (F4)
- Timeline (F5)
- Search (F6)
- Settings + password lock (F8.1–F8.5)
- GitHub Releases distribution

### Phase 2 — v1.1

- PDF Export Bundle (F7)
- Appointment reminders (F2.6)
- Recurring appointments (F2.7)
- Note version history (F3.5)
- Backup / restore (F8.6–F8.7)

### Phase 3 — v2.0

- OCR text extraction from images
- AI-powered document summarisation (local model, offline)
- Family profiles (multiple encrypted vaults)
- Medication tracker

---

## 6. Acceptance Criteria

### AC-Documents
- GIVEN a user uploads a 10 MB PDF, WHEN the upload completes, THEN the document appears in the list with correct category, thumbnail, and file size within 3 seconds.
- GIVEN a user deletes a document, WHEN they open Trash, THEN the document is visible and can be restored within 30 days.

### AC-Appointments
- GIVEN a user creates an appointment, WHEN the date arrives, THEN the system notification fires at the configured lead time.
- GIVEN a user views the calendar, THEN all appointments for that month are displayed with correct dates.

### AC-Search
- GIVEN a user types "blood" in the search bar, THEN results appear within 200 ms including any document, appointment, or note containing "blood".

### AC-Security
- GIVEN the app is locked, WHEN the correct password is entered, THEN the app unlocks within 1 second.
- GIVEN an attacker copies the database file, WHEN they attempt to open it without the password, THEN the file is unreadable.
