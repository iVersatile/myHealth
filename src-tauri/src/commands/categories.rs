use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::AppState;

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
pub fn categories_list(state: State<'_, AppState>) -> Result<Vec<Category>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
             FROM categories ORDER BY is_system DESC, sort_order ASC, name ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], row_to_category)
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn categories_create(
    input: CategoryCreateInput,
    state: State<'_, AppState>,
) -> Result<Category, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let id = Uuid::new_v4().to_string();
    let color_hex = input.color_hex.unwrap_or_else(|| "#6B7280".to_string());
    let sort_order = input.sort_order.unwrap_or(100);
    let created_at = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order, created_at) \
         VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)",
        rusqlite::params![id, input.name, input.parent_id, color_hex, sort_order, created_at],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
             FROM categories WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    stmt.query_row(rusqlite::params![id], row_to_category)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn categories_update(
    input: CategoryUpdateInput,
    state: State<'_, AppState>,
) -> Result<Category, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    if let Some(name) = &input.name {
        conn.execute(
            "UPDATE categories SET name = ?1 WHERE id = ?2",
            rusqlite::params![name, input.id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(color) = &input.color_hex {
        conn.execute(
            "UPDATE categories SET color_hex = ?1 WHERE id = ?2",
            rusqlite::params![color, input.id],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(order) = input.sort_order {
        conn.execute(
            "UPDATE categories SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![order, input.id],
        )
        .map_err(|e| e.to_string())?;
    }

    let mut stmt = conn
        .prepare(
            "SELECT id, name, parent_id, color_hex, is_system, sort_order, created_at \
             FROM categories WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    stmt.query_row(rusqlite::params![input.id], row_to_category)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn categories_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let is_system: i64 = conn
        .query_row(
            "SELECT is_system FROM categories WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "category not found".to_string())?;

    if is_system != 0 {
        return Err("cannot delete system categories".to_string());
    }

    conn.execute(
        "DELETE FROM categories WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn categories_assign_document(
    document_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    conn.execute(
        "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
        rusqlite::params![document_id, category_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn categories_assign_appointment(
    appointment_id: String,
    category_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    conn.execute(
        "INSERT OR IGNORE INTO appointment_categories (appointment_id, category_id) VALUES (?1, ?2)",
        rusqlite::params![appointment_id, category_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn categories_unassign(
    entity_id: String,
    category_id: String,
    entity_type: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    match entity_type.as_str() {
        "document" => {
            conn.execute(
                "DELETE FROM document_categories WHERE document_id = ?1 AND category_id = ?2",
                rusqlite::params![entity_id, category_id],
            )
            .map_err(|e| e.to_string())?;
        }
        "appointment" => {
            conn.execute(
                "DELETE FROM appointment_categories WHERE appointment_id = ?1 AND category_id = ?2",
                rusqlite::params![entity_id, category_id],
            )
            .map_err(|e| e.to_string())?;
        }
        _ => return Err(format!("unknown entity_type: {entity_type}")),
    }

    Ok(())
}

#[tauri::command]
pub fn categories_for_document(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT category_id FROM document_categories WHERE document_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([&document_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ids)
}

#[tauri::command]
pub fn categories_for_appointment(
    appointment_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let mut stmt = conn
        .prepare(
            "SELECT category_id FROM appointment_categories WHERE appointment_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let ids = stmt
        .query_map([&appointment_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(ids)
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
}
