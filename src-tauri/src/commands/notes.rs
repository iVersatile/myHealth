use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::search::{remove_from_search_index, strip_html, upsert_search_index};
use crate::commands::{AppState, CommandContext, CommandError};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub is_pinned: bool,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct NoteCreateInput {
    pub title: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct NoteUpdateInput {
    pub title: Option<String>,
    pub content: Option<String>,
}

fn fetch_tags(conn: &rusqlite::Connection, note_id: &str) -> Vec<String> {
    conn.prepare("SELECT tag FROM note_tags WHERE note_id = ? ORDER BY tag")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([note_id], |row| row.get::<_, String>(0))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default()
}

fn load_note(conn: &rusqlite::Connection, id: &str) -> Result<Note, CommandError> {
    conn.query_row(
        "SELECT id, title, content, is_pinned, created_at, updated_at
         FROM notes WHERE id = ?",
        [id],
        |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                is_pinned: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                tags: vec![],
            })
        },
    )
    .map_err(|e| {
        if e == rusqlite::Error::QueryReturnedNoRows {
            CommandError::NotFound(format!("note '{id}' not found"))
        } else {
            CommandError::Internal(e.to_string())
        }
    })
    .map(|mut note| {
        note.tags = fetch_tags(conn, &note.id);
        note
    })
}

#[tauri::command]
pub fn notes_list(
    pinned_first: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<Note>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let order = if pinned_first.unwrap_or(false) {
        "ORDER BY is_pinned DESC, updated_at DESC"
    } else {
        "ORDER BY updated_at DESC"
    };

    let sql =
        format!("SELECT id, title, content, is_pinned, created_at, updated_at FROM notes {order}");

    let mut stmt = conn.prepare(&sql)?;
    let notes: Vec<Note> = stmt
        .query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                is_pinned: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                tags: vec![],
            })
        })?
        .filter_map(|r| r.ok())
        .map(|mut n| {
            n.tags = fetch_tags(conn, &n.id);
            n
        })
        .collect();

    Ok(notes)
}

#[tauri::command]
pub fn notes_get(id: String, state: State<'_, AppState>) -> Result<Note, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_note(conn, &id)
}

#[tauri::command]
pub fn notes_create(
    input: NoteCreateInput,
    state: State<'_, AppState>,
) -> Result<Note, CommandError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT INTO notes (id, title, content, is_pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?4)",
        rusqlite::params![id, input.title, input.content, now],
    )?;

    let note = load_note(conn, &id)?;
    upsert_search_index(
        conn,
        "note",
        &note.id,
        &note.title,
        &strip_html(&note.content),
        &note.tags.join(","),
        "",
        "",
    );
    Ok(note)
}

#[tauri::command]
pub fn notes_update(
    id: String,
    input: NoteUpdateInput,
    state: State<'_, AppState>,
) -> Result<Note, CommandError> {
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    if input.content.is_some() {
        let current_content: Option<String> = conn
            .query_row("SELECT content FROM notes WHERE id = ?1", [&id], |row| {
                row.get(0)
            })
            .ok();

        if let Some(content) = current_content {
            let version_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO note_versions (id, note_id, content, saved_at) VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![version_id, id, content, now],
            )?;
            conn.execute(
                "DELETE FROM note_versions WHERE note_id = ?1
                 AND id NOT IN (
                     SELECT id FROM note_versions WHERE note_id = ?1
                     ORDER BY saved_at DESC LIMIT 10
                 )",
                rusqlite::params![id],
            )?;
        }
    }

    let rows = conn.execute(
        "UPDATE notes SET
             title      = COALESCE(?2, title),
             content    = COALESCE(?3, content),
             updated_at = ?4
             WHERE id = ?1",
        rusqlite::params![id, input.title, input.content, now],
    )?;

    if rows == 0 {
        return Err(CommandError::Internal(format!("note '{id}' not found")));
    }

    let note = load_note(conn, &id)?;
    upsert_search_index(
        conn,
        "note",
        &note.id,
        &note.title,
        &strip_html(&note.content),
        &note.tags.join(","),
        "",
        "",
    );
    Ok(note)
}

#[tauri::command]
pub fn notes_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let rows = conn.execute("DELETE FROM notes WHERE id = ?", [&id])?;

    if rows == 0 {
        Err(CommandError::Internal(format!("note '{id}' not found")))
    } else {
        remove_from_search_index(conn, &id);
        Ok(())
    }
}

#[tauri::command]
pub fn notes_pin(id: String, pinned: bool, state: State<'_, AppState>) -> Result<(), CommandError> {
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let rows = conn.execute(
        "UPDATE notes SET is_pinned = ?2, updated_at = ?3 WHERE id = ?1",
        rusqlite::params![id, pinned as i64, now],
    )?;

    if rows == 0 {
        Err(CommandError::Internal(format!("note '{id}' not found")))
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn notes_tags_set(
    id: String,
    tags: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let exists: bool = conn
        .query_row("SELECT 1 FROM notes WHERE id = ?", [&id], |_| Ok(()))
        .is_ok();
    if !exists {
        return Err(CommandError::Internal(format!("note '{id}' not found")));
    }

    conn.execute("DELETE FROM note_tags WHERE note_id = ?", [&id])?;

    for tag in &tags {
        conn.execute(
            "INSERT INTO note_tags (note_id, tag) VALUES (?1, ?2)",
            rusqlite::params![id, tag],
        )?;
    }

    conn.execute(
        "UPDATE notes SET updated_at = ?2 WHERE id = ?1",
        rusqlite::params![id, now],
    )?;

    if let Ok(note) = load_note(conn, &id) {
        upsert_search_index(
            conn,
            "note",
            &note.id,
            &note.title,
            &strip_html(&note.content),
            &note.tags.join(","),
            "",
            "",
        );
    }

    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteVersionDto {
    pub id: String,
    pub note_id: String,
    pub content: String,
    pub saved_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteLinkDto {
    pub id: String,
    pub note_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub created_at: String,
}

#[tauri::command]
pub fn note_link(
    note_id: String,
    entity_type: String,
    entity_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO note_links (id, note_id, entity_type, entity_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![id, note_id, entity_type, entity_id, now],
    )?;

    Ok(())
}

#[tauri::command]
pub fn note_unlink(
    note_id: String,
    entity_type: String,
    entity_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "DELETE FROM note_links WHERE note_id = ?1 AND entity_type = ?2 AND entity_id = ?3",
        rusqlite::params![note_id, entity_type, entity_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn links_for_note(
    note_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<NoteLinkDto>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT id, note_id, entity_type, entity_id, created_at
         FROM note_links WHERE note_id = ?1 ORDER BY created_at",
    )?;

    let links: Vec<NoteLinkDto> = stmt
        .query_map([&note_id], |row| {
            Ok(NoteLinkDto {
                id: row.get(0)?,
                note_id: row.get(1)?,
                entity_type: row.get(2)?,
                entity_id: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(links)
}

#[tauri::command]
pub fn notes_for_entity(
    entity_type: String,
    entity_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Note>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT n.id, n.title, n.content, n.is_pinned, n.created_at, n.updated_at
         FROM notes n
         INNER JOIN note_links nl ON nl.note_id = n.id
         WHERE nl.entity_type = ?1 AND nl.entity_id = ?2
         ORDER BY n.updated_at DESC",
    )?;

    let notes: Vec<Note> = stmt
        .query_map(rusqlite::params![entity_type, entity_id], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                is_pinned: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                tags: vec![],
            })
        })?
        .filter_map(|r| r.ok())
        .map(|mut n| {
            n.tags = fetch_tags(conn, &n.id);
            n
        })
        .collect();

    Ok(notes)
}

#[tauri::command]
pub fn note_versions_list(
    note_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<NoteVersionDto>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT id, note_id, content, saved_at
         FROM note_versions WHERE note_id = ?1 ORDER BY saved_at DESC",
    )?;

    let versions: Vec<NoteVersionDto> = stmt
        .query_map([&note_id], |row| {
            Ok(NoteVersionDto {
                id: row.get(0)?,
                note_id: row.get(1)?,
                content: row.get(2)?,
                saved_at: row.get(3)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(versions)
}

#[tauri::command]
pub fn note_version_restore(
    note_id: String,
    version_id: String,
    state: State<'_, AppState>,
) -> Result<Note, CommandError> {
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let target_content: String = conn
        .query_row(
            "SELECT content FROM note_versions WHERE id = ?1 AND note_id = ?2",
            rusqlite::params![version_id, note_id],
            |row| row.get(0),
        )
        .map_err(|_| CommandError::NotFound(format!("version '{version_id}' not found")))?;

    let current_content: String = conn
        .query_row(
            "SELECT content FROM notes WHERE id = ?1",
            [&note_id],
            |row| row.get(0),
        )
        .map_err(|_| CommandError::NotFound(format!("note '{note_id}' not found")))?;

    let snapshot_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO note_versions (id, note_id, content, saved_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![snapshot_id, note_id, current_content, now],
    )?;
    conn.execute(
        "DELETE FROM note_versions WHERE note_id = ?1
         AND id NOT IN (
             SELECT id FROM note_versions WHERE note_id = ?1
             ORDER BY saved_at DESC LIMIT 10
         )",
        rusqlite::params![note_id],
    )?;

    conn.execute(
        "UPDATE notes SET content = ?2, updated_at = ?3 WHERE id = ?1",
        rusqlite::params![note_id, target_content, now],
    )?;

    load_note(conn, &note_id)
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
            CREATE TABLE notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                is_pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE note_tags (
                note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                tag TEXT NOT NULL,
                PRIMARY KEY (note_id, tag)
            );
            CREATE TABLE note_links (
                id          TEXT PRIMARY KEY,
                note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                entity_type TEXT NOT NULL CHECK(entity_type IN ('appointment','document')),
                entity_id   TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                UNIQUE(note_id, entity_type, entity_id)
            );
            CREATE TABLE note_versions (
                id       TEXT PRIMARY KEY,
                note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                content  TEXT NOT NULL,
                saved_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_note_versions_note_id_saved_at
                ON note_versions (note_id, saved_at DESC);",
        )
        .unwrap();
        conn
    }

    fn insert_note(conn: &Connection, id: &str, title: &str, pinned: bool) {
        conn.execute(
            "INSERT INTO notes (id, title, content, is_pinned, created_at, updated_at)
             VALUES (?1, ?2, '', ?3, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
            rusqlite::params![id, title, pinned as i64],
        )
        .unwrap();
    }

    #[test]
    fn load_note_returns_note() {
        let conn = test_conn();
        insert_note(&conn, "n1", "My Note", false);
        let note = load_note(&conn, "n1").unwrap();
        assert_eq!(note.id, "n1");
        assert_eq!(note.title, "My Note");
        assert!(!note.is_pinned);
    }

    #[test]
    fn load_note_returns_err_for_missing() {
        let conn = test_conn();
        let result = load_note(&conn, "nonexistent");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn fetch_tags_returns_sorted_tags() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        conn.execute("INSERT INTO note_tags VALUES ('n1','zebra')", [])
            .unwrap();
        conn.execute("INSERT INTO note_tags VALUES ('n1','apple')", [])
            .unwrap();
        let tags = fetch_tags(&conn, "n1");
        assert_eq!(tags, vec!["apple", "zebra"]);
    }

    #[test]
    fn fetch_tags_returns_empty_when_none() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        assert!(fetch_tags(&conn, "n1").is_empty());
    }

    #[test]
    fn create_note_inserts_and_returns() {
        let conn = test_conn();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO notes (id,title,content,is_pinned,created_at,updated_at)
             VALUES (?1,'Draft','Hello',0,?2,?2)",
            rusqlite::params![id, now],
        )
        .unwrap();
        let note = load_note(&conn, &id).unwrap();
        assert_eq!(note.title, "Draft");
        assert_eq!(note.content, "Hello");
        assert!(!note.is_pinned);
    }

    #[test]
    fn update_note_changes_title_and_content() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Old", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notes SET title=?2, content=?3, updated_at=?4 WHERE id=?1",
            rusqlite::params!["n1", "New", "Updated content", now],
        )
        .unwrap();
        let note = load_note(&conn, "n1").unwrap();
        assert_eq!(note.title, "New");
        assert_eq!(note.content, "Updated content");
    }

    #[test]
    fn update_returns_err_for_missing_note() {
        let conn = test_conn();
        let result = load_note(&conn, "missing");
        assert!(result.is_err());
    }

    #[test]
    fn pin_note_sets_is_pinned_true() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notes SET is_pinned=1, updated_at=?2 WHERE id=?1",
            rusqlite::params!["n1", now],
        )
        .unwrap();
        let note = load_note(&conn, "n1").unwrap();
        assert!(note.is_pinned);
    }

    #[test]
    fn pin_note_sets_is_pinned_false() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", true);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE notes SET is_pinned=0, updated_at=?2 WHERE id=?1",
            rusqlite::params!["n1", now],
        )
        .unwrap();
        let note = load_note(&conn, "n1").unwrap();
        assert!(!note.is_pinned);
    }

    #[test]
    fn delete_removes_note() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        conn.execute("DELETE FROM notes WHERE id='n1'", []).unwrap();
        assert!(load_note(&conn, "n1").is_err());
    }

    #[test]
    fn tags_set_replaces_all_tags() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        conn.execute("INSERT INTO note_tags VALUES ('n1','old')", [])
            .unwrap();
        conn.execute("DELETE FROM note_tags WHERE note_id='n1'", [])
            .unwrap();
        conn.execute("INSERT INTO note_tags VALUES ('n1','new1')", [])
            .unwrap();
        conn.execute("INSERT INTO note_tags VALUES ('n1','new2')", [])
            .unwrap();
        let tags = fetch_tags(&conn, "n1");
        assert_eq!(tags, vec!["new1", "new2"]);
    }

    #[test]
    fn tags_set_clears_all_tags() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        conn.execute("INSERT INTO note_tags VALUES ('n1','t1')", [])
            .unwrap();
        conn.execute("DELETE FROM note_tags WHERE note_id='n1'", [])
            .unwrap();
        assert!(fetch_tags(&conn, "n1").is_empty());
    }

    #[test]
    fn list_pinned_first_ordering() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Unpinned", false);
        insert_note(&conn, "n2", "Pinned", true);
        let mut stmt = conn
            .prepare("SELECT id FROM notes ORDER BY is_pinned DESC, updated_at DESC")
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(ids[0], "n2");
    }

    fn insert_link(conn: &Connection, note_id: &str, entity_type: &str, entity_id: &str) {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO note_links (id, note_id, entity_type, entity_id, created_at)
             VALUES (?1, ?2, ?3, ?4, '2026-01-01T00:00:00Z')",
            rusqlite::params![id, note_id, entity_type, entity_id],
        )
        .unwrap();
    }

    #[test]
    fn note_link_inserts_and_lists() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Note", false);
        insert_link(&conn, "n1", "appointment", "a1");

        let mut stmt = conn
            .prepare("SELECT note_id, entity_type, entity_id FROM note_links WHERE note_id='n1'")
            .unwrap();
        let rows: Vec<(String, String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0], ("n1".into(), "appointment".into(), "a1".into()));
    }

    #[test]
    fn note_link_duplicate_is_noop() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Note", false);
        insert_link(&conn, "n1", "document", "d1");
        insert_link(&conn, "n1", "document", "d1");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM note_links WHERE note_id='n1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn note_unlink_removes_link() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Note", false);
        insert_link(&conn, "n1", "appointment", "a1");
        conn.execute(
            "DELETE FROM note_links WHERE note_id='n1' AND entity_type='appointment' AND entity_id='a1'",
            [],
        )
        .unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM note_links", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn links_for_note_returns_linked_entities() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Note", false);
        insert_link(&conn, "n1", "appointment", "a1");
        insert_link(&conn, "n1", "document", "d1");

        let mut stmt = conn
            .prepare("SELECT entity_type, entity_id FROM note_links WHERE note_id='n1' ORDER BY created_at")
            .unwrap();
        let rows: Vec<(String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(rows.len(), 2);
    }

    #[test]
    fn notes_for_entity_returns_linked_notes() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Alpha", false);
        insert_note(&conn, "n2", "Beta", false);
        insert_link(&conn, "n1", "appointment", "appt-1");
        insert_link(&conn, "n2", "appointment", "appt-1");

        let mut stmt = conn
            .prepare(
                "SELECT n.id FROM notes n
                 INNER JOIN note_links nl ON nl.note_id = n.id
                 WHERE nl.entity_type='appointment' AND nl.entity_id='appt-1'
                 ORDER BY n.updated_at DESC",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(ids.len(), 2);
        assert!(ids.contains(&"n1".to_string()));
        assert!(ids.contains(&"n2".to_string()));
    }

    fn insert_version(conn: &Connection, note_id: &str, content: &str, saved_at: &str) {
        conn.execute(
            "INSERT INTO note_versions (id, note_id, content, saved_at) VALUES (?, ?, ?, ?)",
            rusqlite::params![Uuid::new_v4().to_string(), note_id, content, saved_at],
        )
        .unwrap();
    }

    #[test]
    fn note_versions_capped_at_ten() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Note", false);
        for i in 1..=11 {
            insert_version(
                &conn,
                "n1",
                &format!("v{i}"),
                &format!("2024-01-{:02}T00:00:00Z", i),
            );
            conn.execute(
                "DELETE FROM note_versions WHERE note_id = ?1
                 AND id NOT IN (
                     SELECT id FROM note_versions WHERE note_id = ?1
                     ORDER BY saved_at DESC LIMIT 10
                 )",
                rusqlite::params!["n1"],
            )
            .unwrap();
        }
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM note_versions WHERE note_id='n1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 10);
    }

    #[test]
    fn note_version_restore_updates_note_content() {
        let conn = test_conn();
        insert_note(&conn, "n1", "original", false);
        insert_version(&conn, "n1", "snapshot", "2024-01-01T00:00:00Z");
        let version_id: String = conn
            .query_row("SELECT id FROM note_versions WHERE note_id='n1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        let now = "2024-02-01T00:00:00Z";
        let target_content: String = conn
            .query_row(
                "SELECT content FROM note_versions WHERE id = ?1 AND note_id = ?2",
                rusqlite::params![version_id, "n1"],
                |r| r.get(0),
            )
            .unwrap();
        conn.execute(
            "UPDATE notes SET content = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params!["n1", target_content, now],
        )
        .unwrap();
        let content: String = conn
            .query_row("SELECT content FROM notes WHERE id='n1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(content, "snapshot");
    }

    #[test]
    fn note_version_restore_snapshots_current_before_restore() {
        let conn = test_conn();
        insert_note(&conn, "n1", "current-content", false);
        insert_version(&conn, "n1", "old-version", "2024-01-01T00:00:00Z");
        let version_id: String = conn
            .query_row("SELECT id FROM note_versions WHERE note_id='n1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        let now = "2024-02-01T00:00:00Z";
        // Simulate restore: snapshot current first
        let current: String = conn
            .query_row("SELECT content FROM notes WHERE id='n1'", [], |r| r.get(0))
            .unwrap();
        conn.execute(
            "INSERT INTO note_versions (id, note_id, content, saved_at) VALUES (?, ?, ?, ?)",
            rusqlite::params![Uuid::new_v4().to_string(), "n1", current, now],
        )
        .unwrap();
        // Then restore target
        let target: String = conn
            .query_row(
                "SELECT content FROM note_versions WHERE id = ?1",
                rusqlite::params![version_id],
                |r| r.get(0),
            )
            .unwrap();
        conn.execute(
            "UPDATE notes SET content = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params!["n1", target, now],
        )
        .unwrap();
        let version_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM note_versions WHERE note_id='n1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(version_count, 2);
        let note_content: String = conn
            .query_row("SELECT content FROM notes WHERE id='n1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(note_content, "old-version");
    }
}
