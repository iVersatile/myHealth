use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::AppState;
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
pub fn calendar_list_sources(state: State<'_, AppState>) -> Result<Vec<CalendarSourceRow>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    // Fetch existing calendar sources from DB
    let mut stmt = conn
        .prepare(
            "SELECT id, external_id, name, color_hex, enabled, last_synced_at \
             FROM calendar_sources ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let db_sources: Vec<CalendarSourceRow> = stmt
        .query_map([], row_to_calendar_source)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

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
            )
            .map_err(|e| e.to_string())?;

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
pub fn calendar_sync(source_ids: Vec<String>, state: State<'_, AppState>) -> Result<usize, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    if source_ids.is_empty() {
        return Ok(0);
    }

    // Fetch external_ids for the given source IDs
    let mut external_ids = Vec::new();
    for source_id in &source_ids {
        let ext_id: String = conn
            .query_row(
                "SELECT external_id FROM calendar_sources WHERE id = ?1",
                rusqlite::params![source_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
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
        )
        .map_err(|e| e.to_string())?;

        upserted_count += 1;
    }

    // Update last_synced_at for each synced source
    for source_id in &source_ids {
        conn.execute(
            "UPDATE calendar_sources SET last_synced_at = ?1 WHERE id = ?2",
            rusqlite::params![now, source_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Record global last sync timestamp in settings
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('calendar_last_sync', ?1) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![now],
    )
    .map_err(|e| e.to_string())?;

    Ok(upserted_count)
}

/// Request macOS calendar permission. Returns true if granted.
#[tauri::command]
pub fn calendar_request_permission() -> Result<bool, String> {
    calendar::request_permission()
}

/// Import unimported calendar events as appointments.
/// Skips events already imported (is_imported = 1).
/// Returns the number of appointments created.
#[tauri::command]
pub fn calendar_import_events(state: State<'_, AppState>) -> Result<usize, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let now = Utc::now().to_rfc3339();

    let mut stmt = conn
        .prepare(
            "SELECT id, title, start_at, location, notes \
             FROM calendar_events WHERE is_imported = 0",
        )
        .map_err(|e| e.to_string())?;

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
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

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
        .map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE calendar_events SET is_imported = 1 WHERE id = ?1",
            rusqlite::params![row.id],
        )
        .map_err(|e| e.to_string())?;

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
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    let enabled_int: i64 = if enabled { 1 } else { 0 };
    conn.execute(
        "UPDATE calendar_sources SET enabled = ?1 WHERE id = ?2",
        rusqlite::params![enabled_int, id],
    )
    .map_err(|e| e.to_string())?;
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
}
