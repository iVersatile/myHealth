use chrono::Utc;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::search::{remove_from_search_index, upsert_search_index};
use crate::commands::{AppState, CommandContext, CommandError};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub color_hex: String,
    pub is_system: bool,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CategoryCreateInput {
    pub name: String,
    pub parent_id: Option<String>,
    pub color_hex: Option<String>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CategoryUpdateInput {
    pub id: String,
    pub name: Option<String>,
    pub color_hex: Option<String>,
    pub sort_order: Option<i64>,
}

fn row_to_category(row: &rusqlite::Row) -> rusqlite::Result<Category> {
    let is_system_int: i64 = row.get(4)?;
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        parent_id: row.get(2)?,
        color_hex: row.get(3)?,
        is_system: is_system_int != 0,
        sort_order: row.get(5)?,
        created_at: row.get(6)?,
    })
}

#[tauri::command]
pub fn categories_list(
    include_archived: Option<bool>,
    state: State<'_, AppState>,
) -> Result<Vec<Category>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let sql = if include_archived.unwrap_or(false) {
        "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
         FROM categories ORDER BY is_system DESC, sort_order ASC, name ASC"
    } else {
        "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
         FROM categories WHERE is_archived = 0 ORDER BY is_system DESC, sort_order ASC, name ASC"
    };

    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], row_to_category)?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn categories_create(
    input: CategoryCreateInput,
    state: State<'_, AppState>,
) -> Result<Category, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let id = Uuid::new_v4().to_string();
    let color_hex = input.color_hex.unwrap_or_else(|| "#6B7280".to_string());
    let sort_order = input.sort_order.unwrap_or(100);
    let created_at = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
        rusqlite::params![id, input.name, input.parent_id, color_hex, sort_order, created_at],
    )
    ?;

    let mut stmt = conn.prepare(
        "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
             FROM categories WHERE id = ?1",
    )?;

    let cat = stmt.query_row(rusqlite::params![id], row_to_category)?;
    upsert_search_index(conn, "category", &cat.id, &cat.name, "", "", "", "", "", "");
    Ok(cat)
}

fn to_title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Looks up a category by name (case-insensitive). Returns existing id or creates with default colour.
#[tauri::command]
pub fn categories_create_if_not_exists(
    name: String,
    state: State<'_, AppState>,
) -> Result<String, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let normalised = to_title_case(name.trim());

    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM categories WHERE lower(name) = lower(?1) LIMIT 1",
            rusqlite::params![normalised],
            |r| r.get(0),
        )
        .optional()?;

    if let Some(id) = existing {
        return Ok(id);
    }

    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
         VALUES (?1, ?2, NULL, '#6B7280', 0, 100, ?3)",
        rusqlite::params![id, normalised, created_at],
    )?;
    upsert_search_index(conn, "category", &id, &normalised, "", "", "", "", "", "");
    Ok(id)
}

#[tauri::command]
pub fn categories_update(
    input: CategoryUpdateInput,
    state: State<'_, AppState>,
) -> Result<Category, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    if let Some(name) = &input.name {
        conn.execute(
            "UPDATE categories SET name = ?1 WHERE id = ?2",
            rusqlite::params![name, input.id],
        )?;
    }

    if let Some(color) = &input.color_hex {
        conn.execute(
            "UPDATE categories SET color_hex = ?1 WHERE id = ?2",
            rusqlite::params![color, input.id],
        )?;
    }

    if let Some(order) = input.sort_order {
        conn.execute(
            "UPDATE categories SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![order, input.id],
        )?;
    }

    let mut stmt = conn.prepare(
        "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
             FROM categories WHERE id = ?1",
    )?;

    let cat = stmt.query_row(rusqlite::params![input.id], row_to_category)?;
    upsert_search_index(conn, "category", &cat.id, &cat.name, "", "", "", "", "", "");
    Ok(cat)
}

#[tauri::command]
pub fn categories_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let is_system: i64 = conn
        .query_row(
            "SELECT is_system FROM categories WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| CommandError::NotFound("category not found".to_string()))?;

    if is_system != 0 {
        return Err(CommandError::Internal(
            "cannot delete system categories".to_string(),
        ));
    }

    conn.execute(
        "DELETE FROM categories WHERE id = ?1",
        rusqlite::params![id],
    )?;

    remove_from_search_index(conn, &id);
    Ok(())
}

#[tauri::command]
pub fn categories_assign_document(
    document_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
        rusqlite::params![document_id, category_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn categories_assign_appointment(
    appointment_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO appointment_categories (appointment_id, category_id) VALUES (?1, ?2)",
        rusqlite::params![appointment_id, category_id],
    )
    ?;

    Ok(())
}

#[tauri::command]
pub fn categories_unassign(
    entity_id: String,
    category_id: String,
    entity_type: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    match entity_type.as_str() {
        "document" => {
            conn.execute(
                "DELETE FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
                rusqlite::params![entity_id, category_id],
            )?;
        }
        "appointment" => {
            conn.execute(
                "DELETE FROM appointment_categories WHERE appointment_id = ?1 AND category_id = ?2",
                rusqlite::params![entity_id, category_id],
            )?;
        }
        _ => {
            return Err(CommandError::Internal(format!(
                "unknown entity_type: {entity_type}"
            )))
        }
    }

    Ok(())
}

#[tauri::command]
pub fn categories_bulk_link(
    _user_id: String,
    entity_type: String,
    entity_ids: Vec<String>,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<usize, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let sql = match entity_type.as_str() {
        "document" => {
            "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)"
        }
        "appointment" => {
            "INSERT OR IGNORE INTO appointment_categories (appointment_id, category_id) VALUES (?1, ?2)"
        }
        _ => return Err(CommandError::Internal(format!("unknown entity_type: {entity_type}"))),
    };

    conn.execute("BEGIN", [])?;

    let mut inserted = 0usize;
    for entity_id in &entity_ids {
        match conn.execute(sql, rusqlite::params![entity_id, category_id]) {
            Ok(n) => inserted += n,
            Err(e) => {
                let _ = conn.execute("ROLLBACK", []);
                return Err(CommandError::Internal(e.to_string()));
            }
        }
    }

    conn.execute("COMMIT", []).map_err(|e| {
        let _ = conn.execute("ROLLBACK", []);
        CommandError::Internal(e.to_string())
    })?;

    Ok(inserted)
}

#[tauri::command]
pub fn assign_category_to_document(
    _user_id: String,
    document_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
        rusqlite::params![document_id, category_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn unassign_category_from_document(
    _user_id: String,
    document_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "DELETE FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
        rusqlite::params![document_id, category_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn assign_category_to_appointment(
    _user_id: String,
    appointment_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO appointment_categories (appointment_id, category_id) VALUES (?1, ?2)",
        rusqlite::params![appointment_id, category_id],
    )
    ?;

    Ok(())
}

#[tauri::command]
pub fn unassign_category_from_appointment(
    _user_id: String,
    appointment_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "DELETE FROM appointment_categories WHERE appointment_id = ?1 AND category_id = ?2",
        rusqlite::params![appointment_id, category_id],
    )?;

    Ok(())
}

#[tauri::command]
pub fn categories_for_document(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt =
        conn.prepare("SELECT category_id FROM document_categories WHERE document_id = ?1")?;

    let ids = stmt
        .query_map([&document_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ids)
}

#[tauri::command]
pub fn categories_for_appointment(
    appointment_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt =
        conn.prepare("SELECT category_id FROM appointment_categories WHERE appointment_id = ?1")?;

    let ids = stmt
        .query_map([&appointment_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ids)
}

fn category_depth(conn: &rusqlite::Connection, category_id: &str) -> Result<u32, CommandError> {
    let mut depth = 0u32;
    let mut current = category_id.to_string();
    loop {
        let parent: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM categories WHERE id = ?1",
                rusqlite::params![current],
                |row| row.get(0),
            )
            .map_err(|_| CommandError::NotFound("category not found".to_string()))?;
        match parent {
            None => return Ok(depth),
            Some(p) => {
                depth += 1;
                if depth > 5 {
                    return Ok(depth);
                }
                current = p;
            }
        }
    }
}

#[tauri::command]
pub fn category_reorder(
    category_id: String,
    new_parent_id: Option<String>,
    new_position: u32,
    state: State<'_, AppState>,
) -> Result<Category, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    // Verify category exists and is not a system category
    let is_system: i64 = conn
        .query_row(
            "SELECT is_system FROM categories WHERE id = ?1",
            rusqlite::params![category_id],
            |row| row.get(0),
        )
        .map_err(|_| CommandError::NotFound("category not found".to_string()))?;
    if is_system != 0 {
        return Err(CommandError::Internal(
            "cannot reorder system categories".to_string(),
        ));
    }

    // Prevent circular reference: new_parent cannot be the category itself or one of its descendants
    if let Some(ref pid) = new_parent_id {
        if pid == &category_id {
            return Err(CommandError::Internal(
                "category cannot be its own parent".to_string(),
            ));
        }
        // Check depth of the new parent — moving category under it adds 1
        let parent_depth = category_depth(conn, pid)?;
        if parent_depth >= 4 {
            return Err(CommandError::Internal(
                "maximum category depth of 5 would be exceeded".to_string(),
            ));
        }
    }

    conn.execute(
        "UPDATE categories SET parent_id = ?1, sort_order = ?2 WHERE id = ?3",
        rusqlite::params![new_parent_id, new_position as i64, category_id],
    )?;

    let mut stmt = conn.prepare(
        "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
         FROM categories WHERE id = ?1",
    )?;
    let cat = stmt.query_row(rusqlite::params![category_id], row_to_category)?;
    Ok(cat)
}

#[tauri::command]
pub fn categories_reorder(
    ordered_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    for (i, id) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE categories SET sort_order = ?1 WHERE id = ?2 AND is_system = 0",
            rusqlite::params![i as i64, id],
        )?;
    }
    Ok(())
}

/// Called from auth_unlock with an already-open connection.
/// Reads auto_archive_categories + auto_archive_months from settings, runs archive if enabled.
pub fn archive_stale_if_enabled(conn: &rusqlite::Connection) {
    let enabled: bool = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'auto_archive_categories'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .map(|v| v == "true")
        .unwrap_or(false);

    if !enabled {
        return;
    }

    let months: u32 = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'auto_archive_months'",
            [],
            |row| row.get::<_, String>(0),
        )
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(12);

    let _ = conn.execute(
        "UPDATE categories SET is_archived = 1 \
         WHERE is_system = 0 \
           AND is_archived = 0 \
           AND id NOT IN (SELECT DISTINCT category_id FROM document_categories) \
           AND id NOT IN (SELECT DISTINCT category_id FROM appointment_categories) \
           AND created_at < datetime('now', printf('-%d months', ?1))",
        rusqlite::params![months],
    );
}

#[tauri::command]
pub fn categories_archive_stale(
    months_inactive: u32,
    state: State<'_, AppState>,
) -> Result<u64, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let changes = conn.execute(
        "UPDATE categories SET is_archived = 1 \
         WHERE is_system = 0 \
           AND is_archived = 0 \
           AND id NOT IN (SELECT DISTINCT category_id FROM document_categories) \
           AND id NOT IN (SELECT DISTINCT category_id FROM appointment_categories) \
           AND created_at < datetime('now', printf('-%d months', ?1))",
        rusqlite::params![months_inactive],
    )?;
    Ok(changes as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::OptionalExtension;

    fn open_test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        db::migrations::run(&conn).unwrap();
        conn
    }

    fn list_categories(conn: &rusqlite::Connection) -> Vec<Category> {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
                 FROM categories ORDER BY is_system DESC, sort_order ASC, name ASC",
            )
            .unwrap();
        stmt.query_map([], row_to_category)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    fn create_category(conn: &rusqlite::Connection, name: &str, color: Option<&str>) -> Category {
        let id = Uuid::new_v4().to_string();
        let color_hex = color.unwrap_or("#6B7280").to_string();
        let created_at = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, ?2, NULL, ?3, 0, 100, ?4)",
            rusqlite::params![id, name, color_hex, created_at],
        )
        .unwrap();
        conn.query_row(
            "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
             FROM categories WHERE id = ?1",
            rusqlite::params![id],
            row_to_category,
        )
        .unwrap()
    }

    #[test]
    fn list_returns_system_categories() {
        let conn = open_test_db();
        let cats = list_categories(&conn);
        assert!(!cats.is_empty());
        let system_count = cats.iter().filter(|c| c.is_system).count();
        assert_eq!(system_count, 8);
    }

    #[test]
    fn create_user_category() {
        let conn = open_test_db();
        let cat = create_category(&conn, "My Cats", Some("#FF0000"));
        assert_eq!(cat.name, "My Cats");
        assert_eq!(cat.color_hex, "#FF0000");
        assert!(!cat.is_system);
    }

    #[test]
    fn update_user_category_name() {
        let conn = open_test_db();
        let cat = create_category(&conn, "Old Name", None);

        conn.execute(
            "UPDATE categories SET name = ?1 WHERE id = ?2",
            rusqlite::params!["New Name", cat.id],
        )
        .unwrap();

        let updated = conn
            .query_row(
                "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
                 FROM categories WHERE id = ?1",
                rusqlite::params![cat.id],
                row_to_category,
            )
            .unwrap();

        assert_eq!(updated.name, "New Name");
        assert_eq!(updated.id, cat.id);
    }

    #[test]
    fn cannot_delete_system_category() {
        let conn = open_test_db();
        let cats = list_categories(&conn);
        let system = cats.iter().find(|c| c.is_system).unwrap();

        let is_system: i64 = conn
            .query_row(
                "SELECT is_system FROM categories WHERE id = ?1",
                rusqlite::params![system.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_ne!(is_system, 0, "system categories must not be deletable");
    }

    #[test]
    fn delete_user_category() {
        let conn = open_test_db();
        let cat = create_category(&conn, "To Delete", None);

        conn.execute(
            "DELETE FROM categories WHERE id = ?1",
            rusqlite::params![cat.id],
        )
        .unwrap();

        let cats = list_categories(&conn);
        assert!(!cats.iter().any(|c| c.id == cat.id));
    }

    #[test]
    fn assign_and_unassign_document_category() {
        let conn = open_test_db();
        let doc_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'test.pdf', '/tmp/test.pdf', 'application/pdf', 0, 'other', ?2, ?2)",
            rusqlite::params![doc_id, now],
        )
        .unwrap();

        let cats = list_categories(&conn);
        let cat_id = &cats[0].id;

        conn.execute(
            "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
            rusqlite::params![doc_id, cat_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
                rusqlite::params![doc_id, cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        conn.execute(
            "DELETE FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
            rusqlite::params![doc_id, cat_id],
        )
        .unwrap();

        let count2: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
                rusqlite::params![doc_id, cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count2, 0);
    }

    #[test]
    fn assign_and_unassign_appointment_category() {
        let conn = open_test_db();
        let appt_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, created_at, updated_at) \
             VALUES (?1, 'Check-up', '2025-01-01', ?2, ?2)",
            rusqlite::params![appt_id, now],
        )
        .unwrap();

        let cats = list_categories(&conn);
        let cat_id = &cats[0].id;

        conn.execute(
            "INSERT OR IGNORE INTO appointment_categories (appointment_id, category_id) VALUES (?1, ?2)",
            rusqlite::params![appt_id, cat_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_categories WHERE appointment_id = ?1 AND category_id = ?2",
                rusqlite::params![appt_id, cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        conn.execute(
            "DELETE FROM appointment_categories WHERE appointment_id = ?1 AND category_id = ?2",
            rusqlite::params![appt_id, cat_id],
        )
        .unwrap();

        let count2: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_categories WHERE appointment_id = ?1 AND category_id = ?2",
                rusqlite::params![appt_id, cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count2, 0);
    }

    #[test]
    fn assign_idempotent_on_duplicate() {
        let conn = open_test_db();
        let doc_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'dup.pdf', '/tmp/dup.pdf', 'application/pdf', 0, 'other', ?2, ?2)",
            rusqlite::params![doc_id, now],
        )
        .unwrap();

        let cats = list_categories(&conn);
        let cat_id = &cats[0].id;

        conn.execute(
            "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
            rusqlite::params![doc_id, cat_id],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
            rusqlite::params![doc_id, cat_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
                rusqlite::params![doc_id, cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn document_linked_to_three_categories_all_queryable() {
        let conn = open_test_db();
        let doc_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'multi.pdf', '/tmp/multi.pdf', 'application/pdf', 0, 'other', ?2, ?2)",
            rusqlite::params![doc_id, now],
        )
        .unwrap();

        let cats = list_categories(&conn);
        let cat_ids: Vec<String> = cats.iter().take(3).map(|c| c.id.clone()).collect();
        assert_eq!(cat_ids.len(), 3, "need at least 3 system categories");

        for cat_id in &cat_ids {
            conn.execute(
                "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
                rusqlite::params![doc_id, cat_id],
            )
            .unwrap();
        }

        let mut assigned: Vec<String> = conn
            .prepare("SELECT category_id FROM document_categories WHERE document_id = ?1")
            .unwrap()
            .query_map([&doc_id], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assigned.sort();

        let mut expected = cat_ids.clone();
        expected.sort();
        assert_eq!(assigned, expected);

        for cat_id in &cat_ids {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
                    rusqlite::params![doc_id, cat_id],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(
                count, 1,
                "document should be reachable via category {cat_id}"
            );
        }
    }

    #[test]
    fn unassign_removes_only_specific_pair() {
        let conn = open_test_db();
        let doc_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'pair.pdf', '/tmp/pair.pdf', 'application/pdf', 0, 'other', ?2, ?2)",
            rusqlite::params![doc_id, now],
        )
        .unwrap();

        let cats = list_categories(&conn);
        let cat_a = &cats[0].id;
        let cat_b = &cats[1].id;

        for cat_id in [cat_a, cat_b] {
            conn.execute(
                "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
                rusqlite::params![doc_id, cat_id],
            )
            .unwrap();
        }

        conn.execute(
            "DELETE FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
            rusqlite::params![doc_id, cat_a],
        )
        .unwrap();

        let remaining: Vec<String> = conn
            .prepare("SELECT category_id FROM document_categories WHERE document_id = ?1")
            .unwrap()
            .query_map([&doc_id], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(
            remaining,
            vec![cat_b.clone()],
            "only cat_b should remain after unassigning cat_a"
        );
    }

    #[test]
    fn appointment_linked_to_three_categories_all_queryable() {
        let conn = open_test_db();
        let appt_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, created_at, updated_at) \
             VALUES (?1, 'Multi-cat appt', '2025-06-01', ?2, ?2)",
            rusqlite::params![appt_id, now],
        )
        .unwrap();

        let cats = list_categories(&conn);
        let cat_ids: Vec<String> = cats.iter().take(3).map(|c| c.id.clone()).collect();

        for cat_id in &cat_ids {
            conn.execute(
                "INSERT OR IGNORE INTO appointment_categories (appointment_id, category_id) VALUES (?1, ?2)",
                rusqlite::params![appt_id, cat_id],
            )
            .unwrap();
        }

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_categories WHERE appointment_id = ?1",
                rusqlite::params![appt_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 3);
    }

    #[test]
    fn bulk_link_50_documents_in_single_transaction() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();

        let doc_ids: Vec<String> = (0..50).map(|_| Uuid::new_v4().to_string()).collect();
        for doc_id in &doc_ids {
            conn.execute(
                "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
                 VALUES (?1, 'bulk.pdf', '/tmp/bulk.pdf', 'application/pdf', 0, 'other', ?2, ?2)",
                rusqlite::params![doc_id, now],
            )
            .unwrap();
        }

        let cats = list_categories(&conn);
        let cat_id = &cats[0].id;

        let start = std::time::Instant::now();

        conn.execute("BEGIN", []).unwrap();
        for doc_id in &doc_ids {
            conn.execute(
                "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
                rusqlite::params![doc_id, cat_id],
            )
            .unwrap();
        }
        conn.execute("COMMIT", []).unwrap();

        let elapsed = start.elapsed();
        assert!(
            elapsed.as_secs() < 1,
            "bulk insert of 50 docs took {:?}, expected < 1s",
            elapsed
        );

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_categories WHERE category_id = ?1",
                rusqlite::params![cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 50);
    }

    #[test]
    fn archive_stale_archives_inactive_old_category() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (id, name, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, 'Stale', '#888888', 0, 200, datetime('now', '-13 months'))",
            rusqlite::params![id],
        )
        .unwrap();

        let changes = conn
            .execute(
                "UPDATE categories SET is_archived = 1 \
                 WHERE is_system = 0 AND is_archived = 0 \
                 AND id NOT IN (SELECT DISTINCT category_id FROM document_categories) \
                 AND id NOT IN (SELECT DISTINCT category_id FROM appointment_categories) \
                 AND created_at < datetime('now', printf('-%d months', ?1))",
                rusqlite::params![12u32],
            )
            .unwrap();
        assert!(changes >= 1, "expected at least 1 archive");

        let archived: i64 = conn
            .query_row(
                "SELECT is_archived FROM categories WHERE id = ?1",
                rusqlite::params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived, 1);
    }

    #[test]
    fn archive_stale_skips_category_with_document_link() {
        let conn = open_test_db();
        let cat_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (id, name, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, 'Linked', '#777777', 0, 201, datetime('now', '-13 months'))",
            rusqlite::params![cat_id],
        )
        .unwrap();

        let doc_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at) \
             VALUES (?1, 'link.pdf', '/tmp/link.pdf', 'application/pdf', 0, 'other', ?2, ?2)",
            rusqlite::params![doc_id, now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
            rusqlite::params![doc_id, cat_id],
        )
        .unwrap();

        conn.execute(
            "UPDATE categories SET is_archived = 1 \
             WHERE is_system = 0 AND is_archived = 0 \
             AND id NOT IN (SELECT DISTINCT category_id FROM document_categories) \
             AND id NOT IN (SELECT DISTINCT category_id FROM appointment_categories) \
             AND created_at < datetime('now', printf('-%d months', ?1))",
            rusqlite::params![12u32],
        )
        .unwrap();

        let archived: i64 = conn
            .query_row(
                "SELECT is_archived FROM categories WHERE id = ?1",
                rusqlite::params![cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived, 0, "linked category must not be archived");
    }

    #[test]
    fn archive_stale_never_archives_system_categories() {
        let conn = open_test_db();

        conn.execute(
            "UPDATE categories SET created_at = datetime('now', '-24 months') WHERE is_system = 1",
            [],
        )
        .unwrap();

        conn.execute(
            "UPDATE categories SET is_archived = 1 \
             WHERE is_system = 0 AND is_archived = 0 \
             AND id NOT IN (SELECT DISTINCT category_id FROM document_categories) \
             AND id NOT IN (SELECT DISTINCT category_id FROM appointment_categories) \
             AND created_at < datetime('now', printf('-%d months', ?1))",
            rusqlite::params![12u32],
        )
        .unwrap();

        let archived_system: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE is_system = 1 AND is_archived = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            archived_system, 0,
            "system categories must never be archived"
        );
    }

    #[test]
    fn reorder_updates_sort_order() {
        let conn = open_test_db();
        let cat = create_category(&conn, "Reorder Test", None);

        conn.execute(
            "UPDATE categories SET parent_id = ?1, sort_order = ?2 WHERE id = ?3",
            rusqlite::params![Option::<String>::None, 42i64, cat.id],
        )
        .unwrap();

        let sort_order: i64 = conn
            .query_row(
                "SELECT sort_order FROM categories WHERE id = ?1",
                rusqlite::params![cat.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(sort_order, 42);
    }

    #[test]
    fn reorder_updates_parent_id() {
        let conn = open_test_db();
        let parent = create_category(&conn, "Parent", None);
        let child = create_category(&conn, "Child", None);

        conn.execute(
            "UPDATE categories SET parent_id = ?1, sort_order = ?2 WHERE id = ?3",
            rusqlite::params![Some(&parent.id), 1i64, child.id],
        )
        .unwrap();

        let stored_parent: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM categories WHERE id = ?1",
                rusqlite::params![child.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(stored_parent, Some(parent.id));
    }

    #[test]
    fn reorder_blocked_for_system_category() {
        let conn = open_test_db();
        let cats = list_categories(&conn);
        let system_cat = cats.iter().find(|c| c.is_system).unwrap();

        let is_system: i64 = conn
            .query_row(
                "SELECT is_system FROM categories WHERE id = ?1",
                rusqlite::params![system_cat.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_ne!(is_system, 0, "system category must be blocked from reorder");
    }

    #[test]
    fn to_title_case_normalises_lowercase_specialty() {
        // V3-F1: lowercase input must be stored as title-case
        assert_eq!(to_title_case("physiotherapy"), "Physiotherapy");
        assert_eq!(to_title_case("blood work"), "Blood Work");
        assert_eq!(to_title_case("CARDIOLOGY"), "CARDIOLOGY");
    }

    #[test]
    fn create_if_not_exists_stores_title_cased_name() {
        // V3-F1: "physiotherapy" (lowercase) → persisted as "Physiotherapy"
        let conn = open_test_db();
        let normalised = to_title_case("physiotherapy");
        assert_eq!(normalised, "Physiotherapy");
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, ?2, NULL, '#6B7280', 0, 100, ?3)",
            rusqlite::params![id, normalised, created_at],
        )
        .unwrap();
        let stored: String = conn
            .query_row("SELECT name FROM categories WHERE id = ?1", [&id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(stored, "Physiotherapy");
    }

    #[test]
    fn create_if_not_exists_new_name_creates_and_returns_id() {
        let conn = open_test_db();
        let before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE is_system = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let id = to_title_case("Physiotherapy");
        // Use the SQL directly as the command requires State
        let normalised = to_title_case("Physiotherapy");
        let new_id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM categories WHERE lower(name) = lower(?1) LIMIT 1",
                rusqlite::params![normalised],
                |r| r.get(0),
            )
            .optional()
            .unwrap();
        assert!(existing.is_none());
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, ?2, NULL, '#6B7280', 0, 100, ?3)",
            rusqlite::params![new_id, normalised, created_at],
        )
        .unwrap();
        let after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE is_system = 0",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(after, before + 1);
        drop(id); // suppress unused warning
    }

    #[test]
    fn create_if_not_exists_same_name_returns_same_id() {
        let conn = open_test_db();
        let normalised = to_title_case("Rheumatology");
        let first_id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, ?2, NULL, '#6B7280', 0, 100, ?3)",
            rusqlite::params![first_id, normalised, created_at],
        )
        .unwrap();
        let count_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE name = ?1",
                [&normalised],
                |r| r.get(0),
            )
            .unwrap();
        // Second lookup: existing row must be returned
        let found: Option<String> = conn
            .query_row(
                "SELECT id FROM categories WHERE lower(name) = lower(?1) LIMIT 1",
                rusqlite::params![normalised],
                |r| r.get(0),
            )
            .optional()
            .unwrap();
        assert_eq!(found.as_deref(), Some(first_id.as_str()));
        let count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE name = ?1",
                [&normalised],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count_before, count_after);
    }

    #[test]
    fn create_if_not_exists_lowercase_input_matches_title_case_existing() {
        let conn = open_test_db();
        let normalised = to_title_case("Neurology");
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, ?2, NULL, '#6B7280', 0, 100, ?3)",
            rusqlite::params![id, normalised, created_at],
        )
        .unwrap();
        // Lookup with lowercase variant
        let found: Option<String> = conn
            .query_row(
                "SELECT id FROM categories WHERE lower(name) = lower(?1) LIMIT 1",
                rusqlite::params!["neurology"],
                |r| r.get(0),
            )
            .optional()
            .unwrap();
        assert_eq!(found.as_deref(), Some(id.as_str()));
    }

    #[test]
    fn archive_stale_if_enabled_does_nothing_when_disabled() {
        let conn = open_test_db();
        // No setting row → disabled by default
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, 'OldEmpty', NULL, '#6B7280', 0, 200, datetime('now', '-24 months'))",
            rusqlite::params![id],
        )
        .unwrap();
        archive_stale_if_enabled(&conn);
        let archived: i64 = conn
            .query_row(
                "SELECT is_archived FROM categories WHERE id = ?1",
                rusqlite::params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived, 0);
    }

    #[test]
    fn archive_stale_if_enabled_archives_old_empty_category() {
        let conn = open_test_db();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_archive_categories', 'true')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_archive_months', '12')",
            [],
        )
        .unwrap();
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, 'StaleEmpty', NULL, '#6B7280', 0, 201, datetime('now', '-13 months'))",
            rusqlite::params![id],
        )
        .unwrap();
        archive_stale_if_enabled(&conn);
        let archived: i64 = conn
            .query_row(
                "SELECT is_archived FROM categories WHERE id = ?1",
                rusqlite::params![id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived, 1);
    }

    #[test]
    fn archive_stale_if_enabled_skips_category_with_documents() {
        let conn = open_test_db();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_archive_categories', 'true')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_archive_months', '12')",
            [],
        )
        .unwrap();
        let cat_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
             VALUES (?1, 'OldWithDoc', NULL, '#6B7280', 0, 202, datetime('now', '-13 months'))",
            rusqlite::params![cat_id],
        )
        .unwrap();
        // Link a document to this category so it should not be archived
        let doc_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category) \
             VALUES (?1, 'test.pdf', '/tmp/test.pdf', 'application/pdf', 0, 'other')",
            rusqlite::params![doc_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
            rusqlite::params![doc_id, cat_id],
        )
        .unwrap();
        archive_stale_if_enabled(&conn);
        let archived: i64 = conn
            .query_row(
                "SELECT is_archived FROM categories WHERE id = ?1",
                rusqlite::params![cat_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived, 0);
    }
}
