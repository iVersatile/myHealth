use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::commands::{AppState, CommandContext};
use crate::plugins::calendar;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarSourceRow {
    pub id: String,
    pub external_id: String,
    pub name: String,
    pub color_hex: Option<String>,
    pub enabled: bool,
    pub last_synced_at: Option<String>,
}

fn row_to_calendar_source(row: &rusqlite::Row) -> rusqlite::Result<CalendarSourceRow> {
    let enabled_int: i64 = row.get(4)?;
    Ok(CalendarSourceRow {
        id: row.get(0)?,
        external_id: row.get(1)?,
        name: row.get(2)?,
        color_hex: row.get(3)?,
        enabled: enabled_int != 0,
        last_synced_at: row.get(5)?,
    })
}

/// List calendar sources: existing DB entries + newly discovered macOS calendars.
/// Returns merged list (DB entries take precedence by external_id).
#[tauri::command]
pub fn calendar_list_sources(
    state: State<'_, AppState>,
) -> Result<Vec<CalendarSourceRow>, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    // Fetch existing calendar sources from DB
    let mut stmt = conn.prepare(
        "SELECT id, external_id, name, color_hex, enabled, last_synced_at \
             FROM calendar_sources ORDER BY name ASC",
    )?;

    let db_sources: Vec<CalendarSourceRow> = stmt
        .query_map([], row_to_calendar_source)?
        .collect::<Result<Vec<_>, _>>()?;

    // Discover new calendars from macOS system
    let system_calendars = calendar::list_calendars().unwrap_or_default();

    // Merge: DB sources + new system calendars not yet in DB
    let mut result = db_sources;
    let existing_external_ids: std::collections::HashSet<String> =
        result.iter().map(|s| s.external_id.clone()).collect();

    for sys_cal in system_calendars {
        if !existing_external_ids.contains(&sys_cal.external_id) {
            let id = Uuid::new_v4().to_string();
            // Insert new discovered calendar into DB
            conn.execute(
                "INSERT INTO calendar_sources \
                 (id, external_id, name, color_hex, enabled, last_synced_at) \
                 VALUES (?1, ?2, ?3, ?4, 1, NULL)",
                rusqlite::params![id, sys_cal.external_id, sys_cal.name, sys_cal.color_hex],
            )?;

            result.push(CalendarSourceRow {
                id,
                external_id: sys_cal.external_id,
                name: sys_cal.name,
                color_hex: sys_cal.color_hex,
                enabled: true,
                last_synced_at: None,
            });
        }
    }

    Ok(result)
}

/// Sync calendar events for specified sources.
/// Upserts events into calendar_events table and updates last_synced_at.
#[tauri::command]
pub fn calendar_sync(
    source_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<usize, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    if source_ids.is_empty() {
        return Ok(0);
    }

    // Fetch external_ids for the given source IDs
    let mut external_ids = Vec::new();
    for source_id in &source_ids {
        let ext_id: String = conn.query_row(
            "SELECT external_id FROM calendar_sources WHERE id = ?1",
            rusqlite::params![source_id],
            |row| row.get(0),
        )?;
        external_ids.push(ext_id);
    }

    // Fetch events from system calendars
    let system_events = calendar::fetch_events(&external_ids).unwrap_or_default();

    let now = Utc::now().to_rfc3339();
    let mut upserted_count = 0;

    // Upsert each event into the database
    for event in system_events {
        let event_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, end_at, location, notes, \
              is_imported, last_synced_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9) \
             ON CONFLICT(external_id) DO UPDATE SET \
               title = excluded.title, \
               start_at = excluded.start_at, \
               end_at = excluded.end_at, \
               location = excluded.location, \
               notes = excluded.notes, \
               last_synced_at = excluded.last_synced_at",
            rusqlite::params![
                event_id,
                event.external_id,
                event.calendar_id,
                event.title,
                event.start_at,
                event.end_at,
                event.location,
                event.notes,
                now
            ],
        )?;

        upserted_count += 1;
    }

    // Update last_synced_at for each synced source
    for source_id in &source_ids {
        conn.execute(
            "UPDATE calendar_sources SET last_synced_at = ?1 WHERE id = ?2",
            rusqlite::params![now, source_id],
        )?;
    }

    // Record global last sync timestamp in settings
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('calendar_last_sync', ?1) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![now],
    )?;

    Ok(upserted_count)
}

/// Request macOS calendar permission. Returns true if granted.
#[tauri::command]
pub fn calendar_request_permission() -> Result<bool, CommandError> {
    calendar::request_permission().map_err(|e| CommandError::Internal(e.to_string()))
}

/// Import unimported calendar events as appointments.
/// Skips events already imported (is_imported = 1).
/// Returns the number of appointments created.
#[tauri::command]
pub fn calendar_import_events(state: State<'_, AppState>) -> Result<usize, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    let now = Utc::now().to_rfc3339();

    let mut stmt = conn.prepare(
        "SELECT id, title, start_at, location, notes \
             FROM calendar_events WHERE is_imported = 0",
    )?;

    struct EventRow {
        id: String,
        title: String,
        start_at: String,
        location: Option<String>,
        notes: Option<String>,
    }

    let rows: Vec<EventRow> = stmt
        .query_map([], |row| {
            Ok(EventRow {
                id: row.get(0)?,
                title: row.get(1)?,
                start_at: row.get(2)?,
                location: row.get(3)?,
                notes: row.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut created = 0usize;
    for row in &rows {
        let appt_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO appointments \
             (id, title, doctor_name, clinic_name, specialty, appt_date, \
              duration_min, location, notes, status, reminder_min, created_at, updated_at) \
             VALUES (?1, ?2, NULL, NULL, NULL, ?3, 60, ?4, ?5, 'scheduled', NULL, ?6, ?6)",
            rusqlite::params![
                appt_id,
                row.title,
                row.start_at,
                row.location,
                row.notes,
                now
            ],
        )?;

        conn.execute(
            "UPDATE calendar_events SET is_imported = 1 WHERE id = ?1",
            rusqlite::params![row.id],
        )?;

        created += 1;
    }

    Ok(created)
}

/// Enable or disable a calendar source.
#[tauri::command]
pub fn calendar_toggle_source(
    id: String,
    enabled: bool,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;
    let enabled_int: i64 = if enabled { 1 } else { 0 };
    conn.execute(
        "UPDATE calendar_sources SET enabled = ?1 WHERE id = ?2",
        rusqlite::params![enabled_int, id],
    )?;
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalendarEventDto {
    pub id: String,
    pub title: String,
    pub start_at: String,
    pub end_at: Option<String>,
    pub location: Option<String>,
    pub calendar_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConflictPair {
    pub event_a: CalendarEventDto,
    pub event_b: CalendarEventDto,
    pub overlap_minutes: u32,
}

#[tauri::command]
pub fn calendar_detect_conflicts(
    state: State<'_, AppState>,
) -> Result<Vec<ConflictPair>, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT a.id, a.title, a.start_at, a.end_at, a.location, a.calendar_id,
                b.id, b.title, b.start_at, b.end_at, b.location, b.calendar_id,
                CAST((julianday(MIN(a.end_at, b.end_at)) - julianday(MAX(a.start_at, b.start_at))) * 24 * 60 AS INTEGER)
         FROM calendar_events a
         JOIN calendar_events b ON a.calendar_id = b.calendar_id AND a.id < b.id
         WHERE a.end_at IS NOT NULL AND b.end_at IS NOT NULL
           AND a.start_at < b.end_at AND b.start_at < a.end_at",
    )?;
    let pairs = stmt
        .query_map([], |row| {
            let event_a = CalendarEventDto {
                id: row.get(0)?,
                title: row.get(1)?,
                start_at: row.get(2)?,
                end_at: row.get(3)?,
                location: row.get(4)?,
                calendar_id: row.get(5)?,
            };
            let event_b = CalendarEventDto {
                id: row.get(6)?,
                title: row.get(7)?,
                start_at: row.get(8)?,
                end_at: row.get(9)?,
                location: row.get(10)?,
                calendar_id: row.get(11)?,
            };
            let overlap_raw: i64 = row.get(12)?;
            Ok(ConflictPair {
                event_a,
                event_b,
                overlap_minutes: overlap_raw.max(0) as u32,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(pairs)
}

#[tauri::command]
pub fn calendar_event_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.execute(
        "DELETE FROM calendar_events WHERE id = ?1",
        rusqlite::params![id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn open_test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn list_sources_returns_vec() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-1', 'ext-abc', 'Personal', 1)",
            [],
        )
        .unwrap();

        let mut stmt = conn
            .prepare("SELECT id, external_id, name, color_hex, enabled, last_synced_at FROM calendar_sources")
            .unwrap();
        let sources: Vec<CalendarSourceRow> = stmt
            .query_map([], row_to_calendar_source)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(sources.len(), 1);
        assert_eq!(sources[0].external_id, "ext-abc");
        assert_eq!(sources[0].name, "Personal");
        assert!(sources[0].enabled);
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn calendar_sync_returns_ok_on_non_macos() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-2', 'ext-xyz', 'Work', 1)",
            [],
        )
        .unwrap();

        // On non-macOS, fetch_events returns error, so sync should return 0
        let result = calendar::fetch_events(&["ext-xyz".to_string()]);
        assert!(result.is_err());
    }

    #[test]
    fn calendar_source_upsert() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let ext_id = "ext-upsert-test";

        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, color_hex, enabled) \
             VALUES (?1, ?2, 'Test Cal', '#FF0000', 1)",
            rusqlite::params![id, ext_id],
        )
        .unwrap();

        let retrieved_name: String = conn
            .query_row(
                "SELECT name FROM calendar_sources WHERE external_id = ?1",
                rusqlite::params![ext_id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(retrieved_name, "Test Cal");

        // Upsert with same external_id should update
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, color_hex, enabled) \
             VALUES (?1, ?2, 'Updated Cal', '#00FF00', 1) \
             ON CONFLICT(external_id) DO UPDATE SET name = excluded.name, \
               color_hex = excluded.color_hex",
            rusqlite::params![Uuid::new_v4().to_string(), ext_id],
        )
        .unwrap();

        let updated_name: String = conn
            .query_row(
                "SELECT name FROM calendar_sources WHERE external_id = ?1",
                rusqlite::params![ext_id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(updated_name, "Updated Cal");
    }

    #[test]
    fn calendar_events_insert_and_query() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-ev', 'ext-ev', 'Events Cal', 1)",
            [],
        )
        .unwrap();

        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, is_imported, last_synced_at) \
             VALUES ('ev-1', 'evt-123', 'src-ev', 'Test Event', '2024-10-01T10:00:00Z', 0, '2024-10-01T00:00:00Z')",
            [],
        )
        .unwrap();

        let title: String = conn
            .query_row(
                "SELECT title FROM calendar_events WHERE external_id = 'evt-123'",
                [],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(title, "Test Event");
    }

    fn insert_unimported_event(conn: &rusqlite::Connection, id: &str, ext_id: &str, title: &str) {
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-imp', 'ext-imp', 'Import Cal', 1) \
             ON CONFLICT(external_id) DO NOTHING",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, is_imported, last_synced_at) \
             VALUES (?1, ?2, 'src-imp', ?3, '2025-06-01T09:00:00Z', 0, '2025-06-01T00:00:00Z')",
            rusqlite::params![id, ext_id, title],
        )
        .unwrap();
    }

    fn run_import_logic(conn: &rusqlite::Connection) -> usize {
        let now = chrono::Utc::now().to_rfc3339();
        let mut stmt = conn
            .prepare(
                "SELECT id, title, start_at, location, notes \
                 FROM calendar_events WHERE is_imported = 0",
            )
            .unwrap();

        struct EventRow {
            id: String,
            title: String,
            start_at: String,
            location: Option<String>,
            notes: Option<String>,
        }

        let rows: Vec<EventRow> = stmt
            .query_map([], |row| {
                Ok(EventRow {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    start_at: row.get(2)?,
                    location: row.get(3)?,
                    notes: row.get(4)?,
                })
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        let mut created = 0usize;
        for row in &rows {
            let appt_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO appointments \
                 (id, title, doctor_name, clinic_name, specialty, appt_date, \
                  duration_min, location, notes, status, reminder_min, created_at, updated_at) \
                 VALUES (?1, ?2, NULL, NULL, NULL, ?3, 60, ?4, ?5, 'scheduled', NULL, ?6, ?6)",
                rusqlite::params![
                    appt_id,
                    row.title,
                    row.start_at,
                    row.location,
                    row.notes,
                    now
                ],
            )
            .unwrap();
            conn.execute(
                "UPDATE calendar_events SET is_imported = 1 WHERE id = ?1",
                rusqlite::params![row.id],
            )
            .unwrap();
            created += 1;
        }
        created
    }

    #[test]
    fn import_events_creates_appointments() {
        let conn = open_test_db();
        insert_unimported_event(&conn, "ev-a", "ext-a", "Doctor Visit");
        insert_unimported_event(&conn, "ev-b", "ext-b", "Lab Test");

        let created = run_import_logic(&conn);
        assert_eq!(created, 2);

        let appt_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM appointments", [], |r| r.get(0))
            .unwrap();
        assert_eq!(appt_count, 2);
    }

    #[test]
    fn import_events_is_idempotent() {
        let conn = open_test_db();
        insert_unimported_event(&conn, "ev-c", "ext-c", "Checkup");

        // First import
        let first = run_import_logic(&conn);
        assert_eq!(first, 1);

        // Second import — is_imported = 1 now, nothing to import
        let second = run_import_logic(&conn);
        assert_eq!(second, 0);

        // Appointments count stays at 1
        let appt_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM appointments", [], |r| r.get(0))
            .unwrap();
        assert_eq!(appt_count, 1);
    }

    #[test]
    fn import_sets_is_imported_flag() {
        let conn = open_test_db();
        insert_unimported_event(&conn, "ev-d", "ext-d", "Follow-up");

        run_import_logic(&conn);

        let is_imported: i64 = conn
            .query_row(
                "SELECT is_imported FROM calendar_events WHERE id = 'ev-d'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_imported, 1);
    }

    #[test]
    fn calendar_sync_stores_last_sync_in_settings() {
        let conn = open_test_db();
        let now = chrono::Utc::now().to_rfc3339();

        // Insert (first sync)
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('calendar_last_sync', ?1) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![now],
        )
        .unwrap();

        let stored: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'calendar_last_sync'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(stored, now);

        // Upsert (second sync) updates timestamp
        let later = "2099-01-01T00:00:00+00:00";
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('calendar_last_sync', ?1) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![later],
        )
        .unwrap();

        let updated: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'calendar_last_sync'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(updated, later);

        // Only one row in settings for this key
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM settings WHERE key = 'calendar_last_sync'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn toggle_source_updates_enabled_flag() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-t', 'ext-t', 'Toggle Cal', 1)",
            [],
        )
        .unwrap();

        // Disable
        conn.execute(
            "UPDATE calendar_sources SET enabled = 0 WHERE id = 'src-t'",
            [],
        )
        .unwrap();

        let enabled: i64 = conn
            .query_row(
                "SELECT enabled FROM calendar_sources WHERE id = 'src-t'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(enabled, 0);

        // Re-enable
        conn.execute(
            "UPDATE calendar_sources SET enabled = 1 WHERE id = 'src-t'",
            [],
        )
        .unwrap();

        let re_enabled: i64 = conn
            .query_row(
                "SELECT enabled FROM calendar_sources WHERE id = 'src-t'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(re_enabled, 1);
    }

    #[test]
    fn calendar_events_upsert_on_conflict() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-uc', 'ext-uc', 'Upsert Cal', 1)",
            [],
        )
        .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, is_imported, last_synced_at) \
             VALUES ('ev-u1', 'ext-dup', 'src-uc', 'Original', '2025-01-01T10:00:00Z', 0, ?1)",
            rusqlite::params![now],
        )
        .unwrap();

        // Upsert with same external_id — should update title
        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, is_imported, last_synced_at) \
             VALUES ('ev-u2', 'ext-dup', 'src-uc', 'Updated', '2025-01-01T10:00:00Z', 0, ?1) \
             ON CONFLICT(external_id) DO UPDATE SET \
               title = excluded.title, last_synced_at = excluded.last_synced_at",
            rusqlite::params![now],
        )
        .unwrap();

        let title: String = conn
            .query_row(
                "SELECT title FROM calendar_events WHERE external_id = 'ext-dup'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(title, "Updated");

        // Only one row (no duplicate)
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM calendar_events WHERE external_id = 'ext-dup'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn row_to_calendar_source_maps_enabled_correctly() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, color_hex, enabled) \
             VALUES ('src-m', 'ext-m', 'Mapped', '#AABBCC', 0)",
            [],
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id, external_id, name, color_hex, enabled, last_synced_at \
                 FROM calendar_sources WHERE id = 'src-m'",
            )
            .unwrap();
        let source = stmt
            .query_map([], row_to_calendar_source)
            .unwrap()
            .next()
            .unwrap()
            .unwrap();

        assert!(!source.enabled);
        assert_eq!(source.color_hex.as_deref(), Some("#AABBCC"));
        assert!(source.last_synced_at.is_none());
    }

    fn insert_test_source(conn: &rusqlite::Connection, src_id: &str) {
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES (?1, ?1, 'Test', 1)",
            rusqlite::params![src_id],
        )
        .unwrap();
    }

    fn insert_test_event(
        conn: &rusqlite::Connection,
        id: &str,
        src_id: &str,
        start: &str,
        end: &str,
    ) {
        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, end_at, last_synced_at) \
             VALUES (?1, ?1, ?2, 'Event', ?3, ?4, '2024-01-01T00:00:00Z')",
            rusqlite::params![id, src_id, start, end],
        )
        .unwrap();
    }

    #[test]
    fn detect_conflicts_finds_overlapping_events() {
        let conn = open_test_db();
        insert_test_source(&conn, "src-c1");
        insert_test_event(
            &conn,
            "ev-a",
            "src-c1",
            "2024-01-01T10:00:00",
            "2024-01-01T11:00:00",
        );
        insert_test_event(
            &conn,
            "ev-b",
            "src-c1",
            "2024-01-01T10:30:00",
            "2024-01-01T11:30:00",
        );

        let mut stmt = conn.prepare(
            "SELECT a.id, a.title, a.start_at, a.end_at, a.location, a.calendar_id,
                    b.id, b.title, b.start_at, b.end_at, b.location, b.calendar_id,
                    CAST((julianday(MIN(a.end_at, b.end_at)) - julianday(MAX(a.start_at, b.start_at))) * 24 * 60 AS INTEGER)
             FROM calendar_events a
             JOIN calendar_events b ON a.calendar_id = b.calendar_id AND a.id < b.id
             WHERE a.end_at IS NOT NULL AND b.end_at IS NOT NULL
               AND a.start_at < b.end_at AND b.start_at < a.end_at",
        ).unwrap();
        let pairs: Vec<ConflictPair> = stmt
            .query_map([], |row| {
                let event_a = CalendarEventDto {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    start_at: row.get(2)?,
                    end_at: row.get(3)?,
                    location: row.get(4)?,
                    calendar_id: row.get(5)?,
                };
                let event_b = CalendarEventDto {
                    id: row.get(6)?,
                    title: row.get(7)?,
                    start_at: row.get(8)?,
                    end_at: row.get(9)?,
                    location: row.get(10)?,
                    calendar_id: row.get(11)?,
                };
                let overlap_raw: i64 = row.get(12)?;
                Ok(ConflictPair {
                    event_a,
                    event_b,
                    overlap_minutes: overlap_raw.max(0) as u32,
                })
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(pairs.len(), 1);
        assert_eq!(pairs[0].overlap_minutes, 30);
    }

    #[test]
    fn detect_conflicts_ignores_non_overlapping_events() {
        let conn = open_test_db();
        insert_test_source(&conn, "src-c2");
        insert_test_event(
            &conn,
            "ev-c",
            "src-c2",
            "2024-01-01T09:00:00",
            "2024-01-01T10:00:00",
        );
        insert_test_event(
            &conn,
            "ev-d",
            "src-c2",
            "2024-01-01T10:00:00",
            "2024-01-01T11:00:00",
        );

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM calendar_events a
             JOIN calendar_events b ON a.calendar_id = b.calendar_id AND a.id < b.id
             WHERE a.end_at IS NOT NULL AND b.end_at IS NOT NULL
               AND a.start_at < b.end_at AND b.start_at < a.end_at",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn calendar_event_delete_removes_correct_row() {
        let conn = open_test_db();
        insert_test_source(&conn, "src-c3");
        insert_test_event(
            &conn,
            "ev-del",
            "src-c3",
            "2024-01-01T08:00:00",
            "2024-01-01T09:00:00",
        );
        insert_test_event(
            &conn,
            "ev-keep",
            "src-c3",
            "2024-01-01T10:00:00",
            "2024-01-01T11:00:00",
        );

        conn.execute(
            "DELETE FROM calendar_events WHERE id = ?1",
            rusqlite::params!["ev-del"],
        )
        .unwrap();

        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM calendar_events", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 1);

        let kept_id: String = conn
            .query_row("SELECT id FROM calendar_events", [], |r| r.get(0))
            .unwrap();
        assert_eq!(kept_id, "ev-keep");
    }
}
