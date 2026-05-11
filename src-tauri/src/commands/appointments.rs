use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::commands::search::{remove_from_search_index, upsert_search_index};
use crate::commands::{AppState, CommandContext};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Appointment {
    pub id: String,
    pub title: String,
    pub doctor_name: Option<String>,
    pub clinic_name: Option<String>,
    pub specialty: Option<String>,
    pub appt_date: String,
    pub duration_min: i64,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub status: String,
    pub reminder_min: i64,
    pub created_at: String,
    pub updated_at: String,
    pub document_ids: Vec<String>,
    pub contact_ids: Vec<String>,
    pub recurrence_series_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AppointmentInput {
    pub title: String,
    pub doctor_name: Option<String>,
    pub clinic_name: Option<String>,
    pub specialty: Option<String>,
    pub appt_date: String,
    pub duration_min: Option<i64>,
    pub location: Option<String>,
    pub notes: Option<String>,
    pub status: Option<String>,
    pub reminder_min: Option<i64>,
}

const VALID_STATUSES: &[&str] = &["scheduled", "completed", "cancelled", "missed"];

fn validate_status(status: &str) -> Result<(), CommandError> {
    if VALID_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(CommandError::Internal(format!(
            "invalid status '{status}'; expected one of: {VALID_STATUSES:?}"
        )))
    }
}

fn fetch_document_ids(conn: &rusqlite::Connection, appt_id: &str) -> Vec<String> {
    conn.prepare(
        "SELECT document_id FROM appointment_documents WHERE appointment_id = ? ORDER BY document_id",
    )
    .ok()
    .and_then(|mut stmt| {
        stmt.query_map([appt_id], |row| row.get::<_, String>(0))
            .ok()
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
    })
    .unwrap_or_default()
}

fn fetch_contact_ids(conn: &rusqlite::Connection, appt_id: &str) -> Vec<String> {
    conn.prepare(
        "SELECT contact_id FROM appointment_contacts WHERE appointment_id = ? ORDER BY contact_id",
    )
    .ok()
    .and_then(|mut stmt| {
        stmt.query_map([appt_id], |row| row.get::<_, String>(0))
            .ok()
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
    })
    .unwrap_or_default()
}

fn load_appointment(conn: &rusqlite::Connection, id: &str) -> Result<Appointment, CommandError> {
    conn.query_row(
        "SELECT id, title, doctor_name, clinic_name, specialty, appt_date,
                duration_min, location, notes, status, reminder_min, created_at, updated_at,
                recurrence_series_id
         FROM appointments WHERE id = ? AND is_deleted = 0",
        [id],
        |row| {
            Ok(Appointment {
                id: row.get(0)?,
                title: row.get(1)?,
                doctor_name: row.get(2)?,
                clinic_name: row.get(3)?,
                specialty: row.get(4)?,
                appt_date: row.get(5)?,
                duration_min: row.get(6)?,
                location: row.get(7)?,
                notes: row.get(8)?,
                status: row.get(9)?,
                reminder_min: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                document_ids: vec![],
                contact_ids: vec![],
                recurrence_series_id: row.get(13)?,
            })
        },
    )
    .map_err(|e| {
        if e == rusqlite::Error::QueryReturnedNoRows {
            CommandError::NotFound(format!("appointment '{id}'"))
        } else {
            CommandError::Internal(e.to_string())
        }
    })
    .map(|mut appt| {
        appt.document_ids = fetch_document_ids(conn, &appt.id);
        appt.contact_ids = fetch_contact_ids(conn, &appt.id);
        appt
    })
}

#[tauri::command]
pub fn appointments_list(
    month: Option<String>,
    status: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Appointment>, CommandError> {
    if let Some(ref s) = status {
        validate_status(s)?;
    }

    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut sql = String::from(
        "SELECT id, title, doctor_name, clinic_name, specialty, appt_date,
                duration_min, location, notes, status, reminder_min, created_at, updated_at,
                recurrence_series_id
         FROM appointments WHERE is_deleted = 0 AND is_draft = 0",
    );
    if month.is_some() {
        sql.push_str(" AND strftime('%Y-%m', appt_date) = ?1");
    }
    if status.is_some() {
        let param_n = if month.is_some() { "?2" } else { "?1" };
        sql.push_str(&format!(" AND status = {param_n}"));
    }
    sql.push_str(" ORDER BY appt_date ASC");

    let mut stmt = conn.prepare(&sql)?;

    let rows = match (&month, &status) {
        (Some(m), Some(s)) => stmt.query_map(rusqlite::params![m, s], load_row),
        (Some(m), None) => stmt.query_map(rusqlite::params![m], load_row),
        (None, Some(s)) => stmt.query_map(rusqlite::params![s], load_row),
        (None, None) => stmt.query_map([], load_row),
    }?;

    let mut appts: Vec<Appointment> = rows
        .filter_map(|r| r.ok())
        .map(|mut a| {
            a.document_ids = fetch_document_ids(conn, &a.id);
            a.contact_ids = fetch_contact_ids(conn, &a.id);
            a
        })
        .collect();

    appts.sort_by(|a, b| a.appt_date.cmp(&b.appt_date));
    Ok(appts)
}

/// Returns upcoming scheduled appointments within the next `days_ahead` days,
/// ordered by date ascending. Filtering happens in SQLite rather than client JS.
#[tauri::command]
pub fn appointments_list_upcoming(
    days_ahead: u32,
    state: State<'_, AppState>,
) -> Result<Vec<Appointment>, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    let today = Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    let cutoff = Utc::now()
        .checked_add_signed(chrono::Duration::days(days_ahead as i64))
        .ok_or(CommandError::Internal("date overflow".into()))?
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    let mut stmt = conn.prepare(
        "SELECT id, title, doctor_name, clinic_name, specialty, appt_date,
                    duration_min, location, notes, status, reminder_min, created_at, updated_at,
                    recurrence_series_id
             FROM appointments
             WHERE is_deleted = 0 AND is_draft = 0
               AND status = 'scheduled'
               AND appt_date >= ?1
               AND appt_date <= ?2
             ORDER BY appt_date ASC",
    )?;

    let rows = stmt.query_map(rusqlite::params![today, cutoff], load_row)?;

    let appts: Vec<Appointment> = rows
        .filter_map(|r| r.ok())
        .map(|mut a| {
            a.document_ids = fetch_document_ids(conn, &a.id);
            a.contact_ids = fetch_contact_ids(conn, &a.id);
            a
        })
        .collect();

    Ok(appts)
}

fn load_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Appointment> {
    Ok(Appointment {
        id: row.get(0)?,
        title: row.get(1)?,
        doctor_name: row.get(2)?,
        clinic_name: row.get(3)?,
        specialty: row.get(4)?,
        appt_date: row.get(5)?,
        duration_min: row.get(6)?,
        location: row.get(7)?,
        notes: row.get(8)?,
        status: row.get(9)?,
        reminder_min: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
        document_ids: vec![],
        contact_ids: vec![],
        recurrence_series_id: row.get(13)?,
    })
}

#[tauri::command]
pub fn appointments_get(
    id: String,
    state: State<'_, AppState>,
) -> Result<Appointment, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;
    load_appointment(conn, &id)
}

#[tauri::command]
pub fn appointments_create(
    input: AppointmentInput,
    state: State<'_, AppState>,
) -> Result<Appointment, CommandError> {
    let status = input.status.as_deref().unwrap_or("scheduled");
    validate_status(status)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let duration = input.duration_min.unwrap_or(30);
    let reminder = input.reminder_min.unwrap_or(60);

    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT INTO appointments
         (id, title, doctor_name, clinic_name, specialty, appt_date,
          duration_min, location, notes, status, reminder_min, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
        rusqlite::params![
            id,
            input.title,
            input.doctor_name,
            input.clinic_name,
            input.specialty,
            input.appt_date,
            duration,
            input.location,
            input.notes,
            status,
            reminder,
            now,
            now,
        ],
    )?;

    let appt = load_appointment(conn, &id)?;
    let body = [
        appt.doctor_name.as_deref().unwrap_or(""),
        appt.clinic_name.as_deref().unwrap_or(""),
        appt.specialty.as_deref().unwrap_or(""),
        appt.notes.as_deref().unwrap_or(""),
    ]
    .join(" ");
    upsert_search_index(
        conn,
        "appointment",
        &appt.id,
        &appt.title,
        &body,
        "",
        "",
        "",
        "",
        &appt.appt_date,
    );
    Ok(appt)
}

#[tauri::command]
pub fn appointments_update(
    id: String,
    input: AppointmentInput,
    state: State<'_, AppState>,
) -> Result<Appointment, CommandError> {
    let status = input.status.as_deref().unwrap_or("scheduled");
    validate_status(status)?;

    let now = Utc::now().to_rfc3339();

    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    let rows = conn.execute(
        "UPDATE appointments SET
             title        = ?2,
             doctor_name  = COALESCE(?3, doctor_name),
             clinic_name  = COALESCE(?4, clinic_name),
             specialty    = COALESCE(?5, specialty),
             appt_date    = ?6,
             duration_min = COALESCE(?7, duration_min),
             location     = COALESCE(?8, location),
             notes        = COALESCE(?9, notes),
             status       = ?10,
             reminder_min = COALESCE(?11, reminder_min),
             updated_at   = ?12
             WHERE id = ?1",
        rusqlite::params![
            id,
            input.title,
            input.doctor_name,
            input.clinic_name,
            input.specialty,
            input.appt_date,
            input.duration_min,
            input.location,
            input.notes,
            status,
            input.reminder_min,
            now,
        ],
    )?;

    if rows == 0 {
        return Err(CommandError::NotFound(format!("appointment '{id}'")));
    }

    let appt = load_appointment(conn, &id)?;
    let body = [
        appt.doctor_name.as_deref().unwrap_or(""),
        appt.clinic_name.as_deref().unwrap_or(""),
        appt.specialty.as_deref().unwrap_or(""),
        appt.notes.as_deref().unwrap_or(""),
    ]
    .join(" ");
    upsert_search_index(
        conn,
        "appointment",
        &appt.id,
        &appt.title,
        &body,
        "",
        "",
        "",
        "",
        &appt.appt_date,
    );
    Ok(appt)
}

#[tauri::command]
pub fn appointments_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;
    let now = Utc::now().to_rfc3339();
    let rows = conn.execute(
        "UPDATE appointments SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2 AND is_deleted = 0",
        rusqlite::params![now, id],
    )?;
    if rows == 0 {
        Err(CommandError::NotFound(format!("appointment '{id}'")))
    } else {
        remove_from_search_index(conn, &id);
        Ok(())
    }
}

#[tauri::command]
pub fn appointments_hard_delete(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.execute("DELETE FROM appointments WHERE id = ?", [&id])?;
    Ok(())
}

#[tauri::command]
pub fn appointments_clear_doctor(
    appointment_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    let rows = conn.execute(
        "UPDATE appointments SET doctor_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        rusqlite::params![appointment_id],
    )?;

    if rows == 0 {
        Err(CommandError::NotFound(format!(
            "appointment '{appointment_id}'"
        )))
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn appointment_link_contact(
    appointment_id: String,
    contact_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO appointment_contacts (appointment_id, contact_id) VALUES (?1, ?2)",
        rusqlite::params![appointment_id, contact_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn appointment_unlink_contact(
    appointment_id: String,
    contact_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "DELETE FROM appointment_contacts WHERE appointment_id = ?1 AND contact_id = ?2",
        rusqlite::params![appointment_id, contact_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn contacts_for_appointment(
    appointment_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT contact_id FROM appointment_contacts WHERE appointment_id = ? ORDER BY contact_id",
    )?;

    let ids = stmt
        .query_map([&appointment_id], |row| row.get::<_, String>(0))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ids)
}

#[tauri::command]
pub fn appointments_link_document(
    appointment_id: String,
    document_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO appointment_documents (appointment_id, document_id) VALUES (?1, ?2)",
        rusqlite::params![appointment_id, document_id],
    )?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE appointments (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                doctor_name TEXT,
                clinic_name TEXT,
                specialty TEXT,
                appt_date DATETIME NOT NULL,
                duration_min INTEGER NOT NULL DEFAULT 30,
                location TEXT,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK(status IN ('scheduled','completed','cancelled','missed')),
                reminder_min INTEGER NOT NULL DEFAULT 60,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                recurrence_series_id TEXT,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT
            );
            CREATE TABLE documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
                file_size_bytes INTEGER NOT NULL DEFAULT 0,
                category TEXT NOT NULL DEFAULT 'other',
                thumbnail_path TEXT,
                notes TEXT,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE appointment_documents (
                appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
                document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
                PRIMARY KEY (appointment_id, document_id)
            );
            CREATE TABLE contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'doctor',
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL
            );
            CREATE TABLE appointment_contacts (
                appointment_id TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
                contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
                PRIMARY KEY (appointment_id, contact_id)
            );",
        )
        .unwrap();
        conn
    }

    fn insert_contact(conn: &Connection, id: &str, name: &str) {
        conn.execute(
            "INSERT INTO contacts (id,name,created_at,updated_at)
             VALUES (?1,?2,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
            rusqlite::params![id, name],
        )
        .unwrap();
    }

    fn fetch_contact_ids(conn: &Connection, appt_id: &str) -> Vec<String> {
        conn.prepare(
            "SELECT contact_id FROM appointment_contacts WHERE appointment_id = ? ORDER BY contact_id",
        )
        .unwrap()
        .query_map([appt_id], |row| row.get::<_, String>(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect()
    }

    fn insert_appt(conn: &Connection, id: &str, title: &str, date: &str, status: &str) {
        conn.execute(
            "INSERT INTO appointments
             (id,title,appt_date,status,duration_min,reminder_min,created_at,updated_at)
             VALUES (?1,?2,?3,?4,30,60,'2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
            rusqlite::params![id, title, date, status],
        )
        .unwrap();
    }

    fn insert_doc(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO documents
             (id,filename,file_path,created_at,updated_at)
             VALUES (?1,'f.pdf','/f.pdf','2026-01-01T00:00:00Z','2026-01-01T00:00:00Z')",
            [id],
        )
        .unwrap();
    }

    #[test]
    fn load_appt_returns_appointment() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "Checkup", "2026-05-01T10:00:00Z", "scheduled");
        let appt = load_appointment(&conn, "a1").unwrap();
        assert_eq!(appt.id, "a1");
        assert_eq!(appt.title, "Checkup");
        assert_eq!(appt.status, "scheduled");
    }

    #[test]
    fn load_appt_includes_document_ids() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "MRI", "2026-05-01T10:00:00Z", "scheduled");
        insert_doc(&conn, "d1");
        conn.execute("INSERT INTO appointment_documents VALUES ('a1','d1')", [])
            .unwrap();
        let appt = load_appointment(&conn, "a1").unwrap();
        assert_eq!(appt.document_ids, vec!["d1"]);
    }

    #[test]
    fn load_appt_returns_err_for_missing() {
        let conn = test_conn();
        let result = load_appointment(&conn, "nonexistent");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn fetch_document_ids_returns_empty_when_none() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-01-01T00:00:00Z", "scheduled");
        let ids = fetch_document_ids(&conn, "a1");
        assert!(ids.is_empty());
    }

    #[test]
    fn validate_status_accepts_all_valid() {
        for s in &["scheduled", "completed", "cancelled", "missed"] {
            assert!(validate_status(s).is_ok());
        }
    }

    #[test]
    fn validate_status_rejects_unknown() {
        let result = validate_status("pending");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("invalid status"));
    }

    #[test]
    fn create_inserts_appointment() {
        let conn = test_conn();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO appointments
             (id,title,appt_date,status,duration_min,reminder_min,created_at,updated_at)
             VALUES (?1,'Blood Test','2026-06-01T08:00:00Z','scheduled',30,60,?2,?2)",
            rusqlite::params![id, now],
        )
        .unwrap();
        let appt = load_appointment(&conn, &id).unwrap();
        assert_eq!(appt.title, "Blood Test");
        assert_eq!(appt.duration_min, 30);
    }

    #[test]
    fn update_changes_title_and_status() {
        let conn = test_conn();
        insert_appt(
            &conn,
            "a1",
            "Old Title",
            "2026-05-01T10:00:00Z",
            "scheduled",
        );
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE appointments SET title=?2, status=?3, updated_at=?4 WHERE id=?1",
            rusqlite::params!["a1", "New Title", "completed", now],
        )
        .unwrap();
        let appt = load_appointment(&conn, "a1").unwrap();
        assert_eq!(appt.title, "New Title");
        assert_eq!(appt.status, "completed");
    }

    #[test]
    fn delete_removes_appointment() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-05-01T10:00:00Z", "scheduled");
        conn.execute("DELETE FROM appointments WHERE id='a1'", [])
            .unwrap();
        assert!(load_appointment(&conn, "a1").is_err());
    }

    #[test]
    fn soft_delete_sets_is_deleted_flag() {
        let conn = test_conn();
        insert_appt(
            &conn,
            "sd1",
            "Soft Del",
            "2026-06-01T10:00:00Z",
            "scheduled",
        );
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE appointments SET is_deleted = 1, deleted_at = ?1 WHERE id = 'sd1' AND is_deleted = 0",
            rusqlite::params![now],
        )
        .unwrap();
        let (is_deleted, dt): (i64, Option<String>) = conn
            .query_row(
                "SELECT is_deleted, deleted_at FROM appointments WHERE id = 'sd1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(is_deleted, 1);
        assert!(dt.is_some());
    }

    #[test]
    fn link_document_inserts_row() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-05-01T10:00:00Z", "scheduled");
        insert_doc(&conn, "d1");
        conn.execute(
            "INSERT OR IGNORE INTO appointment_documents VALUES ('a1','d1')",
            [],
        )
        .unwrap();
        let ids = fetch_document_ids(&conn, "a1");
        assert_eq!(ids, vec!["d1"]);
    }

    #[test]
    fn link_document_is_idempotent() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-05-01T10:00:00Z", "scheduled");
        insert_doc(&conn, "d1");
        conn.execute(
            "INSERT OR IGNORE INTO appointment_documents VALUES ('a1','d1')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO appointment_documents VALUES ('a1','d1')",
            [],
        )
        .unwrap();
        let ids = fetch_document_ids(&conn, "a1");
        assert_eq!(ids.len(), 1);
    }

    #[test]
    fn link_contact_inserts_row() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-05-01T10:00:00Z", "scheduled");
        insert_contact(&conn, "c1", "Dr. Smith");
        conn.execute(
            "INSERT OR IGNORE INTO appointment_contacts VALUES ('a1','c1')",
            [],
        )
        .unwrap();
        let ids = fetch_contact_ids(&conn, "a1");
        assert_eq!(ids, vec!["c1"]);
    }

    #[test]
    fn link_contact_is_idempotent() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-05-01T10:00:00Z", "scheduled");
        insert_contact(&conn, "c1", "Dr. Smith");
        conn.execute(
            "INSERT OR IGNORE INTO appointment_contacts VALUES ('a1','c1')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO appointment_contacts VALUES ('a1','c1')",
            [],
        )
        .unwrap();
        let ids = fetch_contact_ids(&conn, "a1");
        assert_eq!(ids.len(), 1);
    }

    #[test]
    fn unlink_contact_removes_row() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-05-01T10:00:00Z", "scheduled");
        insert_contact(&conn, "c1", "Dr. Smith");
        conn.execute(
            "INSERT OR IGNORE INTO appointment_contacts VALUES ('a1','c1')",
            [],
        )
        .unwrap();
        conn.execute(
            "DELETE FROM appointment_contacts WHERE appointment_id='a1' AND contact_id='c1'",
            [],
        )
        .unwrap();
        let ids = fetch_contact_ids(&conn, "a1");
        assert!(ids.is_empty());
    }

    #[test]
    fn contacts_for_appointment_returns_empty_when_none() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "X", "2026-05-01T10:00:00Z", "scheduled");
        let ids = fetch_contact_ids(&conn, "a1");
        assert!(ids.is_empty());
    }

    #[test]
    fn clear_doctor_sets_doctor_name_to_null() {
        let conn = test_conn();
        insert_appt(&conn, "a1", "ECG", "2026-05-01T10:00:00Z", "scheduled");
        conn.execute(
            "UPDATE appointments SET doctor_name = 'MS YING WANG' WHERE id = 'a1'",
            [],
        )
        .unwrap();

        let rows = conn
            .execute(
                "UPDATE appointments SET doctor_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                rusqlite::params!["a1"],
            )
            .unwrap();
        assert_eq!(rows, 1);

        let doctor_name: Option<String> = conn
            .query_row(
                "SELECT doctor_name FROM appointments WHERE id = 'a1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(doctor_name.is_none());
    }

    #[test]
    fn clear_doctor_returns_not_found_for_missing_id() {
        let conn = test_conn();
        let rows = conn
            .execute(
                "UPDATE appointments SET doctor_name = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                rusqlite::params!["nonexistent"],
            )
            .unwrap();
        assert_eq!(rows, 0);
    }

    fn open_migrations_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn draft_appointment_excluded_from_list() {
        let conn = open_migrations_db();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, duration_min, reminder_min, is_draft, created_at, updated_at) \
             VALUES (?1, 'Draft Appt', ?2, 30, 60, 1, ?3, ?4)",
            rusqlite::params![id, now, now, now],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointments WHERE is_deleted = 0 AND is_draft = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn confirmed_appointment_included_in_list() {
        let conn = open_migrations_db();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, duration_min, reminder_min, is_draft, created_at, updated_at) \
             VALUES (?1, 'Real Appt', ?2, 30, 60, 0, ?3, ?4)",
            rusqlite::params![id, now, now, now],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointments WHERE is_deleted = 0 AND is_draft = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }
}
