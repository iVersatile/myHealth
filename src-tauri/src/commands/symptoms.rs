use crate::commands::search::{remove_from_search_index, upsert_search_index};
use crate::commands::AppState;
use crate::commands::{CommandContext, CommandError};
use rusqlite::{params, Connection};
use tauri::State;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Symptom {
    pub id: String,
    pub name: String,
    pub severity: Option<i64>,
    pub onset_date: Option<String>,
    pub notes: Option<String>,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, serde::Deserialize)]
pub struct SymptomCreateInput {
    pub name: String,
    pub severity: Option<i64>,
    pub onset_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
pub struct SymptomUpdateInput {
    pub name: Option<String>,
    pub severity: Option<i64>,
    pub onset_date: Option<String>,
    pub notes: Option<String>,
}

fn load_symptom(conn: &Connection, id: &str) -> Result<Symptom, CommandError> {
    conn.query_row(
        "SELECT id, name, severity, onset_date, notes, deleted_at, created_at, updated_at
         FROM symptoms WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |row| {
            Ok(Symptom {
                id: row.get(0)?,
                name: row.get(1)?,
                severity: row.get(2)?,
                onset_date: row.get(3)?,
                notes: row.get(4)?,
                deleted_at: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            CommandError::NotFound(format!("symptom {id} not found"))
        }
        other => CommandError::Internal(other.to_string()),
    })
}

#[tauri::command]
pub fn symptoms_list(state: State<'_, AppState>) -> Result<Vec<Symptom>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT id, name, severity, onset_date, notes, deleted_at, created_at, updated_at
         FROM symptoms WHERE deleted_at IS NULL ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Symptom {
            id: row.get(0)?,
            name: row.get(1)?,
            severity: row.get(2)?,
            onset_date: row.get(3)?,
            notes: row.get(4)?,
            deleted_at: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn symptoms_get(id: String, state: State<'_, AppState>) -> Result<Symptom, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_symptom(conn, &id)
}

#[tauri::command]
pub fn symptoms_create(
    input: SymptomCreateInput,
    state: State<'_, AppState>,
) -> Result<Symptom, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO symptoms (id, name, severity, onset_date, notes, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.name,
            input.severity,
            input.onset_date,
            input.notes,
            now,
            now
        ],
    )?;
    let s = load_symptom(conn, &id)?;
    let body = s.notes.as_deref().unwrap_or("");
    upsert_search_index(conn, "symptom", &s.id, &s.name, body, "", "", "", "");
    Ok(s)
}

#[tauri::command]
pub fn symptoms_update(
    id: String,
    input: SymptomUpdateInput,
    state: State<'_, AppState>,
) -> Result<Symptom, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_symptom(conn, &id)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE symptoms SET
           name       = COALESCE(?2, name),
           severity   = CASE WHEN ?3 IS NOT NULL THEN ?3 ELSE severity END,
           onset_date = CASE WHEN ?4 IS NOT NULL THEN ?4 ELSE onset_date END,
           notes      = CASE WHEN ?5 IS NOT NULL THEN ?5 ELSE notes END,
           updated_at = ?6
         WHERE id = ?1 AND deleted_at IS NULL",
        params![
            id,
            input.name,
            input.severity,
            input.onset_date,
            input.notes,
            now
        ],
    )?;
    let s = load_symptom(conn, &id)?;
    let body = s.notes.as_deref().unwrap_or("");
    upsert_search_index(conn, "symptom", &s.id, &s.name, body, "", "", "", "");
    Ok(s)
}

#[tauri::command]
pub fn symptoms_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_symptom(conn, &id)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE symptoms SET deleted_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, now],
    )?;
    remove_from_search_index(conn, &id);
    Ok(())
}

#[tauri::command]
pub fn symptoms_hard_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let affected = conn.execute("DELETE FROM symptoms WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(CommandError::NotFound(format!("symptom {id} not found")));
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
    fn creates_and_retrieves_symptom() {
        let conn = test_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO symptoms (id, name, severity, onset_date, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, "Headache", 5_i64, "2024-01-01", "mild", now, now],
        )
        .unwrap();
        let s = load_symptom(&conn, &id).unwrap();
        assert_eq!(s.name, "Headache");
        assert_eq!(s.severity, Some(5));
    }

    #[test]
    fn returns_not_found_for_missing_symptom() {
        let conn = test_conn();
        let err = load_symptom(&conn, "nonexistent").unwrap_err();
        assert!(matches!(err, CommandError::NotFound(_)));
    }

    #[test]
    fn soft_delete_hides_symptom() {
        let conn = test_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO symptoms (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, "Nausea", now, now],
        )
        .unwrap();
        conn.execute(
            "UPDATE symptoms SET deleted_at = ?2 WHERE id = ?1",
            params![id, now],
        )
        .unwrap();
        let err = load_symptom(&conn, &id).unwrap_err();
        assert!(matches!(err, CommandError::NotFound(_)));
    }

    #[test]
    fn hard_delete_removes_symptom() {
        let conn = test_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO symptoms (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, "Fatigue", now, now],
        )
        .unwrap();
        conn.execute("DELETE FROM symptoms WHERE id = ?1", params![id])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM symptoms WHERE id = ?1",
                params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn severity_constraint_rejects_out_of_range() {
        let conn = test_conn();
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        let result = conn.execute(
            "INSERT INTO symptoms (id, name, severity, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, "Pain", 11_i64, now, now],
        );
        assert!(result.is_err());
    }
}
