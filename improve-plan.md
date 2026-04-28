# myHealth — Improvement Plan

**Source**: `docs/code-review.md` (2026-04-28 team review)  
**Scope**: All CRITICAL, HIGH, and MEDIUM issues — 18 total  
**Approach**: Fix in three passes — Sprint 0 (blockers before any user testing), Sprint 1 (before broader distribution), Sprint 2 (v1.2 cycle)

---

## Sprint 0 — Fix Before Any User Testing

*Estimated: 3–5 hours. Must all land before first external user sees the app.*

### C1 — SQL Injection in PRAGMA key/rekey

**Chosen option**: A — Add hex validation before interpolation  
**Files**: `src-tauri/src/db/mod.rs:10`, `src-tauri/src/commands/auth.rs:129`  
**Implementation**:
```rust
// db/mod.rs — before execute_batch
assert!(
    key.chars().all(|c| c.is_ascii_hexdigit()) && key.len() == 64,
    "key must be 64 hex digits"
);
conn.execute_batch(&format!("PRAGMA key = \"x'{key}'\";"))?;

// auth.rs — before rekey execute_batch
assert!(
    new_hex.chars().all(|c| c.is_ascii_hexdigit()) && new_hex.len() == 64,
    "rekey value must be 64 hex digits"
);
conn.execute_batch(&format!("PRAGMA rekey = \"x'{new_hex}'\";"))?;
```
**Done when**: Assertion present on both PRAGMA paths; clippy passes.

---

### C2 — XSS via dangerouslySetInnerHTML in Search Snippets

**Chosen option**: A — DOMPurify (preserves `<mark>` highlighting)  
**File**: `src/components/search/SearchModal.tsx:143`  
**Implementation**:
```bash
npm install dompurify @types/dompurify
```
```tsx
import DOMPurify from 'dompurify';

// replace existing line:
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(r.snippet) }} />
```
**Done when**: DOMPurify installed, import added, sanitize call wraps every snippet render; tsc passes.

---

## Sprint 1 — Fix Before Broader Distribution

*Estimated: 8–12 hours. Land before any GitHub Release with external users.*

### H1 — No Session Timeout / Idle Lock

**Chosen option**: A — Configurable idle timeout with UI setting (default 15 min)  
**Files**: `src/hooks/useIdleLock.ts` (create or extend), `src-tauri/src/commands/auth.rs`  
**Implementation**:
- Add `idleTimeoutMinutes` to app settings (SQLite `settings` table, default 15)
- `useIdleLock` hook: track `mousemove`/`keydown` events; after N minutes of silence call `auth_lock` Tauri command
- Add setting toggle in UI (Settings screen)

**Done when**: After 15 min inactivity the app locks and requires password re-entry; setting persists across restarts.

---

### H2 — Dashboard Unbounded Query (limit: 500)

**Chosen option**: A — `limit: 10` + separate `stats_summary()` backend command  
**Files**: `src/app/(app)/dashboard/page.tsx:88`, `src-tauri/src/commands/documents.rs`  
**Implementation**:
```typescript
// page.tsx — change limit
invoke<Document[]>('documents_list', { category: null, page: 1, limit: 10 })
```
```rust
// new Tauri command
#[tauri::command]
pub fn stats_summary(state: tauri::State<AppState>) -> Result<StatsSummary, String> { ... }
// returns { total_documents, total_appointments, upcoming_count, ... }
```
**Done when**: Dashboard payload under 50KB; stats shown via dedicated command.

---

### H3 — Missing Database Indexes

**Chosen option**: A — Migration v4  
**Files**: `src-tauri/src/db/migrations.rs`, `src-tauri/src/db/schema.sql`  
**Implementation**:
```sql
-- migration v4
CREATE INDEX IF NOT EXISTS idx_documents_category
    ON documents(category) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_documents_created_at
    ON documents(created_at DESC) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_appointments_appt_date
    ON appointments(appt_date DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_events_appointment_id
    ON calendar_events(appointment_id);
CREATE INDEX IF NOT EXISTS idx_contacts_is_deduped_with
    ON contacts(is_deduped_with);
CREATE INDEX IF NOT EXISTS idx_document_appointments_appointment_id
    ON document_appointments(appointment_id);
```
**Done when**: Migration v4 runs on startup; `EXPLAIN QUERY PLAN` on `documents_list` and `appointments_list` shows index scans.

---

### H4 — No Password Complexity Enforcement

**Chosen option**: B — Minimum 12 chars + basic pattern reject  
**Files**: `src/app/page.tsx:28`, `src-tauri/src/commands/auth.rs`  
**Implementation**:
```typescript
// Frontend validation
const isWeak = (p: string) =>
  p.length < 12 ||
  /^(.)\1+$/.test(p) ||
  /^(012|123|234|345|456|567|678|789|890|987|876|765|654|543|432|321|210)+$/i.test(p);
```
```rust
// Backend guard in auth.rs setup/change password
if password.len() < 12 { return Err("password_too_short".into()); }
```
**Done when**: "12345678" and "aaaaaaaa" rejected frontend + backend; 12-char mixed string accepted.

---

### H5 — Boilerplate Duplication in 30+ Tauri Commands

**Chosen option**: A — `CommandContext` helper struct  
**Files**: `src-tauri/src/commands/mod.rs`, all `src-tauri/src/commands/*.rs`  
**Implementation**:
```rust
// commands/mod.rs — add helper
pub struct CommandContext<'a> {
    pub conn: &'a rusqlite::Connection,
}

impl<'a> CommandContext<'a> {
    pub fn new(
        guard: &'a std::sync::MutexGuard<'a, Option<rusqlite::Connection>>,
    ) -> Result<Self, String> {
        let conn = guard.as_ref().ok_or("database not open")?;
        Ok(Self { conn })
    }
}
```
Replace each command's two-line boilerplate:
```rust
// Before (30+ times):
let guard = state.db.lock().map_err(|e| e.to_string())?;
let conn = guard.as_ref().ok_or("database not open")?;

// After:
let guard = state.db.lock().map_err(|e| e.to_string())?;
let ctx = CommandContext::new(&guard)?;
// use ctx.conn
```
**Done when**: `CommandContext` struct defined; all commands updated; clippy passes.

---

### H6 — Extraction Pipeline God Object *(combine with M6)*

**Chosen option**: A — Extract pure parse functions + `spawn_blocking` for PDF (M6 fix included)  
**File**: `src-tauri/src/extraction/mod.rs`  
**Implementation**:
```rust
pub fn parse_doctors(text: &str) -> Vec<String> { ... }
pub fn parse_contacts(text: &str) -> Vec<ContactCandidate> { ... }
pub fn suggest_category(text: &str) -> Option<String> { ... }

pub async fn extract_document(path: &Path) -> Result<ExtractionResult, ExtractionError> {
    let text = tokio::task::spawn_blocking(|| pdf_extract_text(path)).await??;
    Ok(ExtractionResult {
        text: text.clone(),
        doctors: parse_doctors(&text),
        contacts: parse_contacts(&text),
        category: suggest_category(&text),
    })
}
```
**Done when**: Three pure functions with unit tests; orchestrator delegates to them; spawn_blocking wraps blocking PDF call.

---

## Sprint 2 — v1.2 Cycle

*Discrete PRs, ordered by effort ascending.*

### M3 — merge_contacts Has No Transaction *(~30 min)*

**Chosen option**: A — Wrap in `conn.transaction()`  
**File**: `src-tauri/src/commands/contacts.rs`  
Replace bare execute calls with `tx = conn.transaction()?` block; commit at end, auto-rollback on error.

---

### M9 — CSP is null *(~5 min)*

**Chosen option**: A — Remove `"csp": null`  
**File**: `src-tauri/tauri.conf.json:23`  
After removing, verify app loads in dev. If inline scripts fail, add nonce/hash rather than re-disabling.

---

### M12 — PostCSS < 8.5.10 *(~5 min)*

**Chosen option**: A — `npm audit fix` + verify build  
**File**: `package.json`  
```bash
npm audit fix && npm run build
```

---

### M4 — Search Index Not Updated for Appointments/Categories

**Chosen option**: A — Add `upsert_search_index()` calls on create/update  
**Files**: `src-tauri/src/commands/appointments.rs`, `src-tauri/src/commands/categories.rs`  
Mirror the pattern already used in documents, notes, and contacts.

---

### M5 — Zustand Over-Subscription

**Chosen option**: A — Zustand selector hooks per slice  
**File**: `src/hooks/useDocuments.ts:10`  
```typescript
const documents = useDocumentsStore(s => s.documents);
const total = useDocumentsStore(s => s.total);
// one selector per consumed value — no wholesale destructure
```

---

### M7 — Encryption Key Not Zeroed on Drop

**Chosen option**: A — `zeroize` crate with `Zeroizing<String>`  
**File**: `src-tauri/src/commands/mod.rs:19`  
```toml
# Cargo.toml
zeroize = "1"
```
```rust
use zeroize::Zeroizing;
pub key_hex: std::sync::Mutex<Option<Zeroizing<String>>>,
```

---

### M10 — Dashboard Filters Appointments in JavaScript

**Chosen option**: A — `appointments_list_upcoming(days_ahead)` backend command  
**Files**: `src/app/(app)/dashboard/page.tsx:87`, `src-tauri/src/commands/appointments.rs`  
Add `WHERE appt_date >= date('now') AND appt_date <= date('now', '+' || ? || ' days')` to SQL.

---

### M1 — No Authentication Rate Limiting

**Chosen option**: A — Exponential backoff (1s → 10s → 5 min)  
**File**: `src-tauri/src/commands/auth.rs`  
Track `failed_attempts` + `locked_until` in Rust `AppState`. Reset on success.

---

### M8 — PBKDF2 Iterations Below 2024 Standards

**Chosen option**: A — Increase to 500k + re-hash on next unlock  
**File**: `src-tauri/src/crypto.rs:6`  
```rust
const ITERATIONS: u32 = 500_000; // was 64_000
```
On next successful unlock: re-derive key at 500k and re-encrypt database. Users see ~2s delay once.  
Add 16+ char password recommendation to UI.

---

### M2 — All Errors Are Strings

**Chosen option**: A — `CommandError` enum with serde tag  
**File**: `src-tauri/src/commands/mod.rs`  
```rust
#[derive(Debug, serde::Serialize)]
#[serde(tag = "code", content = "message")]
pub enum CommandError {
    DbNotOpen,
    NotFound(String),
    Constraint(String),
    Internal(String),
}
```
All command return types change from `Result<T, String>` to `Result<T, CommandError>`.  
*Coordinate with M5, M10 to avoid rebase conflicts.*

---

### M11 — Type-Unsafe IPC Invocations

**Chosen option**: B — `as const` command registry  
**Files**: `src/lib/ipc.ts` (create), all `*.tsx` files using `invoke()`  
```typescript
export const IPC = {
  documentsList: 'documents_list',
  statsSummary: 'stats_summary',
  authUnlock: 'auth_unlock',
  // ...all commands
} as const;
```

---

## LOW — Backlog (no sprint target)

| # | Action | File |
|---|--------|------|
| L1 | Add `react-window` FixedSizeList to DocumentList | `DocumentList.tsx` |
| L2 | Parallel extraction+scoring: `Promise.all([...])` | `documents/page.tsx` |
| L3 | Migration path integration tests | `db/migrations.rs` |
| L4 | Document: never use prod passwords in dev (plaintext IPC in dev mode) | `CLAUDE.md` |
| L5 | Extract dashboard helpers to `src/lib/formatting.ts` | `dashboard/page.tsx` |
| L6 | Replace `Mutex` with `tokio::sync::RwLock` for concurrent reads | `commands/mod.rs` |

---

## Execution Checklist

```
Sprint 0 — pre user-testing
[x] C1  PRAGMA hex validation (db/mod.rs + auth.rs)
[x] C2  DOMPurify on search snippets (SearchModal.tsx)

Sprint 1 — pre distribution
[x] H1  Idle lock timeout + UI setting
[x] H2  Dashboard limit:10 + stats_summary command
[x] H3  Migration v4 indexes
[x] H4  Password complexity min-12 + pattern reject
[x] H5  CommandContext helper (all commands)
[x] H6+M6  Extraction refactor + spawn_blocking (single PR)

Sprint 2 — v1.2 cycle (order by effort)
[x] M3  merge_contacts transaction (~30 min)
[x] M9  Remove CSP null (~5 min)
[x] M12 npm audit fix (~5 min)
[x] M4  Search index for appointments/categories
[x] M5  Zustand selectors
[x] M7  Zeroize key_hex
[x] M10 appointments_list_upcoming command
[x] M1  Auth rate limiting / exponential backoff
[x] M8  PBKDF2 500k + re-hash migration
[x] M2  CommandError enum (coordinate with M5, M10)
[x] M11 IPC command registry
```
