use crate::commands::AppState;
use crate::commands::{CommandContext, CommandError};
use rusqlite::{params, Connection};
use tauri::State;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Medication {
    pub id: String,
    pub name: String,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct MedicationCreateInput {
    pub name: String,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct MedicationUpdateInput {
    pub name: Option<String>,
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub notes: Option<String>,
}

fn load_medication(conn: &Connection, id: &str) -> Result<Medication, CommandError> {
    conn.query_row(
        "SELECT id, name, dosage, frequency, start_date, end_date, notes,
                deleted_at, created_at, updated_at
         FROM medications WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |row| {
            Ok(Medication {
                id: row.get(0)?,
                name: row.get(1)?,
                dosage: row.get(2)?,
                frequency: row.get(3)?,
                start_date: row.get(4)?,
                end_date: row.get(5)?,
                notes: row.get(6)?,
                deleted_at: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            CommandError::NotFound(format!("medication {id} not found"))
        }
        other => CommandError::Internal(other.to_string()),
    })
}

#[tauri::command]
pub fn medications_list(state: State<'_, AppState>) -> Result<Vec<Medication>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT id, name, dosage, frequency, start_date, end_date, notes,
                deleted_at, created_at, updated_at
         FROM medications WHERE deleted_at IS NULL ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Medication {
            id: row.get(0)?,
            name: row.get(1)?,
            dosage: row.get(2)?,
            frequency: row.get(3)?,
            start_date: row.get(4)?,
            end_date: row.get(5)?,
            notes: row.get(6)?,
            deleted_at: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn medications_get(id: String, state: State<'_, AppState>) -> Result<Medication, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_medication(conn, &id)
}

#[tauri::command]
pub fn medications_create(
    input: MedicationCreateInput,
    state: State<'_, AppState>,
) -> Result<Medication, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO medications
           (id, name, dosage, frequency, start_date, end_date, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            input.name,
            input.dosage,
            input.frequency,
            input.start_date,
            input.end_date,
            input.notes,
            now,
            now
        ],
    )?;
    load_medication(conn, &id)
}

#[tauri::command]
pub fn medications_update(
    id: String,
    input: MedicationUpdateInput,
    state: State<'_, AppState>,
) -> Result<Medication, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_medication(conn, &id)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE medications SET
           name       = COALESCE(?2, name),
           dosage     = CASE WHEN ?3 IS NOT NULL THEN ?3 ELSE dosage END,
           frequency  = CASE WHEN ?4 IS NOT NULL THEN ?4 ELSE frequency END,
           start_date = CASE WHEN ?5 IS NOT NULL THEN ?5 ELSE start_date END,
           end_date   = CASE WHEN ?6 IS NOT NULL THEN ?6 ELSE end_date END,
           notes      = CASE WHEN ?7 IS NOT NULL THEN ?7 ELSE notes END,
           updated_at = ?8
         WHERE id = ?1 AND deleted_at IS NULL",
        params![
            id,
            input.name,
            input.dosage,
            input.frequency,
            input.start_date,
            input.end_date,
            input.notes,
            now
        ],
    )?;
    load_medication(conn, &id)
}

#[tauri::command]
pub fn medications_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_medication(conn, &id)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE medications SET deleted_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, now],
    )?;
    Ok(())
}

#[tauri::command]
pub fn medications_hard_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let affected = conn.execute("DELETE FROM medications WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(CommandError::NotFound(format!("medication {id} not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn creates_and_retrieves_medication() {
        let conn = test_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO medications
               (id, name, dosage, frequency, start_date, end_date, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                "Ibuprofen",
                "400mg",
                "twice daily",
                "2024-01-01",
                None::<String>,
                "with food",
                now,
                now
            ],
        )
        .unwrap();
        let m = load_medication(&conn, &id).unwrap();
        assert_eq!(m.name, "Ibuprofen");
        assert_eq!(m.dosage, Some("400mg".to_string()));
        assert_eq!(m.frequency, Some("twice daily".to_string()));
    }

    #[test]
    fn returns_not_found_for_missing_medication() {
        let conn = test_conn();
        let err = load_medication(&conn, "nonexistent").unwrap_err();
        assert!(matches!(err, CommandError::NotFound(_)));
    }

    #[test]
    fn soft_delete_hides_medication() {
        let conn = test_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO medications (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, "Aspirin", now, now],
        )
        .unwrap();
        conn.execute(
            "UPDATE medications SET deleted_at = ?2 WHERE id = ?1",
            params![id, now],
        )
        .unwrap();
        let err = load_medication(&conn, &id).unwrap_err();
        assert!(matches!(err, CommandError::NotFound(_)));
    }

    #[test]
    fn hard_delete_removes_medication() {
        let conn = test_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO medications (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, "Paracetamol", now, now],
        )
        .unwrap();
        conn.execute("DELETE FROM medications WHERE id = ?1", params![id])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM medications WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn list_excludes_soft_deleted() {
        let conn = test_conn();
        let now = chrono::Utc::now().to_rfc3339();
        let id_active = uuid::Uuid::new_v4().to_string();
        let id_deleted = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO medications (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![id_active, "Metformin", now, now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO medications (id, name, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id_deleted, "OldDrug", now, now, now],
        )
        .unwrap();
        let mut stmt = conn
            .prepare("SELECT id FROM medications WHERE deleted_at IS NULL ORDER BY created_at DESC")
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert!(ids.contains(&id_active));
        assert!(!ids.contains(&id_deleted));
    }
}
