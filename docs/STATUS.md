# myHealth — Unified Quality Status

> Single source of truth merging: smoke test report (v1.1), code review report (v1.2),
> upload analysis gaps, V3 gap register, and performance results.
> **Last updated:** 2026-05-02

---

## 1. Feature Implementation Status

Source of truth: `V3_GAP.md` (v1.5.0 / 2026-05-02). 41 of 47 items implemented (87%).

### F1 — Document Management
| Item | Status |
|------|--------|
| F1.1 Document upload + storage | ✅ Done |
| F1.2 PDF/image OCR extraction | ✅ Done |
| F1.3 Test-type keyword normalisation | ✅ Done (Phase 12) |
| F1.4 Clinic name from filename parsing | ✅ Done (Phase 12) |
| F1.5 Document categories (many-to-many) | ✅ Done |
| F1.6 Document search (FTS5) | ✅ Done |

### F2 — Appointments
| Item | Status |
|------|--------|
| F2.1 Appointments CRUD | ✅ Done |
| F2.2 Appointment search | ✅ Done |
| F2.3 Per-page OCR progress | ⚠️ 80% — no timeout/cancel |
| F2.4 OCR timeout handling | ⚠️ 50% — partial |
| F2.5 Document–appointment linking | ✅ Done |
| F2.6 Appointment reminders | ❌ Not done → Phase 15 |
| F2.7 Recurring appointments | ❌ Not done → Phase 16 |

### F3 — Notes
| Item | Status |
|------|--------|
| F3.1 Notes CRUD | ✅ Done |
| F3.2 Note categories | ✅ Done |
| F3.3 Note search | ✅ Done |
| F3.4 Note cross-links | ❌ Not done → Phase 17 |
| F3.5 Note version history | ❌ Not done → Phase 17 |

### F4 — Contacts
| Item | Status |
|------|--------|
| F4.1 Contacts CRUD | ✅ Done |
| F4.2 Contact search | ✅ Done |
| F4.3 Contact ↔ appointment linking | 🔄 In progress (Phase 13) |
| F4.4 Contact deduplication | ✅ Done |
| F4.5 Contact merge | ✅ Done |

### F5 — Clinics
| Item | Status |
|------|--------|
| All F5 items | ✅ Done |

### F6 — Timeline
| Item | Status |
|------|--------|
| All F6 items | ✅ Done |

### F7 — Search
| Item | Status |
|------|--------|
| All F7 items | ✅ Done |

### F8 — Data Portability
| Item | Status |
|------|--------|
| F8.1–F8.5 Various export/import | ✅ Done |
| F8.6 Backup export | ❌ Not done → Phase 14 |
| F8.7 Backup import | ❌ Not done → Phase 14 |

---

## 2. Code Quality Findings (v1.2 Code Review)

Agents: Architect · Security Reviewer · Performance Optimizer

### CRITICAL

| # | Issue | File | Status |
|---|-------|------|--------|
| C1 | SQL injection via PRAGMA key string interpolation | `db/mod.rs:10`, `auth.rs:129` | ✅ Fixed — hex validation (`key.chars().all(c.is_ascii_hexdigit())`) |
| C2 | XSS via `dangerouslySetInnerHTML` in search snippets | `SearchModal.tsx:143` | ✅ Fixed — DOMPurify sanitize applied |

### HIGH

| # | Issue | File | Status |
|---|-------|------|--------|
| H1 | No session timeout / idle lock | `useIdleLock.ts`, `auth.rs` | ✅ Fixed — `useIdleLock` hook + `IdleLockProvider` + settings UI |
| H2 | Dashboard unbounded query (limit 500) | `dashboard/page.tsx:88` | ✅ Fixed — documents capped to 10; appointments use `appointments_list_upcoming` |
| H3 | Missing DB indexes on `documents.category`, `appointments.appt_date`, `calendar_events.appointment_id`, `contacts.is_deduped_with` | `migrations.rs` | ✅ Fixed — all 6 indexes added in SCHEMA_V4; verified by `migration_v4_creates_indexes` test |
| H4 | No password complexity enforcement | `page.tsx:28`, `auth.rs` | ✅ Fixed — min 12 chars enforced |
| H5 | Boilerplate duplication in 30+ Tauri commands | `commands/*.rs` | ❌ Open → Phase 19 |
| H6 | Extraction pipeline God Object (text+OCR+parsing entangled) | `extraction/mod.rs` | ❌ Open → Phase 19 |

### MEDIUM

| # | Issue | File | Status |
|---|-------|------|--------|
| M1 | No auth rate limiting | `auth.rs` | ✅ Fixed — `auth_rate_limit` with exponential backoff |
| M2 | Structured error types missing — all errors are `String` | `commands/*.rs` | ❌ Open → Phase 19 |
| M3 | `merge_contacts` had no transaction | `contacts.rs` | ✅ Fixed — `unchecked_transaction()` wrapping |
| M4 | Search index not updated for appointments/categories | `appointments.rs`, `categories.rs` | ✅ Fixed — `upsert_search_index` calls added |
| M5 | Zustand over-subscription (11 values destructured) | `hooks/useDocuments.ts:10` | ❌ Open → Phase 19 |
| M6 | Synchronous PDF extraction blocks UI thread | `commands/documents.rs` | ✅ Fixed — `tokio::task::spawn_blocking` |
| M7 | Encryption key (`key_hex`) not zeroed on drop | `commands/mod.rs:19` | ✅ Fixed — `Zeroizing<String>` via `zeroize` crate |
| M8 | PBKDF2 iterations (64k) below OWASP standard | `crypto.rs:6` | ✅ Fixed — raised to 500,000 |
| M9 | CSP null in `tauri.conf.json` | `tauri.conf.json:23` | ✅ Fixed — restrictive CSP configured |
| M10 | Dashboard loads all appointments, filters in JS | `dashboard/page.tsx:87` | ✅ Fixed — `appointments_list_upcoming(daysAhead)` backend command |
| M11 | Type-unsafe IPC invocations (string literals, no compile-time check) | `*.tsx invoke calls` | ❌ Open → Phase 19 |
| M12 | PostCSS < 8.5.10 XSS in build dependency chain | `package.json` | ✅ Fixed — `postcss@^8.5.10`, 0 audit vulnerabilities |

### LOW

| # | Issue | Status |
|---|-------|--------|
| L1 | Merge rollback for failed merges (covered by M3) | ✅ Fixed |
| L2 | No migration framework (forward-only, hard to test) | Accept — out of scope for MVP |
| L3 | No virtualization in `DocumentList` (>30 items) | ❌ Open → Phase 19 |
| L4 | Sequential extraction/scoring in upload | ❌ Open → Phase 19 |
| L5 | Dev-mode IPC transmits passwords plaintext | Accept — dev-only |
| L6 | Inline dashboard helpers recreated per render | ❌ Open → Phase 19 |

---

## 3. Performance Results

MacBook Pro M2, commit `4128ff3`.

| Goal | Metric | Target | Result | Status |
|------|--------|--------|--------|--------|
| G-08 | Cold start | < 2s | ~0.8s | ✅ Pass |
| G-09 | Document list (1,000 rows) | < 200ms | ~0ms | ✅ Pass |
| G-10 | Calendar sync | < 1s | ~0.3s | ✅ Pass |

**Note:** G-09 is a Rust unit test (in-memory DB). H3 missing indexes may affect real-world performance at scale.

---

## 4. Accessibility & Keyboard Navigation (Phase 18)

| Test | Tool | Result |
|------|------|--------|
| G-11: Sidebar axe-core audit | axe-core 4.11.3 | ✅ 0 violations |
| G-11: DocumentCard axe-core audit | axe-core 4.11.3 | ✅ 0 violations |
| G-11: AppointmentCard axe-core audit | axe-core 4.11.3 | ✅ 0 violations |
| G-12: All 10 nav + Lock button reachable via Tab | @testing-library/user-event | ✅ Pass |
| G-12: Focus does not trap on Lock button | @testing-library/user-event | ✅ Pass |

Test files: `src/__tests__/a11y.test.tsx`, `src/__tests__/keyboard-nav.test.tsx`

---

## 5. Automated Test Coverage

As of commit `4128ff3` (2026-04-22):

| Layer | Result |
|-------|--------|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Rust (`cargo clippy`) | ✅ 0 warnings |
| Rust unit tests | ✅ 221 passed |
| Frontend tests (Vitest) | ✅ 331 passed |
| Statement coverage | ✅ 90.32% |

---

## 6. Manual Smoke Test Checklist

Items pending verification against current build:

| Scenario | Status |
|----------|--------|
| Dedup contact detected and flagged | ⏳ Pending |
| Contact merge preserves all linked documents | ⏳ Pending |
| Document ↔ appointment link scoring | ⏳ Pending |
| OCR upload flow (multi-page PDF) | ⏳ Pending |
| Category bulk operations | ⏳ Pending |
| FTS5 full-text search across all record types | ⏳ Pending |

---

## 7. NFR Status

| Requirement | Status |
|-------------|--------|
| Encryption at rest (SQLCipher AES-256) | ✅ |
| Offline-only (no network calls) | ✅ |
| FTS5 full-text search | ✅ |
| Calendar sync (Apple Calendar, macOS) | ✅ |
| GitHub Releases CI/CD pipeline | ✅ |

---

## 8. Open Items → PLAN.md Phase 19

| # | Priority | Item |
|---|----------|------|
| ~~H3~~ | ~~HIGH~~ | ~~Add DB indexes~~ — ✅ already in SCHEMA_V4 |
| H5 | HIGH | Reduce Tauri command boilerplate — `CommandContext` helper struct |
| H6 | HIGH | Refactor extraction pipeline — split pure `parse_doctors()` / `parse_contacts()` functions |
| F2.3/F2.4 | MED | OCR per-page progress events + timeout/cancel |
| M2 | MED | `CommandError` enum replacing string error returns |
| M5 | MED | Zustand selector hooks per slice (reduce re-renders) |
| M11 | MED | Type-safe IPC — typed command registry |
| L3 | LOW | Virtualize `DocumentList` with `react-window` for >30 items |
| L4 | LOW | Parallel extraction/scoring with `Promise.all` |
| L6 | LOW | Extract inline dashboard helpers to `src/lib/formatting.ts` |

---

*Merged from: `SMOKE_TEST_REPORT_V1.1.md`, `v1.2-code-review-report.md`, `UPLOAD_ANALYSIS_GAPS.md`, `V3_GAP.md`, `PERF_RESULTS.md`*
