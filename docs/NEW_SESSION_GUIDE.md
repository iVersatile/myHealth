# myHealth — New Agent / Session Onboarding Guide

> Read this first after a `clear` command or when starting a new session.
> Last updated: 2026-05-04 (v1.6.1 shipped, CI green)

---

## 1. Project in One Paragraph

**myHealth** is a local-first, offline-only personal health records desktop app. Built with **Next.js 14 + TypeScript + Tauri v2 (Rust) + SQLite/SQLCipher**. It stores documents, appointments, notes, contacts, and clinics — all encrypted at rest. No network calls, ever. Distributed via **GitHub Releases** (`.dmg`, `.exe`, `.AppImage`) — a git tag triggers a 4-platform CI build. The user is the sole developer; you are their AI pair programmer.

---

## 2. Current State (as of 2026-05-04)

| Item | Status |
|------|--------|
| Latest release | **v1.6.1** — all CI green (Build & Release ✅, Lint ✅, Tests ✅) |
| Branch | `develop` |
| Test coverage | ~90% statement, 80%+ branch |
| Rust tests | 221 passed |
| Frontend tests | 331 passed |
| PLAN.md marker | Phase 28-E ▶ 28-E.1 — **but 28-E.1 and 28-E.2 are already done** (marker is stale) |

### What was done in the last two sessions

- **E2E acceptance tests** created: `e2e/upload-document-flow.spec.ts` and `e2e/verify-edit-entities.spec.ts`
- **Fixture PDF** generated at `src-tauri/tests/fixtures/medical-invoice.pdf`
- **Build fix:** `apptToEvent` was a named export in `page.tsx`, violating Next.js App Router rules. Moved to `src/app/(app)/timeline/timeline-utils.ts`. Test import updated accordingly.
- **v1.6.1 tagged** at fixed commit `91e2803`

### PLAN.md stale marker — what to do before running `go`

The `▶` marker shows `28-E.1` but that task is complete. Before running `go`:
1. Open `PLAN.md`
2. Mark `28-E.1` and `28-E.2` as `[x]`
3. Move `▶` to `28-E.3`
4. Update the RESUME POINT block at the top

---

## 3. Key Documents — Read Before Working

| Document | What it contains | Read when |
|----------|-----------------|-----------|
| `PLAN.md` | Execution tracker with ▶ marker. Every task has "Done when" criteria. | Every session start |
| `CLAUDE.md` | **Critical rules**: `go` protocol, pre-commit checklist, IPC naming, Git Tag Approval Rule, Manual Test Feedback Protocol | Every session start |
| `docs/PRD.md` | Original feature requirements (v1.0–v1.1) | When a feature's intent is unclear |
| `docs/PRD_V2.md` | v1.2/v1.3 features + manual test feedback log | When working on v1.2/v1.3 features |
| `docs/PRD_V3.md` | v1.4 features (tag extraction, contact auto-creation, clinic reg no) | When working on v1.4 features |
| `docs/PRD_V4.md` | v1.5+ features | When working on v1.5+ features |
| `docs/ARCHITECTURE_V2.md` | System design, DB schema, Rust module layout | When touching backend or DB |
| `docs/LESSONS_LEARNT.md` | **11 root-cause post-mortems** — avoid repeating these | Before any Rust extraction/IPC work |
| `docs/STATUS.md` | Unified quality status — open issues, code review findings, perf results | When assessing what's broken |
| `docs/COMMIT_STRATEGY.md` | Branch/tag/release workflow, Git Tag Approval Rule details | Before any `git tag` |
| `docs/MANUAL_TEST_GUIDE.md` | Step-by-step smoke test scenarios | When verifying the app manually |
| `docs/ACCEPTANCE_TESTS_V3.md` | Acceptance criteria for v1.4–v1.5 features | When verifying V3 features |

---

## 4. Stack Reference

| Layer | Technology |
|-------|------------|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | Next.js 14 App Router + TypeScript + Tailwind CSS |
| State | Zustand |
| Database | SQLite + SQLCipher AES-256 |
| Full-text search | SQLite FTS5 |
| OCR | Tesseract (Rust binding) |
| Testing (frontend) | Vitest + @testing-library/react |
| Testing (E2E) | Playwright (requires live Tauri dev server) |
| CI/CD | GitHub Actions → GitHub Releases |

---

## 5. Non-Negotiable Rules (CLAUDE.md)

These will break the build, the release, or the user's trust if ignored.

### 5.1 Pre-Commit Checklist — MANDATORY before every `git commit`

```bash
# If any .ts/.tsx changed:
npx tsc --noEmit

# If any src-tauri/** changed:
~/.cargo/bin/cargo fmt --all --manifest-path src-tauri/Cargo.toml
~/.cargo/bin/cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Both must pass. Never commit running only one when both layers are touched.

### 5.2 Git Tag Approval Rule

**Never run `git tag` without explicit user approval in the same session.** Tags trigger irreversible 4-platform release builds. Present the intended tag name and wait for "yes."

### 5.3 Tauri IPC Naming Rule

Rust `snake_case` params → `camelCase` at JS boundary.
- Rust: `document_id: String` → JS: `invoke('cmd', { documentId: '...' })`
- Never "fix" camelCase to snake_case in `invoke()` — that breaks at runtime.

### 5.4 Next.js Page Export Rule

`page.tsx` files must only default-export the page component. Any named export is treated as a reserved Next.js field and causes a build error. Put all helpers/utilities in a sibling `*-utils.ts` file.

### 5.5 Manual Test Feedback Protocol

When the user reports an issue from manual testing:
1. Check `docs/PRD.md` — is it a requirement that was missed?
   - **If yes (PRD miss):** Add to `docs/LESSONS_LEARNT.md`, then fix
   - **If no (missing req):** Add to `docs/PRD_V2.md` as a new requirement, then implement
2. Record all feedback in `docs/PRD_V2.md` regardless

### 5.6 `go` Command Protocol

When user types `go`:
1. Read `PLAN.md`, find `▶`
2. Execute that task completely
3. Mark `[x]`, advance `▶`, commit + push to `origin/develop`
4. Check CI; auto-fix if red
5. Do not start the next task until CI is green

**Standing override:** Do NOT start new PLAN.md tasks without explicit user approval. Confirm intent first even when `go` is typed.

### 5.7 gateguard-fact-force.js Hook

A `PreToolUse` hook intercepts every `Write` and `Edit` call requiring 4 facts in plain text first:
- **Write:** (1) files that will call this new file, (2) no duplicate exists, (3) data fields/structure, (4) verbatim user instruction
- **Edit:** (1) all files that import the target, (2) public functions affected, (3) data fields if applicable, (4) verbatim user instruction

Present the facts in your response, then retry the exact same tool call. This is intentional.

---

## 6. Architecture Quick Reference

### Data Flow

```
Next.js UI
  → invoke('command_name', { camelCaseArgs })   ← Tauri IPC
    → Rust command (src-tauri/src/commands/)
      → SQLite via rusqlite (src-tauri/src/db/)
        → Result<T, String> back to JS
```

### Key Directories

```
src/
  app/(app)/               # App Router pages (documents, appointments, notes, clinics, timeline…)
  store/                   # Zustand stores (*Store.ts)
  hooks/                   # Custom React hooks (useDocuments, useAppointments, etc.)
  components/              # Shared UI components

src-tauri/src/
  commands/                # Tauri IPC handlers — one file per entity
    documents.rs / appointments.rs / contacts.rs / clinics.rs / notes.rs / categories.rs / auth.rs
  extraction/              # OCR + text parsing pipeline
    mod.rs                 # Orchestrator
    contact.rs             # Doctor / clinic name extraction
    categories.rs          # Category scoring
  db/
    mod.rs                 # DB init, SQLCipher key setup
    migrations.rs          # Forward-only schema (SCHEMA_V1…V20+)
  crypto.rs                # PBKDF2-SHA512 key derivation
  lib.rs                   # Tauri entry point, command registration

e2e/                       # Playwright E2E tests (require running Tauri dev server at localhost:1420)
docs/                      # All project documentation
```

### Key DB Tables

| Table | Purpose |
|-------|---------|
| `documents` | Uploaded files, OCR text, clinic_name, tags JSON |
| `appointments` | CRUD + recurrence_series_id |
| `contacts` | name, phone, role CHECK ('gp','specialist','dentist','physio','pharmacist','hospital','other') |
| `clinics` | name, address, phone, company_registration_number |
| `clinic_contacts` | Junction: clinics ↔ contacts |
| `appointment_document_links` | Scored links between appointments and documents |
| `categories` | name, color_hex |
| `document_categories`, `appointment_categories` | Junction tables |
| `notes` | title, content, tags JSON |
| `fts_index` | FTS5 virtual table for global search |

---

## 7. Technical Complexity & Gotchas

### 7.1 Mixed-Language Build
TypeScript errors and Rust errors are independent. A clean `tsc` doesn't mean Rust is clean. Always run both pre-commit checks on any task touching both layers.

### 7.2 Next.js App Router Strict Export Rules
Every `page.tsx` / `layout.tsx` / `error.tsx` has reserved named export slots. Utility functions in these files cause build-time type errors. Always extract to `*-utils.ts` or `lib/`. This is what broke v1.6.1 Build & Release.

### 7.3 SQLCipher / PBKDF2
DB key derived at login, 500,000 PBKDF2-SHA512 iterations. Held in memory as `Zeroizing<String>`. All migrations must be additive (nullable new columns). Never test with real patient data.

### 7.4 E2E Tests Need a Live App
`e2e/` tests connect to `localhost:1420`. They cannot run standalone. In CI the workflow starts the Tauri dev server. Locally you need `npm run tauri dev` running concurrently in a separate terminal.

### 7.5 Extraction Pipeline Fragility
`src-tauri/src/extraction/` uses regex tuned for UK medical documents:
- Patient names can match doctor-name regexes — exclusion list in `REFERRAL_PHRASES`
- Clinic names appear mid-sentence (never use `(?m)^` anchor — see Lesson 8)
- Specialty scoring is position-weighted to prevent footer poisoning (see L-010)
- When fixing an extraction bug, add a regression test for that specific document shape

### 7.6 Forward-Only Migrations
No rollback. All migrations additive: new tables, nullable new columns, new indexes only. Never drop or rename in production migrations.

### 7.7 Role Constraint
`contacts.role` CHECK allows only: `'gp','specialist','dentist','physio','pharmacist','hospital','other'`. Never hardcode a role string. Always reference `CONTACT_ROLES` from `contactsStore.ts`.

### 7.8 Re-Running Extraction After Dialog Close
`handleUploaded` must NOT call `documents_run_extraction` again after `UploadDialog` closes — this re-populates banners the user just dismissed. (See L-011.)

---

## 8. Domain Complexity

- **UK data formats:** CRN (8-digit), postcodes (`W1G 0PU`), phone (`020 XXXX XXXX`). Regexes assume these.
- **Medical document parsing:** Provider titles (`Dr`, `Prof`, `BSc MSc MCSP`), British dates (`15/01/2024`), clinic names in letterheads and footers.
- **Entity cross-linking:** Documents ↔ Appointments (scored), Contacts ↔ Clinics (junction), Categories ↔ both Documents and Appointments.
- **Health data sensitivity:** Zero telemetry, zero external SDKs with network access. Non-negotiable.

---

## 9. Open Technical Debt (Phase 19, deferred)

| Priority | Item |
|----------|------|
| HIGH | Tauri command boilerplate → `CommandContext` helper |
| HIGH | Extraction pipeline God Object → split `parse_doctors` / `parse_contacts` |
| MED | `CommandError` enum (currently all errors are `String`) |
| MED | Zustand over-subscription (11 values destructured per hook) |
| MED | Type-safe IPC command registry |
| LOW | Virtualise `DocumentList` with `react-window` |
| LOW | Parallel extraction/scoring with `Promise.all` |

---

## 10. What's Next (v1.2 — do NOT start without user approval)

- Advanced search filters (date range, category combos)
- Drag-to-organize categories
- Auto-archive empty categories
- Calendar conflict resolution UI
- PDF summary report export

---

## 11. Emergency Commands

```bash
# CI status
gh run list --limit 10
gh run view <run-id> --log-failed

# TypeScript check
npx tsc --noEmit

# Rust check
~/.cargo/bin/cargo fmt --all --manifest-path src-tauri/Cargo.toml
~/.cargo/bin/cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# Frontend tests
npx vitest run
npx vitest run --coverage

# Git state
git log --oneline -5
git tag --sort=-version:refname | head -5
```

---

## 12. Lessons Hall of Fame (Top 5)

Full list: `docs/LESSONS_LEARNT.md`

1. **Fix ALL commands with the same pattern, not just the one you found** — a half-fix is a broken release (L-011)
2. **Named exports in `page.tsx` break Next.js builds** — put utilities in `*-utils.ts` (this session, v1.6.1)
3. **`cargo fmt` is non-negotiable** — `tsc` passing alone is not enough on mixed-language tasks (feedback_precommit_rust.md)
4. **Never use `(?m)^` in extraction regexes** — real documents embed clinic/doctor names mid-sentence (Lesson 8)
5. **Role strings must come from `CONTACT_ROLES`, never hardcoded** — `'Doctor'` (capital D) and `'clinic'` are invalid and crash silently at the DB layer (L-011)

---

*Generated: 2026-05-04 | Release: v1.6.1 | CI: all green*
