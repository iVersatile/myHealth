# Acceptance Test Cases — myHealth v1.1.0

**Version:** 1.0  
**Date:** 2026-04-21  
**Scope:** Screens 16–24 (UI Features F1–F6)  
**Total Test Cases:** 26 (TC-F1-01 through TC-F6-10)

---

## Overview

This document defines structured UI acceptance test cases for six new features introduced in myHealth v1.1.0. Each test case maps to one or more wireframe screens (see `WIREFRAMES_V2.md`) and validates both happy-path and edge-case scenarios.

### Test Case Format

Each test case follows the **Arrange–Act–Assert** pattern:

```
TC-[Feature]-[##]
Feature: <Feature Name>
Screen(s): <Screen reference(s)>
Precondition: <State before test>
Steps:
  1. <Step referencing specific UI element>
  2. <Step>
  3. ...
Expected Result: <What should happen>
Edge Cases / Negative Tests:
  - <Negative scenario>
  - <Boundary case>
```

---

## Feature F1: Filename Parsing & Automatic Tag Extraction

### TC-F1-01: Parse date from filename in DD MMM YYYY format

**Feature:** Filename Parsing & Automatic Tag Extraction  
**Screen(s):** Screen 16 (Upload Dialog v2)  
**Precondition:** User is on Upload Dialog with no file selected  
**Steps:**
  1. Select a file named `scan_01Dec2024_blood-test.pdf`
  2. Observe the filename parsing in the "Date" field
  3. Verify the date field automatically populates
  4. Check that tag chips appear below the filename
**Expected Result:**
  - Date field shows `01 Dec 2024`
  - A tag chip `[Dec2024]` or `[2024]` appears automatically
  - Other metadata (e.g., `[blood-test]`) may also be extracted as separate tags
**Edge Cases / Negative Tests:**
  - File with no recognisable date pattern: date field remains empty, no auto-tag
  - File with ambiguous date (e.g., `01_02_03.pdf`): tag only year if present
  - Filename with multiple dates: use the first clearly formatted date (DD MMM YYYY)

---

### TC-F1-02: Extract tags from filename using keyword matching

**Feature:** Filename Parsing & Automatic Tag Extraction  
**Screen(s):** Screen 16 (Upload Dialog v2)  
**Precondition:** File with recognisable keywords in name is selected  
**Steps:**
  1. Select a file named `results_appointment_20Dec2024_cardio_followup.pdf`
  2. Observe tag chips below the filename
  3. Verify each extracted keyword appears as a tag
**Expected Result:**
  - Tag chips appear: `[appointment]`, `[cardio]`, `[followup]`, and date tag `[Dec2024]`
  - Tags are shown in colour-coded swatches if linked to system categories
  - Unknown tags default to neutral colour swatch `[⊕]`
**Edge Cases / Negative Tests:**
  - Filename with no recognised keywords: no tags auto-generated (user can add manually)
  - Filename with duplicate words: tag created once (no duplicate chips)
  - Case-insensitive matching: `CARDIO`, `Cardio`, `cardio` all match same tag

---

### TC-F1-03: Allow manual tag addition via "+ Add tag" button

**Feature:** Filename Parsing & Automatic Tag Extraction  
**Screen(s):** Screen 16 (Upload Dialog v2)  
**Precondition:** Upload Dialog is open; some tags may already be auto-extracted  
**Steps:**
  1. Observe the `[ + Add tag ]` button below the tag chips
  2. Click `[ + Add tag ]`
  3. Type a custom tag (e.g., `urgent`)
  4. Press Enter or click Add
**Expected Result:**
  - New tag chip `[urgent]` appears in the list
  - Manual tag persists alongside auto-extracted tags
  - User can add multiple tags via repeated clicks
**Edge Cases / Negative Tests:**
  - Empty tag input: button disabled or pressing Enter does nothing
  - Duplicate tag: attempting to add existing tag shows validation error or is silently ignored
  - Special characters in tag: validation rejects or sanitises input

---

### TC-F1-04: User can override parsed date field

**Feature:** Filename Parsing & Automatic Tag Extraction  
**Screen(s):** Screen 16 (Upload Dialog v2)  
**Precondition:** Date field is populated from filename parsing  
**Steps:**
  1. Observe the date field containing auto-parsed date (e.g., `01 Dec 2024`)
  2. Click into the date field
  3. Clear the existing date and enter a new date (e.g., `15 Mar 2024`)
  4. Tab or click outside the field to confirm
**Expected Result:**
  - Date field updates to user-entered value
  - Tags are NOT recalculated based on new date (tag extraction only runs on filename parse)
  - User's override is retained
**Edge Cases / Negative Tests:**
  - Invalid date format: field shows validation error, reverts to last valid value
  - Date in future: allow (no validation prevents future dates)
  - Empty date: allow (user may not want to assign a date)

---

### TC-F1-05: Filename with year-only recognition creates year tag

**Feature:** Filename Parsing & Automatic Tag Extraction  
**Screen(s):** Screen 16 (Upload Dialog v2)  
**Precondition:** File selected with year in filename but incomplete date  
**Steps:**
  1. Select a file named `lab_2023_summary.pdf`
  2. Observe the tag chips and date field
  3. Verify year-only extraction
**Expected Result:**
  - Date field remains empty or shows partial/year-only value
  - A year tag `[2023]` is created and displayed
  - User can add or override full date manually
**Edge Cases / Negative Tests:**
  - Filename with multiple years: use first recognised year
  - Year appears in middle of compound word (e.g., `lab2023scanner`): extract as tag if context permits
  - 2-digit year (e.g., `scan_24.pdf`): defer to full DD MMM YYYY pattern; if absent, extract year tag only if context allows

---

## Feature F2: PDF Text Extraction & OCR Status Display

### TC-F2-01: Show extraction status badge with correct state indicator

**Feature:** PDF Text Extraction & OCR Status Display  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document is uploaded; extraction may be in progress, complete, or failed  
**Steps:**
  1. Navigate to Document Detail
  2. Observe the extraction status badge in the top section (above PDF viewer)
  3. Verify badge displays correct state
**Expected Result:**
  - Badge shows one of three states:
    - `[⊙ Extracting]` — extraction in progress (spinner animation)
    - `[✓ Extracted]` — extraction complete; text is available
    - `[✗ No text found]` — extraction complete but no readable text detected
  - Badge colour reflects state (yellow=in progress, green=success, red=failure)
**Edge Cases / Negative Tests:**
  - Corrupted PDF: badge shows `[✗ No text found]`
  - Empty PDF (no text, only images): badge shows `[✗ No text found]`, OCR fallback can be triggered
  - Extraction timeout: badge shows `[✗ No text found]` after timeout period

---

### TC-F2-02: Display extracted text in collapsible section with scrollable box

**Feature:** PDF Text Extraction & OCR Status Display  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document detail is open; extraction status is `[✓ Extracted]`  
**Steps:**
  1. Scroll down to the "Extracted Text" section
  2. Observe the section header: `[▼ Extracted Text]` (expanded) or `[▶ Extracted Text]` (collapsed)
  3. If collapsed, click the header to expand
  4. Verify text appears in a scrollable box (height ~200px)
  5. Scroll within the box to view long documents
**Expected Result:**
  - Section expands on click, showing extracted text
  - Text is rendered in a monospace font (code-like appearance) for readability
  - Scrollbar appears if text exceeds box height
  - Section can be collapsed via click on header
**Edge Cases / Negative Tests:**
  - Very long document (1000+ lines): scrolling is smooth, no performance lag
  - Very short document (10 lines): box still renders but no scrollbar needed
  - Extraction status is `[✗ No text found]`: section is hidden or shows empty state message

---

### TC-F2-03: Show loading state during extraction with spinner and message

**Feature:** PDF Text Extraction & OCR Status Display  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document is uploaded but extraction has not yet completed  
**Steps:**
  1. Navigate to Document Detail immediately after upload
  2. Observe the extraction status badge area
  3. Watch for loading indicator
**Expected Result:**
  - Badge displays `[⊙ Extracting]` with an animated spinner
  - A message appears below the badge: "Extracting text... Please wait."
  - Loading state persists until extraction completes
  - UI remains responsive (no freezing)
**Edge Cases / Negative Tests:**
  - User navigates away and back: loading state correctly resumes or shows final result
  - Extraction takes >10 seconds: loading message still visible, no timeout error shown prematurely
  - User uploads another document while first is extracting: each document's state is tracked independently

---

### TC-F2-04: Copy extracted text to clipboard

**Feature:** PDF Text Extraction & OCR Status Display  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document detail is open; extraction is complete (`[✓ Extracted]`)  
**Steps:**
  1. Locate the "Extracted Text" section with a visible text box
  2. Find and click the `[ Copy ]` button (typically in section header or top-right of text box)
  3. Verify clipboard access
  4. Paste text elsewhere (e.g., text editor, notes app) to confirm copy
**Expected Result:**
  - Button click copies all visible extracted text to clipboard
  - User receives visual feedback: button text changes to `[ Copied! ]` for 2–3 seconds, then reverts
  - Pasted text matches extracted text exactly
**Edge Cases / Negative Tests:**
  - Empty extraction (status `[✗ No text found]`): Copy button is disabled or hidden
  - Very large text (>1MB): copy still works, no timeout
  - Clipboard unavailable (rare): graceful error message shown

---

### TC-F2-05: OCR fallback for scanned documents with setting persistence

**Feature:** PDF Text Extraction & OCR Status Display  
**Screen(s):** Screen 17 (Document Detail v2), Settings (not shown, implied)  
**Precondition:** Document is scanned image (no embedded text); `[✗ No text found]` badge is shown  
**Steps:**
  1. With extraction status `[✗ No text found]`, locate an `[ Use OCR ]` button or toggle in settings
  2. Click `[ Use OCR ]` (if available on Document Detail) or enable OCR in Settings > General
  3. Verify OCR triggers and processes the document
  4. Observe extraction status badge update to `[⊙ Extracting]` → `[✓ Extracted]` (if successful)
  5. Logout and log back in; verify OCR setting persists
**Expected Result:**
  - OCR button triggers Tesseract or equivalent OCR engine
  - Extraction status updates as OCR processes
  - Extracted text appears in the scrollable box (may be lower quality than native text)
  - OCR setting persists across sessions (stored in user settings)
**Edge Cases / Negative Tests:**
  - OCR fails (e.g., image too blurry): badge shows `[✗ No text found]` again, user can retry
  - OCR is disabled globally (settings): `[ Use OCR ]` button is hidden or disabled
  - User disables OCR after successful extraction: previously extracted OCR text remains visible (setting change doesn't retroactively delete)

---

## Feature F3: Multi-Select Category Hierarchy

### TC-F3-01: Display system and user categories separately with system marker

**Feature:** Multi-Select Category Hierarchy  
**Screen(s):** Screen 16 (Upload Dialog v2), Screen 17 (Document Detail v2)  
**Precondition:** Upload Dialog or Document Detail is open; category list is visible  
**Steps:**
  1. Open the category selector (multi-select section in Upload Dialog or edit mode in Document Detail)
  2. Observe the list of all available categories
  3. Identify system-provided categories vs. user-created categories
**Expected Result:**
  - System categories are listed first, each marked with `(system)` label and a lock icon
  - User categories follow, unmarked and without lock icon
  - Both types display colour swatches `[⊕]` matching their configured colours
  - Visual separation is clear (e.g., horizontal divider or different background)
**Edge Cases / Negative Tests:**
  - No user categories created: system categories section displayed, no empty "User Categories" section shown
  - Large number of categories (50+): list is scrollable within the dialog
  - Category name is very long: text truncates with ellipsis, full name visible on hover

---

### TC-F3-02: Select multiple categories via independent checkboxes

**Feature:** Multi-Select Category Hierarchy  
**Screen(s):** Screen 16 (Upload Dialog v2), Screen 17 (Document Detail v2)  
**Precondition:** Category list is visible with checkboxes  
**Steps:**
  1. Click checkbox next to Category A (e.g., `☐ Cardiology`)
  2. Checkbox changes to `☑ Cardiology`
  3. Click checkbox next to Category B (e.g., `☐ Labs`)
  4. Both checkboxes remain checked: `☑ Cardiology`, `☑ Labs`
  5. Click checkbox next to Category A to uncheck
  6. Verify Category A is unchecked, Category B remains checked
**Expected Result:**
  - Each category checkbox operates independently
  - User can select any combination of categories
  - Visual feedback is immediate (checkbox UI updates on click)
  - Selected categories are persisted (until user saves or dialog closes)
**Edge Cases / Negative Tests:**
  - User selects all categories: all checkboxes checked, no limit enforced
  - User selects no categories: valid state, document saved with empty category list
  - Rapid clicking: checkbox state is reliable, no race conditions

---

### TC-F3-03: Show colour swatches for all categories

**Feature:** Multi-Select Category Hierarchy  
**Screen(s):** Screen 16 (Upload Dialog v2), Screen 17 (Document Detail v2)  
**Precondition:** Category list is visible  
**Steps:**
  1. Observe each category row in the list
  2. Locate the colour swatch `[⊕]` to the left of each category name
  3. Verify swatch colour matches the category's configured colour
  4. Select multiple categories with different colours
  5. Observe colours in the selected category list or chip row
**Expected Result:**
  - Each category displays a distinct colour swatch
  - Swatch colour is consistent across all UI locations (Upload Dialog, Document Detail, Timeline views)
  - If category colour is not set, swatch defaults to neutral grey `[⊕]`
  - Swatches are visually prominent (at least 12×12px)
**Edge Cases / Negative Tests:**
  - Two categories have identical colour: both swatches render same colour (not a bug, but noted)
  - Very light colour chosen: swatch still visually distinguishable from background
  - No colour assigned to category: neutral grey swatch shown instead of error

---

### TC-F3-04: Multi-select state resets on dialog close without saving

**Feature:** Multi-Select Category Hierarchy  
**Screen(s):** Screen 16 (Upload Dialog v2)  
**Precondition:** Upload Dialog is open with category multi-select section  
**Steps:**
  1. Select multiple categories: `☑ Cardiology`, `☑ Labs`, `☑ Appointment`
  2. Observe the selections in the dialog
  3. Click `[ Cancel ]` button to close the dialog without saving
  4. Reopen the Upload Dialog
  5. Observe the category list again
**Expected Result:**
  - Previous selections are cleared; all checkboxes return to unchecked state
  - If document was previously saved with categories, reopening that document shows correct saved categories (not the cancelled ones)
**Edge Cases / Negative Tests:**
  - User closes dialog via ESC key: same behaviour as Cancel button
  - User closes dialog via clicking outside (if modal backdrop dismissal is enabled): selections reset
  - User closes and reopens without saving: confirmed state is lost

---

### TC-F3-05: Handle category hierarchy in document detail with update on blur

**Feature:** Multi-Select Category Hierarchy  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document Detail is open in edit mode; category list is visible  
**Steps:**
  1. Click `[ Edit ]` button in Document Detail (or inline edit mode) to enable category editing
  2. Update the category selection (select/deselect categories)
  3. Click outside the category section (blur event) or press Tab to move focus away
  4. Verify categories are saved
  5. Reload the document or navigate away and back
**Expected Result:**
  - Categories are saved on blur (not after each checkbox click)
  - No explicit Save button required for category changes
  - Document reflects updated categories after reload
**Edge Cases / Negative Tests:**
  - User changes category and immediately closes the document: save is triggered on blur before closing
  - User revokes all categories: document saved with empty category list (valid)
  - Network error during save: error message shown, user prompted to retry

---

## Feature F4: Apple Calendar Sync (macOS)

### TC-F4-01: Display permission status indicator

**Feature:** Apple Calendar Sync  
**Screen(s):** Screen 22 (Settings > Calendar Sync)  
**Precondition:** Settings page is open; Calendar Sync section is visible  
**Steps:**
  1. Observe the permission status indicator at the top of the Calendar Sync settings
  2. Check the current state (Permitted or Not permitted)
**Expected Result:**
  - Status indicator shows `[✓ Permitted]` if app has calendar access (green checkmark)
  - Status indicator shows `[✗ Not permitted]` if access is denied (red X)
  - If not permitted, a button `[ Request Permission ]` is visible below
  - Indicator colour clearly distinguishes permitted vs. denied state
**Edge Cases / Negative Tests:**
  - macOS permission prompt previously denied: button allows user to re-request (opens System Preferences)
  - macOS permission granted but app uninstalled and reinstalled: prompt may reappear
  - Permission status changes externally (user revokes in macOS Settings): indicator updates on next Settings page load

---

### TC-F4-02: List available calendars with toggle switches

**Feature:** Apple Calendar Sync  
**Screen(s):** Screen 22 (Settings > Calendar Sync)  
**Precondition:** Permission status is `[✓ Permitted]`; calendar list section is visible  
**Steps:**
  1. Observe the "Select Calendars to Sync" section
  2. Verify a list of all available calendars from macOS Calendar app is displayed
  3. Each calendar has a toggle switch: `[ ◎ ]` (off) or `[ ◉ ]` (on)
  4. Click a toggle to enable a calendar
  5. Verify toggle changes state and label updates
**Expected Result:**
  - All available calendars are listed with names and toggle switches
  - Read-only calendars (e.g., "Holidays") have disabled toggles (greyed out) with tooltip explanation
  - User can enable/disable calendars independently
  - Toggled state is visible immediately (no save button required)
**Edge Cases / Negative Tests:**
  - No calendars available in macOS Calendar app: "No calendars found" message shown
  - User has 20+ calendars: list is scrollable within the settings section
  - Calendar is deleted in macOS Calendar app after sync setup: toggle for that calendar disappears on next Settings load

---

### TC-F4-03: Set sync frequency with radio buttons

**Feature:** Apple Calendar Sync  
**Screen(s):** Screen 22 (Settings > Calendar Sync)  
**Precondition:** Calendar Sync section is visible; at least one calendar is enabled  
**Steps:**
  1. Locate the "Sync Frequency" section with radio button options
  2. Observe available options: `( ) Manual`, `( ) Every 15 minutes`, `( ) Every hour`
  3. Click the `( ) Every 15 minutes` radio button
  4. Verify it becomes selected: `(●) Every 15 minutes`
  5. Other options become unselected
**Expected Result:**
  - Only one sync frequency option can be selected at a time
  - Selected option shows filled radio button `(●)`
  - Unselected options show empty radio button `( )`
  - Default selection is `( ) Manual`
  - Frequency change takes effect immediately (no save button)
**Edge Cases / Negative Tests:**
  - User switches from "Every 15 minutes" to "Manual": next sync will only occur when user clicks "Sync Now"
  - Frequency is set to "Every 15 minutes" but no calendars are enabled: sync still runs but finds no events (no error)
  - User changes frequency while sync is in progress: syncing completes; new frequency applies to next sync cycle

---

### TC-F4-04: Configure sync options with checkboxes

**Feature:** Apple Calendar Sync  
**Screen(s):** Screen 22 (Settings > Calendar Sync)  
**Precondition:** Calendar Sync settings section is visible  
**Steps:**
  1. Locate the "Sync Options" section with multiple checkboxes
  2. Observe available options:
     - `☐ Add new events to myHealth calendar` (auto-create events for newly linked documents)
     - `☐ Update existing event details` (sync changes to events back to myHealth)
     - `☐ Create events for unlinked documents` (auto-create events in Apple Calendar for all documents with dates)
  3. Click to enable `☐ Add new events to myHealth calendar`
  4. Verify checkbox becomes checked: `☑ Add new events to myHealth calendar`
  5. Toggle other options
**Expected Result:**
  - Each option can be independently toggled via checkbox
  - Options take effect immediately
  - A brief explanation tooltip appears on hover for each option
**Edge Cases / Negative Tests:**
  - All options disabled: sync still works (calendar is synced but no auto-creation occurs)
  - User disables "Update existing event details" after enabling it: subsequent syncs won't update events
  - User enables "Create events for unlinked documents": very large number of events may be created; warning should be shown

---

### TC-F4-05: Manual sync button with last-synced timestamp and loading state

**Feature:** Apple Calendar Sync  
**Screen(s):** Screen 22 (Settings > Calendar Sync)  
**Precondition:** At least one calendar is enabled; Calendar Sync section is visible  
**Steps:**
  1. Locate the `[ Sync Now ]` button and the "Last synced" timestamp below it
  2. Observe the timestamp (e.g., "Last synced: Today at 14:32")
  3. Click `[ Sync Now ]` button
  4. Observe button state: changes to `[ Syncing... ]` with a spinner
  5. Wait for sync to complete (typically 2–10 seconds)
  6. Verify button returns to `[ Sync Now ]` and timestamp updates
**Expected Result:**
  - Button is enabled (clickable) when sync is not in progress
  - Button becomes disabled and shows spinner during sync
  - "Last synced" timestamp updates to current time upon completion
  - User can trigger multiple manual syncs by clicking button again after completion
**Edge Cases / Negative Tests:**
  - Network error during sync: button reverts to `[ Sync Now ]`, error message shown, timestamp unchanged
  - User clicks `[ Sync Now ]` multiple times rapidly: only one sync runs; additional clicks are ignored
  - No events to sync: sync completes quickly, timestamp updates, "Sync completed" message shown

---

### TC-F4-06: Clear synced events destructive action with confirmation

**Feature:** Apple Calendar Sync  
**Screen(s):** Screen 22 (Settings > Calendar Sync)  
**Precondition:** At least one sync has completed; calendar events have been created in Apple Calendar  
**Steps:**
  1. Scroll to the bottom of the Calendar Sync settings
  2. Locate the `[ Clear Synced Events ]` button (styled as destructive, e.g., red background)
  3. Click the button
  4. Confirmation dialog appears: "Delete all synced calendar events? This cannot be undone."
  5. Click `[ Cancel ]` to abort
  6. Dialog closes, events remain
  7. Click `[ Clear Synced Events ]` again
  8. Dialog appears; click `[ Yes, Delete ]`
  9. Verify events are deleted from Apple Calendar
**Expected Result:**
  - Confirmation dialog prevents accidental deletion
  - Clicking Cancel closes dialog without deleting
  - Clicking "Yes, Delete" removes all synced events from Apple Calendar
  - UI shows brief "Events deleted" message
  - Subsequent syncs will re-create events if sync is triggered
**Edge Cases / Negative Tests:**
  - Network error during delete: error message shown, some events may remain; retry option provided
  - User deletes events manually in Apple Calendar before clicking "Clear Synced Events": only synced events (tracked by myHealth) are deleted
  - No events were synced: button is enabled but clicking shows "No events to clear" message

---

### TC-F4-07: macOS-specific informational notice (hidden/disabled on Windows)

**Feature:** Apple Calendar Sync  
**Screen(s):** Screen 22 (Settings > Calendar Sync)  
**Precondition:** Settings page is loaded  
**Steps:**
  1. On macOS: Observe a notice at the top of Calendar Sync settings:
     "Apple Calendar sync is available on macOS. Windows users: Calendar sync is not available on this platform."
  2. On Windows: Verify Calendar Sync section is either hidden or all controls are disabled (greyed out)
  3. Load the app on both platforms and verify platform-specific behavior
**Expected Result:**
  - macOS: Notice is visible; all Calendar Sync controls are enabled
  - Windows: Notice is hidden; Calendar Sync section shows disabled state with message:
    "Calendar sync is not available on Windows. Use macOS or upgrade your system."
  - Code prevents Calendar Sync API calls on Windows (no sync attempts)
**Edge Cases / Negative Tests:**
  - User running on Linux (not explicitly supported): Calendar Sync hidden or disabled
  - User running macOS in a VM: app correctly detects macOS and enables Calendar Sync
  - Notice text is translated if app supports multiple languages

---

## Feature F5: Contact Auto-Creation from Doctor Data

### TC-F5-01: Show doctor detection banner with action buttons

**Feature:** Contact Auto-Creation  
**Screen(s):** Screen 24 (Contact Auto-Creation Banner + Form)  
**Precondition:** Document is uploaded and processed; doctor information is extracted from text  
**Steps:**
  1. Navigate to Document Detail
  2. Observe the top of the page for a dismissible banner
  3. Banner displays: "Doctor detected in document. [Create Contact] [Dismiss] [See all 2]"
  4. Verify banner styling (colour, spacing, dismiss icon)
**Expected Result:**
  - Banner appears if at least one doctor is detected
  - Banner shows number of detected doctors: "See all N" (e.g., "See all 2")
  - Three action buttons: `[ Create Contact ]`, `[ Dismiss ]`, `[ See all 2 ]`
  - Banner can be dismissed via close icon (×) or `[ Dismiss ]` button
  - Dismissed banner does not reappear unless document is reloaded
**Edge Cases / Negative Tests:**
  - No doctors detected: banner is not shown
  - Multiple doctors detected (5+): button still shows "See all 5"
  - Doctor name is incomplete or malformed: banner still appears with best-guess name

---

### TC-F5-02: Pre-fill contact form with extracted doctor information

**Feature:** Contact Auto-Creation  
**Screen(s):** Screen 24 (Contact Auto-Creation Banner + Form)  
**Precondition:** Banner is showing and user clicks `[ Create Contact ]`  
**Steps:**
  1. Click `[ Create Contact ]` button on the banner
  2. Contact form modal/panel appears with pre-filled fields
  3. Observe the following fields:
     - Name: `[ Dr. Sarah Johnson ]` (pre-filled from extraction)
     - Specialty: `[ Cardiology ]` (pre-filled if extracted)
     - Type: `[ Doctor ]` (dropdown, pre-selected)
     - Clinic: `[ Heart Care Clinic ]` (pre-filled if extracted)
     - Phone: `[ 555-0123 ]` (pre-filled if extracted)
     - Email: `[ sarah@heartcare.com ]` (pre-filled if extracted)
     - Address: `[ 123 Medical Way, City ]` (pre-filled if extracted)
     - Notes: `[ ]` (empty, optional)
  4. Verify all fields are editable
**Expected Result:**
  - Form appears with extracted values pre-populated
  - All fields are editable (user can override any value)
  - Required fields (Name, Type) have validation
  - Optional fields may be empty
  - Fields clearly indicate which data came from extraction vs. user input
**Edge Cases / Negative Tests:**
  - Extraction confidence is low (e.g., name might be wrong): form shows extracted value but user should verify
  - Phone number format is non-standard: pre-filled as-is, user can clean up
  - Multiple doctors in document: form shows one at a time; user navigates via "See all" or form shows first only

---

### TC-F5-03: Create contact from banner with one click

**Feature:** Contact Auto-Creation  
**Screen(s):** Screen 24 (Contact Auto-Creation Banner + Form)  
**Precondition:** Banner is visible with `[ Create Contact ]` button; form is displayed  
**Steps:**
  1. Observe pre-filled form with extracted doctor data
  2. Click `[ Save ]` button (form can be saved as-is if pre-filled values are correct)
  3. Verify save action and confirmation
**Expected Result:**
  - Contact is created with pre-filled data in one action (no additional steps required)
  - Success message appears: "Contact created: Dr. Sarah Johnson"
  - Banner is dismissed
  - New contact is available in Contacts section
**Edge Cases / Negative Tests:**
  - Contact with same name already exists: app shows warning/confirmation to prevent duplicates
  - Save fails (validation error): form shows error messages, user corrects and retries
  - User closes form without saving: banner remains, changes are discarded

---

### TC-F5-04: Dismiss banner without creating contact

**Feature:** Contact Auto-Creation  
**Screen(s):** Screen 24 (Contact Auto-Creation Banner + Form)  
**Precondition:** Banner is visible with doctor detection  
**Steps:**
  1. Click `[ Dismiss ]` button on the banner OR click × (close icon)
  2. Observe banner disappears
  3. Reload the document page
**Expected Result:**
  - Banner is dismissed immediately
  - On reload: banner does not reappear (dismissed state is persisted)
  - No contact is created
  - User can still access "See all" view later via document context menu if needed
**Edge Cases / Negative Tests:**
  - User dismisses banner, then later wants to create contact: "See all doctors" option should still be accessible (e.g., via three-dot menu in Document Detail)
  - Banner dismissed, then new doctor is detected in same document: new banner appears if confidence score is high

---

### TC-F5-05: View all detected doctors with confidence scores

**Feature:** Contact Auto-Creation  
**Screen(s):** Screen 24 (Contact Auto-Creation Banner + Form)  
**Precondition:** Multiple doctors are detected; user clicks `[ See all N ]` button  
**Steps:**
  1. Click `[ See all 3 ]` button on the banner
  2. Modal or sidebar panel appears listing all detected doctors
  3. Each doctor row shows:
     - Name: `[ Dr. John Smith ]`
     - Confidence: `[ 95% ]` (or similar badge)
     - Specialty: `[ Orthopedics ]`
     - Status: `[ Create ]` or `[ Already saved ]`
  4. Click `[ Create ]` next to a doctor to open the contact form
**Expected Result:**
  - All detected doctors are listed with confidence scores
  - High confidence (80%+) is visually distinguished from low confidence
  - User can create contacts from any doctor in the list
  - Already-saved doctors show "Already saved" badge instead of "Create"
**Edge Cases / Negative Tests:**
  - Confidence score is <50%: doctor is still listed but marked as "Low confidence—verify before saving"
  - User already created a contact for one doctor: that row shows "Already saved" button is disabled
  - List is empty or shows "No doctors detected": modal shows empty state

---

### TC-F5-06: Edit contact details before saving

**Feature:** Contact Auto-Creation  
**Screen(s):** Screen 24 (Contact Auto-Creation Banner + Form)  
**Precondition:** Contact form is open with pre-filled data  
**Steps:**
  1. Observe pre-filled form fields (Name, Specialty, Type, Clinic, Phone, Email, Address, Notes)
  2. Modify a field: change Specialty from "Cardiology" to "Cardiovascular Surgery"
  3. Change Email from "sarah@heartcare.com" to "s.johnson@clinic.org"
  4. Leave Notes empty or add custom note: "Referred by Dr. Smith"
  5. Click `[ Save ]` button
**Expected Result:**
  - All modifications are accepted and saved
  - User edits override extracted values
  - Form validation ensures Name and Type are present
  - Contact is created with user-edited values
  - Success message shows updated name: "Contact created: Dr. Sarah Johnson"
**Edge Cases / Negative Tests:**
  - User clears the Name field: Save button disabled, validation error shown
  - User enters invalid email format: validation error on blur or save
  - User modifies Type dropdown: form allows changing doctor to another type (e.g., "Clinic Staff")
  - User cancels edits: original extracted values are discarded (form reverts to read-only or closes)

---

## Feature F6: Document-Appointment Linking & Timeline v2

### TC-F6-01: Show suggestion banner when nearby appointment detected

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 18 (Document-Appointment Link Suggestion), Screen 17 (Document Detail v2)  
**Precondition:** Document is uploaded with a date; existing appointment exists within ±3 days  
**Steps:**
  1. Upload a document dated "15 Apr 2024"
  2. An appointment "Cardiology checkup" exists on "14 Apr 2024"
  3. Navigate to Document Detail for the newly uploaded document
  4. Observe the top of the page for a suggestion banner
  5. Banner displays: "Appointment nearby: Cardiology checkup (14 Apr). [Link Now] [Dismiss]"
**Expected Result:**
  - Banner appears automatically when a nearby appointment is detected
  - Banner shows appointment name and date
  - Two buttons: `[ Link Now ]`, `[ Dismiss ]`
  - Banner styling is prominent but non-intrusive (e.g., light blue background)
  - Distance is shown or implied (e.g., "1 day before this document")
**Edge Cases / Negative Tests:**
  - No appointments within ±3 days: banner does not appear
  - Multiple nearby appointments: banner shows first; "See all" option available or subsequent banners appear
  - Appointment is already linked to another document: banner still shows and allows creating duplicate link (or prevents it with message)

---

### TC-F6-02: Link document to appointment from banner

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 18 (Document-Appointment Link Suggestion), Screen 17 (Document Detail v2)  
**Precondition:** Suggestion banner is visible  
**Steps:**
  1. Click `[ Link Now ]` button on the banner
  2. Verify the linking action completes
  3. Observe banner or confirmation message
  4. Scroll to the "Linked Appointments" section in Document Detail
**Expected Result:**
  - Document and appointment are linked immediately
  - Banner is dismissed or changes to: "Linked: Cardiology checkup (14 Apr) [Unlink]"
  - "Linked Appointments" section in Document Detail shows the appointment with date and time
  - Link is bidirectional: appointment in Timeline also shows linked document indicator `[↔]`
**Edge Cases / Negative Tests:**
  - Network error during linking: error message shown, user can retry
  - User clicks `[ Link Now ]` twice rapidly: only one link is created (idempotent)
  - Link already exists: button is disabled or message shown ("Already linked")

---

### TC-F6-03: Dismiss suggestion banner without linking

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 18 (Document-Appointment Link Suggestion)  
**Precondition:** Suggestion banner is visible  
**Steps:**
  1. Click `[ Dismiss ]` button on the banner OR click × (close icon)
  2. Observe banner disappears
  3. Reload the document page
**Expected Result:**
  - Banner is dismissed immediately
  - On reload: banner does not reappear for the same suggestion (dismissed state is persisted)
  - Document and appointment remain unlinked
  - User can still manually link via "Link Appointment" button in Linked Appointments section
**Edge Cases / Negative Tests:**
  - User dismisses banner, then manually links appointment later: confirmation shown, link is created
  - Suggestion dismissed, then appointment is deleted: banner doesn't reappear (appointment no longer exists)

---

### TC-F6-04: Display linked appointments in document detail

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document has one or more linked appointments  
**Steps:**
  1. Open Document Detail
  2. Scroll to the "Linked Appointments" section (below Extracted Text, above Category section)
  3. Observe the list of linked appointments:
     - `[ Cardiology checkup ]`
     - `[ Date: 14 Apr 2024, 10:00 AM ]`
     - `[ Location: Heart Care Clinic ]`
     - `[ Unlink ]` button
  4. Verify all appointment details are displayed
**Expected Result:**
  - Linked appointments are shown in a clear, readable format
  - Each appointment shows name, date, time, and location
  - User can click appointment name to navigate to Appointment Detail
  - `[ Unlink ]` button is visible and clickable
  - Multiple linked appointments are displayed in a list
**Edge Cases / Negative Tests:**
  - No linked appointments: section shows "No linked appointments. [Link Appointment]" with button to add
  - Appointment has no location: field is omitted or shows "No location"
  - Appointment is deleted elsewhere: link is broken; Document Detail shows error or hides deleted appointment

---

### TC-F6-05: Unlink appointment from document

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document Detail is open with linked appointments displayed  
**Steps:**
  1. Locate a linked appointment in the "Linked Appointments" section
  2. Click the `[ Unlink ]` button next to the appointment
  3. Confirmation dialog appears: "Unlink this appointment? The document and appointment will be separated."
  4. Click `[ Cancel ]` to abort
  5. Click `[ Unlink ]` again on the button
  6. Dialog appears; click `[ Yes, Unlink ]`
  7. Verify appointment is removed from the list
**Expected Result:**
  - Confirmation dialog prevents accidental unlinking
  - Clicking Cancel closes dialog, link remains
  - Clicking "Yes, Unlink" removes the link
  - Linked Appointments section updates immediately
  - Appointment is no longer shown; if it was the only link, section shows "No linked appointments" message
**Edge Cases / Negative Tests:**
  - Network error during unlink: error message shown, link remains, user can retry
  - User unlinks appointment, then reloads document: link remains unlinked (persisted)
  - User clicks `[ Unlink ]` on multiple appointments rapidly: all are processed in order

---

### TC-F6-06: Add new appointment link from document detail via picker

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 17 (Document Detail v2)  
**Precondition:** Document Detail is open; "Linked Appointments" section is visible  
**Steps:**
  1. Locate the "Linked Appointments" section
  2. Click `[ Link Appointment ]` button (or `[ + ]` button if no links exist)
  3. Appointment picker modal appears showing a list of appointments
  4. Filter to appointments within ±30 days of document date (e.g., if document is "15 Apr", show appointments from "16 Mar" to "15 May")
  5. Select "Cardiology checkup (14 Apr)" from the list
  6. Click `[ Link ]` or appointment row to confirm
  7. Verify appointment is added to Linked Appointments
**Expected Result:**
  - Appointment picker modal shows filtered list (±30 days)
  - User can select one appointment at a time
  - Clicking appointment or "Link" button creates the link
  - Modal closes and Linked Appointments section updates
  - Newly linked appointment appears in the list
**Edge Cases / Negative Tests:**
  - No appointments within ±30 days: picker shows empty state "No appointments in this date range"
  - User cancels picker without selecting: modal closes, no change
  - Already-linked appointment appears in picker: disabled or marked "Already linked"
  - User links same appointment twice: prevented via validation (already linked)

---

### TC-F6-07: View Timeline by Time grouping with linked document indicators

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 19 (Timeline v2 By Time)  
**Precondition:** Timeline view is open with multiple appointments and linked documents  
**Steps:**
  1. Navigate to Timeline view
  2. Observe three tab buttons at the top: `[ By Time ]`, `[ By Category ]`, `[ By Doctor ]`
  3. Click `[ By Time ]` tab (or verify it's already active)
  4. Timeline displays appointments and documents chronologically grouped by date:
     - `[14 Apr 2024]` (date header)
     - `Cardiology checkup (10:00 AM)` [↔] ← linked indicator
     - `Lab results PDF` [↔] ← linked indicator
  5. Scroll through timeline to verify chronological order
**Expected Result:**
  - Timeline shows chronological entries grouped by date
  - Linked documents display link indicator `[↔]` next to their names
  - Clicking a linked entry navigates to its detail view
  - Unlinked appointments/documents appear without `[↔]` indicator
  - Visual hierarchy is clear (dates, entries, indicators)
**Edge Cases / Negative Tests:**
  - No entries for a date range: "No events in this period" message shown
  - Very large timeline (1000+ entries): scrolling is smooth, pagination or virtualization is used
  - Entry is unlinked after viewing timeline: indicator disappears on refresh

---

### TC-F6-08: View Timeline by Category grouping with colour-coded headers

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 20 (Timeline v2 By Category)  
**Precondition:** Timeline view is open; appointments and documents are categorized  
**Steps:**
  1. Click `[ By Category ]` tab
  2. Timeline displays grouped by category with colour-coded headers:
     - `[⊕ Cardiology]` (header with colour swatch, collapsible)
     - `  Cardiology checkup (14 Apr, 10:00 AM)` [↔]
     - `  ECG report (12 Apr)` [↔]
     - `[▼ Cardiology]` (expanded arrow shown)
  3. Click header to collapse category:
     - `[▶ Cardiology]` (collapsed arrow)
     - Entries hidden
  4. Click again to expand
**Expected Result:**
  - Entries are grouped by assigned category
  - Category header shows colour swatch `[⊕]` matching category colour
  - Header is clickable to toggle expand/collapse
  - Linked indicators `[↔]` are visible on linked entries
  - Uncategorized entries appear in "Other" section
  - Visual separation between categories is clear
**Edge Cases / Negative Tests:**
  - Category has no entries: section not shown (or shown collapsed with count "0")
  - Document/appointment has multiple categories: entry appears under first category or in "Multi-category" section
  - Category is deleted: entries revert to "Other" category on reload

---

### TC-F6-09: View Timeline by Doctor grouping with Other Providers section

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 21 (Timeline v2 By Doctor)  
**Precondition:** Timeline view is open; appointments and documents have associated providers  
**Steps:**
  1. Click `[ By Doctor ]` tab
  2. Timeline displays grouped by provider/doctor:
     - `[Dr. Sarah Johnson]` (provider header, collapsible)
     - `  Cardiology checkup (14 Apr, 10:00 AM)` [↔]
     - `  Report: 12 Apr` [↔]
     - `[Dr. John Smith]` (another provider)
     - `  Lab work (10 Apr)` [↔]
     - `[Other Providers]` (uncategorised or unassociated entries)
     - `  Appointment (no provider)` [—]
  3. Click provider header to collapse:
     - Entries hidden, arrow direction changes
  4. Verify unlinked entries have no indicator or show `[—]` placeholder
**Expected Result:**
  - Entries grouped by associated doctor/provider
  - Each provider section is collapsible
  - Unassociated entries appear in "Other Providers" section
  - Link indicators visible on linked entries
  - Clear visual hierarchy and separation between providers
**Edge Cases / Negative Tests:**
  - No appointments associated with a doctor: doctor section not shown
  - Document linked to appointment but appointment has no provider: document appears in "Other Providers"
  - Provider is deleted: entries remain but provider group is removed on reload

---

### TC-F6-10: Linked indicators visible in all timeline views

**Feature:** Document-Appointment Linking & Timeline v2  
**Screen(s):** Screen 19 (By Time), Screen 20 (By Category), Screen 21 (By Doctor)  
**Precondition:** Timeline view shows multiple entries with linked and unlinked pairs  
**Steps:**
  1. Switch between all three timeline views: By Time, By Category, By Doctor
  2. In each view, identify linked entries (marked with `[↔]`)
  3. Verify the same entries are marked across all views
  4. Click a linked entry to navigate to its detail
  5. Unlink the entry
  6. Return to Timeline and verify indicator is gone from all views
**Expected Result:**
  - Link indicator `[↔]` is consistently visible across all three timeline grouping modes
  - Indicator placement is clear and non-obstructive (e.g., to the right of entry name)
  - After unlinking, indicator disappears from all views on reload or immediate refresh
  - Linked pairs are visually consistent regardless of grouping mode
**Edge Cases / Negative Tests:**
  - Entry has multiple links (e.g., document linked to two appointments): indicator still shows once, clicking reveals all links
  - Entry is very long (exceeds line width): indicator position adjusts or moves to separate line
  - Large number of linked entries (50+): visual performance is maintained, all indicators render correctly

---

## Phase 8 (v1.2) — New Feature Acceptance Tests

---

### TC-F7-01: Advanced search — date-range filter returns only matching documents

**Feature:** Advanced Search Filters  
**Screen(s):** Screen 4 (Documents) — Search / Filter panel  
**Precondition:** At least 4 documents uploaded; two with dates in Jan 2024, two with dates in Mar 2024  
**Steps:**
  1. Open the Search / Filter panel on Documents screen
  2. Set "From" date to `2024-01-01` and "To" date to `2024-01-31`
  3. Apply filter
  4. Observe document list
  5. Clear filter and verify all documents return
**Expected Result:**
  - Only documents whose date falls within `2024-01-01`–`2024-01-31` are shown
  - Documents from March 2024 are hidden
  - Result count badge updates to reflect filtered count
  - Clearing the filter restores the full list
**Edge Cases / Negative Tests:**
  - "From" > "To": filter is rejected with inline validation error; no query executed
  - No documents in range: empty state shown with "No results for this date range" message
  - Single-day range ("From" = "To"): documents from that exact date shown

---

### TC-F7-02: Advanced search — category filter limits results

**Feature:** Advanced Search Filters  
**Screen(s):** Screen 4 (Documents) — Filter panel  
**Precondition:** 3+ categories exist; documents assigned to at least two different categories  
**Steps:**
  1. Open the Filter panel
  2. Select "Lab Results" from the category dropdown
  3. Apply filter and verify list
  4. Add a second category ("Prescriptions") to the active filter
  5. Verify results include documents from both categories
**Expected Result:**
  - Step 3: only documents in "Lab Results" are shown
  - Step 5: documents from either "Lab Results" OR "Prescriptions" appear (union, not intersection)
  - Active filter pills are visible above the list, each individually removable
**Edge Cases / Negative Tests:**
  - Selecting a category with no documents: empty state shown
  - Removing one pill from multi-category filter: list updates immediately without full reset

---

### TC-F7-03: Advanced search — combined text query and date range

**Feature:** Advanced Search Filters  
**Screen(s):** Screen 4 (Documents) — Search bar + Filter panel  
**Precondition:** At least one document contains the word "cholesterol" and has a date in 2024  
**Steps:**
  1. Type `cholesterol` in the search bar
  2. Set date range to `2024-01-01`–`2024-12-31`
  3. Apply both simultaneously
  4. Verify results satisfy both constraints
**Expected Result:**
  - Only documents containing "cholesterol" AND within 2024 are shown
  - No result that matches text but has a 2023 date appears
**Edge Cases / Negative Tests:**
  - Text matches documents but none fall in date range: empty state "No matches combining these filters"
  - Date range matches documents but none contain the search term: empty state

---

### TC-F7-04: Advanced search — filter state persists during navigation within session

**Feature:** Advanced Search Filters  
**Screen(s):** Screen 4 (Documents) → other screen → back to Documents  
**Precondition:** An active date-range + category filter is applied  
**Steps:**
  1. Apply a date-range filter and a category filter in Documents
  2. Navigate to Appointments screen
  3. Navigate back to Documents screen
  4. Observe filter state
**Expected Result:**
  - Active filters are still applied on return — list shows filtered results
  - Filter pills are still visible
  - User can clear filters with the "Clear all" button
**Edge Cases / Negative Tests:**
  - App is relaunched: filters are cleared (no persistence across restarts required)

---

### TC-F8-01: Category drag-reorder persists after reload

**Feature:** Category Management — Drag to Reorder  
**Screen(s):** Screen 6 (Settings → Categories)  
**Precondition:** At least 4 categories exist at the same hierarchy level  
**Steps:**
  1. Open Settings → Categories
  2. Drag "Prescriptions" above "Lab Results" using the drag handle
  3. Release to drop
  4. Verify new order in the list
  5. Quit and relaunch the app
  6. Return to Settings → Categories
**Expected Result:**
  - After drag: "Prescriptions" appears above "Lab Results" immediately
  - After relaunch: order is preserved
  - Reorder applies only to siblings at the same level; parent–child structure is unchanged
**Edge Cases / Negative Tests:**
  - Dragging a parent to become a child of another: depth limit enforced — move rejected if it would exceed 3 levels
  - Drag cancelled (Escape / pointer released outside drop zone): order reverts to pre-drag state

---

### TC-F8-02: Category auto-archive applies after threshold and is reversible

**Feature:** Category Management — Auto-Archive  
**Screen(s):** Screen 6 (Settings → Categories), Screen 4 (Documents — category filter)  
**Precondition:** One category ("Old Tests") has zero documents and has not been modified for longer than the configured threshold  
**Steps:**
  1. Open Settings → Categories — set auto-archive threshold to 30 days
  2. Ensure "Old Tests" has no documents and was last used > 30 days ago
  3. Restart the app
  4. Open Settings → Categories — verify "Old Tests" is archived
  5. Open the category filter in Documents — verify "Old Tests" is not in the active list
  6. Restore "Old Tests" from the archived view
  7. Verify "Old Tests" reappears in the active filter list
**Expected Result:**
  - On restart, "Old Tests" is moved to archived state automatically
  - Archived categories do not appear in the Documents filter picker
  - Restoring brings the category back to the active list
**Edge Cases / Negative Tests:**
  - Category with documents but no recent activity: NOT archived (only empty categories eligible)
  - Auto-archive disabled (threshold = Never): no categories archived automatically

---

### TC-F8-03: Category auto-archive threshold setting persists across sessions

**Feature:** Category Management — Auto-Archive  
**Screen(s):** Screen 6 (Settings → Categories)  
**Precondition:** Default threshold is set  
**Steps:**
  1. Open Settings → Categories
  2. Change auto-archive threshold to "60 days"
  3. Quit and relaunch the app
  4. Open Settings → Categories
  5. Verify threshold reads "60 days"
**Expected Result:**
  - Threshold is stored in SQLite `settings` table and survives restart
**Edge Cases / Negative Tests:**
  - Threshold set to "Never": auto-archive disabled; no categories moved automatically

---

### TC-F9-01: Calendar conflict detection surfaces overlapping appointments

**Feature:** Calendar Conflict Resolution  
**Screen(s):** Screen 7 (Appointments — calendar view)  
**Precondition:** Two appointments with overlapping time slots on the same day (e.g., both 10:00–11:00 on 2024-06-15)  
**Steps:**
  1. Navigate to Appointments — calendar view
  2. Locate 2024-06-15
  3. Look for a conflict indicator on the day cell
  4. Click the conflict indicator to open the conflict resolution panel
  5. Verify both appointments are shown side-by-side with full details
**Expected Result:**
  - Day cell shows a conflict badge (e.g., orange `!` or "2 conflicts" label)
  - Side-by-side panel clearly labels each appointment and highlights the overlapping time
**Edge Cases / Negative Tests:**
  - Same-day appointments with non-overlapping times: no conflict badge shown
  - All-day appointment vs. timed appointment: flagged as potential conflict; shown in panel

---

### TC-F9-02: Conflict resolution — keep one appointment and delete the other

**Feature:** Calendar Conflict Resolution  
**Screen(s):** Conflict resolution panel  
**Precondition:** TC-F9-01 conflict visible; panel open  
**Steps:**
  1. In the conflict panel, click "Keep This" on the first appointment
  2. Confirm deletion in the confirmation dialog
  3. Return to calendar view
  4. Verify the deleted appointment is gone and the kept one remains
  5. Verify the conflict badge on the day cell is cleared
**Expected Result:**
  - Second appointment is permanently deleted
  - First appointment retains all details and linked documents
  - Conflict badge disappears from the day cell
**Edge Cases / Negative Tests:**
  - Clicking "Cancel" in the confirmation dialog: no appointment deleted; panel remains open
  - Deleted appointment had linked documents: documents remain; appointment link removed

---

### TC-F9-03: Conflict badge absent when no conflicts exist

**Feature:** Calendar Conflict Resolution  
**Screen(s):** Screen 7 (Appointments — calendar view)  
**Precondition:** All conflicts resolved  
**Steps:**
  1. Resolve all conflicts as per TC-F9-02
  2. Navigate away from calendar and back
  3. Inspect all day cells
**Expected Result:**
  - No conflict badges appear on any day cell
**Edge Cases / Negative Tests:**
  - Fresh installation with no appointments: no conflict badge shown

---

### TC-F10-01: PDF summary export generates a valid structured file

**Feature:** PDF Summary Export  
**Screen(s):** Screen 4 (Documents) — export action  
**Precondition:** At least 3 documents and 2 appointments exist  
**Steps:**
  1. Click the PDF Summary Export button
  2. Choose a save path in the system file dialog
  3. Wait for export to complete
  4. Open the exported PDF in the system viewer
**Expected Result:**
  - A valid PDF file is saved to the chosen path
  - PDF opens without error
  - PDF contains: a cover page with export date and app name; a Documents section with metadata and text snippets; an Appointments section listing each appointment
  - Page numbers present
**Edge Cases / Negative Tests:**
  - User cancels the file dialog: no file is written; no error shown
  - Document with no extracted text: entry still appears with metadata; snippet field is blank

---

### TC-F10-02: PDF summary export covers all entity sections

**Feature:** PDF Summary Export  
**Screen(s):** Exported PDF  
**Precondition:** Database contains documents, appointments, and contacts  
**Steps:**
  1. Run PDF summary export (TC-F10-01)
  2. Open exported PDF and scroll all pages
  3. Verify headed sections exist for each entity type
**Expected Result:**
  - Each entity type has its own section header
  - All database records appear (no silent omissions)
  - Long text is truncated with ellipsis rather than overflowing page margin
**Edge Cases / Negative Tests:**
  - Empty section (e.g., no contacts): header present with "No records" note
  - Very long document title (100+ chars): title wraps or is truncated

---

### TC-F10-03: PDF export cancelled at file dialog leaves no temp files

**Feature:** PDF Summary Export  
**Screen(s):** File dialog during export  
**Precondition:** Export button clicked; file dialog open  
**Steps:**
  1. Click PDF Summary Export
  2. When file dialog appears, click Cancel
  3. Check Downloads folder and `/tmp` for partial files
**Expected Result:**
  - No `.pdf` file written to disk; any temporary file cleaned up
  - App returns to normal state; no error notification shown
**Edge Cases / Negative Tests:**
  - Export interrupted mid-write (disk full): partial file cleaned up; error notification "Export failed — disk full" shown
