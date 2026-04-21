# myHealth — UI Wireframes v1.1.0

**Version:** 2.0  
**Date:** 2026-04-21  
**Extends:** WIREFRAMES.md (Screens 1–15)

Legend:
```
[ Button ]   = clickable button
[ Input__ ]  = text input field
[v]          = dropdown / select
(●)          = selected radio / active state
( )          = unselected radio
[x]          = close / delete
[+]          = add / new
[≡]          = menu / list
[↑]          = upload
[↓]          = download / export
[🔍]         = search
[◀] [▶]     = navigation arrows
[⊕]          = category colour swatch
[↔]          = link / connection
[◉]          = extraction status indicator
```

---

## Screen 16 — Upload Dialog v2 (Filename Parsing + Category Multi-Select)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  Documents                                               │
│          │                                                          │
│          │  ┌─────────────────────────────────────────────────┐    │
│          │  │  Upload Document                           [x]  │    │
│          │  │  ─────────────────────────────────────────────  │    │
│          │  │                                                  │    │
│          │  │  ┌─────────────────────────────────────────┐    │    │
│          │  │  │                                         │    │    │
│          │  │  │   Drag & drop file here, or             │    │    │
│          │  │  │         [ Choose File ]                 │    │    │
│          │  │  │   PDF, JPG, PNG, HEIC, TIFF, DOCX       │    │    │
│          │  │  │   Max 100 MB                            │    │    │
│          │  │  │                                         │    │    │
│          │  │  └─────────────────────────────────────────┘    │    │
│          │  │                                                  │    │
│          │  │  ┌─ Parsed from filename: ──────────────────┐   │    │
│          │  │  │ Date: 01 Dec 2024 (can edit)             │   │    │
│          │  │  │ Tags: [bloodtest] [nhs] [x] [x]          │   │    │
│          │  │  │       [ + Add tag ]                       │   │    │
│          │  │  └──────────────────────────────────────────┘   │    │
│          │  │                                                  │    │
│          │  │  Category (Multi-select)                         │    │
│          │  │  ┌────────────────────────────────────────────┐  │    │
│          │  │  │ ☑ ⊕ Lab Result (system)                    │  │    │
│          │  │  │   ☑ ⊕ Blood Tests                          │  │    │
│          │  │  │   ☑ ⊕ Pathology                            │  │    │
│          │  │  │ ☐ ⊕ Imaging (system)                       │  │    │
│          │  │  │ ☐ ⊕ Cardiology                             │  │    │
│          │  │  │ ☑ ⊕ My Custom Category (user)              │  │    │
│          │  │  │ ☐ [x] Old Category (user, deletable)       │  │    │
│          │  │  └────────────────────────────────────────────┘  │    │
│          │  │                                                  │    │
│          │  │  Notes                                           │    │
│          │  │  [ ________________________________ ]            │    │
│          │  │  [ ________________________________ ]            │    │
│          │  │                                                  │    │
│          │  │            [ Cancel ]  [ Upload ]                │    │
│          │  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- File selection triggers automatic filename parsing (date + tag extraction)
- Parsed date field is editable; user can override
- Parsed tags shown as removable chips; user can add more via "+ Add tag"
- Category picker shows system categories (with lock icon, greyed) and user categories
- Multiple categories can be selected via checkboxes
- Colour swatch (⊕) shown next to each category name
- File path must be chosen before preview populates

---

## Screen 17 — Document Detail v2 (Extraction Status + Text + Linked Appointments)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  ◀ Documents  /  Blood Test Results                      │
│          │  ─────────────────────────────────────────────────────  │
│          │  ┌─────────────────────────────────────────────┐         │
│          │  │                                             │         │
│          │  │    [ PDF inline viewer ]                    │         │
│          │  │                                             │         │
│          │  │    Blood Test Results                       │         │
│          │  │    April 14 2026                            │         │
│          │  │    Page 1 / 2                               │         │
│          │  │                                             │         │
│          │  │    [ ◀ Prev ]  [ Next ▶ ]                   │         │
│          │  │                                             │         │
│          │  │    [ ↓ Open in Finder ]                     │         │
│          │  │                                             │         │
│          │  │    ┌─ Extracted Text ────────────────────┐  │         │
│          │  │    │ [◉ Extracted] (1244 chars)       [▼] │  │         │
│          │  │    │ Patient: Jane Doe, DOB: 15/03/1985   │  │         │
│          │  │    │ Haemoglobin: 14.2 g/dL (normal)     │  │         │
│          │  │    │ White blood cell: 7.1 (normal)      │  │         │
│          │  │    │ Platelets: 245 (normal)             │  │         │
│          │  │    │ Glucose: 5.2 mmol/L (normal)        │  │         │
│          │  │    │ [scroll]                             │  │         │
│          │  │    └─────────────────────────────────────┘  │         │
│          │  │                                             │         │
│          │  └─────────────────────────────────────────────┘         │
│          │                                                          │
│          │                 ┌────────────────────────────────────┐   │
│          │                 │  Details                           │   │
│          │                 │  ────────────────────────────────  │   │
│          │                 │  Categories                        │   │
│          │                 │  ☑ ⊕ Lab Result                   │   │
│          │                 │  ☑ ⊕ Blood Tests                  │   │
│          │                 │  ☐ ⊕ Imaging                      │   │
│          │                 │  [ + Add category ]               │   │
│          │                 │                                    │   │
│          │                 │  Uploaded                          │   │
│          │                 │  14 Apr 2026                       │   │
│          │                 │                                    │   │
│          │                 │  Size                              │   │
│          │                 │  1.2 MB                            │   │
│          │                 │                                    │   │
│          │                 │  Tags                              │   │
│          │                 │  #cholesterol #annual              │   │
│          │                 │  [ + Add tag ]                     │   │
│          │                 │                                    │   │
│          │                 │  Linked Appointments               │   │
│          │                 │  ┌──────────────────────────────┐  │   │
│          │                 │  │ 🗓 Annual Checkup             │  │   │
│          │                 │  │   12 Mar 2026, 9:00 AM        │  │   │
│          │                 │  │   Dr. James Liu               │  │   │
│          │                 │  │             [ View ] [x]      │  │   │
│          │                 │  └──────────────────────────────┘  │   │
│          │                 │  [ + Link appointment ]            │   │
│          │                 │                                    │   │
│          │                 │  Notes                             │   │
│          │                 │  [ ──────────────────────────── ]  │   │
│          │                 │  [ ──────────────────────────── ]  │   │
│          │                 │  [ Save Notes ]                    │   │
│          │                 │                                    │   │
│          │                 │  [ Delete ]                        │   │
│          │                 └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- Extraction status badge shows one of: "Extracting…" | "Extracted" | "No text found"
- Extracted text section collapsible (default closed); shows word count and character count
- Extracted text shown in scrollable box (max ~8 rows visible before scroll)
- Category picker now shows multi-select checkboxes with colour swatches
- New "Linked Appointments" section displays all associated appointments
- Each linked appointment has a [View] button and [x] unlink button
- "+ Link appointment" button opens modal to search and attach appointments
- Multiple-category selection persists on save

---

## Screen 18 — Document–Appointment Link Suggestion Card

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  ◀ Documents  /  Blood Test Results                      │
│          │  ─────────────────────────────────────────────────────  │
│          │                                                          │
│          │  ╔════════════════════════════════════════════════════╗  │
│          │  ║ ⚡ Found nearby appointment                    [x] ║  │
│          │  ║                                                    ║  │
│          │  ║ This document (14 Apr 2026) is near:              ║  │
│          │  ║ 🗓 Annual Checkup — 12 Mar 2026, 9:00 AM          ║  │
│          │  ║   Dr. James Liu · GP Surgery                       ║  │
│          │  ║                                                    ║  │
│          │  ║     [ Link Now ]  [ Dismiss ]                      ║  │
│          │  ╚════════════════════════════════════════════════════╝  │
│          │                                                          │
│          │  ┌─────────────────────────────────────────────┐         │
│          │  │    [ PDF inline viewer ]                    │         │
│          │  │                                             │         │
│          │  │    Blood Test Results                       │         │
│          │  │    [rest of detail view below]             │         │
│          │  │                                             │         │
│          │  └─────────────────────────────────────────────┘         │
│          │                                                          │
│          │  [right sidebar details panel...]                        │
│          │                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- Dismissible banner shown at top of Document Detail after upload + extraction
- Banner appears if appointment found within ±3 days of document date
- Displays appointment summary: title, date/time, doctor name, location
- "Link Now" creates bidirectional link; "Dismiss" removes banner without linking
- Banner persists across page reload unless dismissed
- If multiple candidates exist, show first match; include "See all N matches" link

---

## Screen 19 — Timeline v2 — By Time View (Default, Enhanced)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  Timeline                                                │
│          │  ─────────────────────────────────────────────────────  │
│          │  View: [By Time] [By Category] [By Doctor]               │
│          │  Filter: [ All [v] ] [ Documents ] [ Appointments ]      │
│          │          [ Notes ]   Date range: [ From ] → [ To ]       │
│          │                                                          │
│          │  ── APRIL 2026 ───────────────────────────────────────  │
│          │                                                          │
│          │    │  14 Apr  [PDF]  Blood Test Results uploaded         │
│          │    │          Lab Result · Dr. James Liu                 │
│          │    │          ↔ Annual Checkup (12 Mar)                 │
│          │    │                                                     │
│          │    │  12 Apr  [🗓]  GP Annual Checkup — Completed        │
│          │    │          Dr. James Liu · GP Surgery                 │
│          │    │          ↔ Blood Test Results (14 Apr)             │
│          │    │                                                     │
│          │    │  10 Apr  [IMG]  Chest X-Ray uploaded                │
│          │    │          Imaging                                    │
│          │    │                                                     │
│          │    │  8 Apr   [PDF]  Prescription April 2026 uploaded    │
│          │    │          Prescription                               │
│          │                                                          │
│          │  ── MARCH 2026 ────────────────────────────────────── │  │
│          │                                                          │
│          │    │  12 Mar  [🗓]  Annual Checkup — Completed           │
│          │    │          Dr. James Liu · GP Surgery                 │
│          │    │          ↔ Blood Test Results (14 Apr)             │
│          │    │                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- Three view tabs at top: [By Time] [By Category] [By Doctor]
- By Time remains chronological sort (newest or oldest, user configurable)
- Linked appointments shown inline with document via "↔" symbol
- Shows linked document name + date for each linked item
- Maintains all existing filter + date range controls
- Tab switching preserves filters and date range
- Linked items styled subtly differently (indented or lighter background)

---

## Screen 20 — Timeline v2 — By Category View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  Timeline                                                │
│          │  ─────────────────────────────────────────────────────  │
│          │  View: [By Time] [By Category] [By Doctor]               │
│          │  Filter: [ All [v] ] [ Documents ] [ Appointments ]      │
│          │          [ Notes ]   Date range: [ From ] → [ To ]       │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │ ⊕ Lab Result (Colour: #FF6B4A)                     │  │
│          │  │ ──────────────────────────────────────────────────  │  │
│          │  │   │  14 Apr  [PDF]  Blood Test Results              │  │
│          │  │   │          1.2 MB · Dr. James Liu                 │  │
│          │  │   │                                                 │  │
│          │  │   │  8 Apr   [PDF]  Prescription April 2026         │  │
│          │  │   │          0.3 MB                                 │  │
│          │  │   │                                                 │  │
│          │  │   │  12 Apr  [🗓]  GP Annual Checkup               │  │
│          │  │   │          9:00 AM · Dr. James Liu                │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │ ⊕ Imaging (Colour: #4A90FF)                         │  │
│          │  │ ──────────────────────────────────────────────────  │  │
│          │  │   │  10 Apr  [IMG]  Chest X-Ray                     │  │
│          │  │   │          8.4 MB · City Imaging Clinic           │  │
│          │  │   │                                                 │  │
│          │  │   │  3 Feb   [IMG]  Left Hand X-Ray                 │  │
│          │  │   │          2.1 MB                                 │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │ ⊕ Cardiology (Colour: #E84D5F)                      │  │
│          │  │ ──────────────────────────────────────────────────  │  │
│          │  │   │  27 Apr  [🗓]  Cardiology Check — Scheduled      │  │
│          │  │   │          10:30 AM · Dr. Sarah Chen              │  │
│          │  │   │                                                 │  │
│          │  │   │  15 Apr  [📝]  Echo review notes                │  │
│          │  │   │          Updated: 15 Apr 2026                   │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- Group header background uses category's custom colour (⊕ swatch matches)
- Group headers collapsible (toggle with [▼] or [▶])
- Each category groups documents + appointments + notes assigned to it
- Items within group sorted by date (descending)
- Empty categories hidden by default (show empty option in filter settings)
- Linked documents show inline indicator if they belong to multiple categories
- System categories always present; user categories listed after

---

## Screen 21 — Timeline v2 — By Doctor View

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  Timeline                                                │
│          │  ─────────────────────────────────────────────────────  │
│          │  View: [By Time] [By Category] [By Doctor]               │
│          │  Filter: [ All [v] ] [ Documents ] [ Appointments ]      │
│          │          [ Notes ]   Date range: [ From ] → [ To ]       │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │ Dr. Sarah Chen (Cardiologist)                      │  │
│          │  │ ──────────────────────────────────────────────────  │  │
│          │  │   │  27 Apr  [🗓]  Cardiology Check — Scheduled      │  │
│          │  │   │          10:30 AM · City Heart Clinic           │  │
│          │  │   │          ↔ Cardiology notes (15 Apr)            │  │
│          │  │   │                                                 │  │
│          │  │   │  15 Apr  [📝]  Cardiology visit notes           │  │
│          │  │   │          Updated: 15 Apr 2026                   │  │
│          │  │   │                                                 │  │
│          │  │   │  10 Apr  [IMG]  Echo results scan               │  │
│          │  │   │          1.8 MB                                 │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │ Dr. James Liu (GP)                                 │  │
│          │  │ ──────────────────────────────────────────────────  │  │
│          │  │   │  12 Apr  [🗓]  Annual Checkup — Completed       │  │
│          │  │   │          9:00 AM · GP Surgery                   │  │
│          │  │   │          ↔ Blood Test Results (14 Apr)          │  │
│          │  │   │                                                 │  │
│          │  │   │  14 Apr  [PDF]  Blood Test Results              │  │
│          │  │   │          1.2 MB · Lab Result                    │  │
│          │  │   │                                                 │  │
│          │  │   │  8 Apr   [PDF]  Prescription April 2026         │  │
│          │  │   │          0.3 MB                                 │  │
│          │  │                                                     │  │
│          │  │   │  12 Mar  [🗓]  Annual Checkup — Completed       │  │
│          │  │   │          9:00 AM · GP Surgery                   │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │ Other Providers                                    │  │
│          │  │ ──────────────────────────────────────────────────  │  │
│          │  │   │  10 Apr  [IMG]  Chest X-Ray                     │  │
│          │  │   │          8.4 MB · City Imaging Clinic           │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- Groups items by doctor/provider contact
- Each group shows appointments + linked documents from that doctor
- "Other Providers" group appears if documents have no associated contact
- Group headers collapsible (toggle with [▼] or [▶])
- Items within group sorted by date (descending)
- Linked appointments shown inline with "↔" indicator
- Clicking doctor name navigates to Contact detail if desired
- Maintains all existing filter controls

---

## Screen 22 — Settings > Calendar Sync

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  Settings > Calendar Sync                                │
│          │  ─────────────────────────────────────────────────────  │
│          │                                                          │
│          │  Apple Calendar Sync                                     │
│          │  ┌──────────────────────────────────────────────────┐   │
│          │  │  Permission Status: ● Granted                    │   │
│          │  │  Last synced: 2 minutes ago                       │   │
│          │  │                                          [ Sync ] │   │
│          │  │                                                  │   │
│          │  │  Available Calendars:                            │   │
│          │  │  ☑ Personal                                      │   │
│          │  │  ☑ Work                                          │   │
│          │  │  ☐ Medical                                       │   │
│          │  │  ☐ Family                                        │   │
│          │  │                                                  │   │
│          │  │  Sync Frequency                                  │   │
│          │  │  ( ) Manual  (●) Every 15 min  ( ) Every hour    │   │
│          │  │                                                  │   │
│          │  │  On Sync:                                        │   │
│          │  │  ☑ Add new events from my calendars              │   │
│          │  │  ☑ Update existing myHealth appointments         │   │
│          │  │  ☐ Create calendar events for linked documents   │   │
│          │  │                                                  │   │
│          │  │  [ Enable ] [ Disable ]                          │   │
│          │  │  [ Clear Synced Events ]  (deletes all)          │   │
│          │  └──────────────────────────────────────────────────┘   │
│          │                                                          │
│          │  macOS Only Feature                                      │
│          │  ┌──────────────────────────────────────────────────┐   │
│          │  │  ℹ Calendar Sync is only available on macOS.    │   │
│          │  │  On other platforms, appointments can be         │   │
│          │  │  manually linked to documents.                   │   │
│          │  └──────────────────────────────────────────────────┘   │
│          │                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- First launch on macOS shows permission request: "myHealth needs access to your calendars"
- Permission status shows: "○ Not requested" | "⚠ Denied" | "● Granted"
- Calendar list populates only after permission granted
- Selected calendars have their events imported into myHealth calendar_events table
- Sync button triggers immediate sync; last sync timestamp updates
- Disable toggle turns off all syncing; calendars remain selected for future re-enable
- "Clear Synced Events" destructive action (confirmation modal required)
- Non-macOS shows informational notice; all controls disabled/hidden
- Frequency radio buttons control auto-sync interval

---

## Screen 23 — Settings > Category Manager

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  Settings > Category Manager                             │
│          │  ─────────────────────────────────────────────────────  │
│          │                                                          │
│          │  System Categories (Read-Only)                           │
│          │  ┌──────────────────────────────────────────────────┐   │
│          │  │ ⊕ [FF6B4A] Lab Result                      [🔒]   │   │
│          │  │ ⊕ [4A90FF] Imaging                         [🔒]   │   │
│          │  │ ⊕ [2ECC71] Prescription                    [🔒]   │   │
│          │  │ ⊕ [E84D5F] Cardiology                      [🔒]   │   │
│          │  │ ⊕ [8B4513] Ophthalmology                   [🔒]   │   │
│          │  │ ⊕ [FF9500] Dental                          [🔒]   │   │
│          │  │ ⊕ [9B59B6] Mental Health                   [🔒]   │   │
│          │  │ ⊕ [34495E] Other                           [🔒]   │   │
│          │  └──────────────────────────────────────────────────┘   │
│          │                                                          │
│          │  User Categories                                         │
│          │  ┌──────────────────────────────────────────────────┐   │
│          │  │ ⊕ [F39C12] Physical Therapy                       │   │
│          │  │        [ Edit ]  [x] Delete                       │   │
│          │  │ ⊕ [C0392B] Urgent Care                            │   │
│          │  │        [ Edit ]  [x] Delete                       │   │
│          │  │ ⊕ [1ABC9C] Wellness                               │   │
│          │  │        [ Edit ]  [x] Delete                       │   │
│          │  └──────────────────────────────────────────────────┘   │
│          │                                                          │
│          │  [ + New Category ]                                      │
│          │                                                          │
│          │  ── Category Editor (Inline) ────────────────────────    │
│          │  Name:  [ Physical Therapy_________________ ]           │
│          │  Color: [⊕ F39C12]  [ Pick Color ]                      │
│          │                 [ Save ] [ Cancel ]                      │
│          │                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- System categories (with 🔒 lock icon) are read-only; cannot be deleted or renamed
- User categories show [Edit] and [x] Delete buttons
- Clicking [Edit] opens inline editor for name + colour picker
- Colour picker shows palette or hex input field
- New category form appears below "+ New Category" button
- Deleting a user category shows confirmation: "Remove from N documents?"
- Category changes immediately reflected in all documents and timeline views
- Colour swatch (⊕) shows current colour; clicking opens colour picker modal

---

## Screen 24 — Contact Auto-Creation Banner + Pre-filled Contact Form

```
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar │  ◀ Documents  /  Blood Test Results                      │
│          │  ─────────────────────────────────────────────────────  │
│          │                                                          │
│          │  ╔════════════════════════════════════════════════════╗  │
│          │  ║ ➕ Doctor found in document                     [x] ║  │
│          │  ║                                                    ║  │
│          │  ║ Dr. Sarah Chen (Cardiologist)                      ║  │
│          │  ║                                                    ║  │
│          │  ║     [ Create Contact ] [ Dismiss ] [ See all 2 ]   ║  │
│          │  ╚════════════════════════════════════════════════════╝  │
│          │                                                          │
│          │  [Document detail below...]                             │
│          │                                                          │
│          │  ┌────────────────────────────────────────────────────┐  │
│          │  │ ◀ Contacts  /  New Contact                          │  │
│          │  │ ────────────────────────────────────────────────── │  │
│          │  │                                                     │  │
│          │  │ Full Name *                                         │  │
│          │  │ [ Dr. Sarah Chen_________________________ ]         │  │
│          │  │                                                     │  │
│          │  │ Specialty                                           │  │
│          │  │ [ Cardiologist                    [v] ]             │  │
│          │  │                                                     │  │
│          │  │ Type                                                │  │
│          │  │ [ Specialist                      [v] ]             │  │
│          │  │                                                     │  │
│          │  │ Clinic / Hospital                                   │  │
│          │  │ [ _________________________________ ]              │  │
│          │  │                                                     │  │
│          │  │ Phone                                               │  │
│          │  │ [ _________________________________ ]              │  │
│          │  │                                                     │  │
│          │  │ Email                                               │  │
│          │  │ [ _________________________________ ]              │  │
│          │  │                                                     │  │
│          │  │ Address                                             │  │
│          │  │ [ _________________________________ ]              │  │
│          │  │                                                     │  │
│          │  │ Notes                                               │  │
│          │  │ [ _________________________________ ]              │  │
│          │  │ [ _________________________________ ]              │  │
│          │  │                                                     │  │
│          │  │ [ Suggested from: Blood Test Results ]  [Remove]   │  │
│          │  │                                                     │  │
│          │  │          [ Cancel ]  [ Save Contact ]               │  │
│          │  └────────────────────────────────────────────────────┘  │
│          │                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

Notes:
- Banner appears at top of Document Detail after extraction completes
- Shows "Doctor found in document" + name + specialty (if extracted)
- "Create Contact" opens Contact form modal or new page
- Contact form pre-populated with extracted name, specialty, and document origin
- Form fields editable before save
- "Dismiss" removes banner without creating contact; does not reappear on reload
- "See all N matches" link (if multiple candidates) shows list with toggle to select
- Contact creation adds bidirectional link to the originating document
- Suggested source attribution shown at bottom: "[Suggested from: Document Name]"
- Doctor name match uses Levenshtein distance; exact matches + ≤2 char distance shown
- Multiple candidates ranked by confidence; first shown in banner

---
