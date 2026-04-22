use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::search::{remove_from_search_index, upsert_search_index};
use crate::commands::AppState;
use crate::parsing::filename::parse_filename;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Document {
    pub id: String,
    pub filename: String,
    pub file_path: String,
    pub mime_type: String,
    pub file_size_bytes: i64,
    pub category: String,
    pub thumbnail_path: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: bool,
    pub document_date: Option<String>,
    pub extracted_metadata: Option<String>,
    pub tags: Vec<String>,
}

const VALID_CATEGORIES: &[&str] = &[
    "diagnosis",
    "lab",
    "imaging",
    "prescription",
    "letter",
    "other",
];

fn storage_dir() -> Result<PathBuf, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "cannot determine home directory".to_string())?;
    Ok(PathBuf::from(home)
        .join(".myHealth")
        .join("files")
        .join("documents"))
}

fn mime_from_ext(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "pdf" => "application/pdf",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "tiff" | "tif" => "image/tiff",
        "heic" | "heif" => "image/heic",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "txt" => "text/plain",
        _ => "application/octet-stream",
    }
}

fn validate_category(cat: &str) -> Result<(), String> {
    if VALID_CATEGORIES.contains(&cat) {
        Ok(())
    } else {
        Err(format!(
            "invalid category '{cat}'; expected one of: {VALID_CATEGORIES:?}"
        ))
    }
}

fn fetch_tags(conn: &rusqlite::Connection, doc_id: &str) -> Vec<String> {
    conn.prepare("SELECT tag FROM document_tags WHERE document_id = ? ORDER BY tag")
        .ok()
        .and_then(|mut stmt| {
            stmt.query_map([doc_id], |row| row.get::<_, String>(0))
                .ok()
                .map(|rows| rows.filter_map(|r| r.ok()).collect())
        })
        .unwrap_or_default()
}

fn load_doc(conn: &rusqlite::Connection, id: &str) -> Result<Document, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, filename, file_path, mime_type, file_size_bytes, category, \
             thumbnail_path, notes, created_at, updated_at, is_deleted, \
             document_date, extracted_metadata \
             FROM documents WHERE id = ?",
        )
        .map_err(|e| e.to_string())?;
    let mut doc = stmt
        .query_row([id], |row| {
            Ok(Document {
                id: row.get(0)?,
                filename: row.get(1)?,
                file_path: row.get(2)?,
                mime_type: row.get(3)?,
                file_size_bytes: row.get(4)?,
                category: row.get(5)?,
                thumbnail_path: row.get(6)?,
                notes: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
                is_deleted: row.get::<_, i64>(10)? != 0,
                document_date: row.get(11)?,
                extracted_metadata: row.get(12)?,
                tags: vec![],
            })
        })
        .map_err(|e| e.to_string())?;
    doc.tags = fetch_tags(conn, id);
    Ok(doc)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn documents_list(
    state: State<'_, AppState>,
    category: Option<String>,
    page: u32,
    limit: u32,
) -> Result<Vec<Document>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    let offset = page.saturating_sub(1) * limit;

    let ids: Vec<String> = match &category {
        Some(cat) => {
            validate_category(cat)?;
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM documents WHERE is_deleted = 0 AND category = ? \
                     ORDER BY created_at DESC LIMIT ? OFFSET ?",
                )
                .map_err(|e| e.to_string())?;
            let ids: Vec<String> = stmt
                .query_map(rusqlite::params![cat, limit, offset], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            ids
        }
        None => {
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM documents WHERE is_deleted = 0 \
                     ORDER BY created_at DESC LIMIT ? OFFSET ?",
                )
                .map_err(|e| e.to_string())?;
            let ids: Vec<String> = stmt
                .query_map(rusqlite::params![limit, offset], |row| row.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            ids
        }
    };

    ids.iter().map(|id| load_doc(conn, id)).collect()
}

#[tauri::command]
pub fn documents_get(state: State<'_, AppState>, id: String) -> Result<Document, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    load_doc(conn, &id)
}

#[tauri::command]
pub fn documents_upload(
    state: State<'_, AppState>,
    file_path: String,
    category: String,
    notes: Option<String>,
) -> Result<Document, String> {
    validate_category(&category)?;
    let src = std::path::Path::new(&file_path);
    if !src.exists() {
        return Err(format!("file not found: {file_path}"));
    }

    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let filename = src
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("document")
        .to_string();
    let mime = mime_from_ext(&ext).to_string();
    let file_size = fs::metadata(src).map_err(|e| e.to_string())?.len() as i64;

    // Parse filename stem for date and tags.
    let stem = src
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&filename);
    let parsed = parse_filename(stem);
    let document_date: Option<String> = parsed
        .document_date
        .map(|d| d.format("%Y-%m-%d").to_string());

    let id = Uuid::new_v4().to_string();
    let dest_dir = storage_dir()?.join(&id);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let dest_filename = if ext.is_empty() {
        "original".to_string()
    } else {
        format!("original.{ext}")
    };
    let dest_path = dest_dir.join(&dest_filename);
    fs::copy(src, &dest_path).map_err(|e| e.to_string())?;
    let dest_str = dest_path
        .to_str()
        .ok_or("invalid path encoding")?
        .to_string();

    // TODO: generate 200×200 thumbnail for image/* types (requires `image` crate)
    let thumbnail_path: Option<String> = None;

    let now = Utc::now().to_rfc3339();
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    conn.execute(
        "INSERT INTO documents \
         (id, filename, file_path, mime_type, file_size_bytes, category, \
          thumbnail_path, notes, document_date, created_at, updated_at, is_deleted) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, 0)",
        rusqlite::params![
            id,
            filename,
            dest_str,
            mime,
            file_size,
            category,
            thumbnail_path,
            notes,
            document_date,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Insert tags parsed from the filename.
    for tag in &parsed.tags {
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
            rusqlite::params![id, tag],
        )
        .map_err(|e| e.to_string())?;
    }

    let doc = load_doc(conn, &id)?;
    let body = doc.notes.as_deref().unwrap_or("").to_string();
    upsert_search_index(
        conn,
        "document",
        &doc.id,
        &doc.filename,
        &body,
        &doc.tags.join(","),
        "",
        "",
    );
    Ok(doc)
}

#[tauri::command]
pub fn documents_update(
    state: State<'_, AppState>,
    id: String,
    category: Option<String>,
    notes: Option<String>,
) -> Result<Document, String> {
    if let Some(ref cat) = category {
        validate_category(cat)?;
    }
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    let now = Utc::now().to_rfc3339();
    // COALESCE preserves the existing value when the argument is NULL
    conn.execute(
        "UPDATE documents \
         SET category   = COALESCE(?1, category), \
             notes      = COALESCE(?2, notes), \
             updated_at = ?3 \
         WHERE id = ?4 AND is_deleted = 0",
        rusqlite::params![category, notes, now, id],
    )
    .map_err(|e| e.to_string())?;
    let doc = load_doc(conn, &id)?;
    let body = doc.notes.as_deref().unwrap_or("").to_string();
    upsert_search_index(
        conn,
        "document",
        &doc.id,
        &doc.filename,
        &body,
        &doc.tags.join(","),
        "",
        "",
    );
    Ok(doc)
}

#[tauri::command]
pub fn documents_delete(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    let now = Utc::now().to_rfc3339();
    let affected = conn
        .execute(
            "UPDATE documents \
             SET is_deleted = 1, deleted_at = ?1, updated_at = ?1 \
             WHERE id = ?2 AND is_deleted = 0",
            rusqlite::params![now, id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("document not found or already deleted: {id}"));
    }
    remove_from_search_index(conn, &id);
    Ok(())
}

#[tauri::command]
pub fn documents_restore(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    let now = Utc::now().to_rfc3339();
    let affected = conn
        .execute(
            "UPDATE documents \
             SET is_deleted = 0, deleted_at = NULL, updated_at = ?1 \
             WHERE id = ?2 AND is_deleted = 1",
            rusqlite::params![now, id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err(format!("document not found or not deleted: {id}"));
    }
    if let Ok(doc) = load_doc(conn, &id) {
        let body = doc.notes.as_deref().unwrap_or("").to_string();
        upsert_search_index(
            conn,
            "document",
            &doc.id,
            &doc.filename,
            &body,
            &doc.tags.join(","),
            "",
            "",
        );
    }
    Ok(())
}

#[tauri::command]
pub fn documents_get_file_url(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    conn.query_row(
        "SELECT file_path FROM documents WHERE id = ? AND is_deleted = 0",
        [&id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn documents_tags_set(
    state: State<'_, AppState>,
    id: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE id = ? AND is_deleted = 0",
            [&id],
            |row| row.get::<_, i64>(0),
        )
        .map(|n| n > 0)
        .map_err(|e| e.to_string())?;
    if !exists {
        return Err(format!("document not found: {id}"));
    }

    conn.execute("DELETE FROM document_tags WHERE document_id = ?", [&id])
        .map_err(|e| e.to_string())?;

    for tag in &tags {
        let tag = tag.trim();
        if tag.is_empty() {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
            rusqlite::params![id, tag],
        )
        .map_err(|e| e.to_string())?;
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE documents SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| e.to_string())?;

    if let Ok(doc) = load_doc(conn, &id) {
        let body = doc.notes.as_deref().unwrap_or("").to_string();
        upsert_search_index(
            conn,
            "document",
            &doc.id,
            &doc.filename,
            &body,
            &doc.tags.join(","),
            "",
            "",
        );
    }

    Ok(())
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use chrono::Utc;
    use rusqlite::Connection;

    use super::*;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE documents (
                id              TEXT    PRIMARY KEY,
                filename        TEXT    NOT NULL,
                file_path       TEXT    NOT NULL,
                mime_type       TEXT    NOT NULL,
                file_size_bytes INTEGER NOT NULL,
                category        TEXT    NOT NULL,
                thumbnail_path  TEXT,
                notes           TEXT,
                created_at      DATETIME NOT NULL,
                updated_at      DATETIME NOT NULL,
                is_deleted      BOOLEAN  NOT NULL DEFAULT 0,
                deleted_at      DATETIME,
                document_date   TEXT,
                extracted_metadata TEXT
            );
            CREATE TABLE document_tags (
                document_id TEXT NOT NULL,
                tag         TEXT NOT NULL,
                PRIMARY KEY (document_id, tag)
            );",
        )
        .unwrap();
        conn
    }

    fn insert_doc(conn: &Connection, id: &str, category: &str, deleted: bool) {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              created_at, updated_at, is_deleted) \
             VALUES (?1, 'test.pdf', '/tmp/test.pdf', 'application/pdf', 1024, ?2, ?3, ?3, ?4)",
            rusqlite::params![id, category, now, deleted as i64],
        )
        .unwrap();
    }

    #[test]
    fn load_doc_returns_document() {
        let conn = test_conn();
        insert_doc(&conn, "id-1", "lab", false);
        let doc = load_doc(&conn, "id-1").unwrap();
        assert_eq!(doc.id, "id-1");
        assert_eq!(doc.category, "lab");
        assert!(!doc.is_deleted);
        assert!(doc.tags.is_empty());
    }

    #[test]
    fn load_doc_includes_tags() {
        let conn = test_conn();
        insert_doc(&conn, "id-2", "diagnosis", false);
        conn.execute(
            "INSERT INTO document_tags (document_id, tag) \
             VALUES ('id-2', 'blood'), ('id-2', 'annual')",
            [],
        )
        .unwrap();
        let doc = load_doc(&conn, "id-2").unwrap();
        assert_eq!(doc.tags, vec!["annual", "blood"]);
    }

    #[test]
    fn list_filters_deleted_documents() {
        let conn = test_conn();
        insert_doc(&conn, "active", "lab", false);
        insert_doc(&conn, "gone", "lab", true);

        let ids: Vec<String> = {
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM documents WHERE is_deleted = 0 \
                     ORDER BY created_at DESC LIMIT 10 OFFSET 0",
                )
                .unwrap();
            stmt.query_map([], |row| row.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };
        assert_eq!(ids, vec!["active"]);
    }

    #[test]
    fn soft_delete_marks_deleted() {
        let conn = test_conn();
        insert_doc(&conn, "doc-1", "other", false);
        let now = Utc::now().to_rfc3339();

        let affected = conn
            .execute(
                "UPDATE documents SET is_deleted = 1, deleted_at = ?1, updated_at = ?1 \
                 WHERE id = 'doc-1' AND is_deleted = 0",
                rusqlite::params![now],
            )
            .unwrap();
        assert_eq!(affected, 1);

        let doc = load_doc(&conn, "doc-1").unwrap();
        assert!(doc.is_deleted);
    }

    #[test]
    fn restore_clears_deleted_flag() {
        let conn = test_conn();
        insert_doc(&conn, "doc-2", "other", true);
        let now = Utc::now().to_rfc3339();

        let affected = conn
            .execute(
                "UPDATE documents SET is_deleted = 0, deleted_at = NULL, updated_at = ?1 \
                 WHERE id = 'doc-2' AND is_deleted = 1",
                rusqlite::params![now],
            )
            .unwrap();
        assert_eq!(affected, 1);

        let doc = load_doc(&conn, "doc-2").unwrap();
        assert!(!doc.is_deleted);
    }

    #[test]
    fn validate_category_accepts_all_valid() {
        for cat in VALID_CATEGORIES {
            assert!(validate_category(cat).is_ok(), "should accept {cat}");
        }
    }

    #[test]
    fn validate_category_rejects_unknown() {
        assert!(validate_category("xray").is_err());
        assert!(validate_category("").is_err());
    }

    #[test]
    fn tags_set_replaces_existing_tags() {
        let conn = test_conn();
        insert_doc(&conn, "doc-t", "lab", false);
        conn.execute(
            "INSERT INTO document_tags (document_id, tag) VALUES ('doc-t', 'old')",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM document_tags WHERE document_id = 'doc-t'", [])
            .unwrap();
        for tag in &["alpha", "beta"] {
            conn.execute(
                "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES ('doc-t', ?1)",
                rusqlite::params![tag],
            )
            .unwrap();
        }
        let tags = fetch_tags(&conn, "doc-t");
        assert_eq!(tags, vec!["alpha", "beta"]);
    }

    #[test]
    fn mime_from_ext_known_types() {
        assert_eq!(mime_from_ext("pdf"), "application/pdf");
        assert_eq!(mime_from_ext("PNG"), "image/png");
        assert_eq!(mime_from_ext("jpg"), "image/jpeg");
        assert_eq!(mime_from_ext("xyz"), "application/octet-stream");
    }

    #[test]
    fn document_date_roundtrip() {
        let conn = test_conn();
        insert_doc(&conn, "doc-date", "lab", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents SET document_date = '2024-12-01' WHERE id = 'doc-date'",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE documents SET updated_at = ?1 WHERE id = 'doc-date'",
            rusqlite::params![now],
        )
        .unwrap();
        let doc = load_doc(&conn, "doc-date").unwrap();
        assert_eq!(doc.document_date.as_deref(), Some("2024-12-01"));
    }

    #[test]
    fn extracted_metadata_none_by_default() {
        let conn = test_conn();
        insert_doc(&conn, "doc-meta", "lab", false);
        let doc = load_doc(&conn, "doc-meta").unwrap();
        assert!(doc.extracted_metadata.is_none());
        assert!(doc.document_date.is_none());
    }
}

#[derive(Debug, Serialize)]
pub struct ContactSuggestionDto {
    pub name: String,
    pub specialty: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExtractionSuggestions {
    pub doctor_candidates: Vec<String>,
    pub category_suggestion: Option<String>,
    pub document_tags: Vec<String>,
    pub contact_suggestions: Vec<ContactSuggestionDto>,
}

#[tauri::command]
pub fn documents_run_extraction(
    id: String,
    state: State<'_, AppState>,
) -> Result<ExtractionSuggestions, String> {
    let file_path: String = {
        let guard = state.db.lock().map_err(|e| e.to_string())?;
        let conn = guard.as_ref().ok_or("database not open")?;
        conn.query_row(
            "SELECT file_path FROM documents WHERE id = ?1 AND is_deleted = 0",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
    };

    let result = crate::extraction::extract(std::path::Path::new(&file_path));

    let contact_dtos: Vec<ContactSuggestionDto> = result
        .contact_suggestions
        .iter()
        .map(|c| ContactSuggestionDto {
            name: c.name.clone(),
            specialty: c.specialty.clone(),
            clinic: c.clinic.clone(),
            address: c.address.clone(),
            phone: c.phone.clone(),
            email: c.email.clone(),
        })
        .collect();

    let json = serde_json::json!({
        "text": result.text,
        "extracted_at": result.extracted_at,
        "doctor_candidates": result.doctor_candidates,
        "category_suggestion": result.category_suggestion,
        "document_tags": result.document_tags,
    })
    .to_string();

    {
        let guard = state.db.lock().map_err(|e| e.to_string())?;
        let conn = guard.as_ref().ok_or("database not open")?;
        conn.execute(
            "UPDATE documents SET extracted_metadata = ?1, updated_at = ?2 WHERE id = ?3",
            rusqlite::params![json, Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(ExtractionSuggestions {
        doctor_candidates: result.doctor_candidates,
        category_suggestion: result.category_suggestion,
        document_tags: result.document_tags,
        contact_suggestions: contact_dtos,
    })
}

#[derive(Debug, Serialize)]
pub struct ExtractionStatus {
    pub status: String, // "done" | "pending" | "failed"
    pub text_length: usize,
}

#[tauri::command]
pub fn documents_get_extraction_status(
    id: String,
    state: State<'_, crate::commands::AppState>,
) -> Result<ExtractionStatus, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let meta: Option<Option<String>> = conn
        .query_row(
            "SELECT extracted_metadata FROM documents WHERE id = ?1 AND is_deleted = 0",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match meta {
        None => Err(format!("document {} not found", id)),
        Some(None) => Ok(ExtractionStatus {
            status: "pending".into(),
            text_length: 0,
        }),
        Some(Some(json_str)) => {
            let text_length = serde_json::from_str::<serde_json::Value>(&json_str)
                .ok()
                .and_then(|v| v["text"].as_str().map(|s| s.len()))
                .unwrap_or(0);
            Ok(ExtractionStatus {
                status: if text_length > 0 {
                    "done".into()
                } else {
                    "failed".into()
                },
                text_length,
            })
        }
    }
}
