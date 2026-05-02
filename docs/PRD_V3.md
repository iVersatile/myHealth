# Product Requirements Document — myHealth v1.3
# Document Upload Intelligence — Phase 2

**Date:** 2026-04-30  
**Version:** 3.0  
**Status:** Draft — Accepting Additional Feedback  
**Basis:** Manual smoke-test feedback from upload of "Upload (09Mar2023-16_31_26).pdf"

---

## Overview

This document captures requirements derived from real-world upload testing. Where PRD_V2 specified features at a high level, this document refines them with concrete expected behaviours observed (or missed) during manual testing.

All requirements in this document are additive to PRD_V2. Where they conflict, PRD_V3 takes precedence.

---

## Feature Areas

### V3-F1: Category Auto-Creation from Extracted Specialty

**Context:** Uploading "Upload (09Mar2023-16_31_26).pdf" (a physiotherapy invoice) failed to suggest or create a "PHYSIOTHERAPY" category, even though the specialty was extractable from the document body.

**Gap in PRD_V2:** UTFv1-02 fixed category *suggestion* as a dismissible banner. The requirement to *create* the category when accepted (if it does not already exist) was underspecified.

#### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| V3-F1.1 | When the user accepts a category suggestion in the upload dialog, the system MUST create the category if it does not already exist | MUST |
| V3-F1.2 | The suggested category name MUST be derived from the document specialty keyword (e.g. "PHYSIOTHERAPY", "CARDIOLOGY", "DERMATOLOGY") found in the PDF body, normalised to title-case (e.g. "Physiotherapy") | MUST |
| V3-F1.3 | If a case-insensitive match for the suggested category already exists, no duplicate must be created; the existing category MUST be reused | MUST |
| V3-F1.4 | After accepting, the new/existing category MUST be automatically assigned to the uploaded document | MUST |
| V3-F1.5 | The suggestion banner MUST display: category name, source (e.g. "Detected from document content"), and two actions: **Accept** and **Dismiss** | MUST |
| V3-F1.6 | If dismissed, the banner must not reappear for this upload session | MUST |

**Acceptance Criteria (Gherkin):**

```gherkin
Feature: Category Auto-Creation from Document Specialty

  Scenario: Physio invoice triggers PHYSIOTHERAPY category suggestion
    Given a PDF containing the keyword "PHYSIOTHERAPY" in the document body
    When the user uploads the document and reaches the review step
    Then a category suggestion banner is shown for "Physiotherapy"
    And the banner text includes "Detected from document content"

  Scenario: Accept suggestion creates new category and assigns it
    Given a category suggestion banner for "Physiotherapy"
    And no category named "Physiotherapy" exists
    When the user clicks "Accept"
    Then a new category "Physiotherapy" is created
    And the uploaded document is assigned to "Physiotherapy"
    And the banner is dismissed

  Scenario: Accept suggestion reuses existing category
    Given a category suggestion banner for "Physiotherapy"
    And a category named "Physiotherapy" already exists with id=42
    When the user clicks "Accept"
    Then no new category is created
    And the document is assigned to category id=42

  Scenario: Dismiss suggestion does not create category
    Given a category suggestion banner for "Physiotherapy"
    When the user clicks "Dismiss"
    Then no category is created
    And no category is assigned to the document
```

---

### V3-F2: Contact Auto-Creation from PDF Body

**Context:** The PDF contained clear contact information (name: John Green, phone: 07544 370440, email: jg@johngreenphysio.com) that was not surfaced or saved as a contact.

**Gap in PRD_V2:** UTFv1-03 added contact suggestion cards. The gaps are:
1. The UK mobile number format `07544 XXXXXX` was not matched by the existing phone regex.
2. The extracted contact details must populate all contact fields (name, phone, email).
3. The "Save as Contact" flow must persist the contact to the database.

#### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| V3-F2.1 | The phone extraction regex MUST match UK mobile numbers in the format `07XXX XXXXXX` (e.g. `07544 370440`) | MUST | ✅ |
| V3-F2.2 | The phone extraction regex MUST also match UK landlines (`01XXX XXXXXX`, `02X XXXX XXXX`) and international numbers (`+XX XXX…`) | MUST | ✅ |
| V3-F2.3 | A detected contact card MUST display: full name, phone, email, title/salutation if present | MUST |
| V3-F2.4 | Clicking "Save as Contact" on a detected contact card MUST create a contact record with name, phone, and email pre-populated | MUST |
| V3-F2.5 | Before saving, the system MUST check for duplicates using case-insensitive name match and email match; if a probable duplicate is found, a merge prompt MUST be shown | MUST |
| V3-F2.6 | After saving, the contact MUST be linked to the uploaded document | SHOULD |
| V3-F2.7 | If the user closes the upload dialog without saving a detected contact, the suggestion MUST NOT be auto-saved | MUST |

**Acceptance Criteria (Gherkin):**

```gherkin
Feature: Contact Auto-Creation from PDF Body

  Scenario: UK mobile phone number is detected
    Given a PDF containing "TEL: 07544 370440"
    When text extraction runs
    Then the contact suggestion includes phone "07544 370440"

  Scenario: Full contact details are surfaced in upload dialog
    Given a PDF containing:
      | Field | Value                  |
      | Name  | John Green             |
      | Tel   | 07544 370440           |
      | Email | jg@johngreenphysio.com |
    When the user reaches the review step of the upload dialog
    Then a detected contact card shows:
      | name  | John Green             |
      | phone | 07544 370440           |
      | email | jg@johngreenphysio.com |

  Scenario: Save as Contact persists to database
    Given a detected contact card for "John Green"
    When the user clicks "Save as Contact"
    Then a contact record is created with:
      | name  | John Green             |
      | phone | 07544 370440           |
      | email | jg@johngreenphysio.com |
    And the contact is linked to the document

  Scenario: Duplicate detection prevents duplicate contacts
    Given a contact named "John Green" with email "jg@johngreenphysio.com" already exists
    When the user clicks "Save as Contact" for a contact with the same name and email
    Then a merge/duplicate prompt is displayed
    And no duplicate contact is created unless the user confirms

  Scenario: Closing dialog without saving does not auto-save contact
    Given a detected contact card for "John Green" is shown
    When the user closes the upload dialog without clicking "Save as Contact"
    Then no contact record is created
```

---

### V3-F3: Clinic Auto-Creation with Full Details and Contact Linking

**Context:** "JOHN GREEN PHYSIOTHERAPY LTD" is a company with three registered addresses and a Company Registration Number (6780032). The existing flow did not capture company registration numbers, multiple addresses, or automatically link the clinic to the extracted contact.

**Gap in PRD_V2:** F5 (Intelligent Contact Auto-Creation) addresses clinic name extraction but does not specify:
- Company Registration Number capture
- Multiple addresses per clinic
- Automatic clinic ↔ contact linking

#### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| V3-F3.1 | The clinic extraction pipeline MUST extract the company/clinic name from the PDF body (e.g. from letterhead, footer, or registration block) | MUST |
| V3-F3.2 | The clinic extraction pipeline MUST extract the Company Registration Number when present (pattern: `Company Registration No[.:]\s*\d{6,8}` or similar) | MUST |
| V3-F3.3 | The clinic record MUST support multiple addresses (one-to-many: `clinic_addresses` table) | MUST |
| V3-F3.4 | All addresses found in the PDF body for that clinic MUST be extracted and stored (up to 5 addresses) | SHOULD |
| V3-F3.5 | When a clinic and a contact are both detected in the same document, they MUST be automatically linked (`clinic_contacts` join record) when both are saved | MUST |
| V3-F3.6 | The clinic suggestion card in the upload dialog MUST show: clinic name, company registration number (if found), and a count of detected addresses | MUST |
| V3-F3.7 | Clicking "Save as Clinic" MUST create the clinic record, all associated addresses, and the link to the saved contact (if any) | MUST |
| V3-F3.8 | If a clinic with an identical name (case-insensitive) already exists, a merge prompt MUST be shown instead of creating a duplicate | MUST |

**Acceptance Criteria (Gherkin):**

```gherkin
Feature: Clinic Auto-Creation with Full Details

  Scenario: Clinic name is extracted from PDF body
    Given a PDF with "JOHN GREEN PHYSIOTHERAPY LTD" in the letterhead
    When text extraction runs
    Then the clinic suggestion includes name "John Green Physiotherapy Ltd"

  Scenario: Company Registration Number is extracted
    Given a PDF containing "Company Registration No: 6780032"
    When text extraction runs
    Then the clinic suggestion includes company_registration_number "6780032"

  Scenario: Multiple addresses are extracted
    Given a PDF containing 3 distinct postal addresses for the same clinic
    When text extraction runs
    Then the clinic suggestion includes 3 addresses

  Scenario: Save as Clinic persists full record
    Given a clinic suggestion for "John Green Physiotherapy Ltd" with:
      | company_reg_no | 6780032 |
      | addresses      | 3       |
    When the user clicks "Save as Clinic"
    Then a clinic record is created with company_registration_number "6780032"
    And 3 address records are linked to the clinic

  Scenario: Clinic and contact are auto-linked when both saved
    Given a detected contact "John Green" has been saved as a contact
    And a clinic suggestion "John Green Physiotherapy Ltd" is present
    When the user clicks "Save as Clinic"
    Then the clinic is linked to contact "John Green"

  Scenario: Duplicate clinic triggers merge prompt
    Given a clinic named "John Green Physiotherapy Ltd" already exists
    When the user clicks "Save as Clinic" for a clinic with the same name
    Then a duplicate/merge prompt is displayed
    And no duplicate clinic is created unless the user confirms
```

**Schema Changes Required:**

```sql
-- Add company_registration_number to clinics table
ALTER TABLE clinics ADD COLUMN company_registration_number TEXT;

-- New clinic_addresses table
CREATE TABLE clinic_addresses (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  address   TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0
);
```

---

### V3-F4: Tag Auto-Extraction from Document Analysis

**Context:** After uploading the physiotherapy invoice, expected tags were: `invoice`, `John Green`, `PHYSIOTHERAPY`, `2023-03-09`. None were present in the tags field. A second upload of a registration form revealed that the document title tag was stored as `"title:Registration Form"` instead of the clean value `"Registration Form"`.

**Gap in PRD_V2:** UTFv1-01 fixed tag merging from extraction, but the extraction pipeline was not producing all required tags.

#### Tag Sources and Expected Outputs

| Tag | Source | Extraction Rule |
|-----|--------|----------------|
| `invoice` | Document type keyword | PDF body contains "INVOICE", "Receipt", "Bill", or similar billing keyword |
| `John Green` | Provider/doctor name | Doctor candidate extracted from PDF body |
| `PHYSIOTHERAPY` | Specialty keyword | Category keyword extracted from PDF body (same source as V3-F1) |
| `2023-03-09` | Medical activity date | Date of service in PDF body (not the upload date, not the filename timestamp) |
| `Registration Form` | Document title | Short title-case heading found in first 3 OCR lines of PDF body |

#### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| V3-F4.1 | The extraction pipeline MUST identify document type keywords (`INVOICE`, `RECEIPT`, `BILL`, `REFERRAL`, `PRESCRIPTION`, `REPORT`, `SUMMARY`, `DISCHARGE`) and emit the matching keyword as a lowercase tag | MUST |
| V3-F4.2 | All extracted doctor/provider names MUST be added as tags (in addition to being shown as contact suggestions) | MUST |
| V3-F4.3 | The specialty/category keyword MUST also be emitted as a tag (same value as V3-F1 category suggestion) | MUST |
| V3-F4.4 | The medical activity date (date of service, appointment date, or invoice date found in PDF body) MUST be emitted as a tag in `YYYY-MM-DD` format | MUST |
| V3-F4.5 | All auto-extracted tags MUST be pre-populated in the upload dialog's tags field, editable by the user before saving | MUST |
| V3-F4.6 | Duplicate tags (case-insensitive) MUST be de-duplicated before display | MUST |
| V3-F4.7 | When a document title is detected (a short title-case heading in the first 3 OCR lines), it MUST be stored as a plain tag with NO prefix — e.g. `"Registration Form"`, NOT `"title:Registration Form"` | MUST |
| V3-F4.8 | A document title tag candidate MUST satisfy: ≤5 words, 2–60 characters, does not end in `:`, fewer than 1/3 digits, and is not identical to any already-emitted type/specialty/provider/date tag | MUST |

**Acceptance Criteria (Gherkin):**

```gherkin
Feature: Tag Auto-Extraction from Document Analysis

  Scenario: Invoice keyword produces invoice tag
    Given a PDF containing the word "INVOICE" in the document body
    When text extraction runs
    Then the tags list includes "invoice"

  Scenario: Provider name produces tag
    Given a PDF where "John Green" is detected as a provider/doctor name
    When text extraction runs
    Then the tags list includes "John Green"

  Scenario: Specialty keyword produces tag
    Given a PDF containing the keyword "PHYSIOTHERAPY"
    When text extraction runs
    Then the tags list includes "PHYSIOTHERAPY"

  Scenario: Medical activity date produces date tag
    Given a PDF with a service date of 2023-03-09 in the document body
    When text extraction runs
    Then the tags list includes "2023-03-09"

  Scenario: All four tags appear pre-populated in upload dialog
    Given the physiotherapy invoice PDF
    When the user reaches the review step of the upload dialog
    Then the tags field contains: "invoice", "John Green", "PHYSIOTHERAPY", "2023-03-09"
    And all tags are editable

  Scenario: Duplicate tags are de-duplicated
    Given extraction produces tag "PHYSIOTHERAPY" from both filename and body
    When tags are merged for display
    Then "PHYSIOTHERAPY" appears only once in the tags field

  Scenario: Document title tag is stored without prefix (V3-F4.7)
    Given a PDF whose first OCR line is "Registration Form"
    When text extraction runs
    Then the tags list includes "Registration Form"
    And the tags list does NOT contain any tag starting with "title:"

  Scenario: Document title tag is displayed without prefix in UI
    Given a document with tag "Registration Form" (no prefix)
    When the user views the document in the Documents list or detail page
    Then the tag chip displays "Registration Form"
    And no "title:" prefix is visible anywhere in the UI
```

---

### V3-F5: Timeline Entry Uses Medical Activity Date

**Context:** The timeline was recording the upload date instead of the date of the medical event described in the document. For the physiotherapy invoice dated 2023-03-09, the expected timeline entry was:

> **2023-03-09 PHYSIOTHERAPY with Mr John Green**

Additional manual testing feedback (2026-05-02) clarified:
- The **Chronological** view must show only events keyed to `activity_date` — upload events must NOT appear there.
- A new **"By Uploaded Date"** view must show ALL documents sorted by `created_at` (upload timestamp), including those without an `activity_date`.
- Documents that have no extracted `activity_date` must show an editable field in their detail page so the user can set it manually after upload.

**Gap in PRD_V2:** Timeline entries are linked to documents but no requirement specified which date to use (document date, upload date, or medical activity date). The format of the timeline description was also not specified. The separation of "when was this medical event" vs "when was this file uploaded" was not modelled as distinct views.

#### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| V3-F5.1 | The timeline entry for a document MUST use the medical activity date (`activity_date`) as its event date in the Chronological view | MUST |
| V3-F5.2 | If no activity date is found in the PDF body, the document date from the filename parse MUST be used as a fallback | MUST |
| V3-F5.3 | If neither is available, the document is NOT shown in the Chronological view (it appears only in "By Uploaded Date") | MUST |
| V3-F5.4 | The timeline entry description MUST follow the format: `{YYYY-MM-DD} {SPECIALTY} with {Title} {Provider Name}` when a specialty and provider are detected | MUST |
| V3-F5.5 | The title/salutation (e.g. "Mr", "Mrs", "Dr", "Prof") MUST be extracted from the PDF body when present and included in the description | SHOULD |
| V3-F5.6 | If no specialty is detected, the document type (e.g. "Invoice", "Report") MUST be used in its place in the description | SHOULD |
| V3-F5.7 | If no provider name is detected, the clinic name MUST be used in its place | SHOULD |
| V3-F5.8 | The timeline entry description MUST be editable by the user before the upload is finalised | MUST |
| V3-F5.9 | The Timeline page MUST offer a **"By Uploaded Date"** view tab that shows ALL documents sorted by `created_at` descending, regardless of whether they have an `activity_date` | MUST |
| V3-F5.10 | In the "By Uploaded Date" view, each row MUST display: upload date (`created_at`), document title (from tags or filename), and document type tag if present | MUST |
| V3-F5.11 | Upload events (keyed to `created_at`) MUST NOT appear in the Chronological, By Category, or By Doctor views — they are exclusive to the "By Uploaded Date" view | MUST |
| V3-F5.12 | On the document detail page, if a document has no `activity_date`, an editable date field labelled "Activity Date" MUST be displayed, allowing the user to set or correct it | MUST |
| V3-F5.13 | Saving an `activity_date` from the document detail page MUST persist it to the `documents.activity_date` column via a Tauri IPC command | MUST |
| V3-F5.14 | After the user saves an `activity_date` from the detail page, the Chronological timeline view MUST reflect the new entry on the next render | MUST |

**Accepted Activity Date Sources (priority order):**

1. Invoice date / Service date explicitly labelled in PDF body (e.g. "Date of Service: 09/03/2023", "Invoice Date: 09 March 2023")
2. Appointment date found in PDF body
3. Date extracted from filename
4. Not shown in Chronological view (user must enter manually via detail page)

**Acceptance Criteria (Gherkin):**

```gherkin
Feature: Timeline Entry Uses Medical Activity Date

  Scenario: Activity date from PDF body is used for timeline
    Given a PDF with service date 2023-03-09 in the document body
    And upload date is 2026-04-30
    When the document is uploaded and saved
    Then the Chronological timeline shows an entry dated 2023-03-09
    And no entry dated 2026-04-30 appears in the Chronological view

  Scenario: Timeline description follows prescribed format
    Given a PDF with:
      | specialty      | PHYSIOTHERAPY |
      | provider_name  | John Green    |
      | provider_title | Mr            |
      | activity_date  | 2023-03-09    |
    When the document is uploaded and saved
    Then the timeline entry description is "2023-03-09 PHYSIOTHERAPY with Mr John Green"

  Scenario: Filename date used when no body date found
    Given a PDF with no labelled date in the body
    And the filename contains date 2023-03-09
    When the document is uploaded
    Then the Chronological timeline entry date is 2023-03-09

  Scenario: Document without activity_date does NOT appear in Chronological view (V3-F5.3)
    Given a PDF with no date in body or filename
    When the document is uploaded
    Then no entry for this document appears in the Chronological timeline view

  Scenario: Document without activity_date DOES appear in By Uploaded Date view (V3-F5.9)
    Given a PDF with no date in body or filename
    And upload date is 2026-04-30
    When the document is uploaded
    And the user switches to the "By Uploaded Date" tab on the Timeline page
    Then an entry for this document appears with date 2026-04-30

  Scenario: By Uploaded Date view shows ALL documents sorted by upload date (V3-F5.9)
    Given 3 documents uploaded on 2026-04-28, 2026-04-29, and 2026-04-30 respectively
    When the user views the "By Uploaded Date" tab
    Then all 3 documents are listed
    And they are ordered: 2026-04-30, 2026-04-29, 2026-04-28

  Scenario: Upload events absent from Chronological view (V3-F5.11)
    Given a document with activity_date 2023-03-09 and upload date 2026-04-30
    When the user views the Chronological timeline tab
    Then only the entry dated 2023-03-09 is shown for this document
    And no entry dated 2026-04-30 appears for this document

  Scenario: Document detail shows editable activity_date field when absent (V3-F5.12)
    Given a document that has no activity_date
    When the user opens the document detail page
    Then an "Activity Date" input field is visible and empty

  Scenario: User can set activity_date from document detail (V3-F5.13)
    Given a document with no activity_date
    When the user opens the document detail page
    And enters "2023-01-10" in the Activity Date field
    And clicks Save
    Then the document's activity_date is persisted as 2023-01-10

  Scenario: Chronological view reflects newly set activity_date (V3-F5.14)
    Given a document that previously had no activity_date
    And the user has just set activity_date to 2023-01-10 from the detail page
    When the user navigates to the Timeline page and views the Chronological tab
    Then an entry dated 2023-01-10 is now visible for that document

  Scenario: Timeline description is editable before save
    Given a suggested timeline description "2023-03-09 PHYSIOTHERAPY with Mr John Green"
    When the user is on the review step
    Then the timeline description field is editable
    And the user can modify it before clicking Save
```

---

## Data Model Changes Summary

| Change | Scope | Notes |
|--------|-------|-------|
| `clinics.company_registration_number TEXT` | clinics table | New nullable column |
| `clinic_addresses` table | New table | One-to-many from clinics |
| `documents.activity_date DATE` | documents table | Medical activity date; separate from `document_date` (filename-parsed) and `created_at` (upload) |
| `timeline_entries.event_date` | timeline_entries table | Confirm it uses `activity_date` not `created_at` |

### V3-F6: Auto-Create Appointment from Invoice/Receipt Upload

**Context:** Uploading "Upload (21Jan2022-13_34_32).pdf" (an invoice for "09-Dec-21 Initial out-patient consultation") produced no appointment. The document contains a medical activity date (09 Dec 2021) and is typed as an invoice, yet no appointment was created or suggested. `links_score_candidates` returned null because the appointments table was empty — there was no fallback path to suggest appointment creation.

**Gap in PRD_V2:** UTFv1-03 specified document-to-appointment linking when appointments exist. It did not specify the case where no matching appointment exists and the document signals an appointment event.

#### Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| V3-F6.1 | When a document is uploaded and extraction detects `activity_date` AND a type tag of `invoice`, `receipt`, or `bill`, the system MUST check whether `links_score_candidates` returns a match. | MUST |
| V3-F6.2 | If `links_score_candidates` returns null (no matching appointment), the system MUST call `appointments_suggest_from_document` to assemble a pre-filled appointment suggestion from extracted data. | MUST |
| V3-F6.3 | If `appointments_suggest_from_document` returns a non-null suggestion, the Upload screen MUST display an "Appointment Suggestion" banner with the pre-filled fields: date, title (doctor + specialty), and doctor name. | MUST |
| V3-F6.4 | The banner MUST offer two actions: **"Create Appointment"** and **"Dismiss"**. | MUST |
| V3-F6.5 | On "Create Appointment", the system MUST call `appointments_create` with the pre-filled data and link the document to the newly created appointment via `link_document_to_appointment`. | MUST |
| V3-F6.6 | On "Dismiss", the banner disappears; no appointment is created. | MUST |
| V3-F6.7 | Documents without `activity_date` OR without an invoice/receipt/bill type tag MUST NOT trigger the appointment suggestion banner. | MUST |
| V3-F6.8 | If `links_score_candidates` already returns a match, the appointment suggestion banner MUST NOT be shown (the existing `LinkSuggestionBanner` handles this case). | MUST |

#### Appointment Suggestion Assembly Rules

The new `appointments_suggest_from_document` Rust command reads extracted data from the document and returns:

| Field | Source |
|-------|--------|
| `appt_date` | `activity_date` from the `documents` table |
| `doctor_name` | First entry in `doctor_candidates` (extracted from PDF body); null if none |
| `specialty` | First UPPERCASE auto-tag (specialty tag); null if none |
| `title` | If doctor_name present: `"{specialty} with {doctor_name}"` else `"{specialty} appointment"` |

The command returns `null` when the document has no `activity_date` or has no invoice/receipt/bill type tag among its `auto_tags`.

#### Acceptance Criteria

```gherkin
Scenario: Invoice upload with date triggers appointment suggestion (V3-F6.1)
  Given a PDF invoice with body date "09 Dec 2021" and doctor "Dr. Smith"
  And no appointments exist in the database
  When the document is uploaded
  Then links_score_candidates returns null
  And appointments_suggest_from_document returns a suggestion with date 2021-12-09

Scenario: Appointment suggestion banner displayed (V3-F6.3)
  Given appointments_suggest_from_document returns a non-null suggestion
  When the upload completes
  Then the "Appointment Suggestion" banner is visible
  And it shows the suggested date and doctor name

Scenario: Create Appointment from banner (V3-F6.5)
  Given the Appointment Suggestion banner is visible
  When the user clicks "Create Appointment"
  Then an appointment is created with the pre-filled data
  And the document is linked to the new appointment
  And the banner disappears

Scenario: Dismiss banner (V3-F6.6)
  Given the Appointment Suggestion banner is visible
  When the user clicks "Dismiss"
  Then no appointment is created
  And the banner disappears

Scenario: Non-invoice document does NOT trigger banner (V3-F6.7)
  Given a PDF lab report with activity_date but no invoice/receipt/bill tag
  When the document is uploaded
  Then the Appointment Suggestion banner is NOT shown

Scenario: Existing appointment match suppresses suggestion (V3-F6.8)
  Given a matching appointment exists and links_score_candidates returns a match
  When the document is uploaded
  Then only the LinkSuggestionBanner is shown
  And the Appointment Suggestion banner is NOT shown
```

---

## Implementation Priority

| # | Feature | Priority | Estimated Effort |
|---|---------|----------|-----------------|
| 1 | V3-F4: Tag auto-extraction (all 4 tag types) | MUST | M (3–4h) |
| 2 | V3-F5: Timeline uses activity date + correct format | MUST | M (3–4h) |
| 3 | V3-F2: Contact auto-creation (phone regex + save flow) | MUST | M (3–4h) |
| 4 | V3-F1: Category auto-creation when accepted | MUST | S (1–2h) |
| 5 | V3-F3: Clinic with company reg + multi-address + linking | MUST | L (5–7h) |
| 6 | V3-F6: Auto-create appointment from invoice upload | MUST | S (2–3h) |

**Total estimated effort: 17–24 hours**

---

## Out of Scope (This Version)

- Batch re-extraction of previously uploaded documents
- PDF form field extraction (distinct from body text extraction)
- NLP-based entity recognition (all extraction uses regex + keyword lists)
- Multi-language documents

---

## Open Questions

| # | Question | Owner |
|---|----------|-------|
| 1 | Should activity date override a user-edited document date, or only pre-populate? | Product |
| 2 | Max addresses per clinic — is 5 sufficient or should it be unlimited? | Product |
| 3 | Should tags added automatically be visually distinguished from manually-added tags? | UX |
| 4 | When both clinic and contact are detected but only one is saved, should the link be created later? | Product |
