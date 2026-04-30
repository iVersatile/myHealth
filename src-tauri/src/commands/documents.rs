use std::fs;
use std::path::PathBuf;

use chrono::Utc;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::commands::search::{remove_from_search_index, upsert_search_index};
use crate::commands::{AppState, CommandContext};
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
    pub activity_date: Option<String>,
    pub extracted_metadata: Option<String>,
    pub extracted_text: Option<String>,
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

fn storage_dir() -> Result<PathBuf, CommandError> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| CommandError::Internal("cannot determine home directory".to_string()))?;
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

fn validate_category(cat: &str) -> Result<(), CommandError> {
    if VALID_CATEGORIES.contains(&cat) {
        Ok(())
    } else {
        Err(CommandError::Internal(format!(
            "invalid category '{cat}'; expected one of: {VALID_CATEGORIES:?}"
        )))
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

fn load_doc(conn: &rusqlite::Connection, id: &str) -> Result<Document, CommandError> {
    let mut stmt = conn.prepare(
        "SELECT id, filename, file_path, mime_type, file_size_bytes, category, \
             thumbnail_path, notes, created_at, updated_at, is_deleted, \
             document_date, activity_date, extracted_metadata, extracted_text \
             FROM documents WHERE id = ?",
    )?;
    let mut doc = stmt.query_row([id], |row| {
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
            activity_date: row.get(12)?,
            extracted_metadata: row.get(13)?,
            extracted_text: row.get(14)?,
            tags: vec![],
        })
    })?;
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
) -> Result<Vec<Document>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let offset = page.saturating_sub(1) * limit;

    let ids: Vec<String> = match &category {
        Some(cat) => {
            validate_category(cat)?;
            let mut stmt = conn.prepare(
                "SELECT id FROM documents WHERE is_deleted = 0 AND category = ? \
                     ORDER BY created_at DESC LIMIT ? OFFSET ?",
            )?;
            let ids: Vec<String> = stmt
                .query_map(rusqlite::params![cat, limit, offset], |row| row.get(0))?
                .filter_map(|r| r.ok())
                .collect();
            ids
        }
        None => {
            let mut stmt = conn.prepare(
                "SELECT id FROM documents WHERE is_deleted = 0 \
                     ORDER BY created_at DESC LIMIT ? OFFSET ?",
            )?;
            let ids: Vec<String> = stmt
                .query_map(rusqlite::params![limit, offset], |row| row.get(0))?
                .filter_map(|r| r.ok())
                .collect();
            ids
        }
    };

    ids.iter().map(|id| load_doc(conn, id)).collect()
}

#[tauri::command]
pub fn documents_get(state: State<'_, AppState>, id: String) -> Result<Document, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    load_doc(conn, &id)
}

#[tauri::command]
pub fn documents_upload(
    state: State<'_, AppState>,
    file_path: String,
    category: String,
    notes: Option<String>,
) -> Result<Document, CommandError> {
    validate_category(&category)?;
    let src = std::path::Path::new(&file_path);
    if !src.exists() {
        return Err(CommandError::Internal(format!(
            "file not found: {file_path}"
        )));
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
    let file_size = fs::metadata(src)
        .map_err(|e| CommandError::Internal(e.to_string()))?
        .len() as i64;

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
    fs::create_dir_all(&dest_dir).map_err(|e| CommandError::Internal(e.to_string()))?;

    let dest_filename = if ext.is_empty() {
        "original".to_string()
    } else {
        format!("original.{ext}")
    };
    let dest_path = dest_dir.join(&dest_filename);
    fs::copy(src, &dest_path).map_err(|e| CommandError::Internal(e.to_string()))?;
    let dest_str = dest_path
        .to_str()
        .ok_or(CommandError::Internal("invalid path encoding".to_string()))?
        .to_string();

    // TODO: generate 200×200 thumbnail for image/* types (requires `image` crate)
    let thumbnail_path: Option<String> = None;

    let now = Utc::now().to_rfc3339();
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
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
    )?;

    // Insert tags parsed from the filename.
    for tag in &parsed.tags {
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
            rusqlite::params![id, tag],
        )?;
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
    activity_date: Option<String>,
) -> Result<Document, CommandError> {
    if let Some(ref cat) = category {
        validate_category(cat)?;
    }
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let now = Utc::now().to_rfc3339();
    // COALESCE preserves the existing value when the argument is NULL
    conn.execute(
        "UPDATE documents \
         SET category      = COALESCE(?1, category), \
             notes         = COALESCE(?2, notes), \
             activity_date = COALESCE(?3, activity_date), \
             updated_at    = ?4 \
         WHERE id = ?5 AND is_deleted = 0",
        rusqlite::params![category, notes, activity_date, now, id],
    )?;
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
pub fn documents_delete(state: State<'_, AppState>, id: String) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let now = Utc::now().to_rfc3339();
    let affected = conn.execute(
        "UPDATE documents \
             SET is_deleted = 1, deleted_at = ?1, updated_at = ?1 \
             WHERE id = ?2 AND is_deleted = 0",
        rusqlite::params![now, id],
    )?;
    if affected == 0 {
        return Err(CommandError::NotFound(format!(
            "document not found or already deleted: {id}"
        )));
    }
    remove_from_search_index(conn, &id);
    Ok(())
}

#[tauri::command]
pub fn documents_restore(state: State<'_, AppState>, id: String) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let now = Utc::now().to_rfc3339();
    let affected = conn.execute(
        "UPDATE documents \
             SET is_deleted = 0, deleted_at = NULL, updated_at = ?1 \
             WHERE id = ?2 AND is_deleted = 1",
        rusqlite::params![now, id],
    )?;
    if affected == 0 {
        return Err(CommandError::NotFound(format!(
            "document not found or not deleted: {id}"
        )));
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
pub fn documents_get_file_url(
    state: State<'_, AppState>,
    id: String,
) -> Result<String, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.query_row(
        "SELECT file_path FROM documents WHERE id = ? AND is_deleted = 0",
        [&id],
        |row| row.get(0),
    )
    .map_err(|_| CommandError::NotFound(format!("document not found: {id}")))
}

#[tauri::command]
pub fn documents_tags_set(
    state: State<'_, AppState>,
    id: String,
    tags: Vec<String>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE id = ? AND is_deleted = 0",
            [&id],
            |row| row.get::<_, i64>(0),
        )
        .map(|n| n > 0)?;
    if !exists {
        return Err(CommandError::NotFound(format!("document not found: {id}")));
    }

    conn.execute("DELETE FROM document_tags WHERE document_id = ?", [&id])?;

    for tag in &tags {
        let tag = tag.trim();
        if tag.is_empty() {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
            rusqlite::params![id, tag],
        )?;
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE documents SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )?;

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

// ── Advanced filtered search ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct FilteredDocumentsResult {
    pub items: Vec<Document>,
    pub total: i64,
}

#[tauri::command]
pub fn documents_search_filtered(
    query: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    category_ids: Option<Vec<String>>,
    page: Option<i64>,
    limit: Option<i64>,
    state: State<'_, AppState>,
) -> Result<FilteredDocumentsResult, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let page = page.unwrap_or(0).max(0);
    let per_page = limit.unwrap_or(50).clamp(1, 200);

    let fts = query
        .as_deref()
        .map(str::trim)
        .filter(|q| !q.is_empty())
        .map(crate::commands::search::build_fts_query)
        .filter(|fq| !fq.is_empty());

    let cat_ids: Vec<String> = category_ids
        .unwrap_or_default()
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect();

    let mut where_parts: Vec<String> = vec!["d.is_deleted = 0".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref from) = date_from {
        params.push(Box::new(from.clone()));
        where_parts.push(format!("d.document_date >= ?{}", params.len()));
    }
    if let Some(ref to) = date_to {
        params.push(Box::new(to.clone()));
        where_parts.push(format!("d.document_date <= ?{}", params.len()));
    }
    if let Some(ref fq) = fts {
        params.push(Box::new(fq.clone()));
        where_parts.push(format!(
            "d.id IN (SELECT entity_id FROM search_index \
             WHERE search_index MATCH ?{} AND entity_type = 'document')",
            params.len()
        ));
    }
    if !cat_ids.is_empty() {
        let n = cat_ids.len();
        let placeholders: Vec<String> = (0..n)
            .map(|i| format!("?{}", params.len() + i + 1))
            .collect();
        for id in &cat_ids {
            params.push(Box::new(id.clone()));
        }
        where_parts.push(format!(
            "d.id IN (SELECT document_id FROM document_categories \
             WHERE category_id IN ({}) \
             GROUP BY document_id HAVING COUNT(DISTINCT category_id) = {})",
            placeholders.join(", "),
            n
        ));
    }

    let where_clause = where_parts.join(" AND ");

    // count query (no pagination params needed)
    let count_sql = format!("SELECT COUNT(DISTINCT d.id) FROM documents d WHERE {where_clause}");
    let count_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let total: i64 = conn.query_row(&count_sql, count_refs.as_slice(), |r| r.get(0))?;

    // data query
    params.push(Box::new(per_page));
    params.push(Box::new(page * per_page));
    let data_sql = format!(
        "SELECT DISTINCT d.id, d.filename, d.file_path, d.mime_type, d.file_size_bytes, \
         d.category, d.thumbnail_path, d.notes, d.created_at, d.updated_at, d.is_deleted, \
         d.document_date, d.activity_date, d.extracted_metadata, d.extracted_text \
         FROM documents d WHERE {where_clause} \
         ORDER BY d.created_at DESC LIMIT ?{} OFFSET ?{}",
        params.len() - 1,
        params.len()
    );
    let data_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&data_sql)?;
    let items: Vec<Document> = stmt
        .query_map(data_refs.as_slice(), |row| {
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
                is_deleted: row.get(10)?,
                document_date: row.get(11)?,
                activity_date: row.get(12)?,
                extracted_metadata: row.get(13)?,
                extracted_text: row.get(14)?,
                tags: vec![],
            })
        })?
        .filter_map(|r| r.ok())
        .map(|mut doc| {
            doc.tags = fetch_tags(conn, &doc.id);
            doc
        })
        .collect();

    Ok(FilteredDocumentsResult { items, total })
}

/// Resolves the activity date using the priority chain:
/// (1) body-extracted date → (2) filename date → (3) created_at date
pub(crate) fn resolve_activity_date(
    body_date: Option<&str>,
    filename_date: Option<&str>,
    created_at: &str,
) -> String {
    body_date
        .or(filename_date)
        .map(|s| s.to_string())
        .unwrap_or_else(|| created_at.get(..10).unwrap_or(created_at).to_string())
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
                activity_date   TEXT,
                extracted_metadata TEXT,
                extracted_text  TEXT,
                extraction_status TEXT
            );
            CREATE TABLE document_tags (
                document_id TEXT NOT NULL,
                tag         TEXT NOT NULL,
                PRIMARY KEY (document_id, tag)
            );
            CREATE TABLE document_categories (
                document_id TEXT NOT NULL,
                category_id TEXT NOT NULL,
                PRIMARY KEY (document_id, category_id)
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

    #[test]
    fn cache_write_sets_extracted_text_and_status() {
        let conn = test_conn();
        insert_doc(&conn, "doc-cache-1", "lab", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents \
             SET extracted_text = ?1, extraction_status = 'EXTRACTED', updated_at = ?2 \
             WHERE id = 'doc-cache-1'",
            rusqlite::params!["blood glucose 5.4", now],
        )
        .unwrap();

        let (text, status): (String, String) = conn
            .query_row(
                "SELECT extracted_text, extraction_status FROM documents WHERE id = 'doc-cache-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();

        assert_eq!(text, "blood glucose 5.4");
        assert_eq!(status, "EXTRACTED");
    }

    #[test]
    fn cache_hit_query_returns_text_when_status_extracted() {
        let conn = test_conn();
        insert_doc(&conn, "doc-cache-2", "lab", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents \
             SET extracted_text = ?1, extraction_status = 'EXTRACTED', updated_at = ?2 \
             WHERE id = 'doc-cache-2'",
            rusqlite::params!["hemoglobin A1c 5.7%", now],
        )
        .unwrap();

        let cached: Option<String> = conn
            .query_row(
                "SELECT extracted_text FROM documents \
                 WHERE id = ?1 AND is_deleted = 0 \
                   AND extraction_status = 'EXTRACTED' \
                   AND extracted_text IS NOT NULL",
                rusqlite::params!["doc-cache-2"],
                |r| r.get(0),
            )
            .optional()
            .unwrap()
            .flatten();

        assert_eq!(cached.as_deref(), Some("hemoglobin A1c 5.7%"));
    }

    #[test]
    fn cache_hit_query_returns_none_when_status_not_extracted() {
        let conn = test_conn();
        insert_doc(&conn, "doc-cache-3", "lab", false);

        let cached: Option<String> = conn
            .query_row(
                "SELECT extracted_text FROM documents \
                 WHERE id = ?1 AND is_deleted = 0 \
                   AND extraction_status = 'EXTRACTED' \
                   AND extracted_text IS NOT NULL",
                rusqlite::params!["doc-cache-3"],
                |r| r.get(0),
            )
            .optional()
            .unwrap()
            .flatten();

        assert!(cached.is_none());
    }

    // ── documents_search_filtered tests ──────────────────────────────────────

    fn assign_category(conn: &Connection, doc_id: &str, cat_id: &str) {
        conn.execute(
            "INSERT OR IGNORE INTO document_categories (document_id, category_id) VALUES (?1, ?2)",
            rusqlite::params![doc_id, cat_id],
        )
        .unwrap();
    }

    fn filtered_ids(
        conn: &Connection,
        date_from: Option<&str>,
        date_to: Option<&str>,
        category_ids: &[&str],
    ) -> Vec<String> {
        let mut where_parts: Vec<String> = vec!["d.is_deleted = 0".to_string()];
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(f) = date_from {
            params.push(Box::new(f.to_string()));
            where_parts.push(format!("d.document_date >= ?{}", params.len()));
        }
        if let Some(t) = date_to {
            params.push(Box::new(t.to_string()));
            where_parts.push(format!("d.document_date <= ?{}", params.len()));
        }
        if !category_ids.is_empty() {
            let n = category_ids.len();
            let placeholders: Vec<String> = (0..n)
                .map(|i| format!("?{}", params.len() + i + 1))
                .collect();
            for id in category_ids {
                params.push(Box::new(id.to_string()));
            }
            where_parts.push(format!(
                "d.id IN (SELECT document_id FROM document_categories \
                 WHERE category_id IN ({}) \
                 GROUP BY document_id HAVING COUNT(DISTINCT category_id) = {})",
                placeholders.join(", "),
                n
            ));
        }

        let sql = format!(
            "SELECT DISTINCT d.id FROM documents d WHERE {} ORDER BY d.id",
            where_parts.join(" AND ")
        );
        let refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql).unwrap();
        stmt.query_map(refs.as_slice(), |r| r.get::<_, String>(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    }

    #[test]
    fn filtered_search_date_range_only() {
        let conn = test_conn();
        insert_doc(&conn, "d-early", "lab", false);
        insert_doc(&conn, "d-mid", "lab", false);
        insert_doc(&conn, "d-late", "lab", false);
        conn.execute(
            "UPDATE documents SET document_date = '2024-01-15' WHERE id = 'd-early'",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE documents SET document_date = '2024-06-15' WHERE id = 'd-mid'",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE documents SET document_date = '2024-11-30' WHERE id = 'd-late'",
            [],
        )
        .unwrap();

        let ids = filtered_ids(&conn, Some("2024-03-01"), Some("2024-09-01"), &[]);
        assert_eq!(ids, vec!["d-mid"]);
    }

    #[test]
    fn filtered_search_multi_category_and() {
        let conn = test_conn();
        insert_doc(&conn, "d-both", "lab", false);
        insert_doc(&conn, "d-one", "lab", false);
        insert_doc(&conn, "d-none", "lab", false);

        assign_category(&conn, "d-both", "cat-a");
        assign_category(&conn, "d-both", "cat-b");
        assign_category(&conn, "d-one", "cat-a");

        let ids = filtered_ids(&conn, None, None, &["cat-a", "cat-b"]);
        assert_eq!(ids, vec!["d-both"]);
    }

    #[test]
    fn filtered_search_combined_date_and_category() {
        let conn = test_conn();
        insert_doc(&conn, "d-match", "lab", false);
        insert_doc(&conn, "d-wrong-date", "lab", false);
        insert_doc(&conn, "d-wrong-cat", "lab", false);

        conn.execute(
            "UPDATE documents SET document_date = '2024-05-01' WHERE id = 'd-match'",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE documents SET document_date = '2023-01-01' WHERE id = 'd-wrong-date'",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE documents SET document_date = '2024-05-01' WHERE id = 'd-wrong-cat'",
            [],
        )
        .unwrap();

        assign_category(&conn, "d-match", "cat-x");
        assign_category(&conn, "d-wrong-date", "cat-x");
        // d-wrong-cat has no category

        let ids = filtered_ids(&conn, Some("2024-01-01"), None, &["cat-x"]);
        assert_eq!(ids, vec!["d-match"]);
    }

    #[test]
    fn filtered_search_empty_filters_returns_all() {
        let conn = test_conn();
        insert_doc(&conn, "e1", "lab", false);
        insert_doc(&conn, "e2", "lab", false);
        insert_doc(&conn, "e3", "lab", false);
        insert_doc(&conn, "e-deleted", "lab", true);

        let ids = filtered_ids(&conn, None, None, &[]);
        assert_eq!(ids.len(), 3);
        assert!(!ids.contains(&"e-deleted".to_string()));
    }

    // ── resolve_activity_date priority chain ──────────────────────────────────

    #[test]
    fn activity_date_uses_body_date_first() {
        let result = resolve_activity_date(
            Some("2023-03-09"),
            Some("2022-01-01"),
            "2021-06-15T10:00:00Z",
        );
        assert_eq!(result, "2023-03-09");
    }

    #[test]
    fn activity_date_falls_back_to_filename_date() {
        let result = resolve_activity_date(None, Some("2023-03-09"), "2021-06-15T10:00:00Z");
        assert_eq!(result, "2023-03-09");
    }

    #[test]
    fn activity_date_falls_back_to_created_at_when_no_dates() {
        let result = resolve_activity_date(None, None, "2024-07-22T14:30:00Z");
        assert_eq!(result, "2024-07-22");
    }

    #[test]
    fn activity_date_truncates_rfc3339_to_date_only() {
        let result = resolve_activity_date(None, None, "2025-12-01T23:59:59+01:00");
        assert_eq!(result, "2025-12-01");
    }
}

#[derive(Debug, Serialize)]
pub struct ContactSuggestionDto {
    pub name: String,
    pub title: Option<String>,
    pub specialty: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ClinicSuggestionDto {
    pub name: String,
    pub company_registration_number: Option<String>,
    pub addresses: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ExtractionSuggestions {
    pub doctor_candidates: Vec<String>,
    pub category_suggestion: Option<String>,
    pub document_tags: Vec<String>,
    pub contact_suggestions: Vec<ContactSuggestionDto>,
    pub clinic_suggestions: Vec<ClinicSuggestionDto>,
    pub auto_tags: Vec<String>,
    pub activity_date: Option<String>,
}

#[tauri::command]
pub async fn documents_run_extraction(
    id: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
    emit_progress: Option<bool>,
) -> Result<ExtractionSuggestions, CommandError> {
    // ── cache hit ────────────────────────────────────────────────────────────
    {
        let guard = state
            .db
            .lock()
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        let conn = CommandContext::new(&guard)?.conn;
        let cached: Option<(String, Option<String>)> = conn
            .query_row(
                "SELECT extracted_text, activity_date FROM documents \
                 WHERE id = ?1 AND is_deleted = 0 \
                   AND extraction_status = 'EXTRACTED' \
                   AND extracted_text IS NOT NULL",
                rusqlite::params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .optional()?;

        if let Some((text, activity_date)) = cached {
            let doctor_candidates = crate::extraction::doctor::extract_doctor_candidates(&text);
            let category_suggestion = crate::extraction::category::suggest_category(&text);
            let document_tags = crate::extraction::category::extract_document_tags(&text);
            let contact_suggestions =
                crate::extraction::contact::extract_contact_suggestions(&text);
            let contact_dtos: Vec<ContactSuggestionDto> = contact_suggestions
                .iter()
                .map(|c| ContactSuggestionDto {
                    name: c.name.clone(),
                    title: c.title.clone(),
                    specialty: c.specialty.clone(),
                    clinic: c.clinic.clone(),
                    address: c.address.clone(),
                    phone: c.phone.clone(),
                    email: c.email.clone(),
                })
                .collect();
            let clinic_suggestions = {
                let clinic_name = contact_dtos.first().and_then(|c| c.clinic.clone());
                if let Some(name) = clinic_name {
                    let company_registration_number =
                        crate::extraction::clinic::extract_company_registration_number(&text);
                    let addresses = crate::extraction::clinic::extract_clinic_addresses(&text);
                    vec![ClinicSuggestionDto {
                        name,
                        company_registration_number,
                        addresses,
                    }]
                } else {
                    vec![]
                }
            };
            let auto_tags = crate::extraction::auto_extract_tags(
                &text,
                &doctor_candidates,
                activity_date.as_deref(),
            );
            return Ok(ExtractionSuggestions {
                doctor_candidates,
                category_suggestion,
                document_tags,
                contact_suggestions: contact_dtos,
                clinic_suggestions,
                auto_tags,
                activity_date,
            });
        }
    }

    // ── cache miss — run extraction ──────────────────────────────────────────
    let (file_path, document_date, created_at): (String, Option<String>, String) = {
        let guard = state
            .db
            .lock()
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        let conn = CommandContext::new(&guard)?.conn;
        conn.query_row(
            "SELECT file_path, document_date, created_at \
             FROM documents WHERE id = ?1 AND is_deleted = 0",
            rusqlite::params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )?
    };

    let emit = emit_progress.unwrap_or(false);
    let app_handle_cloned = app_handle.clone();
    let result = tokio::task::spawn_blocking(move || {
        if emit {
            crate::extraction::extract_with_progress(
                std::path::Path::new(&file_path),
                &app_handle_cloned,
            )
        } else {
            crate::extraction::extract(std::path::Path::new(&file_path))
        }
    })
    .await
    .map_err(|e| CommandError::Internal(format!("extraction thread panicked: {e}")))?;

    let contact_dtos: Vec<ContactSuggestionDto> = result
        .contact_suggestions
        .iter()
        .map(|c| ContactSuggestionDto {
            name: c.name.clone(),
            title: c.title.clone(),
            specialty: c.specialty.clone(),
            clinic: c.clinic.clone(),
            address: c.address.clone(),
            phone: c.phone.clone(),
            email: c.email.clone(),
        })
        .collect();

    let clinic_suggestions = {
        let clinic_name = result
            .contact_suggestions
            .first()
            .and_then(|c| c.clinic.clone());
        if let Some(name) = clinic_name {
            let company_registration_number =
                crate::extraction::clinic::extract_company_registration_number(&result.text);
            let addresses = crate::extraction::clinic::extract_clinic_addresses(&result.text);
            vec![ClinicSuggestionDto {
                name,
                company_registration_number,
                addresses,
            }]
        } else {
            vec![]
        }
    };

    // Priority chain: (1) body text → (2) document_date from filename → (3) created_at
    let resolved_activity_date = resolve_activity_date(
        result.activity_date.as_deref(),
        document_date.as_deref(),
        &created_at,
    );

    let auto_tags = crate::extraction::auto_extract_tags(
        &result.text,
        &result.doctor_candidates,
        Some(&resolved_activity_date),
    );

    let json = serde_json::json!({
        "text": result.text,
        "extracted_at": result.extracted_at,
        "doctor_candidates": result.doctor_candidates,
        "category_suggestion": result.category_suggestion,
        "document_tags": result.document_tags,
    })
    .to_string();

    {
        let guard = state
            .db
            .lock()
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        let conn = CommandContext::new(&guard)?.conn;
        conn.execute(
            "UPDATE documents \
             SET extracted_metadata = ?1, \
                 extracted_text = ?2, \
                 extraction_status = 'EXTRACTED', \
                 activity_date = ?3, \
                 updated_at = ?4 \
             WHERE id = ?5",
            rusqlite::params![
                json,
                result.text,
                resolved_activity_date,
                Utc::now().to_rfc3339(),
                id
            ],
        )?;
    }

    Ok(ExtractionSuggestions {
        doctor_candidates: result.doctor_candidates,
        category_suggestion: result.category_suggestion,
        document_tags: result.document_tags,
        contact_suggestions: contact_dtos,
        clinic_suggestions,
        auto_tags,
        activity_date: Some(resolved_activity_date),
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
) -> Result<ExtractionStatus, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let meta: Option<Option<String>> = conn
        .query_row(
            "SELECT extracted_metadata FROM documents WHERE id = ?1 AND is_deleted = 0",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .optional()?;

    match meta {
        None => Err(CommandError::NotFound(format!("document {} not found", id))),
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
