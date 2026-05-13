# myHealth — Execution Plan (v1.5)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Phase: 106
Task:  106.5 — Pre-commit checks + commit
Note:  Phases 109 and 110 complete. All completed phases archived in docs/archive/PLAN_20260513.md.
```

▶ **104.5 — Unit + E2E tests**

---

## Status Legend

```
[x]  complete
[ ]  pending
▶    next action (exactly one at any time)
```

---

## Scope Reference

**v1.1–v1.4 + v1.9 (SHIPPED — Phases 0–66)**

| Feature | Status |
|---------|--------|
| OCR pipeline, categories, contacts, clinics, tags, timeline | ✅ |
| Trash / restore / permanent-delete | ✅ |
| Advanced search filters, drag-to-organize, auto-archive | ✅ |
| Content intelligence (FTS5, entity extraction, cross-doc search) | ✅ |
| Notes UX, symptoms, medications, unified search | ✅ |
| OCR text preview in upload review | ✅ |
| PDF summary report export | ✅ Phase 50 |
| Batch document upload with draft entity flow | ✅ Phases 58–62 |
| UX Redesign — Option A (Multi-Theme Panel Layout) | ✅ Phases 51–57 |
| E2E acceptance gate (Cases 1–3) | ✅ Phases 63–66 |

**v1.5 (Phases 99 DEFERRED + 103–110)**

| Feature | Phase | Priority | Effort | Status |
|---------|-------|----------|--------|--------|
| Clinical notes auto-extraction (F3.6) | 109 | MED | Medium | ✅ |
| Test quality & coverage hardening | 110 | HIGH | Medium | ✅ |
| System-wide theme switcher (Calm / Coffee / Mint) | 103 | LOW | Small | ⬜ |
| iCalendar import/export (.ics) | 104 | MED | Medium | ⬜ |
| Medical code tagging (ICD-10) | 105 | LOW | Medium | ⬜ |
| Calendar conflict resolution UI | 106 | SHOULD | Medium | ⬜ |
| Multi-user vault support | 107 | LOW | Large | ⬜ |
| Contact extraction: ALLCAPS surname + role-labelled names (F4.8+F4.9) | 108 | MED | Small | ⬜ |

**v1.6+ (deferred)**

| Feature | Source | Priority | Status |
|---------|--------|----------|--------|
| LLM-assisted extraction (on-device Phi-3-mini Q4 via llama.cpp) | PRD_V4 | POST-MVP | 🔜 DEFERRED |
| Outlook Calendar sync (Windows, COM automation) | PRD_V2 Phase 3 | MED | 🔜 DEFERRED |
| AI appointment notes summarization | PRD_V2 Phase 3 | LOW | 🔜 DEFERRED (needs LLM first) |

**Coverage requirement:** ≥ 80% across all new code

---

## Phase 99 (DEFERRED) — Full Tauri Binary Test Harness (superseded by Phase 100–102)

**Status:** Superseded. Phase 100 covers tauri-driver E2E; Phase 102 covers Rust integration tests with better scope and CI integration.

### Sprint 99 (DEFERRED — do not execute)

[ ] **99.1 — Research Tauri test harness patterns**
   - Superseded by Phase 100.1 and 102.1
   - Done when: approach documented in `docs/ARCHITECTURE.md` §Testing

[ ] **99.2 — Scaffold `src-tauri/tests/integration/` harness**
   - Superseded by Phase 102.1

[ ] **99.3 — Port acceptance cases 1–3 to integration tests**
   - Superseded by Phase 102.2–102.4

[ ] **99.4 — CI job: `integration-test`**
   - Superseded by Phase 102.5

---

## Phase 103 — System-wide Theme Switcher

**Goal:** Let users pick a visual theme (Calm / Coffee / Mint) that persists across sessions. Redesign-A CSS variable infrastructure already exists; this wires up the picker UI.

**Done when:**
- Theme picker accessible from settings or top-nav
- Selecting a theme swaps CSS class on `<html>` and persists to `localStorage`
- All three themes (Calm, Coffee, Mint) render without contrast or layout regressions
- Unit test covers store + persistence; E2E test covers picker interaction

### Sprint 103

[x] **103.1 — Define theme tokens for Calm / Coffee / Mint**
   - `src/styles/themes.css` — three sets of CSS custom property overrides (background, surface, accent, text, border)
   - Calm: existing default palette
   - Coffee: warm browns, cream surface, amber accent
   - Mint: cool greens, light surface, teal accent
   - Done when: applying each class to `<html>` visually changes the app without layout shift

[x] **103.2 — Zustand theme store + localStorage persistence**
   - `src/store/themeStore.ts` — `theme: 'calm' | 'coffee' | 'mint'`, `setTheme(t)` persists to `localStorage`
   - `src/app/layout.tsx` — read store on mount, apply class to `document.documentElement`
   - Done when: `npx tsc --noEmit` passes; refreshing page restores theme

[x] **103.3 — Theme picker UI**
   - Add `<ThemePicker />` component (`src/components/ui/ThemePicker.tsx`) — three swatches, active indicator, `data-testid="theme-picker"`
   - Wire into settings page or top-nav header
   - Done when: picker visible and functional in dev

[x] **103.4 — Unit test: theme store**
   - Assert `setTheme('coffee')` updates store and writes to `localStorage`
   - Assert `document.documentElement` class updated
   - Done when: `npx vitest run` passes

[x] **103.5 — E2E test: theme switcher**
   - `e2e/theme-switcher.spec.ts`
   - Navigate to picker → click Coffee → assert `<html>` has `theme-coffee` class
   - Reload → assert theme persists
   - Done when: `npx playwright test e2e/theme-switcher.spec.ts` passes

[x] **103.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - Commit: `feat: system-wide theme switcher — Calm / Coffee / Mint (Phase 103)`

---

## Phase 104 — iCalendar Import / Export (.ics)

**Goal:** Export appointments as a standard `.ics` file; import `.ics` files to create appointments in the local DB. Fully offline — no calendar service API.

**Done when:**
- "Export Calendar" button on appointments page exports all appointments as `.ics` via Tauri save dialog
- "Import .ics" button parses a user-selected `.ics` file and creates appointments in SQLite
- Duplicate detection: skip events already present (match on `uid` or `dtstart + summary`)
- Unit tests cover serialisation and parsing; E2E covers button visibility

### Sprint 104

[x] **104.1 — Add `icalendar` Rust crate; implement export command**
   - `src-tauri/Cargo.toml`: add `icalendar = "0.15"`
   - New command `appointments_export_ics` — query all appointments from SQLite, build `Calendar` object, serialise to `.ics` string, return to frontend
   - Done when: `cargo test` passes with fixture appointment data

[x] **104.2 — Tauri save-dialog integration for export**
   - Frontend: `invoke('appointments_export_ics')` → `dialog::save()` → write file via `fs::write_text_file`
   - Add `data-testid="export-ics-btn"` to button on appointments page
   - Done when: clicking button opens save dialog and writes valid `.ics`

[x] **104.3 — Import command: parse .ics → insert appointments**
   - New command `appointments_import_ics(ics_content: String)` — parse with `icalendar` crate
   - For each `VEVENT`: extract `SUMMARY`, `DTSTART`, `DTEND`, `DESCRIPTION`, `UID`
   - Duplicate check: skip if row with same `uid` exists; else insert with `source = 'ics_import'`
   - Return `{ imported: usize, skipped: usize }`
   - Done when: `cargo test` passes; imports fixture `.ics` without error

[x] **104.4 — Frontend import UI**
   - "Import .ics" button → `dialog::open()` filter `.ics` → read file → `invoke('appointments_import_ics')` → toast "X appointments imported, Y skipped"
   - `data-testid="import-ics-btn"`
   - Done when: `npx tsc --noEmit` passes

[x] **104.5 — Unit + E2E tests**
   - Unit: mock `invoke` for export; assert `.ics` content structure correct
   - E2E: `e2e/icalendar.spec.ts` — assert `export-ics-btn` and `import-ics-btn` visible on appointments page
   - Done when: all tests pass

[x] **104.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: iCalendar .ics import and export (Phase 104)`

---

## Phase 105 — Medical Code Tagging (ICD-10)

**Goal:** Automatically tag extracted diagnoses with ICD-10 codes during OCR processing. Codes stored in SQLite; displayed on document detail. Fully offline — ICD-10 dataset bundled as SQLite table.

**Done when:**
- ICD-10 lookup table seeded in SQLite migration (≥ 70k codes, code + description)
- OCR pipeline matches extracted diagnoses against ICD-10 via FTS5 or fuzzy match
- Matched codes stored in `document_icd10_tags(document_id, code, description, confidence)`
- Document detail page shows matched codes with `data-testid="icd10-tag"`
- Unit tests cover matching logic; E2E asserts tags visible on detail page

### Sprint 105

[x] **105.1 — Bundle ICD-10 dataset as SQLite migration**
   - Source: CMS ICD-10-CM public domain data (CSV)
   - Migration creates `icd10_codes(code TEXT PRIMARY KEY, description TEXT)` + FTS5 virtual table `icd10_fts`
   - Seed script in `scripts/seed-icd10.mjs` — reads CSV, generates SQL migration file
   - Done when: migration runs cleanly; `SELECT COUNT(*) FROM icd10_codes` ≥ 70000

[x] **105.2 — Rust matching command `documents_tag_icd10(document_id)`**
   - Query `extracted_text` for the document
   - Run FTS5 search on `icd10_fts` for each extracted entity (`diagnoses` array from structured extraction)
   - Score matches; keep top result per entity if rank > threshold
   - Insert into `document_icd10_tags`; return matched codes
   - Done when: `cargo test` passes with fixture text containing known diagnosis terms

[x] **105.3 — Wire into upload pipeline**
   - Call `documents_tag_icd10` after structured entity extraction step in `upload_document` command
   - Done when: uploading a document with diagnosis text auto-populates `document_icd10_tags`

[x] **105.4 — Document detail UI: ICD-10 tags section**
   - `src/app/(app)/documents/view/DocumentDetailClient.tsx`
   - Fetch `document_icd10_tags` via new query `documents_get_icd10_tags(documentId)`
   - Render as chip list with `data-testid="icd10-tag"` per chip; section `data-testid="icd10-section"`
   - Hide section if no tags
   - Done when: `npx tsc --noEmit` passes; tags render correctly in dev

[x] **105.5 — Unit + E2E tests**
   - Unit: mock `invoke('documents_get_icd10_tags')` returning fixture codes; assert chips render
   - E2E: `e2e/icd10-tags.spec.ts` — navigate to document detail; assert `icd10-section` present (or hidden when empty)
   - Done when: all tests pass

[x] **105.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: ICD-10 code tagging for extracted diagnoses (Phase 105)`

---

## Phase 106 — Calendar Conflict Resolution UI

**Goal:** Display overlapping appointments with a visual conflict indicator. Users can dismiss or reschedule. Read-only detection only — no write-back to Apple Calendar in this phase.

**Done when:**
- Appointments page detects time-window overlaps in SQLite (pure SQL, no Apple Calendar reads needed)
- Conflicting rows shown with `data-testid="conflict-badge"` and highlighted border
- "Dismiss conflict" button marks pair as acknowledged (`conflicts_dismissed` table)
- Dismissed conflicts no longer shown as conflicts
- Unit + E2E tests cover detection and dismiss

### Sprint 106

[x] **106.1 — SQL conflict detection query**
   - New Rust command `appointments_list_conflicts` — self-join on `appointments` where `a.start_time < b.end_time AND b.start_time < a.end_time AND a.id != b.id AND a.is_draft = 0`
   - Return pairs `[(id_a, id_b, title_a, title_b, start_a, start_b)]`
   - Done when: `cargo test` passes with fixture overlapping appointments

[x] **106.2 — `conflicts_dismissed` table migration**
   - Migration: `conflicts_dismissed(id_a TEXT, id_b TEXT, dismissed_at TEXT, PRIMARY KEY(id_a, id_b))`
   - `appointments_dismiss_conflict(id_a, id_b)` command inserts row
   - `appointments_list_conflicts` excludes dismissed pairs via LEFT JOIN
   - Done when: `cargo test` passes

[x] **106.3 — Conflict UI on appointments page**
   - `src/app/(app)/appointments/page.tsx` — call `appointments_list_conflicts` on mount
   - For each conflicting appointment row: add `data-testid="conflict-badge"` chip + highlight class
   - "Dismiss" button per conflict pair → `invoke('appointments_dismiss_conflict')` → optimistic remove from list
   - Done when: `npx tsc --noEmit` passes; conflicts render in dev with fixture data

[x] **106.4 — Unit + E2E tests**
   - Unit: mock `invoke('appointments_list_conflicts')` returning fixture pair; assert `conflict-badge` visible; click Dismiss → badge gone
   - E2E: `e2e/calendar-conflicts.spec.ts` — appointments page loads; assert no unhandled JS errors
   - Done when: all tests pass

▶ [ ] **106.5 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: calendar conflict detection and dismiss UI (Phase 106)`

---

## Phase 107 — Multi-User Vault Support

**Goal:** Support multiple local user profiles, each with their own encrypted SQLite vault and PBKDF2-derived key. Users switch profiles at app start. No network — fully local.

**Done when:**
- Profile list screen at app launch (or Settings → Switch Profile)
- Each profile = separate `{profile_id}.db` file under app data dir, encrypted with its own key
- Creating a profile: choose name + master password → derives key → creates empty vault
- Switching profile: close current DB connection → open new DB with new key
- Deleting a profile: requires confirmation + password re-entry; deletes `.db` file permanently
- All existing features work correctly within a profile
- Unit tests cover key derivation isolation; E2E covers profile creation and switch flow

### Sprint 107

[ ] **107.1 — Profile metadata store (unencrypted)**
   - `profiles.json` in app data dir: `[{ id, name, db_path, created_at }]`
   - New Rust commands: `profiles_list`, `profiles_create(name, password)`, `profiles_delete(id, password)`
   - `profiles_create`: generate UUID, derive key via PBKDF2-SHA512 + random salt, create `{id}.db`, store salt in `profiles.json`
   - Done when: `cargo test` passes; profile JSON round-trips correctly

[ ] **107.2 — Dynamic DB connection switching**
   - Refactor `AppState` in `src-tauri/src/lib.rs`: `db: Mutex<Option<Connection>>` → allow re-open
   - New command `profiles_switch(id, password)` — close current connection, derive key from stored salt + supplied password, open new DB
   - All existing commands remain unchanged (read from `state.db`)
   - Done when: `cargo test` passes; switching profile mid-session works

[ ] **107.3 — Profile selection screen (frontend)**
   - `src/app/profiles/page.tsx` — list profiles from `profiles_list`; "New Profile" button; click to select
   - On select: prompt password → `invoke('profiles_switch')` → redirect to `/documents`
   - `data-testid="profile-list"`, `data-testid="profile-item"`, `data-testid="new-profile-btn"`
   - Done when: `npx tsc --noEmit` passes; screen renders in dev

[ ] **107.4 — Profile creation dialog**
   - Modal: name field + password field + confirm password → `invoke('profiles_create')` → close modal → profile appears in list
   - Validation: name non-empty, passwords match, min 8 chars
   - Done when: creation flow works end-to-end in dev

[ ] **107.5 — Profile deletion with confirmation**
   - Delete button on profile item → confirm dialog + password re-entry → `invoke('profiles_delete')` → profile removed from list
   - Warning: "This permanently deletes all data in this profile and cannot be undone."
   - Done when: deletion flow works; `.db` file removed from disk

[ ] **107.6 — Unit + E2E tests**
   - Unit: mock `invoke('profiles_list')` returning fixture profiles; assert `profile-item` count matches
   - E2E: `e2e/multi-user-vault.spec.ts` — profiles page loads; `new-profile-btn` visible
   - Done when: all tests pass

[ ] **107.7 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - Commit: `feat: multi-user vault with per-profile encrypted SQLite DB (Phase 107)`

---

## Phase 108 — Contact Extraction: ALLCAPS Surname + Role-Labelled Names (F4.8 + F4.9)

**Goal:** Improve contact name detection in OCR text by adding two new extraction patterns: (1) ALLCAPS-surname detection (e.g. "Dr John SMITH" → surname = "SMITH"), (2) role-label prefix detection (e.g. "GP: Dr Jane Lee", "Consultant: Mr Ahmed"). Both extend the existing Rust contact extractor in `src-tauri/src/commands/contact.rs`.

**Done when:**
- `extract_contact_name()` (or equivalent) in `contact.rs` recognises ALLCAPS surname tokens adjacent to a title prefix
- Role-label prefix pattern ("GP:", "Consultant:", "Physiotherapist:", "Nurse:", "Registrar:") correctly extracts the name that follows
- Existing contact extraction tests still pass; new unit tests cover both patterns
- E2E: upload a fixture PDF whose OCR text contains each pattern; assert suggested contact name is correct
- `cargo fmt` + `cargo clippy -- -D warnings` pass; `npx tsc --noEmit` passes

### Sprint 108

[ ] **108.1 — ALLCAPS surname pattern (Rust)**
   - In `src-tauri/src/commands/contact.rs` (or `src-tauri/src/extraction/contact.rs`), add regex: title prefix + given name + ALLCAPS token (≥2 uppercase letters, no lowercase)
   - Example: `r"(?i)\b(Dr|Mr|Mrs|Ms|Prof)\.?\s+[A-Z][a-z]+\s+([A-Z]{2,})\b"` → group 2 is surname
   - Normalise captured surname to title-case before returning
   - Done when: unit test `extracts_allcaps_surname` passes

[ ] **108.2 — Role-label prefix pattern (Rust)**
   - Add regex matching `"<Role>:\s*<title> <name>"` where Role ∈ {GP, Consultant, Physiotherapist, Nurse, Registrar, Specialist, Surgeon}
   - Example: `r"(?i)\b(GP|Consultant|Physiotherapist|Nurse|Registrar|Specialist|Surgeon)\s*:\s*(Dr|Mr|Mrs|Ms|Prof)\.?\s+([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+)*)"` → group 3 is full name
   - Done when: unit test `extracts_role_labelled_name` passes

[ ] **108.3 — Unit tests**
   - Add test cases to `src-tauri/tests/contact_extraction.rs` (or inline `#[cfg(test)]` module):
     - `"Referred by Dr John SMITH"` → name contains "Smith"
     - `"GP: Dr Jane Lee"` → name = "Jane Lee"
     - `"Consultant: Mr Ahmed Al-Rashid"` → name = "Ahmed Al-Rashid"
     - Existing pattern tests unchanged
   - Done when: `cargo test` passes with new cases

[ ] **108.4 — Fixture PDF + E2E test**
   - Add a small fixture PDF (or reuse existing) whose text includes ALLCAPS surname and role-label
   - `e2e/v3-f4-contact-patterns.spec.ts`: upload fixture → assert `[data-testid="contact-suggestion"]` shows correct extracted name
   - Done when: E2E passes in mock/browser mode

[ ] **108.5 — Pre-commit checks + commit**
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - `npx tsc --noEmit`
   - Commit: `feat: add ALLCAPS surname and role-label contact extraction patterns (F4.8+F4.9, Phase 108)`
