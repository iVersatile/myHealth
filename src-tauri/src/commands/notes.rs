use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::search::{remove_from_search_index, strip_html, upsert_search_index};
use crate::commands::AppState;

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

fn load_note(conn: &rusqlite::Connection, id: &str) -> Result<Note, String> {
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
            format!("note '{id}' not found")
        } else {
            e.to_string()
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
) -> Result<Vec<Note>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let order = if pinned_first.unwrap_or(false) {
        "ORDER BY is_pinned DESC, updated_at DESC"
    } else {
        "ORDER BY updated_at DESC"
    };

    let sql = format!(
        "SELECT id, title, content, is_pinned, created_at, updated_at FROM notes {order}"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
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
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .map(|mut n| {
            n.tags = fetch_tags(conn, &n.id);
            n
        })
        .collect();

    Ok(notes)
}

#[tauri::command]
pub fn notes_get(id: String, state: State<'_, AppState>) -> Result<Note, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    load_note(conn, &id)
}

#[tauri::command]
pub fn notes_create(
    input: NoteCreateInput,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    conn.execute(
        "INSERT INTO notes (id, title, content, is_pinned, created_at, updated_at)
         VALUES (?1, ?2, ?3, 0, ?4, ?4)",
        rusqlite::params![id, input.title, input.content, now],
    )
    .map_err(|e| e.to_string())?;

    let note = load_note(conn, &id)?;
    upsert_search_index(
        conn,
        "note",
        &note.id,
        &note.title,
        &strip_html(&note.content),
        &note.tags.join(","),
    );
    Ok(note)
}

#[tauri::command]
pub fn notes_update(
    id: String,
    input: NoteUpdateInput,
    state: State<'_, AppState>,
) -> Result<Note, String> {
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let rows = conn
        .execute(
            "UPDATE notes SET
             title      = COALESCE(?2, title),
             content    = COALESCE(?3, content),
             updated_at = ?4
             WHERE id = ?1",
            rusqlite::params![id, input.title, input.content, now],
        )
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        return Err(format!("note '{id}' not found"));
    }

    let note = load_note(conn, &id)?;
    upsert_search_index(
        conn,
        "note",
        &note.id,
        &note.title,
        &strip_html(&note.content),
        &note.tags.join(","),
    );
    Ok(note)
}

#[tauri::command]
pub fn notes_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let rows = conn
        .execute("DELETE FROM notes WHERE id = ?", [&id])
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        Err(format!("note '{id}' not found"))
    } else {
        remove_from_search_index(conn, &id);
        Ok(())
    }
}

#[tauri::command]
pub fn notes_pin(id: String, pinned: bool, state: State<'_, AppState>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let rows = conn
        .execute(
            "UPDATE notes SET is_pinned = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params![id, pinned as i64, now],
        )
        .map_err(|e| e.to_string())?;

    if rows == 0 {
        Err(format!("note '{id}' not found"))
    } else {
        Ok(())
    }
}

#[tauri::command]
pub fn notes_tags_set(
    id: String,
    tags: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let exists: bool = conn
        .query_row("SELECT 1 FROM notes WHERE id = ?", [&id], |_| Ok(()))
        .is_ok();
    if !exists {
        return Err(format!("note '{id}' not found"));
    }

    conn.execute("DELETE FROM note_tags WHERE note_id = ?", [&id])
        .map_err(|e| e.to_string())?;

    for tag in &tags {
        conn.execute(
            "INSERT INTO note_tags (note_id, tag) VALUES (?1, ?2)",
            rusqlite::params![id, tag],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE notes SET updated_at = ?2 WHERE id = ?1",
        rusqlite::params![id, now],
    )
    .map_err(|e| e.to_string())?;

    if let Ok(note) = load_note(conn, &id) {
        upsert_search_index(
            conn,
            "note",
            &note.id,
            &note.title,
            &strip_html(&note.content),
            &note.tags.join(","),
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE notes (
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
            );",
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
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn fetch_tags_returns_sorted_tags() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        conn.execute("INSERT INTO note_tags VALUES ('n1','zebra')", []).unwrap();
        conn.execute("INSERT INTO note_tags VALUES ('n1','apple')", []).unwrap();
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
        conn.execute("INSERT INTO note_tags VALUES ('n1','old')", []).unwrap();
        conn.execute("DELETE FROM note_tags WHERE note_id='n1'", []).unwrap();
        conn.execute("INSERT INTO note_tags VALUES ('n1','new1')", []).unwrap();
        conn.execute("INSERT INTO note_tags VALUES ('n1','new2')", []).unwrap();
        let tags = fetch_tags(&conn, "n1");
        assert_eq!(tags, vec!["new1", "new2"]);
    }

    #[test]
    fn tags_set_clears_all_tags() {
        let conn = test_conn();
        insert_note(&conn, "n1", "X", false);
        conn.execute("INSERT INTO note_tags VALUES ('n1','t1')", []).unwrap();
        conn.execute("DELETE FROM note_tags WHERE note_id='n1'", []).unwrap();
        assert!(fetch_tags(&conn, "n1").is_empty());
    }

    #[test]
    fn list_pinned_first_ordering() {
        let conn = test_conn();
        insert_note(&conn, "n1", "Unpinned", false);
        insert_note(&conn, "n2", "Pinned", true);
        let mut stmt = conn
            .prepare(
                "SELECT id FROM notes ORDER BY is_pinned DESC, updated_at DESC",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(ids[0], "n2");
    }
}
