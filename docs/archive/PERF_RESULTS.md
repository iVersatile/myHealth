# myHealth — Performance Results

Results recorded against the `develop` branch. Tests run on a local macOS developer machine (Apple Silicon) unless noted.

---

## G-09 — Document List Query (1 000 rows)

| Date | Result | Limit | Status |
|------|--------|-------|--------|
| 2026-05-02 | **0 ms** | < 500 ms | ✅ PASS |

**Method:** Rust unit test `perf_document_list_1000` in `src-tauri/src/commands/documents.rs`.
Inserts 1 000 rows into an in-memory SQLite DB, then times a `SELECT … WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 1000 OFFSET 0` query.
Run with:
```
cargo test perf_document_list_1000 -- --nocapture
```

---

## G-08 — Cold Start (app launch → unlock screen visible)

| Date | Result | Limit | Status |
|------|--------|-------|--------|
| 2026-05-02 | **~0.8 s** (manual measurement) | < 2 s | ✅ PASS |

**Method:** Manual stop-watch measurement on a MacBook Pro M2 with an empty vault.
Steps: double-click the `.app` bundle → watch for the unlock/password screen to appear.
Observed time: ~0.8 s from click to unlock screen rendered.

> Note: Cold start includes Tauri shell init, Next.js static hydration, and SQLCipher DB open.
> Results will vary by machine. Retest after any changes to the startup path.

---

## G-10 — Apple Calendar Sync (100 events)

| Date | Result | Limit | Status |
|------|--------|-------|--------|
| 2026-05-02 | **~0.3 s** (manual device measurement) | < 5 s | ✅ PASS |

**Method:** Manual test on a developer machine with ~100 events in Apple Calendar.
Launch app → grant calendar permission → open Calendar tab → observe sync completion.
Observed time: ~0.3 s end-to-end (IPC round trip included).

The Rust unit test `fetch_events_returns_empty_for_no_calendar_ids` (empty-list fast path, no
EventKit call) completes in < 1 ms and runs in CI without calendar permission.

> Full-device re-measurement required after any changes to the EventKit fetch path
> (`src-tauri/src/plugins/calendar/macos.rs`).
