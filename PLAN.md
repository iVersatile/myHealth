# myHealth — Execution Plan (v1.5)

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
Phase: 117
Task:  117.5
Note:  117.1–117.4 done. Next: Rule 2 imaging implementation + tests.
```

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
| System-wide theme switcher (Calm / Coffee / Mint) | 103 | LOW | Small | ✅ |
| iCalendar import/export (.ics) | 104 | MED | Medium | ✅ |
| Medical code tagging (ICD-10) | 105 | LOW | Medium | ✅ |
| Calendar conflict resolution UI | 106 | SHOULD | Medium | ✅ |
| Multi-user vault support | 107 | LOW | Large | ✅ |
| Contact extraction: ALLCAPS surname + role-labelled names (F4.8+F4.9) | 108 | MED | Small | ✅ |

**Phase 116 (in progress)**

| Feature | Phase | Priority | Effort | Status |
|---------|-------|----------|--------|--------|
| Supplemental OCR: clinic phone + email from embedded PDF images (F5.4) | 116 | MED | Small | 🔲 |

**Phase 117 (in progress)**

| Feature | Phase | Priority | Effort | Status |
|---------|-------|----------|--------|--------|
| Smart note content: invoice description summary + first-line fallback | 117 | HIGH | Small | 🔲 |

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

[x] **106.5 — Pre-commit checks + commit**
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

[x] **107.1 — Profile metadata store (unencrypted)**
   - `profiles.json` in app data dir: `[{ id, name, db_path, created_at }]`
   - New Rust commands: `profiles_list`, `profiles_create(name, password)`, `profiles_delete(id, password)`
   - `profiles_create`: generate UUID, derive key via PBKDF2-SHA512 + random salt, create `{id}.db`, store salt in `profiles.json`
   - Done when: `cargo test` passes; profile JSON round-trips correctly

[x] **107.2 — Dynamic DB connection switching**
   - Refactor `AppState` in `src-tauri/src/lib.rs`: `db: Mutex<Option<Connection>>` → allow re-open
   - New command `profiles_switch(id, password)` — close current connection, derive key from stored salt + supplied password, open new DB
   - All existing commands remain unchanged (read from `state.db`)
   - Done when: `cargo test` passes; switching profile mid-session works

[x] **107.3 — Profile selection screen (frontend)**
   - `src/app/profiles/page.tsx` — list profiles from `profiles_list`; "New Profile" button; click to select
   - On select: prompt password → `invoke('profiles_switch')` → redirect to `/documents`
   - `data-testid="profile-list"`, `data-testid="profile-item"`, `data-testid="new-profile-btn"`
   - Done when: `npx tsc --noEmit` passes; screen renders in dev

[x] **107.4 — Profile creation dialog**
   - Modal: name field + password field + confirm password → `invoke('profiles_create')` → close modal → profile appears in list
   - Validation: name non-empty, passwords match, min 8 chars
   - Done when: creation flow works end-to-end in dev

[x] **107.5 — Profile deletion with confirmation**
   - Delete button on profile item → confirm dialog + password re-entry → `invoke('profiles_delete')` → profile removed from list
   - Warning: "This permanently deletes all data in this profile and cannot be undone."
   - Done when: deletion flow works; `.db` file removed from disk

[x] **107.6 — Unit + E2E tests**
   - Unit: mock `invoke('profiles_list')` returning fixture profiles; assert `profile-item` count matches
   - E2E: `e2e/multi-user-vault.spec.ts` — profiles page loads; `new-profile-btn` visible
   - Done when: all tests pass

[x] **107.7 — Pre-commit checks + commit**
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

[x] **108.1 — ALLCAPS surname pattern (Rust)**
   - In `src-tauri/src/commands/contact.rs` (or `src-tauri/src/extraction/contact.rs`), add regex: title prefix + given name + ALLCAPS token (≥2 uppercase letters, no lowercase)
   - Example: `r"(?i)\b(Dr|Mr|Mrs|Ms|Prof)\.?\s+[A-Z][a-z]+\s+([A-Z]{2,})\b"` → group 2 is surname
   - Normalise captured surname to title-case before returning
   - Done when: unit test `extracts_allcaps_surname` passes

[x] **108.2 — Role-label prefix pattern (Rust)**
   - Add regex matching `"<Role>:\s*<title> <name>"` where Role ∈ {GP, Consultant, Physiotherapist, Nurse, Registrar, Specialist, Surgeon}
   - Example: `r"(?i)\b(GP|Consultant|Physiotherapist|Nurse|Registrar|Specialist|Surgeon)\s*:\s*(Dr|Mr|Mrs|Ms|Prof)\.?\s+([A-Z][a-zA-Z\-']+(?:\s+[A-Z][a-zA-Z\-']+)*)"` → group 3 is full name
   - Done when: unit test `extracts_role_labelled_name` passes

[x] **108.3 — Unit tests**
   - Add test cases to `src-tauri/tests/contact_extraction.rs` (or inline `#[cfg(test)]` module):
     - `"Referred by Dr John SMITH"` → name contains "Smith"
     - `"GP: Dr Jane Lee"` → name = "Jane Lee"
     - `"Consultant: Mr Ahmed Al-Rashid"` → name = "Ahmed Al-Rashid"
     - Existing pattern tests unchanged
   - Done when: `cargo test` passes with new cases

[x] **108.4 — Fixture PDF + E2E test**
   - Add a small fixture PDF (or reuse existing) whose text includes ALLCAPS surname and role-label
   - `e2e/v3-f4-contact-patterns.spec.ts`: upload fixture → assert `[data-testid="contact-suggestion"]` shows correct extracted name
   - Done when: E2E passes in mock/browser mode

[x] **108.5 — Pre-commit checks + commit**
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - `npx tsc --noEmit`
   - Commit: `feat: add ALLCAPS surname and role-label contact extraction patterns (F4.8+F4.9, Phase 108)`

---

## Phase 111 — Test Coverage Hardening (Pre-Refactor Gate)

**Goal:** Fill coverage gaps identified in code review before any structural refactoring. Ensures refactoring in Phase 112 is safe across all layers.

**Context:** System-wide coverage audit (2026-05-14) found overall 87.81% stmt / 80.44% branch. Three specific files have insufficient coverage to refactor safely.

**Done when:**
- `NoteEditorClient.tsx` has ≥80% branch coverage via new unit test file
- `AppointmentDetailClient.tsx` branch coverage raised from 70% → ≥80%
- `UploadReviewStep.tsx` has a dedicated standalone test file (extracted from UploadDialog tests)
- `npx vitest run --coverage` confirms all three targets meet threshold
- `npx tsc --noEmit` passes

### Sprint 111

[x] **111.1 — NoteEditorClient unit tests (from zero)**
   - Create `src/app/(app)/notes/view/__tests__/NoteEditorClient.test.tsx`
   - Cover: toolbar renders, bold/italic/bullet/ordered-list toggles, save triggers `invoke('notes_update')`, unsaved-changes warning on navigation, empty-note validation
   - Mock Tiptap editor via `vi.mock('@tiptap/react')`; mock `invoke` via existing test utilities
   - Done when: ≥80% stmt + branch coverage on `NoteEditorClient.tsx`; `npx vitest run` passes

[x] **111.2 — AppointmentDetailClient branch coverage expansion**
   - File: `src/app/(app)/appointments/view/__tests__/AppointmentDetailClient.test.tsx` (already exists)
   - Identify uncovered branches via `npx vitest run --coverage` output
   - Add test cases for: conflict-badge render path, dismiss-conflict optimistic update, ICS export error path, form validation edge cases
   - Done when: branch coverage ≥80% on `AppointmentDetailClient.tsx`
   - Result: 81.88% branch coverage, 38 tests all passing

[x] **111.3 — UploadReviewStep dedicated test file**
   - Create `src/components/documents/__tests__/UploadReviewStep.test.tsx`
   - Extract relevant cases from `UploadDialog.test.tsx` that exercise UploadReviewStep in isolation
   - Add: contact-suggestion-card renders correct name, category picker interaction, tag add/remove, clinic suggestion banner visibility
   - Done when: dedicated file passes; no duplication with UploadDialog tests
   - Result: 49 tests pass, branch coverage 84.52%

[x] **111.4 — Pre-commit checks + commit**
   - `npx vitest run --coverage` — confirm all three targets ≥80% branch
   - `npx tsc --noEmit`
   - Commit: `test: harden coverage on NoteEditorClient, AppointmentDetailClient, UploadReviewStep (Phase 111)`
   - Result: tsc clean, branches 81.4%, functions 84.06%, statements 88.29%; pushed, CI green

---

## Phase 112 — Structural Refactoring

**Goal:** Reduce complexity in three oversized components identified in code review. Improve maintainability without changing behaviour.

**Context:** Code review (2026-05-14) flagged three HIGH issues. Phase 111 must be complete (coverage gate) before starting this phase.

**Done when:**
- `DocumentDetailClient.tsx` split into focused sub-components; file ≤800 lines
- `UploadReviewStep.tsx` prop count reduced from 55 via Context + hook pattern
- `AppointmentDetailClient.tsx` split; file ≤800 lines
- All existing tests pass unchanged after refactoring
- `npx tsc --noEmit` passes; `npx vitest run` passes; E2E smoke passes

### Sprint 112

[x] **112.1 — DocumentDetailClient split (1020 → ≤800 lines)**
   - Extract: `DocumentLinks.tsx` (appointment/note linking state + UI)
   - Extract: `DocumentEntities.tsx` (symptoms, medications, clinic management)
   - Extract: `useDocumentDetail()` hook — consolidate 30+ useState calls
   - `DocumentDetailClient.tsx` becomes orchestrator only; delegates to sub-components
   - Done when: file ≤800 lines; `npx tsc --noEmit` passes; existing test suite passes unchanged

[x] **112.2 — UploadReviewStep prop drilling fix (55 props → Context)**
   - Create `UploadReviewContext` in `src/components/documents/UploadReviewContext.tsx`
   - Move shared state into context; `UploadReviewStep` reads from context, not props
   - `UploadDialog` provides context; prop interface shrinks to ≤10 props
   - Done when: `npx tsc --noEmit` passes; UploadDialog tests pass; UploadReviewStep test file passes

[x] **112.3 — AppointmentDetailClient split (834 → ≤800 lines)**
   - Extract: `AppointmentConflicts.tsx` (conflict detection + dismiss UI)
   - Extract: `useAppointmentDetail()` hook
   - Done when: file ≤800 lines; existing test suite passes unchanged

[x] **112.4 — Rust upload deduplication**
   - `src-tauri/src/commands/documents.rs`: extract `prepare_document_upload()` helper shared by `documents_upload()` and `upload_one_document()`
   - Done when: `cargo test` passes; `cargo clippy -- -D warnings` clean

[x] **112.5 — Zustand selector consolidation**
   - `src/hooks/useDocuments.ts` + `src/hooks/useAppointments.ts`: replace 10–11 individual `useStore(s => s.x)` calls with single `useShallow` selector
   - Done when: `npx tsc --noEmit` passes; tests pass

[x] **112.6 — Pre-commit checks + commit**
   - `npx tsc --noEmit`
   - `cargo fmt --all` + `cargo clippy -- -D warnings`
   - `npx vitest run`
   - Commit: `refactor: split large components, fix prop drilling, dedup Rust upload logic (Phase 112)`

---

## Phase 113 — Smoke-Test Bug Fixes (6 Issues)

**Goal:** Fix 6 bugs found during manual smoke testing. All root causes confirmed.

**Done when:** All 6 tasks pass their "Done when" criteria; `npx tsc --noEmit` clean; `npx vitest run` passes; `cargo clippy -- -D warnings` clean.

### Sprint 113

[x] **113.1 — Bug #1: Multi-doc upload shows "✗[object Object]" on first two files**

   **Root cause:** `UploadDialog.tsx` catches Tauri IPC errors and falls back to `String(err)`. Tauri errors are plain JS objects `{ message: string, ... }`, not `Error` instances — `String(obj)` → `"[object Object]"`.

   **Fix:** Extract `extractMessage(err: unknown): string` helper at top of file. Use `(err as { message?: string })?.message ?? JSON.stringify(err)` as the implementation. Replace all `String(err)` and bare error-stringify calls in `UploadDialog.tsx` with `extractMessage(err)`.

   - File: `src/components/documents/UploadDialog.tsx`
   - Done when: multi-doc upload error shows human-readable string; `npx tsc --noEmit` passes; test covers the plain-object-error path

[x] **113.2 — Bug #2: Single-doc upload crashes with "table clinic_addresses has no column named address"**

   **Root cause:** `documents.rs` auto-creates a draft clinic then inserts its address with stale SQL:
   ```sql
   INSERT INTO clinic_addresses (clinic_id, address) VALUES (?1, ?2)
   ```
   Real schema (migration v18): `id, clinic_id, label, line1, line2, city, postcode, country, is_primary, created_at`. No `address` column exists.

   **Fix:** Rewrite INSERT to match real schema — generate UUID for `id`, use `addr.line1` for `line1`, all other fields default to empty/false/now.

   - File: `src-tauri/src/commands/documents.rs` (INSERT inside `documents_upload`)
   - Done when: single-doc upload with extracted clinic completes without SQL error; `cargo test` passes; `cargo clippy -- -D warnings` clean

[x] **113.3 — Bug #3: Document preview persists after soft-delete in multi-doc upload**

   **Root cause:** `previewDoc` state in `documents/page.tsx` is never cleared when a document is soft-deleted, so the detail panel stays visible after deletion.

   **Fix:** In the soft-delete handler, add `if (previewDoc?.id === deletedId) setPreviewDoc(null)`.

   - File: `src/app/(app)/documents/page.tsx`
   - Done when: soft-deleting the currently-previewed document closes the detail panel; `npx tsc --noEmit` passes

[x] **113.4 — Bug #4 & #5: Reject/Accept buttons in appointment and contact suggestion banners have no effect**

   **Root cause:** `handleApptSuggestionConfirm` (and contact banner handler) in `page.tsx` wraps Tauri calls in `catch { // best-effort }` — all errors silently swallowed. In multi-doc upload a draft appointment already exists, so `appointments_create` fails silently.

   **Option A (recommended):** Replace silent catches with visible error toasts: `catch (err) { toast.error(extractMessage(err)) }`. Then diagnose whether the duplicate-draft path needs an upsert.

   **Option B:** Add `appointment_find_draft(doc_id)` Tauri command; if draft exists, call `appointment_activate(id)` instead of create.

   - Files: `src/app/(app)/documents/page.tsx`, `src/components/documents/ApptSuggestionBanner.tsx`, `src/components/documents/DoctorSuggestionBanner.tsx`
   - Done when: Accept button either succeeds visibly or shows readable error toast; Dismiss clears the banner; `npx tsc --noEmit` passes

[x] **113.5 — Bug #6: Dismissed draft entities do not appear in Trash**

   **Resolution: N/A — Option C.** Investigation confirmed no draft contact/clinic/appointment rows are inserted during the upload flow. `ContactSuggestionDto` / `ClinicSuggestionDto` are ephemeral OCR structs with no `id` field. All `IS_DRAFT=1` inserts for those tables are in test-only code. `dismiss` correctly clears React state; there is nothing in the DB to soft-delete.

[x] **113.6 — Test cases for bugs 1–5**

   - `UploadDialog.test.tsx`: Tauri returns `{ message: 'some error' }` object → status shows `"some error"`, not `"[object Object]"` (Bug #1)
   - `page.test.tsx`: soft-delete currently-previewed doc → `previewDoc` becomes `null` (Bug #3)
   - `page.test.tsx`: Accept on ApptSuggestionBanner when `appointments_create` throws → error toast shown (Bug #4)
   - Rust test in `src-tauri/tests/`: `documents_upload` with clinic extraction → no SQL error after 113.2 fix (Bug #2)
   - Done when: all new cases pass; coverage ≥80% maintained; `npx tsc --noEmit` clean; `cargo test` passes

---

## Phase 114 — Upload Flow Bug Fixes (Round 2, 4 Issues)

**Goal:** Fix 4 bugs found during second manual smoke-test round (multi-doc upload, draft appointments, draft contacts, note auto-generation).

**Done when:** All 4 tasks pass their "Done when" criteria; `npx tsc --noEmit` clean; `cargo clippy -- -D warnings` clean; `npx vitest run` passes.

### Root Causes (confirmed before coding)

- **Bug A** (null constraint on multi-doc): `INSERT INTO clinic_addresses` included `country = NULL` explicitly; SQLite rejects NOT NULL column even with a default. Fixed: remove explicit NULL columns from INSERT so DB default applies.
- **Bug B** (draft appointments stay draft): `draft_appointment_id` was never threaded from Rust `ContactSuggestionDto` through TS layers; Accept/Dismiss calls had no ID to confirm or delete.
- **Bug C** (only 1/3 appointments): Root cause was Bug A — the other 2 PDFs failed with null constraint before reaching appointment extraction.
- **Bug D** (contacts stay draft): `draft_id` field missing from `ContactSuggestion` interface; Rust returned None/null so frontend couldn't identify which draft contact to confirm or delete.

### Sprint 114

[x] **114.1 — Fix Bug A: null constraint on multi-doc upload (clinic_addresses.country)**

   **Fix:** Remove `country = NULL` (and any other explicit NULL non-nullable columns) from `documents.rs` clinic_address INSERT so the DB NOT NULL default applies.

   - File: `src-tauri/src/commands/documents.rs`
   - Done when: multi-doc upload with clinic extraction completes without null constraint error; `cargo clippy -- -D warnings` clean

[x] **114.2 — Fix Bug B/D: thread draft_appointment_id and draft_id through IPC**

   **Fix:**
   - Add `draft_appointment_id: Option<String>` to `ContactSuggestionDto` Rust struct; populate from DB insert
   - Add `draft_id: string | null` to `ContactSuggestion` TS interface (`uploadTypes.ts`)
   - Thread both fields through `UploadDialog` → `DoctorSuggestionBanner` → `ApptSuggestionBanner`
   - On accept: call `confirm_draft_appointment(draft_appointment_id)` + `confirm_draft_contact(draft_id)`
   - On reject/dismiss: call `delete_draft_appointment(draft_appointment_id)` + `delete_draft_contact(draft_id)`

   - Files: `src-tauri/src/commands/documents.rs`, `src/components/documents/uploadTypes.ts`, `src/components/documents/UploadDialog.tsx`, `src/components/documents/DoctorSuggestionBanner.tsx`, `src/components/documents/ApptSuggestionBanner.tsx`, `src/app/(app)/documents/page.tsx`
   - Done when: Accept confirms draft entities in DB; Dismiss removes them; `npx tsc --noEmit` clean

[x] **114.3 — Update TypeScript test fixtures for draft_id field**

   **Fix:** Add `draft_id: null` to all `contactSugg` object literals in `UploadDialog.test.tsx` and inline `doctorCandidates.map()` in `page.tsx`.

   - Files: `src/components/documents/UploadDialog.test.tsx`, `src/app/(app)/documents/page.tsx`
   - Done when: `npx tsc --noEmit` passes with zero errors; `npx vitest run` passes

[x] **114.4 — Fix second Rust ContactSuggestionDto initializer missing draft_id**

   **Fix:** Plain-text extraction code path in `documents.rs` (distinct from clinic-based path) also constructs `ContactSuggestionDto` without `draft_id: None`. Add field.

   - File: `src-tauri/src/commands/documents.rs` (line ~2332)
   - Done when: `cargo clippy -- -D warnings` passes with zero errors

[x] **114.5 — Integration tests for Bugs A–D**

   Write Rust integration tests in `src-tauri/tests/` covering:
   - Bug A: multi-doc upload with clinic extraction → no null constraint error (passes without panic)
   - Bug B: `confirm_draft_appointment` called after upload accept → appointment row has IS_DRAFT=0
   - Bug D: `confirm_draft_contact` called after upload accept → contact row has IS_DRAFT=0
   - Bug D: `delete_draft_contact` called after upload dismiss → contact row deleted

   - Done when: `cargo test` passes; `cargo clippy -- -D warnings` clean

---

## Phase 115 — Regression Fixes Round 3 (5 Manual-Test Issues)

**Goal:** Fix 5 behaviours repeatedly reported in manual smoke tests but never resolved. Integration tests written first (RED), then code fixed (GREEN). Phase is complete only after manual test confirmation.

**Background:** These regressions were reported across multiple sessions. Root causes confirmed in session 2026-05-14; fixes committed in same session. Phase tasks below track manual verification status — do NOT mark complete without a human confirming the fix in the running app.

**Done when:** All 5 tasks confirmed by manual test; `npx tsc --noEmit` clean; `cargo clippy -- -D warnings` clean; `cargo test` passes.

### Root Causes (confirmed before coding)

- **R1 (contacts stay draft):** `accept_draft_entity` / `reject_draft_entity` IPC calls passed `id:` instead of `entityId:` — Tauri converts Rust `snake_case` params to `camelCase` at the IPC boundary, so the entity was never found.
- **R2 (appointments stay draft):** Same IPC arg name bug in the reject path of `DraftEntitySection.tsx`.
- **R3 (clinic-contact link lost):** Extraction loop created draft clinics and draft contacts independently; no code linked them via `contacts.clinic_id` or the `clinic_contacts` junction table.
- **R4 (tags missing):** Batch upload tag INSERT had explicit `is_draft = 1`; those tags are filtered out by standard tag queries, making them invisible.
- **R5 (notes empty):** `extract_clinical_notes()` computed a value from OCR text but the result was never written to `documents.notes`.

### Sprint 115

[x] **115.1 — Manual test: R1 — Accepted contacts appear as regular contacts; rejected go to Trash**

   **Scenario:** Upload a PDF that yields at least one contact suggestion. Accept the contact via the draft review UI. Verify the contact appears in the Contacts list with no "Draft" badge. Also reject a draft contact — it should disappear from the draft list and appear in Trash UI.

   **Fix committed:** `src/components/shared/DraftEntitySection.tsx` — `accept_draft_entity` and `reject_draft_entity` IPC arg renamed from `id` to `entityId`.

   - Done when: user confirms accepted contact visible in Contacts; rejected contact visible in Trash.

[x] **115.2 — Manual test: R2 — Accepted appointments appear in timeline; rejected go to Trash**

   **Scenario:** Upload a PDF that yields an appointment suggestion. Accept via draft review. Verify appointment appears in the timeline / appointments list without "Draft" status. Reject a draft appointment — it should appear in Trash.

   **Fix committed:** same `DraftEntitySection.tsx` IPC arg fix as R1.

   - Done when: user confirms accepted appointment visible in timeline; rejected appointment in Trash.

[x] **115.3 — Manual test: R3 — Clinic-contact link preserved after extraction**

   **Scenario:** Upload a PDF containing a named clinician and their clinic (e.g. "John Green" at "JOHN GREEN PHYSIOTHERAPY LTD"). Accept both entities. Verify the contact record shows the clinic association (contact detail shows clinic name; clinic page lists the contact).

   **Fix committed:** `src-tauri/src/commands/documents.rs` — after clinic creation loop, draft contacts are linked via `UPDATE contacts SET clinic_id` and `INSERT INTO clinic_contacts`.

   - Done when: user confirms contact detail shows correct clinic; clinic page shows contact.

[x] **115.4 — Manual test: R4 — Tags visible after upload**

   **Scenario:** Upload document "Upload (22Nov2021-13_16_15).pdf". After extraction, verify the document shows tags including at minimum: `2023-11-22` (from filename), `Invoice` (from extraction), `London Clinic`, `Cardiography`, `19/11/21`. Bonus: `Patient Number: M24195380/1`.

   **Fix committed:** `src-tauri/src/commands/documents.rs` — batch tag INSERT no longer sets `is_draft = 1`; tags default to visible.

   - Done when: user confirms expected tags visible on the document.

[x] **115.5 — Manual test: R5 — Clinical notes populated after extraction**

   **Scenario:** Upload document "Upload (11Nov2021-12_39_20).pdf". After extraction completes, open the document detail. Verify the Notes field is non-empty and contains clinically relevant text extracted from the PDF.

   **Fix committed:** `src-tauri/src/commands/documents.rs` — `extract_clinical_notes()` result now creates a record in the `notes` entity table linked via `note_links` (entity_type='document'), replacing the broken `UPDATE documents SET notes` that wrote to the wrong column.

   - Done when: user confirms Notes field shows extracted clinical content.

### Sprint 116 — Supplemental OCR: Clinic Phone & Email from Embedded Images

**Context:** Some clinic invoices (e.g. Evewell) render their footer (address, phone, email) as a JPEG baked into the PDF. `pdftotext` cannot see this content. The text layer has enough chars to skip the `OCR_DENSITY_THRESHOLD` path, so Tesseract is not triggered today. This sprint adds a supplemental pass: after text extraction, if phone/email are absent, extract embedded JPEG(s) via `pdfimages -j` and run Tesseract on them.

▶ [ ] **116.1 — Regex extractors: `extract_clinic_phone()` + `extract_clinic_email()` in `clinic.rs`**

   Add two public functions to `src-tauri/src/extraction/clinic.rs`:
   - `extract_clinic_phone(text: &str) -> Option<String>` — matches UK phone patterns prefixed by `T`, `Tel:`, or bare digits
   - `extract_clinic_email(text: &str) -> Option<String>` — matches email addresses optionally prefixed by `E` or `Email:`

   Unit tests (in `#[cfg(test)]` block of `clinic.rs`):
   - `extracts_phone_with_t_prefix`: `"T 020 3974 0950"` → `Some("020 3974 0950")`
   - `extracts_phone_with_tel_prefix`: `"Tel: 020 3974 0950"` → `Some("020 3974 0950")`
   - `returns_none_when_no_phone`: `"No contact info here"` → `None`
   - `extracts_email_with_e_prefix`: `"E info@evewell.com"` → `Some("info@evewell.com")`
   - `extracts_email_bare`: `"contact@clinic.co.uk"` → `Some("contact@clinic.co.uk")`
   - `returns_none_when_no_email`: `"No email here"` → `None`

   - Done when: all 6 unit tests pass; `cargo test` green.

[ ] **116.2 — `extract_embedded_images()` in `ocr.rs`**

   Add `pub fn extract_embedded_images(pdf_path: &Path, out_dir: &Path) -> Vec<PathBuf>` to `src-tauri/src/extraction/ocr.rs`.

   - Runs `pdfimages -j <pdf_path> <out_dir>/img` via `std::process::Command`
   - Globs `out_dir` for `*.jpg`, `*.ppm`, `*.pbm`, `*.png` after the call
   - Returns empty `Vec` on any failure (binary unavailable, non-zero exit, no images found)

   Unit test: `extract_embedded_images_returns_empty_for_nonexistent_pdf` — call with `/tmp/nonexistent.pdf` → empty `Vec`.

   - Done when: unit test passes; `cargo clippy` clean.

[ ] **116.3 — Supplemental OCR pass in `documents.rs` upload pipeline**

   After `extract_inner()` in the upload pipeline, add supplemental pass: if phone/email absent from text layer, call `extract_embedded_images()` on the PDF, run `extract_image_text()` on each result, join OCR output, then call `extract_clinic_phone()` / `extract_clinic_email()` on the joined text. Clean up temp dir after. Pass results into `ClinicSuggestionDto`.

   Integration test:
   - `evewell_fixture_yields_clinic_phone_and_email`: load `tests/fixtures/evewell-invoice.pdf`, run full pipeline including supplemental pass → assert `clinic_phone == Some("020 3974 0950")` and `clinic_email == Some("info@evewell.com")`. Skip with `return` if `pdfimages` or `tesseract` unavailable.

   - Done when: integration test passes on dev machine (or skips gracefully); clippy clean.

[ ] **116.4 — DTO + UI: Add `phone`/`email` to `ClinicSuggestionDto` and `UploadReviewStep`**

   **Rust:** Add `phone: Option<String>` and `email: Option<String>` fields to `ClinicSuggestionDto` in `src-tauri/src/commands/documents.rs`.

   **TypeScript:** Add `phone?: string` and `email?: string` to the `ClinicSuggestion` interface.

   **UI (`UploadReviewStep`):** Render phone and email lines on the clinic suggestion card when values are present.

   - Done when: `tsc --noEmit` passes; clinic card renders phone + email in dev UI when values are non-null.

[ ] **116.5 — E2E test: clinic suggestion banner shows phone + email**

   File: `e2e/clinic-suggestion-phone-email.spec.ts`

   Scenario:
   1. Mock `extract_document` IPC to return a clinic suggestion with `phone: "020 3974 0950"` and `email: "info@evewell.com"`.
   2. Navigate to upload review step.
   3. Assert clinic suggestion card contains `"020 3974 0950"`.
   4. Assert clinic suggestion card contains `"info@evewell.com"`.

   - Done when: `pnpm playwright test clinic-suggestion-phone-email` passes.

[ ] **116.6 — Pre-commit checks + commit**

   ```bash
   cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   cargo test --manifest-path src-tauri/Cargo.toml
   npx tsc --noEmit
   pnpm vitest run
   ```

   Commit: `feat: supplemental OCR pass extracts clinic phone and email from embedded images`

   - Done when: all checks green; commit pushed to `origin/develop`; CI green.

---

## Phase 117 — Smart Note Content: Invoice / Imaging / Clinical Notes / Fallback

**Business rules (approved by user, 2026-05-17, revised same day):**

**Rule 1 — Invoice detected** (`"invoice"` in `auto_tags`):
- Note content = full document body text (no char cap)
- Title = `"[date] Invoice - [clinic name]"` (or `"[date] Invoice"` if no clinic)
- Example: full physio invoice text preserved, including `£180` line

**Rule 2 — Imaging detected** (`"Radiology"` in `auto_tags`, case-insensitive):
- Note content = full document body text (no char cap)
- Title = `"[date] Diagnostic Imaging Report"` (or `"[date] Diagnostic Imaging Report - [clinic name]"` if clinic present)
- Detection: `auto_tags` includes "Radiology" when text contains "mri", "ct scan", "ultrasound", "xray", "radiol" keywords
- Example: MRI/CT scan report — full text preserved, specific title used

**Rule 3 — Clinical notes section found** (`extract_clinical_notes()` returns Some):
- Note content = extracted clinical notes section (no cap)
- Title = `"[date] Clinical Notes - [clinic name]"`

**Rule 4 — Fallback** (no invoice, no imaging, no clinical notes):
- Collect consecutive non-empty lines from top of extracted text
- Join with `", "` until accumulated length ≥120 chars or blank line hit
- Title = `"[date] Document - [clinic name]"`

[x] **117.1 — `extract_invoice_descriptions()` in `clinical_notes.rs`**

   Add to `src-tauri/src/extraction/clinical_notes.rs`:
   ```rust
   pub fn extract_invoice_descriptions(text: &str) -> Vec<String>
   ```
   - Capture group 1 (description only, no price/qty/currency)
   - Same exclusion filter as `extract_invoice_line_items()`
   - Unit tests: 3 passing tests
   - Done when: unit tests pass; `cargo test` green.

[x] **117.2 — `extract_first_lines()` in `clinical_notes.rs`**

   Add to `src-tauri/src/extraction/clinical_notes.rs`:
   ```rust
   pub fn extract_first_lines(text: &str) -> Option<String>
   ```
   - Skip leading blank lines; collect consecutive non-empty lines joined with `", "`; stop at ≥120 chars or blank line
   - Return `None` if result < 3 chars
   - Done when: unit tests pass; `cargo test` green.

[x] **117.3 — Wire into `documents.rs` note creation (initial — invoice descriptions)**

   Wired `extract_invoice_descriptions()` and `extract_first_lines()`.
   Note: Rule 1 used description-stripping, which failed for free-form invoices like physio (£180, no decimal).

[x] **117.4 — Revise Rule 1: invoice detection via auto_tag + full body text**

   In `src-tauri/src/commands/documents.rs` note-creation block:
   - Change invoice detection: `result.auto_tags.iter().any(|t| t == "invoice")` (replaces `extract_invoice_descriptions().is_empty()`)
   - Change invoice content: `result.text.chars().take(3000).collect::<String>()` (full body text, not joined descriptions)
   - Add unit test `invoice_note_uses_full_body_text` in `clinical_notes.rs` asserting full text preserved
   - Done when: `cargo test` green; `tsc --noEmit` clean; physio invoice note has full text.

[ ] **117.5 — Rule 2: imaging detection + tests**

   In `src-tauri/src/commands/documents.rs` note-creation block:
   - Remove `chars().take(3000)` from Rule 1 (invoice) — use `result.text.clone()`
   - Add Rule 2 between invoice and clinical-notes checks:
     `let is_imaging = !is_invoice && auto_tags.iter().any(|t| t.eq_ignore_ascii_case("Radiology"));`
   - Rule 2 content: `result.text.clone()`, title: `[{friendly_date}] Diagnostic Imaging Report` (+ clinic suffix if present)
   - Add unit test `imaging_report_produces_radiology_auto_tag` in `mod.rs`
   - Add unit test `imaging_note_is_not_invoice` in `clinical_notes.rs`
   - Done when: `cargo test` green; imaging report gets correct title + full content.

▶ [ ] **117.6 — Pre-commit checks + commit**

   ```bash
   cargo fmt --all --manifest-path src-tauri/Cargo.toml -- --check
   cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
   cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
   npx tsc --noEmit
   ./node_modules/.bin/vitest run
   ```

   Commit: `feat: smart note content — invoice/imaging/clinical-notes/fallback (Rule 2 + remove caps)`

   - Done when: all checks green; pushed to `origin/develop`; CI green.
