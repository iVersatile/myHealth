# myHealth v1.1.0 — Manual Test Guide

Practical step-by-step guide for local manual testing. Run after `npm run tauri:dev` is confirmed working.

---

## 1. Setup

### Prerequisites

| Tool | Required Version | Install |
|------|-----------------|---------|
| Node.js | ≥ 18 | `brew install node` |
| Rust | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| SQLCipher | any | `brew install sqlcipher` |
| Tauri CLI | v2 | bundled — `npm install` installs it |

```bash
# In project root
npm install
npm run tauri:dev
```

Wait for the app window to open (~30–60s first run, ~10s subsequent).

### Testing a Release Build (.dmg)

If testing a downloaded `.dmg` instead of `tauri:dev`, macOS Gatekeeper will block the app on first launch. Remove the quarantine flag before opening:

```bash
xattr -cr /Applications/myHealth.app
```

If still blocked, register the app with Gatekeeper explicitly:

```bash
spctl --add /Applications/myHealth.app
```

After either command, double-click the app normally — no "cannot be opened" dialog will appear.

### Seed Data

Before running tests, create the following baseline data:

1. **Upload 3 documents**: a native PDF, a scanned PDF (image-based), and any other file
2. **Create 2 appointments**: one past, one future
3. **Create 1 note**
4. **Create 2 contacts**: with similar names (e.g. "John Smith" and "John A. Smith")

---

## 2. Feature Test Checklists

### F1 — Filename Parsing & Tag Extraction

> Navigate: Upload a document via the Documents page upload button.

- [ ] **TC-F1-01** Upload `2024-01-15_BloodTest_DrSmith.pdf` → document saved with date `2024-01-15`, doctor tag `DrSmith`, type tag `BloodTest`
- [ ] **TC-F1-02** Upload a file with no date pattern in name → document saved, date field blank, no crash
- [ ] **TC-F1-03** Upload a file with only a date (e.g. `2024-03-01.pdf`) → date extracted, other tags empty
- [ ] **TC-F1-04** Upload a file with special characters in name (e.g. `Report (1) & Notes.pdf`) → saves without error, name displayed correctly
- [ ] **TC-F1-05** Open a just-uploaded document detail → extracted tags visible in metadata panel
- [ ] **TC-F1-06** Edit extracted tags on document detail page → changes persist after navigating away and back

---

### F2 — PDF Text Extraction & OCR

> Navigate: Documents → Upload → select a scanned PDF.

- [ ] **TC-F2-01** Upload a native (text-layer) PDF → text extraction completes in < 500ms, extracted text appears in document detail
- [ ] **TC-F2-02** Upload a scanned PDF (image-only) → OCR progress bar appears, completes in < 30s
- [ ] **TC-F2-03** After OCR, search for a word known to be in the scanned document → document appears in results
- [ ] **TC-F2-04** Upload a 5-page scanned PDF → OCR completes for all 5 pages (check detail view shows full text)
- [ ] **TC-F2-05** Upload a non-PDF file (e.g. `.txt`) → app handles gracefully, no OCR attempted, no crash
- [ ] **TC-F2-06** During OCR, navigate away from Documents page and back → OCR completes in background; result available when returning

---

### F3 — Hierarchical Categories (Many-to-Many)

> Navigate: Documents → select a document → Category picker.

- [ ] **TC-F3-01** Assign two categories to one document → both appear in document detail; document appears when filtering by either category
- [ ] **TC-F3-02** Create a child category under an existing parent (Settings → Categories) → child appears nested in tree
- [ ] **TC-F3-03** Filter Documents list by a category → only documents in that category shown
- [ ] **TC-F3-04** Select multiple documents in list → "Assign Category" toolbar button appears → assign category to all → each document reflects the new category
- [ ] **TC-F3-05** Remove a category from a document → document no longer appears when filtering by that category
- [ ] **TC-F3-06** Category tree with 10+ categories renders without visual lag

---

### F5 — Contact Deduplication & Merge

> Navigate: Contacts → "Add Contact" or upload a document with a contact.

- [x] **TC-F5-01** Upload a document where the extracted contact matches an existing contact name → deduplication alert shown before saving
- [ ] **TC-F5-02** On dedup alert, choose "Keep Separate" → two distinct contacts saved
- [ ] **TC-F5-03** On dedup alert, choose "Merge" → single merged contact appears; both source records gone
- [ ] **TC-F5-04** Navigate to Contacts → "Flag Duplicates" → contacts with similar names grouped
- [ ] **TC-F5-05** Merge two manually flagged duplicates → merged contact retains all linked documents from both originals
- [ ] **TC-F5-06** Contacts list shows no duplicate entries after merges
- [ ] **TC-F5-07** Search contacts by partial name → matching contacts returned

---

### F6 — Document–Appointment Link Scoring

> Navigate: Documents → select a document → "Linked Appointments" panel.

- [ ] **TC-F6-01** Document with date `2024-01-15` and appointment on same date → suggestion score shown in link panel
- [ ] **TC-F6-02** Accept a suggested link → document appears in Appointment detail → "Linked Documents" sidebar
- [ ] **TC-F6-03** Reject a suggested link → suggestion removed; document not linked
- [ ] **TC-F6-04** Manually link a document to an appointment (no auto-suggestion) → link persists after restart
- [ ] **TC-F6-05** Appointment detail shows all accepted linked documents
- [ ] **TC-F6-06** Unlink a document from Appointment detail → document no longer listed
- [ ] **TC-F6-07** Document linked to multiple appointments → all links visible in document detail
- [ ] **TC-F6-08** Delete an appointment that has linked documents → documents remain; links removed cleanly
- [ ] **TC-F6-09** Search term in document body matches appointment note → cross-search surfaces both
- [ ] **TC-F6-10** Link score display: high-confidence matches (same date + doctor) score ≥ 0.8; low-confidence score < 0.5

---

## 3. Non-Functional Verification

| Check | How to test | Pass criterion |
|-------|-------------|----------------|
| Offline operation | Disable Wi-Fi/Ethernet, relaunch app, use all features | All features work; zero network errors |
| FTS5 search latency | Upload 10+ documents with text; search for a common word; use DevTools or observe | Results appear < 200ms |
| OCR timing | Upload a 5-page scanned PDF; time from upload to "complete" | < 30s total |
| Category tree render | Create 20+ categories; open category picker | Picker opens < 200ms |
| Encryption at rest | `sqlcipher ~/.myHealth/myhealth.db`; try `.tables` without password | Access denied / error without master password |
| SQL injection robustness | Search for `'; DROP TABLE documents; --` | App returns empty results or "no match"; no crash, no data loss |

---

## 4. MVP Regression Checklist

Quick smoke test to confirm nothing regressed during the release:

- [ ] App launches and prompts for master password on first run
- [ ] Correct master password unlocks the app; wrong password rejected
- [x] Document upload → document appears in list
- [ ] Document list pagination (if > 20 documents)
- [ ] Full-text search returns relevant documents
- [ ] Appointment create, read, update, delete (CRUD complete)
- [ ] Note create and edit
- [ ] Contact create, view, and search
- [ ] PDF export bundle — select multiple documents → export → .zip downloaded with PDFs
- [ ] App closes cleanly (no crash on quit)

---

---

## Phase 8 (v1.2) Feature Checklists

### F7 — Advanced Search Filters

> Navigate: Documents page → open Search / Filter panel.

- [ ] **TC-F7-01** Apply a date-range filter (Jan 2024 only) → only January 2024 documents shown; March 2024 documents hidden
- [ ] **TC-F7-02** Apply a date range where "From" > "To" → inline validation error; no results change
- [ ] **TC-F7-03** Apply category filter "Lab Results" → only Lab Results documents shown; active filter pill visible
- [ ] **TC-F7-04** Add a second category to the active filter → documents from either category appear (union)
- [ ] **TC-F7-05** Combine text search `cholesterol` + date range 2024 → only documents matching BOTH constraints shown
- [ ] **TC-F7-06** Navigate away to Appointments then back to Documents → active filters still applied on return
- [ ] **TC-F7-07** Click "Clear all" → full unfiltered document list restored

---

### F8 — Category Drag-Reorder & Auto-Archive

> Navigate: Settings → Categories.

- [ ] **TC-F8-01** Drag a category above a sibling using the drag handle → new order reflected immediately
- [ ] **TC-F8-02** Quit and relaunch app → drag-reorder is preserved across restart
- [ ] **TC-F8-03** Cancel a drag mid-operation (Escape or release outside drop zone) → order reverts to original
- [ ] **TC-F8-04** Set auto-archive threshold to 30 days; quit and relaunch → setting still shows "30 days"
- [ ] **TC-F8-05** Empty category with no recent use (past threshold) → moved to archived state after restart
- [ ] **TC-F8-06** Archived category not visible in Documents category filter picker
- [ ] **TC-F8-07** Restore archived category → reappears in Documents category filter picker
- [ ] **TC-F8-08** Set auto-archive to "Never" → no categories auto-archived regardless of age

---

### F9 — Calendar Conflict Resolution

> Navigate: Appointments → calendar view.

- [ ] **TC-F9-01** Create two appointments with overlapping times on the same day → conflict badge visible on that day cell
- [ ] **TC-F9-02** Two same-day appointments with non-overlapping times → no conflict badge
- [ ] **TC-F9-03** Click conflict badge → side-by-side panel shows both appointments with full details
- [ ] **TC-F9-04** Click "Keep This" on one appointment and confirm → other deleted; conflict badge cleared
- [ ] **TC-F9-05** Cancel the delete confirmation dialog → no appointment deleted; panel stays open
- [ ] **TC-F9-06** Deleted appointment had linked documents → documents remain; appointment link removed

---

### F10 — PDF Summary Export

> Navigate: Documents page → PDF Summary Export button.

- [ ] **TC-F10-01** Click PDF Summary Export → system file save dialog appears
- [ ] **TC-F10-02** Choose save path and confirm → valid PDF saved; opens in system viewer without error
- [ ] **TC-F10-03** Exported PDF contains: cover page with export date, Documents section, Appointments section, page numbers
- [ ] **TC-F10-04** Document with no extracted text → entry appears in PDF with metadata; snippet area blank (no crash)
- [ ] **TC-F10-05** Empty entity section (e.g., no contacts) → section header present with "No records" note
- [ ] **TC-F10-06** Cancel the file dialog → no file written to disk; no error notification shown

---

## 5. Failure Reporting Template

Copy and fill in for each failed test:

```
TC: [e.g. TC-F2-03]
Severity: CRITICAL / HIGH / MEDIUM / LOW
Steps to reproduce:
  1.
  2.
  3.
Actual result:
Expected result:
Screenshot/log: [attach or paste]
App version: 1.1.0
Platform: macOS / Windows / Linux
```

Report issues at: GitHub Issues in this repo.
