# myHealth — Team Code Review

**Date**: 2026-04-28  
**Reviewers**: Architect · Security Reviewer · Performance Optimizer  
**Codebase**: Next.js 14 + TypeScript + Tauri v2 + SQLite/SQLCipher  
**Scope**: Full codebase review of v1.1.0 (all 30 PLAN.md tasks complete)

---

## Overall Health

| Dimension | Score |
|-----------|-------|
| Architecture | 3.5 / 5 |
| Security | 3.5 / 5 |
| Performance | 2.8 / 5 |
| **Composite** | **3.3 / 5** |

**Verdict**: Approved for MVP with required fixes. Address CRITICAL issues before any user testing. HIGH issues before broader distribution.

---

## Consensus Findings (All Three Agents Agree)

1. Core IPC boundary architecture is sound; local-first encryption is correctly implemented.
2. `String` error returns across all Tauri commands cause pain for security, architecture, and observability.
3. Single Mutex-wrapped DB connection is a serialization bottleneck as feature count grows.
4. Missing database indexes are the highest-ROI fix available.
5. Codebase is shippable for internal MVP testing today.

---

## CRITICAL — Fix Before User Testing

### C1 — SQL Injection in PRAGMA key/rekey

**Agents**: Security  
**Files**: `src-tauri/src/db/mod.rs:10`, `src-tauri/src/commands/auth.rs:129`  
**CWE**: CWE-89

Both database open and password-change paths interpolate the hex key directly into a PRAGMA statement:

```rust
conn.execute_batch(&format!("PRAGMA key = '{key}';"))
conn.execute_batch(&format!("PRAGMA rekey = '{new_hex}';"))
```

The key is currently hex-only output from `crypto::key_to_hex()`, but there is no type-level or runtime enforcement. A change to key derivation or a bug upstream could enable injection into SQLCipher encryption settings.

**Options**:
- **A (recommended)**: Add hex validation before use — `assert!(key.chars().all(|c| c.is_ascii_hexdigit()) && key.len() == 64)`
- **B**: Introduce newtype `Hex64Key(String)` that validates on construction, making invalid keys unrepresentable
- **C**: Use SQLCipher's parameterized key API if available in the Rust bindings

---

### C2 — XSS via dangerouslySetInnerHTML in Search Snippets

**Agents**: Security  
**File**: `src/components/search/SearchModal.tsx:143`  
**CWE**: CWE-79

```tsx
<div dangerouslySetInnerHTML={{ __html: r.snippet }} />
```

SQLite's `snippet()` wraps matched terms in `<mark>` tags but does not sanitize user content. A note or document containing `<img src=x onerror=...>` would execute script in search results.

**Options**:
- **A (recommended)**: Sanitize with DOMPurify — `DOMPurify.sanitize(r.snippet)` (preserves `<mark>` highlighting)
- **B**: Use `html-react-parser` with a `<mark>`-only allowlist
- **C**: Drop to plain text `{r.snippet}` (safe but loses highlight styling)

---

## HIGH — Fix Before Broader Distribution

### H1 — No Session Timeout / Idle Lock

**Agents**: Security  
**Files**: `src/hooks/useIdleLock.ts`, `src-tauri/src/commands/auth.rs`

Once unlocked, the session persists indefinitely. No idle timeout, no auto-lock, no re-authentication for sensitive operations. An unattended machine gives full access to all health records.

**Options**:
- **A (recommended)**: Configurable idle timeout — auto-lock after N minutes of inactivity (default 15); expose setting in UI
- **B**: Re-auth requirement for destructive operations (delete, export, password change)
- **C**: Use OS-level lock mechanisms (macOS keychain / Windows credential manager) for master password

---

### H2 — Dashboard Unbounded Query (limit: 500)

**Agents**: Performance  
**File**: `src/app/(app)/dashboard/page.tsx:88`

```typescript
invoke<Document[]>('documents_list', { category: null, page: 1, limit: 500 })
```

Fetches up to 500 documents on every dashboard visit. With large datasets causes 1–3s load delay and 2–5MB payloads.

**Options**:
- **A (recommended)**: Change to `limit: 10` sorted by `created_at DESC`; add a separate `stats_summary()` backend command for counts
- **B**: Add hard cap in Rust backend (`LIMIT 20` unconditionally)
- **C**: Dashboard shows only statistics, not document list (defer list to Documents tab)

---

### H3 — Missing Database Indexes on Common Query Paths

**Agents**: Performance  
**File**: `src-tauri/src/db/schema.sql` + migrations

No indexes on:
- `documents.category` — queried on every documents list
- `appointments.appt_date` — sorted DESC on timeline
- `calendar_events.appointment_id` — used in calendar join
- `contacts.is_deduped_with` — used in dedup queries
- `document_appointments.appointment_id` — join table

Sequential scans cause 100–500ms delays once document count exceeds ~5,000.

**Options**:
- **A (recommended)**: Add in migration v4:
  ```sql
  CREATE INDEX idx_documents_category ON documents(category) WHERE is_deleted = 0;
  CREATE INDEX idx_documents_created_at ON documents(created_at DESC) WHERE is_deleted = 0;
  CREATE INDEX idx_appointments_appt_date ON appointments(appt_date DESC);
  CREATE INDEX idx_calendar_events_appointment_id ON calendar_events(appointment_id);
  CREATE INDEX idx_contacts_is_deduped_with ON contacts(is_deduped_with);
  CREATE INDEX idx_document_appointments_appointment_id ON document_appointments(appointment_id);
  ```
- **B**: Run `EXPLAIN QUERY PLAN` on slow queries first to confirm which indexes matter most
- **C**: Composite index `(category, created_at DESC)` for dashboard

---

### H4 — No Password Complexity Enforcement

**Agents**: Security  
**Files**: `src/app/page.tsx:28`, `src-tauri/src/commands/auth.rs`  
**CWE**: CWE-521

Only minimum 8 characters enforced in frontend; no backend validation. "12345678" is accepted. PBKDF2 at 64k iterations provides some protection but weak passwords remain vulnerable to offline dictionary attacks if the database file is stolen.

**Options**:
- **A (recommended)**: Minimum 12 characters + backend validation + `zxcvbn` entropy score (reject score < 2)
- **B**: Minimum 12 chars + basic pattern reject (all same char, sequential digits)
- **C**: Strong password guidance in UI copy + minimum 16 chars

---

### H5 — Boilerplate Duplication in 30+ Tauri Commands

**Agents**: Architect  
**Files**: `src-tauri/src/commands/*.rs` (all command files)

Every command repeats the identical lock-acquisition and error-mapping pattern:

```rust
let guard = state.db.lock().map_err(|e| e.to_string())?;
let conn = guard.as_ref().ok_or("database not open")?;
```

This pattern appears 30+ times. Adding logging, changing error strategy, or adding metrics requires touching all 30 files.

**Options**:
- **A (recommended)**: Extract `CommandContext` helper struct with `CommandContext::new(&state)?` that centralises lock and error logic
- **B**: Procedural macro `#[tauri_command]` that generates the boilerplate (v1.2 effort)
- **C**: Document the pattern + clippy lint to enforce it on new commands

---

### H6 — Extraction Pipeline God Object

**Agents**: Architect  
**File**: `src-tauri/src/extraction/mod.rs`

PDF text extraction, OCR, doctor-name detection, category suggestion, and contact parsing are all entangled in one ~200-line function. Cannot test doctor detection without running the full extraction pipeline.

**Options**:
- **A (recommended)**: Extract pure parse functions — `parse_doctors(text: &str)`, `parse_contacts(text: &str)`, `suggest_category(text: &str)` — leaving extraction as orchestrator
- **B**: Full async pipeline decomposition with `tokio::mpsc` progress channel (v1.2)
- **C**: Add integration tests only (no refactoring)

---

## MEDIUM — Fix in v1.2

### M1 — No Authentication Rate Limiting

**Agents**: Security | `src-tauri/src/commands/auth.rs` | CWE-307  
Unlimited `auth_unlock` attempts. An attacker with the database file can brute-force the master password offline.  
**Options**: A) Exponential backoff (1s, 10s, 5min); B) Lock after 5 fails for 30 min; C) OS-level protection

---

### M2 — All Errors Are Strings (No Structured Error Types)

**Agents**: Architect + Security | `src-tauri/src/commands/*.rs`  
Frontend cannot distinguish "database not open" from "constraint violation" from "not found". Prevents smart retry, targeted error messages, and brittle tests.  
**Options**: A) `CommandError` enum with serde `tag`; B) Error code constants (`ERR_DB_NOT_OPEN`); C) Document expected messages per command

---

### M3 — merge_contacts Has No Transaction

**Agents**: Architect | `src-tauri/src/commands/contacts.rs`  
Merge runs as multiple individual statements. A crash mid-operation leaves orphaned contact references.  
**Options**: A) Wrap in `conn.transaction()` (immediate, low effort); B) Savepoints per-duplicate; C) Idempotent cleanup job

---

### M4 — Search Index Not Updated for Appointments/Categories

**Agents**: Architect | `src-tauri/src/commands/appointments.rs`, `categories.rs`  
`upsert_search_index()` is called on create/update for documents, notes, and contacts but not appointments or categories. Newly created appointments do not appear in search.  
**Options**: A) Add `upsert_search_index()` calls on create/update; B) SQLite triggers; C) Trait-based `Searchable` interface (v1.2)

---

### M5 — Zustand Over-Subscription Causes Unnecessary Re-renders

**Agents**: Performance | `src/hooks/useDocuments.ts:10`  
11 state values destructured wholesale; every component using the hook re-renders when any value changes.  
**Options**: A) Zustand selector hooks per slice; B) TanStack Query migration (v1.2); C) `staleTime` tracking

---

### M6 — Synchronous PDF Extraction Blocks UI Thread

**Agents**: Performance | `src-tauri/src/commands/documents.rs`  
`pdf-extract` runs synchronously, freezing the IPC for 2–10s on large PDFs.  
**Options**: A) Wrap in `tokio::spawn_blocking`; B) Add cancellation + progress events; C) Enforce 20MB file size limit

---

### M7 — Encryption Key Not Zeroed on Drop

**Agents**: Security | `src-tauri/src/commands/mod.rs:19` | CWE-316  
`key_hex: Mutex<Option<String>>` — `String` does not zero memory on drop; key material survives in heap until overwritten.  
**Options**: A) `zeroize` crate with `Zeroizing<String>`; B) Explicit overwrite before drop; C) Accept for local desktop context

---

### M8 — PBKDF2 Iterations Below 2024 Standards (64k vs OWASP 1M)

**Agents**: Security | `src-tauri/src/crypto.rs:6` | CWE-327  
OWASP 2023 recommends ≥1M iterations for PBKDF2-HMAC-SHA512. At 64k, offline brute-force is feasible for weak passwords.  
**Options**: A) Increase to 500k + migration re-hash on next unlock; B) Switch to Argon2id; C) Document 16+ char requirement

---

### M9 — CSP is null in tauri.conf.json

**Agents**: Security | `src-tauri/tauri.conf.json:23` | CWE-693  
Content Security Policy explicitly disabled. Defense-in-depth layer missing.  
**Options**: A) Remove `"csp": null` (enables Tauri default); B) Explicit restrictive policy; C) Accept for local-only app

---

### M10 — Dashboard Filters Appointments in JavaScript

**Agents**: Performance | `src/app/(app)/dashboard/page.tsx:87`  
All appointments fetched then filtered to upcoming in JS instead of SQL.  
**Options**: A) `appointments_list_upcoming(days_ahead)` backend command; B) Move `WHERE appt_date >= ?` to SQL; C) Cache stats

---

### M11 — Type-Unsafe IPC Invocations

**Agents**: Architect | All `*.tsx` files using `invoke()`  
Command names are string literals; TypeScript types manually annotated. Renaming a command causes silent runtime failures.  
**Options**: A) Macro code-gen (Rust → TypeScript stubs); B) `as const` command registry; C) OpenAPI contract file

---

### M12 — PostCSS < 8.5.10 XSS in Build Dependency Chain

**Agents**: Security | `package.json` (transitive via Next.js) | CWE-79  
Build-time XSS in CSS stringify output. Low runtime risk but should be patched.  
**Options**: A) `npm audit fix` + test build; B) Upgrade Next.js to version with patched postcss; C) Accept (build-time only)

---

## LOW — Nice to Have

| # | Issue | File | Option |
|---|-------|------|--------|
| L1 | No virtualization in DocumentList for >30 items | `DocumentList.tsx` | react-window FixedSizeList |
| L2 | Sequential extraction + scoring in upload (should be parallel) | `documents/page.tsx` | `Promise.all([invoke(...), invoke(...)])` |
| L3 | Migration framework missing (forward-only, hard to test rollback) | `db/migrations.rs` | Add migration path integration tests |
| L4 | Dev-mode IPC transmits passwords in plaintext (WebSocket) | N/A | Document: never use prod passwords in dev |
| L5 | Dashboard inline helper functions recreated per render | `dashboard/page.tsx` | Extract to `src/lib/formatting.ts` |
| L6 | `RwLock` upgrade for DB connection (allow concurrent reads) | `commands/mod.rs` | Replace `Mutex` with `tokio::sync::RwLock` |

---

## Agent Conflicts and Resolutions

| Tension | Resolution |
|---------|-----------|
| Security wants 1M PBKDF2 iterations; Performance notes slower unlock | Increase to 500k. Document 16+ char password recommendation. Plan Argon2id for v2.0. |
| Architect recommends TanStack Query; Performance says Zustand selectors are sufficient now | Implement Zustand selectors immediately; plan TanStack Query for v1.2. |
| Security flags `dangerouslySetInnerHTML` as CRITICAL; Architect missed it | Security takes precedence — fix with DOMPurify before any user testing. |
| Performance recommends async PDF extraction; Architect notes extraction is already a God Object | Do both together: extract pure parse functions (H6-A) + add `spawn_blocking` (M6-A). |
