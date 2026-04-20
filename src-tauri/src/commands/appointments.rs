use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::search::{remove_from_search_index, upsert_search_index};
use crate::commands::AppState;

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

fn validate_status(status: &str) -> Result<(), String> {
    if VALID_STATUSES.contains(&status) {
        Ok(())
    } else {
        Err(format!(
            "invalid status '{status}'; expected one of: {VALID_STATUSES:?}"
        ))
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

fn load_appointment(
    conn: &rusqlite::Connection,
    id: &str,
) -> Result<Appointment, String> {
    conn.query_row(
        "SELECT id, title, doctor_name, clinic_name, specialty, appt_date,
                duration_min, location, notes, status, reminder_min, created_at, updated_at
         FROM appointments WHERE id = ?",
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
            })
        },
    )
    .map_err(|e| {
        if e == rusqlite::Error::QueryReturnedNoRows {
            format!("appointment '{id}' not found")
        } else {
            e.to_string()
        }
    })
    .map(|mut appt| {
        appt.document_ids = fetch_document_ids(conn, &appt.id);
        appt
    })
}

#[tauri::command]
pub fn appointments_list(
    month: Option<String>,
    status: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Appointment>, String> {
    if let Some(ref s) = status {
        validate_status(s)?;
    }

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let mut sql = String::from(
        "SELECT id, title, doctor_name, clinic_name, specialty, appt_date,
                duration_min, location, notes, status, reminder_min, created_at, updated_at
         FROM appointments WHERE 1=1",
    );
    if month.is_some() {
        sql.push_str(" AND strftime('%Y-%m', appt_date) = ?1");
    }
    if status.is_some() {
        let param_n = if month.is_some() { "?2" } else { "?1" };
        sql.push_str(&format!(" AND status = {param_n}"));
    }
    sql.push_str(" ORDER BY appt_date ASC");

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = match (&month, &status) {
        (Some(m), Some(s)) => stmt.query_map(rusqlite::params![m, s], load_row),
        (Some(m), None) => stmt.query_map(rusqlite::params![m], load_row),
        (None, Some(s)) => stmt.query_map(rusqlite::params![s], load_row),
        (None, None) => stmt.query_map([], load_row),
    }
    .map_err(|e| e.to_string())?;

    let mut appts: Vec<Appointment> = rows
        .filter_map(|r| r.ok())
        .map(|mut a| {
            a.document_ids = fetch_document_ids(conn, &a.id);
            a
        })
        .collect();

    appts.sort_by(|a, b| a.appt_date.cmp(&b.appt_date));
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
    })
}

#[tauri::command]
pub fn appointments_get(id: String, state: State<'_, AppState>) -> Result<Appointment, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    load_appointment(conn, &id)
}

#[tauri::command]
pub fn appointments_create(
    input: AppointmentInput,
    state: State<'_, AppState>,
) -> Result<Appointment, String> {
    let status = input.status.as_deref().unwrap_or("scheduled");
    validate_status(status)?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let duration = input.duration_min.unwrap_or(30);
    let reminder = input.reminder_min.unwrap_or(60);

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

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
    )
    .map_err(|e| e.to_string())?;

    let appt = load_appointment(conn, &id)?;
    let body = [
        appt.doctor_name.as_deref().unwrap_or(""),
        appt.clinic_name.as_deref().unwrap_or(""),
        appt.specialty.as_deref().unwrap_or(""),
        appt.notes.as_deref().unwrap_or(""),
    ]
    .join(" ");
    upsert_search_index(conn, "appointment", &appt.id, &appt.title, &body, "");
    Ok(appt)
}

#[tauri::command]
pub fn appointments_update(
    id: String,
    input: AppointmentInput,
    state: State<'_, AppState>,
) -> Result<Appointment, String> {
    let status = input.status.as_deref().unwrap_or("scheduled");
    validate_status(status)?;

    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let rows = conn
        .execute(
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
        )
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        return Err(format!("appointment '{id}' not found"));
    }

    let appt = load_appointment(conn, &id)?;
    let body = [
        appt.doctor_name.as_deref().unwrap_or(""),
        appt.clinic_name.as_deref().unwrap_or(""),
        appt.specialty.as_deref().unwrap_or(""),
        appt.notes.as_deref().unwrap_or(""),
    ]
    .join(" ");
    upsert_search_index(conn, "appointment", &appt.id, &appt.title, &body, "");
    Ok(appt)
}

#[tauri::command]
pub fn appointments_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let rows = conn
        .execute("DELETE FROM appointments WHERE id = ?", [&id])
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        Err(format!("appointment '{id}' not found"))
    } else {
        remove_from_search_index(conn, &id);
        Ok(())
    }
}

#[tauri::command]
pub fn appointments_link_document(
    appointment_id: String,
    document_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    conn.execute(
        "INSERT OR IGNORE INTO appointment_documents (appointment_id, document_id) VALUES (?1, ?2)",
        rusqlite::params![appointment_id, document_id],
    )
    .map_err(|e| e.to_string())?;

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
                updated_at DATETIME NOT NULL
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
            );",
        )
        .unwrap();
        conn
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
        conn.execute(
            "INSERT INTO appointment_documents VALUES ('a1','d1')",
            [],
        )
        .unwrap();
        let appt = load_appointment(&conn, "a1").unwrap();
        assert_eq!(appt.document_ids, vec!["d1"]);
    }

    #[test]
    fn load_appt_returns_err_for_missing() {
        let conn = test_conn();
        let result = load_appointment(&conn, "nonexistent");
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
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
        assert!(result.unwrap_err().contains("invalid status"));
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
        insert_appt(&conn, "a1", "Old Title", "2026-05-01T10:00:00Z", "scheduled");
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
        conn.execute("DELETE FROM appointments WHERE id='a1'", []).unwrap();
        assert!(load_appointment(&conn, "a1").is_err());
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
}
