use chrono::Utc;
use serde::Serialize;
use tauri::State;

use crate::commands::{AppState, CommandContext, CommandError};

#[derive(Debug, Serialize)]
pub struct TrashItem {
    pub entity_type: String,
    pub id: String,
    pub display_name: String,
    pub deleted_at: Option<String>,
}

#[tauri::command]
pub fn trash_list(state: State<'_, AppState>) -> Result<Vec<TrashItem>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut items: Vec<TrashItem> = Vec::new();

    let mut stmt = conn.prepare(
        "SELECT id, name, deleted_at FROM clinics WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TrashItem {
            entity_type: "clinic".to_string(),
            id: row.get(0)?,
            display_name: row.get(1)?,
            deleted_at: row.get(2)?,
        })
    })?;
    for r in rows {
        items.push(r.map_err(|e| CommandError::Internal(e.to_string()))?);
    }

    let mut stmt = conn.prepare(
        "SELECT id, name, deleted_at FROM contacts WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TrashItem {
            entity_type: "contact".to_string(),
            id: row.get(0)?,
            display_name: row.get(1)?,
            deleted_at: row.get(2)?,
        })
    })?;
    for r in rows {
        items.push(r.map_err(|e| CommandError::Internal(e.to_string()))?);
    }

    let mut stmt = conn.prepare(
        "SELECT id, title, deleted_at FROM appointments WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TrashItem {
            entity_type: "appointment".to_string(),
            id: row.get(0)?,
            display_name: row.get(1)?,
            deleted_at: row.get(2)?,
        })
    })?;
    for r in rows {
        items.push(r.map_err(|e| CommandError::Internal(e.to_string()))?);
    }

    let mut stmt = conn.prepare(
        "SELECT id, title, deleted_at FROM notes WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TrashItem {
            entity_type: "note".to_string(),
            id: row.get(0)?,
            display_name: row.get(1)?,
            deleted_at: row.get(2)?,
        })
    })?;
    for r in rows {
        items.push(r.map_err(|e| CommandError::Internal(e.to_string()))?);
    }

    let mut stmt = conn.prepare(
        "SELECT id, filename, deleted_at FROM documents WHERE is_deleted = 1 ORDER BY deleted_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TrashItem {
            entity_type: "document".to_string(),
            id: row.get(0)?,
            display_name: row.get(1)?,
            deleted_at: row.get(2)?,
        })
    })?;
    for r in rows {
        items.push(r.map_err(|e| CommandError::Internal(e.to_string()))?);
    }

    items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));

    Ok(items)
}

#[tauri::command]
pub fn trash_restore(
    entity_type: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let table = entity_table(&entity_type)?;
    let now = Utc::now().to_rfc3339();
    let affected = conn
        .execute(
            &format!(
                "UPDATE {table} SET is_deleted = 0, deleted_at = NULL, updated_at = ?1 \
                 WHERE id = ?2 AND is_deleted = 1"
            ),
            rusqlite::params![now, id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if affected == 0 {
        return Err(CommandError::NotFound(format!(
            "{entity_type} '{id}' not in trash"
        )));
    }
    Ok(())
}

#[tauri::command]
pub fn trash_hard_delete(
    entity_type: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let table = entity_table(&entity_type)?;
    conn.execute(
        &format!("DELETE FROM {table} WHERE id = ?1 AND is_deleted = 1"),
        [&id],
    )
    .map_err(|e| CommandError::Internal(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn trash_empty(state: State<'_, AppState>) -> Result<u32, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut count: u32 = 0;
    for table in &["clinics", "contacts", "appointments", "notes", "documents"] {
        let n = conn
            .execute(&format!("DELETE FROM {table} WHERE is_deleted = 1"), [])
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        count += n as u32;
    }
    Ok(count)
}

#[tauri::command]
pub fn trash_purge_expired(state: State<'_, AppState>) -> Result<u32, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let cutoff = (Utc::now() - chrono::Duration::days(30)).to_rfc3339();
    let mut count: u32 = 0;
    for table in &["clinics", "contacts", "appointments", "notes", "documents"] {
        let n = conn
            .execute(
                &format!("DELETE FROM {table} WHERE is_deleted = 1 AND deleted_at < ?1"),
                [&cutoff],
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        count += n as u32;
    }
    Ok(count)
}

fn entity_table(entity_type: &str) -> Result<&'static str, CommandError> {
    match entity_type {
        "clinic" => Ok("clinics"),
        "contact" => Ok("contacts"),
        "appointment" => Ok("appointments"),
        "note" => Ok("notes"),
        "document" => Ok("documents"),
        other => Err(CommandError::InvalidInput(format!(
            "unknown entity type '{other}'"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE clinics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                updated_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                updated_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE appointments (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                updated_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                updated_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                updated_at TEXT NOT NULL DEFAULT ''
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn trash_list_excludes_active_items() {
        let conn = test_conn();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted, deleted_at) VALUES ('c1', 'Deleted Clinic', 1, ?1)",
            [&now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted) VALUES ('c2', 'Active Clinic', 0)",
            [],
        )
        .unwrap();

        let deleted: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinics WHERE is_deleted = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(deleted, 1);

        let active: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinics WHERE is_deleted = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(active, 1);
    }

    #[test]
    fn trash_restore_clears_is_deleted_flag() {
        let conn = test_conn();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, is_deleted, deleted_at) VALUES ('co1', 'Jane', 1, ?1)",
            [&now],
        )
        .unwrap();

        let affected = conn
            .execute(
                "UPDATE contacts SET is_deleted = 0, deleted_at = NULL, updated_at = ?1 \
                 WHERE id = ?2 AND is_deleted = 1",
                rusqlite::params![now, "co1"],
            )
            .unwrap();
        assert_eq!(affected, 1);

        let is_deleted: i64 = conn
            .query_row(
                "SELECT is_deleted FROM contacts WHERE id = 'co1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_deleted, 0);
    }

    #[test]
    fn trash_restore_returns_not_found_for_active_item() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO contacts (id, name, is_deleted) VALUES ('co1', 'Jane', 0)",
            [],
        )
        .unwrap();

        let affected = conn
            .execute(
                "UPDATE contacts SET is_deleted = 0, deleted_at = NULL, updated_at = '' \
                 WHERE id = 'co1' AND is_deleted = 1",
                [],
            )
            .unwrap();
        assert_eq!(affected, 0);
    }

    #[test]
    fn trash_hard_delete_removes_row() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO notes (id, title, is_deleted, deleted_at) VALUES ('n1', 'Old Note', 1, '2026-01-01T00:00:00Z')",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM notes WHERE id = ?1 AND is_deleted = 1", ["n1"])
            .unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes WHERE id = 'n1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn trash_empty_removes_all_soft_deleted_rows() {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted) VALUES ('c1', 'A', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO clinics (id, name, is_deleted) VALUES ('c2', 'B', 0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointments (id, title, is_deleted) VALUES ('a1', 'Appt', 1)",
            [],
        )
        .unwrap();

        let mut total: u32 = 0;
        for table in &["clinics", "contacts", "appointments", "notes", "documents"] {
            let n = conn
                .execute(&format!("DELETE FROM {table} WHERE is_deleted = 1"), [])
                .unwrap();
            total += n as u32;
        }

        assert_eq!(total, 2);
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM clinics", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 1);
    }

    #[test]
    fn trash_purge_expired_removes_only_old_items() {
        let conn = test_conn();
        let old = "2026-01-01T00:00:00Z";
        let recent = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO notes (id, title, is_deleted, deleted_at) VALUES ('n1', 'Old', 1, ?1)",
            [old],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notes (id, title, is_deleted, deleted_at) VALUES ('n2', 'New', 1, ?1)",
            [&recent],
        )
        .unwrap();

        let cutoff = (Utc::now() - chrono::Duration::days(30)).to_rfc3339();
        let mut removed: u32 = 0;
        for table in &["clinics", "contacts", "appointments", "notes", "documents"] {
            let n = conn
                .execute(
                    &format!("DELETE FROM {table} WHERE is_deleted = 1 AND deleted_at < ?1"),
                    [&cutoff],
                )
                .unwrap();
            removed += n as u32;
        }

        assert_eq!(removed, 1);
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes WHERE is_deleted = 1", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(remaining, 1);
    }

    #[test]
    fn entity_table_rejects_unknown_type() {
        let result = entity_table("unknown");
        assert!(result.is_err());
    }
}
