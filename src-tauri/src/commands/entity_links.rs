use crate::commands::AppState;
use crate::commands::{CommandContext, CommandError};
use rusqlite::params;
use tauri::State;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct EntityLink {
    pub id: String,
    pub from_type: String,
    pub from_id: String,
    pub to_type: String,
    pub to_id: String,
    pub created_at: String,
}

fn row_to_entity_link(row: &rusqlite::Row<'_>) -> rusqlite::Result<EntityLink> {
    Ok(EntityLink {
        id: row.get(0)?,
        from_type: row.get(1)?,
        from_id: row.get(2)?,
        to_type: row.get(3)?,
        to_id: row.get(4)?,
        created_at: row.get(5)?,
    })
}

fn insert_link(
    conn: &rusqlite::Connection,
    from_type: &str,
    from_id: &str,
    to_type: &str,
    to_id: &str,
) -> Result<EntityLink, CommandError> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR IGNORE INTO entity_links (id, from_type, from_id, to_type, to_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, from_type, from_id, to_type, to_id, now],
    )?;
    conn.query_row(
        "SELECT id, from_type, from_id, to_type, to_id, created_at
         FROM entity_links WHERE from_type = ?1 AND from_id = ?2 AND to_type = ?3 AND to_id = ?4",
        params![from_type, from_id, to_type, to_id],
        row_to_entity_link,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

fn delete_link(
    conn: &rusqlite::Connection,
    from_type: &str,
    from_id: &str,
    to_type: &str,
    to_id: &str,
) -> Result<(), CommandError> {
    let affected = conn.execute(
        "DELETE FROM entity_links WHERE from_type = ?1 AND from_id = ?2 AND to_type = ?3 AND to_id = ?4",
        params![from_type, from_id, to_type, to_id],
    )?;
    if affected == 0 {
        return Err(CommandError::NotFound("entity link not found".to_string()));
    }
    Ok(())
}

fn list_links(
    conn: &rusqlite::Connection,
    from_type: &str,
    from_id: &str,
) -> Result<Vec<EntityLink>, CommandError> {
    let mut stmt = conn.prepare(
        "SELECT id, from_type, from_id, to_type, to_id, created_at
         FROM entity_links WHERE from_type = ?1 AND from_id = ?2
         ORDER BY created_at ASC",
    )?;
    let rows = stmt.query_map(params![from_type, from_id], row_to_entity_link)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn symptom_link(
    symptom_id: String,
    to_type: String,
    to_id: String,
    state: State<'_, AppState>,
) -> Result<EntityLink, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    insert_link(conn, "symptom", &symptom_id, &to_type, &to_id)
}

#[tauri::command]
pub fn symptom_unlink(
    symptom_id: String,
    to_type: String,
    to_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    delete_link(conn, "symptom", &symptom_id, &to_type, &to_id)
}

#[tauri::command]
pub fn links_for_symptom(
    symptom_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<EntityLink>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    list_links(conn, "symptom", &symptom_id)
}

#[tauri::command]
pub fn medication_link(
    medication_id: String,
    to_type: String,
    to_id: String,
    state: State<'_, AppState>,
) -> Result<EntityLink, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    insert_link(conn, "medication", &medication_id, &to_type, &to_id)
}

#[tauri::command]
pub fn medication_unlink(
    medication_id: String,
    to_type: String,
    to_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    delete_link(conn, "medication", &medication_id, &to_type, &to_id)
}

#[tauri::command]
pub fn links_for_medication(
    medication_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<EntityLink>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    list_links(conn, "medication", &medication_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;

    fn test_conn() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn symptom_link_round_trip() {
        let conn = test_conn();
        let link = insert_link(&conn, "symptom", "s1", "document", "d1").unwrap();
        assert_eq!(link.from_type, "symptom");
        assert_eq!(link.from_id, "s1");
        assert_eq!(link.to_type, "document");
        assert_eq!(link.to_id, "d1");
    }

    #[test]
    fn medication_link_round_trip() {
        let conn = test_conn();
        let link = insert_link(&conn, "medication", "m1", "appointment", "a1").unwrap();
        assert_eq!(link.from_type, "medication");
        assert_eq!(link.to_type, "appointment");
    }

    #[test]
    fn unlink_removes_record() {
        let conn = test_conn();
        insert_link(&conn, "symptom", "s1", "document", "d1").unwrap();
        delete_link(&conn, "symptom", "s1", "document", "d1").unwrap();
        let links = list_links(&conn, "symptom", "s1").unwrap();
        assert!(links.is_empty());
    }

    #[test]
    fn unlink_returns_not_found_when_missing() {
        let conn = test_conn();
        let err = delete_link(&conn, "symptom", "s1", "document", "d1").unwrap_err();
        assert!(matches!(err, CommandError::NotFound(_)));
    }

    #[test]
    fn duplicate_link_is_idempotent() {
        let conn = test_conn();
        insert_link(&conn, "symptom", "s1", "document", "d1").unwrap();
        insert_link(&conn, "symptom", "s1", "document", "d1").unwrap();
        let links = list_links(&conn, "symptom", "s1").unwrap();
        assert_eq!(links.len(), 1);
    }

    #[test]
    fn list_returns_all_links_for_entity() {
        let conn = test_conn();
        insert_link(&conn, "symptom", "s1", "document", "d1").unwrap();
        insert_link(&conn, "symptom", "s1", "appointment", "a1").unwrap();
        let links = list_links(&conn, "symptom", "s1").unwrap();
        assert_eq!(links.len(), 2);
    }
}
