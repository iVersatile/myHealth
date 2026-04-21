# Product Requirements Document — myHealth v1.1

## Executive Summary

myHealth v1.1 introduces six new features that significantly enhance document management, data integration, and appointment tracking capabilities. The application remains local-first and offline-only, with all data encrypted at rest using SQLCipher AES-256.

**Release Target:** Q2 2026  
**Platform Support:** macOS 13+, Windows 10/11, Linux (AppImage)  
**Test Coverage Requirement:** 80% minimum

---

## User Personas

### Persona 1: Dr. Sarah Chen (45, General Practitioner)
- **Goals:** Maintain comprehensive patient history; quickly locate past lab results and appointment notes; sync with personal calendar
- **Pain Points:** Manual file naming; difficulty searching PDFs; scattered appointment data across multiple systems
- **Key Needs:** Fast document retrieval, OCR capability for scanned documents, calendar integration, robust search

### Persona 2: James Mitchell (38, Patient with Chronic Conditions)
- **Goals:** Organize medical records by condition; track appointment-to-test relationships; understand care patterns
- **Pain Points:** Overwhelming number of documents; unclear which tests relate to which appointments; redundant contact data
- **Key Needs:** Smart categorization, document-appointment linking, contact deduplication, offline access

### Persona 3: Lisa Patel (52, Medical Records Manager)
- **Goals:** Ensure data accuracy; quickly identify duplicate contacts; bulk-manage documents and categories
- **Pain Points:** Time-consuming data entry; manual categorization; no hierarchical structure for complex conditions
- **Key Needs:** Hierarchical categories, intelligent duplicate detection, batch operations, audit trail

---

## Feature Requirements

### F1: Intelligent Filename Parsing

**Description:** Automatically extract metadata from document filenames and populate corresponding fields.

| Requirement ID | Requirement | Priority | Details |
|---|---|---|---|
| F1.1 | Date recognition from filename | MUST | Parse multiple date formats (DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, text month names). Default extract is `document_date`. |
| F1.2 | Year-only recognition | SHOULD | If full date unavailable, extract year and tag as `[year]` (e.g., `[2024]`). |
| F1.3 | Test type detection | SHOULD | Recognize common test names (Blood Work, CBC, Lipid Panel, etc.) and auto-tag. |
| F1.4 | Clinic/provider name extraction | COULD | Attempt to match clinic names against existing database records. |
| F1.5 | Case-insensitive matching | MUST | All pattern matching must be case-insensitive. |

**Acceptance Criteria (Gherkin Format):**
```gherkin
Feature: Filename Metadata Extraction
  Scenario: Upload document with standard filename format
    Given a document named "Blood_Work_15-12-2023.pdf"
    When the upload dialog parses the filename
    Then the document_date field is auto-populated with 2023-12-15
    And a tag "Blood Work" is suggested

  Scenario: Upload document with year-only date
    Given a document named "Lab_Results_2023.pdf"
    When the upload dialog parses the filename
    Then document_date is set to 2023-01-01
    And a tag "[2023]" is added

  Scenario: Multiple date formats are recognized
    Given documents with filenames:
      | Filename |
      | Report_01-05-2024.pdf |
      | Report_2024-05-01.pdf |
      | Report_May_01_2024.pdf |
    When uploaded
    Then all three dates resolve to 2024-05-01
```

**Performance Target:** < 100ms per filename parse  
**Implementation Scope:** Frontend (Next.js) + Tauri command

---

### F2: PDF Text Extraction & OCR

**Description:** Extract text from PDFs and apply OCR to scanned documents; support both native and image-based PDFs.

| Requirement ID | Requirement | Priority | Details |
|---|---|---|---|
| F2.1 | Native PDF text extraction | MUST | Use `pdf-extract` crate; extract text and preserve structure. |
| F2.2 | OCR for scanned documents | MUST | Use Tesseract (`leptess` crate) on image-based PDFs; triggered if native extraction yields < 50% text. |
| F2.3 | Async extraction pipeline | MUST | Extract runs in background Tauri command; UI shows progress bar with estimated time. |
| F2.4 | OCR timeout handling | SHOULD | OCR per-page max 10s; skip pages exceeding timeout with warning. |
| F2.5 | Extracted text caching | SHOULD | Cache extracted text alongside document; reuse on next view. |
| F2.6 | Searchable index integration | MUST | Extracted text immediately indexed in SQLite FTS5. |

**Acceptance Criteria (Gherkin Format):**
```gherkin
Feature: PDF Text Extraction and OCR
  Scenario: Upload native PDF document
    Given a PDF with embedded text
    When uploaded
    Then text is extracted synchronously within 500ms
    And is immediately searchable

  Scenario: Upload scanned (image-based) PDF
    Given a 5-page scanned PDF
    When uploaded
    Then OCR is triggered
    And progress updates every 2 seconds
    And estimated completion time is displayed
    And completed within 30 seconds total

  Scenario: OCR timeout on difficult page
    Given a scanned PDF with one illegible page
    When OCR is applied
    Then that page is flagged with "[OCR_TIMEOUT]"
    And remaining pages are processed normally
```

**Performance Target:** 
- Native PDF: < 500ms for 10 pages
- OCR: < 30s for 5 pages  
- FTS5 indexing: < 200ms for 10,000 words

**Implementation Scope:** Rust backend (pdf-extract, leptess) + Tauri command + FTS5

---

### F3: Hierarchical Categories with Many-to-Many Linking

**Description:** Organize documents and appointments into nested category trees with flexible many-to-many relationships.

| Requirement ID | Requirement | Priority | Details |
|---|---|---|---|
| F3.1 | Category tree structure | MUST | Support parent-child relationships; depth limit 5 levels. |
| F3.2 | Many-to-many documents-categories | MUST | Single document can belong to multiple categories; single category contains multiple documents. |
| F3.3 | Many-to-many appointments-categories | MUST | Single appointment linked to multiple categories; single category contains multiple appointments. |
| F3.4 | Drag-to-organize | SHOULD | UI allows drag-drop reordering within hierarchy. |
| F3.5 | Bulk categorization | SHOULD | Select multiple documents/appointments; assign category in batch. |
| F3.6 | Category search filters | MUST | Quick-filter by single or multiple categories. |
| F3.7 | Auto-archive old categories | SHOULD | Archive categories with no documents/appointments for 12+ months. |

**Acceptance Criteria (Gherkin Format):**
```gherkin
Feature: Hierarchical Categories
  Scenario: Create nested category structure
    Given a root category "Cardiovascular"
    When a user adds subcategory "Hypertension"
    And adds sub-subcategory "2024 Treatment Plan"
    Then nesting depth is 3 and within limit

  Scenario: Link document to multiple categories
    Given a document "Cardiac_Ultrasound_2024.pdf"
    When linked to categories ["Cardiovascular", "Imaging", "2024 Medical Records"]
    Then document appears in all three category views
    And can be searched by any category tag

  Scenario: Bulk assign category to documents
    Given 12 untagged lab result documents
    When user selects all and assigns category "Lab Results"
    Then all 12 documents are linked
    And category shows count of 12
```

**Performance Target:** 
- Category tree render: < 200ms for 500 categories
- Bulk link operation: < 1s for 50 documents

**Implementation Scope:** Database schema + Rust commands + React component

---

### F4: Apple Calendar Integration (macOS)

**Description:** Sync health-related appointments with macOS Calendar and bi-directionally track changes.

| Requirement ID | Requirement | Priority | Details |
|---|---|---|---|
| F4.1 | Read calendar events | MUST | Query EventKit for user's selected calendars; import events matching health keywords. |
| F4.2 | Bi-directional sync | SHOULD | myHealth → Calendar (create events from appointments); Calendar → myHealth (detect new health-related events). |
| F4.3 | macOS permission request | MUST | Prompt for full access to Calendar (privacy setting); gracefully degrade if denied. |
| F4.4 | Event filtering by keyword | MUST | Allow user to define keywords (e.g., "doctor", "clinic", "lab") to identify health events. |
| F4.5 | Conflict resolution | SHOULD | If event modified in both systems, show merge dialog; user chooses winning version. |
| F4.6 | One-time sync import | MUST | Support initial bulk import of past events (last 24 months). |
| F4.7 | Platform isolation | MUST | Calendar sync disabled on Windows/Linux; graceful no-op messaging. |

**Acceptance Criteria (Gherkin Format):**
```gherkin
Feature: Apple Calendar Integration
  Scenario: First-time calendar permission request
    Given a macOS user opening myHealth for the first time
    When navigating to Settings > Calendar Sync
    Then a system dialog requests "Full Access" to Calendar
    And user can grant or deny

  Scenario: Sync health-related calendar events
    Given user has enabled calendar sync with keyword "doctor"
    And their Calendar app contains "Doctor Appointment - 2024-05-15"
    When sync is triggered
    Then event is imported as myHealth appointment
    And linked to appropriate contact

  Scenario: Windows user opens calendar sync settings
    Given a Windows 10 user
    When navigating to Settings > Calendar Sync
    Then message displays "Not available on Windows"
    And section is disabled
```

**Performance Target:** Initial sync < 5s for 100 events; ongoing polling every 5 minutes  
**Platform:** macOS 13+ only (gated at compile time or runtime check)

**Implementation Scope:** Rust EventKit bindings + Tauri command + Settings UI

---

### F5: Intelligent Contact Auto-Creation

**Description:** Automatically create clinic and provider contacts from document filenames and appointment metadata, with duplicate detection.

| Requirement ID | Requirement | Priority | Details |
|---|---|---|---|
| F5.1 | Clinic name extraction | MUST | Parse document filenames and appointment titles for clinic names; auto-create if new. |
| F5.2 | Provider name extraction | SHOULD | Extract provider names from documents; link to clinic. |
| F5.3 | Duplicate detection | MUST | Use Levenshtein distance (> 85% match) to detect duplicate contacts; prompt for merge. |
| F5.4 | Merge contacts | SHOULD | Consolidate duplicate contacts; update all referencing documents/appointments. |
| F5.5 | Manual override | MUST | User can assign document to existing clinic/provider, overriding auto-suggestion. |
| F5.6 | Clinic search | MUST | Quick search clinics by name or specialty. |

**Acceptance Criteria (Gherkin Format):**
```gherkin
Feature: Intelligent Contact Auto-Creation
  Scenario: Auto-create clinic from filename
    Given a document "Lab_Results_St_Marys_Hospital_2024.pdf"
    When parsed
    Then new contact "St Mary's Hospital" is suggested
    And can be accepted or discarded

  Scenario: Detect duplicate clinic with fuzzy match
    Given existing clinic "St Marys Hospital"
    And a document with "St Mary's Hospital" in filename
    When parsed
    Then system suggests merge (86% match)
    And displays merge confirmation dialog

  Scenario: Assign document to existing clinic manually
    Given unassigned document "Results.pdf"
    When user clicks "Assign Clinic"
    And selects "St Mary's Hospital" from dropdown
    Then document is linked to clinic
    And auto-suggestion is updated
```

**Performance Target:** 
- Duplicate detection: < 100ms for 1000 existing contacts (Levenshtein < 50ms)
- Auto-creation: < 200ms

**Implementation Scope:** Rust command (strsim crate for Levenshtein) + React component

---

### F6: Document-to-Appointment Link Scoring & Auto-Suggestion

**Description:** Intelligently link documents to appointments using a scoring engine; suggest relevant connections with threshold-based confidence.

| Requirement ID | Requirement | Priority | Details |
|---|---|---|---|
| F6.1 | Link scoring algorithm | MUST | Score based on: date proximity (±7 days = 0.5), clinic match (exact = 1.0, fuzzy > 85% = 0.7), text overlap in titles/extracted text (TF-IDF = 0.3 weight). |
| F6.2 | Threshold-based suggestions | MUST | Display suggestions only if total score ≥ 0.65. |
| F6.3 | User confirmation | MUST | All suggested links require explicit user approval before saving. |
| F6.4 | Batch linking | SHOULD | Select multiple documents; auto-link to single appointment. |
| F6.5 | Edit/remove links | MUST | User can modify or delete document-appointment links at any time. |
| F6.6 | Search by linked documents | MUST | Appointments show linked documents in sidebar; filter appointments by document presence. |

**Acceptance Criteria (Gherkin Format):**
```gherkin
Feature: Document-to-Appointment Link Scoring
  Scenario: Auto-suggest link with high confidence
    Given appointment "Blood Test - 2024-05-15 - St Mary's Hospital"
    And document "Blood_Work_Results_15-05-2024_StMarys.pdf" (uploaded 2024-05-16)
    When link scoring runs
    Then calculated score = 0.5 (date) + 1.0 (clinic) + 0.3 (text) = 1.8 (normalized to 0.86)
    And suggestion displayed with "86% confidence"
    And user can click "Link" or "Not Related"

  Scenario: Low-confidence suggestion is not displayed
    Given appointment "General Checkup - 2024-05-01"
    And document "Prescription_2024-06-15.pdf"
    When link scoring runs
    Then score < 0.65
    And no suggestion is displayed

  Scenario: Batch link documents to appointment
    Given appointment "Annual Physical - 2024-06-20"
    And 5 selected documents from that date
    When user selects "Link All to Appointment"
    Then each document is linked with individual confirmation
```

**Performance Target:** 
- Scoring: < 50ms per document-appointment pair
- Batch operation: < 500ms for 50 documents

**Algorithm Detail (Pseudocode):**
```
score = 0
score += date_proximity_score(doc.date, appointment.date)  # ±7 days
score += clinic_match_score(doc.clinic, appointment.clinic)
score += text_overlap_score(doc.text, appointment.notes)
normalized_score = min(score / 3.0, 1.0)
if normalized_score >= 0.65:
  display_suggestion(normalized_score)
```

**Implementation Scope:** Rust command (TF-IDF + scoring engine) + React UI for suggestions

---

## Non-Functional Requirements

| Category | Requirement | Target |
|---|---|---|
| **Performance** | Document upload + text extraction | < 30s for PDF ≤ 5 pages |
| **Performance** | Full-text search query latency | < 200ms for 50,000 indexed words |
| **Performance** | Category tree render | < 200ms for 500 categories |
| **Performance** | Calendar sync initial import | < 5s for 100 events |
| **Reliability** | Test coverage | ≥ 80% across all v1.1 features |
| **Reliability** | OCR failure recovery | Graceful timeout + retry on next upload |
| **Security** | Encryption | AES-256-GCM for all database fields |
| **Security** | Permission model | Explicitly request macOS Calendar access |
| **Usability** | Offline operation | 100% offline; no network calls |
| **Scalability** | Database size | Support 10,000+ documents without performance degradation |
| **Scalability** | Category depth | Max 5 levels; display < 200ms for 500 categories |
| **Accessibility** | Keyboard navigation | All features accessible via keyboard |
| **Accessibility** | Screen reader support | ARIA labels on all interactive elements |

---

## Feature Roadmap

### Phase 1 (v1.1.0) — MVP
- [x] F1: Intelligent filename parsing
- [x] F2: PDF text extraction & OCR
- [x] F3: Hierarchical categories (many-to-many)
- [x] F4: Apple Calendar integration (macOS)
- [x] F5: Contact auto-creation with duplicate detection
- [x] F6: Document-appointment link scoring

### Phase 2 (v1.2) — Enhancements
- [ ] Bulk categorization UI
- [ ] Advanced search filters (date range, category combination)
- [ ] Contact merge assistant
- [ ] Calendar conflict resolution UI
- [ ] Export to PDF summary reports

### Phase 3 (v1.3+) — Extended Features
- [ ] Outlook Calendar sync (Windows)
- [ ] Icalendar import/export
- [ ] AI-powered appointment notes summarization
- [ ] Medical code tagging (ICD-10)
- [ ] Multi-user vault support

---

## Acceptance Criteria Summary

All acceptance criteria for each feature are specified in the **Feature Requirements** section using Gherkin (Given-When-Then) format. A feature is **complete** when:

1. All MUST acceptance criteria pass
2. At least 80% of SHOULD criteria are implemented
3. Test coverage ≥ 80%
4. Performance targets are met
5. Code review approved
6. User acceptance testing completed

---

## Success Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| v1.1 Feature Adoption | 80% of users enable ≥ 1 new feature within 4 weeks | In-app telemetry (privacy-respecting logs only) |
| OCR Accuracy | ≥ 90% accuracy on test PDF set | Manual review of extracted text samples |
| Search Performance | < 200ms for typical query | Automated performance test |
| Calendar Sync Reliability | ≥ 99.5% sync success rate | Test sync with 1000 events |
| Contact Deduplication | ≥ 95% of true duplicates detected | Manual verification on test dataset |
| Test Coverage | ≥ 80% across all v1.1 code | Code coverage report |

---

## Compliance & Standards

- **Data Privacy:** Compliant with GDPR and HIPAA requirements; data never leaves device
- **Encryption:** NIST SP 800-38D (AES-GCM) for symmetric encryption
- **Text Extraction:** Tesseract 5.x (open-source OCR engine)
- **Accessibility:** WCAG 2.1 Level AA compliance for UI
- **Code Quality:** ESLint + TypeScript strict mode + 80% test coverage

---

## Dependencies & Risks

### Critical Dependencies
- **Tesseract 5.x:** Available on macOS, Windows, Linux (pre-bundled in Tauri)
- **pdf-extract crate:** Maintained; no active security issues
- **EventKit (macOS):** Apple framework; stable API
- **SQLCipher:** Proven AES-256 implementation; no known vulnerabilities

### Identified Risks
1. **OCR Accuracy Variance:** Scanned PDFs with poor quality may have low accuracy
   - *Mitigation:* Allow manual text correction; flag low-confidence extractions
2. **Calendar Permission Denial:** User may deny Calendar access
   - *Mitigation:* Graceful degradation; manual appointment entry always available
3. **Levenshtein Performance at Scale:** 10,000+ contacts may cause slowdowns
   - *Mitigation:* Implement lazy-loading; cache similarity scores
4. **Conflicting Document-Appointment Links:** Multiple valid interpretations
   - *Mitigation:* Display top-3 suggestions; require user confirmation

---

## Release Notes Template

### v1.1.0 — [Release Date]

**New Features:**
- Intelligent filename parsing with multi-format date recognition
- PDF text extraction and OCR with async background processing
- Hierarchical categories with many-to-many relationships
- Apple Calendar sync for macOS
- Intelligent contact auto-creation with duplicate detection
- AI-powered document-appointment link suggestions

**Performance Improvements:**
- FTS5 search optimizations
- Async extraction pipeline for large PDFs
- Lazy-loading for large category hierarchies

**Bug Fixes:**
- [To be populated during development]

**Known Limitations:**
- Calendar sync available on macOS 13+ only
- OCR accuracy varies based on PDF scan quality
- Maximum category nesting depth: 5 levels

