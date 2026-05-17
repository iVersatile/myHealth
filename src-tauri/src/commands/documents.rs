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
    pub clinic_name: Option<String>,
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

struct PreparedUpload {
    id: String,
    filename: String,
    mime: String,
    file_size: i64,
    dest_path: String,
    dest_dir: std::path::PathBuf,
    document_date: Option<String>,
    tags: Vec<String>,
}

fn prepare_document_upload(file_path: &str) -> Result<PreparedUpload, CommandError> {
    let src = std::path::Path::new(file_path);
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
    let dest_path_buf = dest_dir.join(&dest_filename);
    fs::copy(src, &dest_path_buf).map_err(|e| CommandError::Internal(e.to_string()))?;
    let dest_path = dest_path_buf
        .to_str()
        .ok_or(CommandError::Internal("invalid path encoding".to_string()))?
        .to_string();

    Ok(PreparedUpload {
        id,
        filename,
        mime,
        file_size,
        dest_path,
        dest_dir,
        document_date,
        tags: parsed.tags,
    })
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
             document_date, activity_date, extracted_metadata, extracted_text, clinic_name \
             FROM documents WHERE id = ?",
    )?;
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
                activity_date: row.get(12)?,
                extracted_metadata: row.get(13)?,
                extracted_text: row.get(14)?,
                tags: vec![],
                clinic_name: row.get(15)?,
            })
        })
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                CommandError::NotFound(format!("document {id} not found"))
            }
            other => CommandError::Internal(other.to_string()),
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
    let prep = prepare_document_upload(&file_path)?;

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
            prep.id,
            prep.filename,
            prep.dest_path,
            prep.mime,
            prep.file_size,
            category,
            thumbnail_path,
            notes,
            prep.document_date,
            now,
        ],
    )?;

    for tag in &prep.tags {
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
            rusqlite::params![prep.id, tag],
        )?;
    }
    if let Some(ref date) = prep.document_date {
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
            rusqlite::params![prep.id, date],
        )?;
    }

    let doc = load_doc(conn, &prep.id)?;
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
        doc.extracted_text.as_deref().unwrap_or(""),
        doc.activity_date.as_deref().unwrap_or(""),
    );
    Ok(doc)
}

#[derive(Debug, Serialize)]
pub struct BatchUploadResult {
    pub file_path: String,
    pub document_id: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn documents_upload_batch(
    state: State<'_, AppState>,
    file_paths: Vec<String>,
    category: String,
    batch_upload_id: String,
    notes: Option<String>,
) -> Result<Vec<BatchUploadResult>, CommandError> {
    validate_category(&category)?;

    let mut results: Vec<BatchUploadResult> = Vec::with_capacity(file_paths.len());

    for file_path in file_paths {
        let result = upload_one_document(
            &state,
            &file_path,
            &category,
            &batch_upload_id,
            notes.as_deref(),
        );
        match result {
            Ok(doc_id) => results.push(BatchUploadResult {
                file_path,
                document_id: Some(doc_id),
                error: None,
            }),
            Err(e) => results.push(BatchUploadResult {
                file_path,
                document_id: None,
                error: Some(e.to_string()),
            }),
        }
    }

    Ok(results)
}

fn upload_one_document(
    state: &AppState,
    file_path: &str,
    category: &str,
    batch_upload_id: &str,
    notes: Option<&str>,
) -> Result<String, CommandError> {
    let prep = prepare_document_upload(file_path)?;

    let now = Utc::now().to_rfc3339();
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute("BEGIN EXCLUSIVE", [])?;
    let tx_result = (|| -> Result<(), CommandError> {
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              thumbnail_path, notes, document_date, batch_upload_id, created_at, updated_at, is_deleted) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?8, ?9, ?10, ?10, 0)",
            rusqlite::params![
                prep.id,
                prep.filename,
                prep.dest_path,
                prep.mime,
                prep.file_size,
                category,
                notes,
                prep.document_date,
                batch_upload_id,
                now,
            ],
        )?;
        for tag in &prep.tags {
            conn.execute(
                "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
                rusqlite::params![prep.id, tag],
            )?;
        }
        Ok(())
    })();

    match tx_result {
        Ok(()) => {
            conn.execute("COMMIT", [])?;
            Ok(prep.id)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            let _ = fs::remove_dir_all(&prep.dest_dir);
            Err(e)
        }
    }
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
        doc.extracted_text.as_deref().unwrap_or(""),
        doc.activity_date.as_deref().unwrap_or(""),
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
            doc.extracted_text.as_deref().unwrap_or(""),
            doc.activity_date.as_deref().unwrap_or(""),
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
pub fn get_document_preview_url(
    state: State<'_, AppState>,
    doc_id: String,
) -> Result<String, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.query_row(
        "SELECT file_path FROM documents WHERE id = ? AND is_deleted = 0",
        [&doc_id],
        |row| row.get(0),
    )
    .map_err(|_| CommandError::NotFound(format!("document not found: {doc_id}")))
}

#[derive(Debug, serde::Serialize)]
pub struct FlaggedValue {
    pub name: String,
    pub value: String,
    pub unit: String,
    pub status: String,
}

fn classify_lab_status(name: &str, value_str: &str) -> &'static str {
    let v: f64 = match value_str.trim().parse() {
        Ok(n) => n,
        Err(_) => return "NORMAL",
    };
    let name_lc = name.to_lowercase();
    // Reference ranges — adult population, SI units where applicable
    if name_lc.contains("hba1c") {
        if v >= 6.5 {
            "HIGH"
        } else if v >= 5.7 {
            "BORDERLINE"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("egfr") {
        if v < 30.0 {
            "LOW"
        } else if v < 60.0 {
            "BORDERLINE"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("creatinine") {
        if v > 120.0 {
            "HIGH"
        } else if v > 110.0 {
            "BORDERLINE"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("glucose") {
        if v >= 11.1 {
            "HIGH"
        } else if v >= 5.6 {
            "BORDERLINE"
        } else if v < 3.9 {
            "LOW"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("cholesterol")
        && !name_lc.contains("ldl")
        && !name_lc.contains("hdl")
    {
        if v >= 6.2 {
            "HIGH"
        } else if v >= 5.2 {
            "BORDERLINE"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("ldl") {
        if v >= 4.1 {
            "HIGH"
        } else if v >= 3.4 {
            "BORDERLINE"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("hdl") {
        if v < 1.0 {
            "LOW"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("triglyceride") {
        if v >= 5.6 {
            "HIGH"
        } else if v >= 1.7 {
            "BORDERLINE"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("tsh") {
        if v > 4.0 {
            "HIGH"
        } else if v < 0.4 {
            "LOW"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("haemoglobin") || name_lc.contains("hemoglobin") {
        if v < 120.0 {
            "LOW"
        } else if v > 170.0 {
            "HIGH"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("wbc") {
        if v < 4.0 {
            "LOW"
        } else if v > 11.0 {
            "HIGH"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("platelet") {
        if v < 150.0 {
            "LOW"
        } else if v > 400.0 {
            "HIGH"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("sodium") {
        if v < 135.0 {
            "LOW"
        } else if v > 145.0 {
            "HIGH"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("potassium") {
        if v < 3.5 {
            "LOW"
        } else if v > 5.0 {
            "HIGH"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("inr") {
        if v > 1.1 {
            "HIGH"
        } else {
            "NORMAL"
        }
    } else if name_lc.contains("psa") {
        if v >= 4.0 {
            "HIGH"
        } else if v >= 2.5 {
            "BORDERLINE"
        } else {
            "NORMAL"
        }
    } else {
        "NORMAL"
    }
}

#[tauri::command]
pub fn get_flagged_lab_values(
    state: State<'_, AppState>,
    doc_id: String,
) -> Result<Vec<FlaggedValue>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT name, value, unit FROM document_entities \
         WHERE document_id = ? AND entity_type = 'lab_value' \
         ORDER BY name",
    )?;
    let rows = stmt.query_map([&doc_id], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?,
        ))
    })?;
    let mut result = Vec::new();
    for row in rows {
        let (name, value_opt, unit_opt) = row?;
        let value = value_opt.unwrap_or_default();
        let unit = unit_opt.unwrap_or_default();
        let status = classify_lab_status(&name, &value).to_string();
        result.push(FlaggedValue {
            name,
            value,
            unit,
            status,
        });
    }
    Ok(result)
}

#[derive(Debug, Serialize)]
pub struct DocSummary {
    pub id: String,
    pub title: String,
    pub activity_date: Option<String>,
    pub doc_type: String,
}

#[tauri::command]
pub fn get_linked_documents(
    state: State<'_, AppState>,
    doc_id: String,
) -> Result<Vec<DocSummary>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT d.id, d.filename, d.activity_date, d.category \
         FROM documents d \
         WHERE d.is_deleted = 0 \
           AND d.id != ?1 \
           AND ( \
             EXISTS ( \
               SELECT 1 FROM document_contacts dc1 \
               JOIN document_contacts dc2 ON dc1.contact_id = dc2.contact_id \
               WHERE dc1.document_id = ?1 AND dc2.document_id = d.id \
             ) \
             OR EXISTS ( \
               SELECT 1 FROM documents src \
               WHERE src.id = ?1 \
                 AND src.clinic_name IS NOT NULL \
                 AND src.clinic_name != '' \
                 AND d.clinic_name = src.clinic_name \
             ) \
           ) \
         ORDER BY d.activity_date DESC \
         LIMIT 10",
    )?;
    let rows = stmt.query_map([&doc_id], |row| {
        Ok(DocSummary {
            id: row.get(0)?,
            title: row.get(1)?,
            activity_date: row.get(2)?,
            doc_type: row.get(3)?,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(CommandError::from)
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
            doc.extracted_text.as_deref().unwrap_or(""),
            doc.activity_date.as_deref().unwrap_or(""),
        );
    }

    Ok(())
}

#[tauri::command]
pub fn documents_set_clinic(
    state: State<'_, AppState>,
    document_id: String,
    clinic_name: String,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE id = ? AND is_deleted = 0",
            [&document_id],
            |row| row.get::<_, i64>(0),
        )
        .map(|n| n > 0)?;
    if !exists {
        return Err(CommandError::NotFound(format!(
            "document not found: {document_id}"
        )));
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE documents SET clinic_name = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![clinic_name, now, document_id],
    )?;

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
                clinic_name: None,
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
                extraction_status TEXT,
                clinic_name     TEXT,
                batch_upload_id TEXT
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
             SET extracted_text = ?1, extraction_status = 'done', updated_at = ?2 \
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
        assert_eq!(status, "done");
    }

    #[test]
    fn cache_hit_query_returns_text_when_status_extracted() {
        let conn = test_conn();
        insert_doc(&conn, "doc-cache-2", "lab", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents \
             SET extracted_text = ?1, extraction_status = 'done', updated_at = ?2 \
             WHERE id = 'doc-cache-2'",
            rusqlite::params!["hemoglobin A1c 5.7%", now],
        )
        .unwrap();

        let cached: Option<String> = conn
            .query_row(
                "SELECT extracted_text FROM documents \
                 WHERE id = ?1 AND is_deleted = 0 \
                   AND extraction_status = 'done' \
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
                   AND extraction_status = 'done' \
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

    // ── Performance benchmark: document list (G-09) ───────────────────────────
    // Inserts 1 000 documents and queries all of them; asserts elapsed < 500 ms.
    // Run with: cargo test perf_document_list_1000 -- --nocapture
    #[test]
    fn perf_document_list_1000() {
        let conn = test_conn();
        let now = chrono::Utc::now().to_rfc3339();
        for i in 0..1000usize {
            conn.execute(
                "INSERT INTO documents \
                 (id, filename, file_path, mime_type, file_size_bytes, category, \
                  created_at, updated_at, is_deleted) \
                 VALUES (?1, 'doc.pdf', '/tmp/doc.pdf', 'application/pdf', 1024, 'lab', ?2, ?2, 0)",
                rusqlite::params![format!("perf-doc-{i}"), now],
            )
            .unwrap();
        }

        let start = std::time::Instant::now();
        let ids: Vec<String> = {
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM documents WHERE is_deleted = 0 \
                     ORDER BY created_at DESC LIMIT 1000 OFFSET 0",
                )
                .unwrap();
            stmt.query_map([], |row| row.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect()
        };
        let elapsed = start.elapsed();
        assert_eq!(ids.len(), 1000);
        assert!(
            elapsed.as_millis() < 500,
            "document list query took {}ms (limit 500ms)",
            elapsed.as_millis()
        );
        eprintln!("[PERF] document list 1000 rows: {}ms", elapsed.as_millis());
    }

    #[test]
    fn suggest_appointment_returns_none_when_no_activity_date() {
        let conn = test_conn();
        insert_doc(&conn, "doc-appt-none", "lab", false);
        let result = suggest_appointment_from_doc(&conn, "doc-appt-none").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn suggest_appointment_returns_suggestion_when_activity_date_set() {
        let conn = test_conn();
        insert_doc(&conn, "doc-appt-some", "lab", false);
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents \
             SET activity_date = '2024-03-15', \
                 extracted_text = 'Cardiology appointment with Dr. Smith at City Clinic', \
                 updated_at = ?1 \
             WHERE id = 'doc-appt-some'",
            rusqlite::params![now],
        )
        .unwrap();
        let result = suggest_appointment_from_doc(&conn, "doc-appt-some").unwrap();
        assert!(result.is_some());
        let s = result.unwrap();
        assert_eq!(s.appt_date, "2024-03-15");
        assert!(!s.title.is_empty());
    }

    fn report_test_conn() -> Connection {
        let conn = test_conn();
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS appointments (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                doctor_name TEXT,
                clinic_name TEXT,
                specialty TEXT,
                appt_date TEXT NOT NULL,
                duration_min INTEGER NOT NULL DEFAULT 60,
                location TEXT,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'scheduled',
                reminder_min INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                is_deleted BOOLEAN NOT NULL DEFAULT 0,
                recurrence_series_id TEXT
            );
            CREATE TABLE IF NOT EXISTS appointment_documents (
                appointment_id TEXT NOT NULL,
                document_id TEXT NOT NULL,
                PRIMARY KEY (appointment_id, document_id)
            );
            CREATE TABLE IF NOT EXISTS document_entities (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                name TEXT NOT NULL,
                value TEXT,
                unit TEXT,
                raw_text TEXT NOT NULL DEFAULT '',
                created_at DATETIME NOT NULL
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn export_report_returns_basic_fields() {
        let conn = report_test_conn();
        insert_doc(&conn, "rep-1", "lab", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents SET document_date = '2024-06-01', clinic_name = 'City Clinic', notes = 'Fasting required', updated_at = ?1 WHERE id = 'rep-1'",
            rusqlite::params![now],
        )
        .unwrap();
        let report = assemble_report(&conn, "rep-1").unwrap();
        assert_eq!(report.document_id, "rep-1");
        assert_eq!(report.document_date.as_deref(), Some("2024-06-01"));
        assert_eq!(report.clinic_name.as_deref(), Some("City Clinic"));
        assert_eq!(report.notes.as_deref(), Some("Fasting required"));
        assert_eq!(report.category, "lab");
    }

    #[test]
    fn export_report_returns_not_found_for_missing_doc() {
        let conn = report_test_conn();
        let err = assemble_report(&conn, "missing").unwrap_err();
        assert!(matches!(err, CommandError::NotFound(_)));
    }

    #[test]
    fn export_report_ocr_excerpt_truncated_to_500_chars() {
        let conn = report_test_conn();
        insert_doc(&conn, "rep-ocr", "lab", false);
        let long_text = "a".repeat(1000);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE documents SET extracted_text = ?1, updated_at = ?2 WHERE id = 'rep-ocr'",
            rusqlite::params![long_text, now],
        )
        .unwrap();
        let report = assemble_report(&conn, "rep-ocr").unwrap();
        assert_eq!(report.ocr_excerpt.as_ref().map(|s| s.len()), Some(500));
    }

    #[test]
    fn export_report_includes_linked_appointments() {
        let conn = report_test_conn();
        insert_doc(&conn, "rep-appt", "diagnosis", false);
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, status, duration_min, reminder_min, created_at, updated_at) VALUES ('appt-1', 'Cardiology', '2024-06-01', 'completed', 30, 0, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointment_documents (appointment_id, document_id) VALUES ('appt-1', 'rep-appt')",
            [],
        )
        .unwrap();
        let report = assemble_report(&conn, "rep-appt").unwrap();
        assert_eq!(report.appointments.len(), 1);
        assert_eq!(report.appointments[0].id, "appt-1");
        assert_eq!(report.appointments[0].title, "Cardiology");
    }

    #[test]
    fn export_report_entities_empty_when_none() {
        let conn = report_test_conn();
        insert_doc(&conn, "rep-ent0", "lab", false);
        let report = assemble_report(&conn, "rep-ent0").unwrap();
        assert!(report.entities.is_empty());
    }

    // ── batch upload rollback ──────────────────────────────────────────────────

    #[test]
    fn rollback_leaves_other_committed_docs_intact() {
        let conn = test_conn();
        let batch_id = "batch-test-001";

        // Transaction 1: succeeds — doc-ok should survive.
        conn.execute("BEGIN EXCLUSIVE", []).unwrap();
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              batch_upload_id, created_at, updated_at, is_deleted) \
             VALUES ('doc-ok', 'a.pdf', '/tmp/a.pdf', 'application/pdf', 512, 'lab', ?1, \
                     '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z', 0)",
            rusqlite::params![batch_id],
        )
        .unwrap();
        conn.execute("COMMIT", []).unwrap();

        // Transaction 2: fails via duplicate PK — should roll back cleanly.
        conn.execute("BEGIN EXCLUSIVE", []).unwrap();
        let dup_result = conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              batch_upload_id, created_at, updated_at, is_deleted) \
             VALUES ('doc-ok', 'b.pdf', '/tmp/b.pdf', 'application/pdf', 512, 'lab', ?1, \
                     '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z', 0)",
            rusqlite::params![batch_id],
        );
        assert!(dup_result.is_err(), "duplicate PK insert must fail");
        conn.execute("ROLLBACK", []).unwrap();

        // doc-ok committed in transaction 1 must still be present.
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM documents WHERE id = 'doc-ok'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "doc-ok must survive after transaction 2 rollback");

        // No second row must exist.
        let total: i64 = conn
            .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
            .unwrap();
        assert_eq!(total, 1, "only one document row must exist in total");
    }

    use rusqlite::OptionalExtension;

    fn migrated_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        crate::db::migrations::run(&conn).unwrap();
        conn
    }

    /// document_tags inserted during upload must NOT have is_draft = 1.
    /// Tags default to is_draft = 0 (visible immediately). See R4 regression.
    #[test]
    fn document_tags_upload_does_not_set_is_draft() {
        let conn = migrated_conn();
        conn.execute_batch(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('doc-1', 'test.pdf', '/tmp/test.pdf', 'application/pdf', 0, 'other', '2024-01-01', '2024-01-01');",
        ).unwrap();
        // Correct upload INSERT: no explicit is_draft column → defaults to 0
        conn.execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
            rusqlite::params!["doc-1", "blood-test"],
        )
        .unwrap();
        let is_draft: i32 = conn
            .query_row(
                "SELECT is_draft FROM document_tags WHERE document_id = 'doc-1' AND tag = 'blood-test'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            is_draft, 0,
            "upload tag must be immediately visible (is_draft=0)"
        );
    }

    /// draft contact insert sets is_draft = 1 and returns 1 on SELECT
    #[test]
    fn draft_contact_insert_sets_is_draft() {
        let conn = migrated_conn();
        let now = "2024-01-01T00:00:00Z";
        conn.execute(
            "INSERT INTO contacts \
             (id, name, role, is_draft, created_at, updated_at) \
             VALUES ('c-draft', 'Dr Smith', 'specialist', 1, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();
        let is_draft: i32 = conn
            .query_row(
                "SELECT is_draft FROM contacts WHERE id = 'c-draft'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_draft, 1);
    }

    /// when a non-draft contact with the same name exists,
    /// the draft contact should have merge_candidate_id set to that contact's id
    #[test]
    fn duplicate_detection_sets_merge_candidate_id() {
        let conn = migrated_conn();
        let now = "2024-01-01T00:00:00Z";

        // existing non-draft contact
        conn.execute(
            "INSERT INTO contacts (id, name, role, is_draft, created_at, updated_at) \
             VALUES ('c-real', 'Dr Smith', 'gp', 0, ?1, ?1)",
            rusqlite::params![now],
        )
        .unwrap();

        // duplicate detection: find existing non-draft by name
        let existing_id: Option<String> = conn
            .query_row(
                "SELECT id FROM contacts WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                rusqlite::params!["Dr Smith"],
                |row| row.get(0),
            )
            .optional()
            .unwrap();

        // insert draft with merge_candidate_id
        conn.execute(
            "INSERT INTO contacts \
             (id, name, role, is_draft, merge_candidate_id, created_at, updated_at) \
             VALUES ('c-draft', 'Dr Smith', 'specialist', 1, ?1, ?2, ?2)",
            rusqlite::params![existing_id, now],
        )
        .unwrap();

        let merge_id: Option<String> = conn
            .query_row(
                "SELECT merge_candidate_id FROM contacts WHERE id = 'c-draft'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(merge_id.as_deref(), Some("c-real"));
    }

    /// upload_one_document transaction: if doc 2 fails, doc 1 and doc 3 remain
    #[test]
    fn upload_transaction_rollback_leaves_other_docs_intact() {
        let conn = migrated_conn();
        let now = "2024-01-01T00:00:00Z";

        // Doc 1: success
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('doc-1', 'a.pdf', '/a.pdf', 'application/pdf', 0, 'other', ?1, ?1)",
            rusqlite::params![now],
        ).unwrap();

        // Doc 2: attempt then rollback
        {
            conn.execute("BEGIN", []).unwrap();
            conn.execute(
                "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
                 VALUES ('doc-2', 'b.pdf', '/b.pdf', 'application/pdf', 0, 'other', ?1, ?1)",
                rusqlite::params![now],
            ).unwrap();
            conn.execute("ROLLBACK", []).unwrap();
        }

        // Doc 3: success
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('doc-3', 'c.pdf', '/c.pdf', 'application/pdf', 0, 'other', ?1, ?1)",
            rusqlite::params![now],
        ).unwrap();

        let count: i32 = conn
            .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2); // doc-1 and doc-3 only

        let doc2_exists: Option<String> = conn
            .query_row("SELECT id FROM documents WHERE id = 'doc-2'", [], |r| {
                r.get(0)
            })
            .optional()
            .unwrap();
        assert!(doc2_exists.is_none());
    }

    #[test]
    fn classify_hba1c_high() {
        assert_eq!(classify_lab_status("HbA1c", "7.2"), "HIGH");
    }

    #[test]
    fn classify_hba1c_borderline() {
        assert_eq!(classify_lab_status("HbA1c", "6.0"), "BORDERLINE");
    }

    #[test]
    fn classify_hba1c_normal() {
        assert_eq!(classify_lab_status("HbA1c", "5.3"), "NORMAL");
    }

    #[test]
    fn classify_egfr_low() {
        assert_eq!(classify_lab_status("eGFR", "25"), "LOW");
    }

    #[test]
    fn classify_egfr_borderline() {
        assert_eq!(classify_lab_status("eGFR", "55"), "BORDERLINE");
    }

    #[test]
    fn classify_glucose_low() {
        assert_eq!(classify_lab_status("glucose", "3.5"), "LOW");
    }

    #[test]
    fn classify_glucose_high() {
        assert_eq!(classify_lab_status("glucose", "12.0"), "HIGH");
    }

    #[test]
    fn classify_hdl_low() {
        assert_eq!(classify_lab_status("HDL", "0.8"), "LOW");
    }

    #[test]
    fn classify_sodium_normal() {
        assert_eq!(classify_lab_status("sodium", "140"), "NORMAL");
    }

    #[test]
    fn classify_unknown_lab_is_normal() {
        assert_eq!(classify_lab_status("ferritin", "45"), "NORMAL");
    }

    #[test]
    fn classify_non_numeric_is_normal() {
        assert_eq!(classify_lab_status("HbA1c", "pending"), "NORMAL");
    }

    // ── get_linked_documents ──────────────────────────────────────────────────

    fn linked_doc_conn() -> Connection {
        let conn = migrated_conn();
        conn.execute_batch(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES \
               ('ld-src', 'src.pdf', '/src.pdf', 'application/pdf', 0, 'lab', '2024-01-01', '2024-01-01'), \
               ('ld-shared-contact', 'a.pdf', '/a.pdf', 'application/pdf', 0, 'diagnosis', '2024-02-01', '2024-02-01'), \
               ('ld-shared-clinic', 'b.pdf', '/b.pdf', 'application/pdf', 0, 'other', '2024-03-01', '2024-03-01'), \
               ('ld-unrelated', 'c.pdf', '/c.pdf', 'application/pdf', 0, 'other', '2024-04-01', '2024-04-01'), \
               ('ld-deleted', 'd.pdf', '/d.pdf', 'application/pdf', 0, 'other', '2024-05-01', '2024-05-01');
             UPDATE documents SET is_deleted = 1 WHERE id = 'ld-deleted';
             UPDATE documents SET clinic_name = 'City Clinic' WHERE id IN ('ld-src', 'ld-shared-clinic');
             INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES ('c-1', 'Dr A', 'gp', '2024-01-01', '2024-01-01');
             INSERT INTO document_contacts (document_id, contact_id) VALUES ('ld-src', 'c-1'), ('ld-shared-contact', 'c-1');",
        ).unwrap();
        conn
    }

    #[test]
    fn linked_docs_returns_shared_contact_doc() {
        let conn = linked_doc_conn();
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT d.id FROM documents d \
                 WHERE d.is_deleted = 0 AND d.id != 'ld-src' AND ( \
                   EXISTS ( \
                     SELECT 1 FROM document_contacts dc1 \
                     JOIN document_contacts dc2 ON dc1.contact_id = dc2.contact_id \
                     WHERE dc1.document_id = 'ld-src' AND dc2.document_id = d.id \
                   ) \
                   OR EXISTS ( \
                     SELECT 1 FROM documents src \
                     WHERE src.id = 'ld-src' \
                       AND src.clinic_name IS NOT NULL AND src.clinic_name != '' \
                       AND d.clinic_name = src.clinic_name \
                   ) \
                 ) ORDER BY d.activity_date DESC LIMIT 10",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(
            ids.contains(&"ld-shared-contact".to_string()),
            "shared contact doc missing"
        );
        assert!(
            ids.contains(&"ld-shared-clinic".to_string()),
            "shared clinic doc missing"
        );
        assert!(
            !ids.contains(&"ld-unrelated".to_string()),
            "unrelated doc should not appear"
        );
        assert!(
            !ids.contains(&"ld-deleted".to_string()),
            "deleted doc should not appear"
        );
        assert!(
            !ids.contains(&"ld-src".to_string()),
            "source doc must not appear"
        );
    }

    #[test]
    fn linked_docs_no_results_when_no_shared_entities() {
        let conn = migrated_conn();
        conn.execute_batch(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('iso-1', 'x.pdf', '/x.pdf', 'application/pdf', 0, 'lab', '2024-01-01', '2024-01-01');",
        ).unwrap();
        let mut stmt = conn
            .prepare(
                "SELECT DISTINCT d.id FROM documents d \
                 WHERE d.is_deleted = 0 AND d.id != 'iso-1' AND ( \
                   EXISTS ( \
                     SELECT 1 FROM document_contacts dc1 \
                     JOIN document_contacts dc2 ON dc1.contact_id = dc2.contact_id \
                     WHERE dc1.document_id = 'iso-1' AND dc2.document_id = d.id \
                   ) \
                   OR EXISTS ( \
                     SELECT 1 FROM documents src \
                     WHERE src.id = 'iso-1' \
                       AND src.clinic_name IS NOT NULL AND src.clinic_name != '' \
                       AND d.clinic_name = src.clinic_name \
                   ) \
                 ) LIMIT 10",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(ids.is_empty());
    }

    // ── draft entity creation tests ──────────────────────────────────────────

    fn draft_test_conn() -> Connection {
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
                extraction_status TEXT,
                clinic_name     TEXT,
                batch_upload_id TEXT
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
            );
            CREATE TABLE appointments (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                doctor_name TEXT,
                clinic_name TEXT,
                specialty   TEXT,
                appt_date   TEXT NOT NULL,
                duration_min INTEGER,
                location    TEXT,
                notes       TEXT,
                status      TEXT NOT NULL,
                reminder_min INTEGER,
                is_draft    INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE TABLE appointment_documents (
                appointment_id TEXT NOT NULL,
                document_id    TEXT NOT NULL,
                PRIMARY KEY (appointment_id, document_id)
            );
            CREATE TABLE medications (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                dosage     TEXT,
                frequency  TEXT,
                notes      TEXT,
                is_draft   INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE document_medications (
                document_id   TEXT NOT NULL,
                medication_id TEXT NOT NULL,
                PRIMARY KEY (document_id, medication_id)
            );
            CREATE TABLE symptoms (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                severity   TEXT,
                notes      TEXT,
                is_draft   INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE document_symptoms (
                document_id TEXT NOT NULL,
                symptom_id  TEXT NOT NULL,
                PRIMARY KEY (document_id, symptom_id)
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn draft_appointment_created_from_extraction_with_date_and_doctor() {
        let conn = draft_test_conn();
        insert_doc(&conn, "doc-appt", "lab", false);
        let now = Utc::now().to_rfc3339();
        let doctor_name = "Dr. Smith";
        let appt_date = "2024-03-15";

        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM appointments \
                 WHERE doctor_name = ?1 AND appt_date = ?2 AND is_draft = 0 LIMIT 1",
                rusqlite::params![doctor_name, appt_date],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        assert!(existing.is_none());

        let appt_id = "appt-uuid-1";
        let title = format!("Appointment with {doctor_name}");
        conn.execute(
            "INSERT INTO appointments \
             (id, title, doctor_name, appt_date, status, is_draft, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, 'completed', 1, ?5, ?5)",
            rusqlite::params![appt_id, title, doctor_name, appt_date, now],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO appointment_documents \
             (appointment_id, document_id) VALUES (?1, ?2)",
            rusqlite::params![appt_id, "doc-appt"],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointments WHERE doctor_name = ?1 AND is_draft = 1",
                rusqlite::params![doctor_name],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let linked: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_documents WHERE appointment_id = ?1",
                rusqlite::params![appt_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(linked, 1);
    }

    #[test]
    fn draft_medication_created_from_extraction() {
        let conn = draft_test_conn();
        insert_doc(&conn, "doc-med", "lab", false);
        let now = Utc::now().to_rfc3339();
        let med_name = "Metformin";

        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM medications WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                rusqlite::params![med_name],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        assert!(existing.is_none());

        let med_id = "med-uuid-1";
        conn.execute(
            "INSERT INTO medications (id, name, is_draft, created_at, updated_at) \
             VALUES (?1, ?2, 1, ?3, ?3)",
            rusqlite::params![med_id, med_name, now],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO document_medications \
             (document_id, medication_id) VALUES (?1, ?2)",
            rusqlite::params!["doc-med", med_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM medications WHERE name = ?1 AND is_draft = 1",
                rusqlite::params![med_name],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let linked: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_medications WHERE medication_id = ?1",
                rusqlite::params![med_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(linked, 1);
    }

    #[test]
    fn draft_symptom_created_from_extraction() {
        let conn = draft_test_conn();
        insert_doc(&conn, "doc-sym", "lab", false);
        let now = Utc::now().to_rfc3339();
        let sym_name = "Hypertension";

        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM symptoms WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                rusqlite::params![sym_name],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        assert!(existing.is_none());

        let sym_id = "sym-uuid-1";
        conn.execute(
            "INSERT INTO symptoms (id, name, is_draft, created_at, updated_at) \
             VALUES (?1, ?2, 1, ?3, ?3)",
            rusqlite::params![sym_id, sym_name, now],
        )
        .unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO document_symptoms \
             (document_id, symptom_id) VALUES (?1, ?2)",
            rusqlite::params!["doc-sym", sym_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM symptoms WHERE name = ?1 AND is_draft = 1",
                rusqlite::params![sym_name],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let linked: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_symptoms WHERE symptom_id = ?1",
                rusqlite::params![sym_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(linked, 1);
    }

    #[test]
    fn no_duplicate_draft_created_if_matching_row_exists() {
        let conn = draft_test_conn();
        let now = Utc::now().to_rfc3339();
        let med_name = "Aspirin";

        // Insert a confirmed (non-draft) medication — duplicate guard must fire
        conn.execute(
            "INSERT INTO medications (id, name, is_draft, created_at, updated_at) \
             VALUES ('med-confirmed', ?1, 0, ?2, ?2)",
            rusqlite::params![med_name, now],
        )
        .unwrap();

        let existing: Option<String> = conn
            .query_row(
                "SELECT id FROM medications WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                rusqlite::params![med_name],
                |row| row.get(0),
            )
            .optional()
            .unwrap();
        // Guard fires: existing confirmed row found → skip draft insert
        assert!(existing.is_some());

        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM medications WHERE name = ?1",
                rusqlite::params![med_name],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(total, 1); // only the confirmed row; no draft inserted
    }
}

#[derive(Debug, Serialize)]
pub struct ContactSuggestionDto {
    pub draft_id: Option<String>,
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
    pub addresses: Vec<crate::extraction::clinic::ExtractedAddress>,
}

#[derive(Debug, Serialize)]
pub struct ExtractionSuggestions {
    pub draft_appointment_id: Option<String>,
    pub doctor_candidates: Vec<String>,
    pub category_suggestion: Option<String>,
    pub document_tags: Vec<String>,
    pub contact_suggestions: Vec<ContactSuggestionDto>,
    pub clinic_suggestions: Vec<ClinicSuggestionDto>,
    pub auto_tags: Vec<String>,
    pub activity_date: Option<String>,
    pub extracted_text_preview: Option<String>,
    pub clinical_notes: Option<String>,
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
                   AND extraction_status = 'done' \
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
                    draft_id: None,
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
                let clinic_name = crate::extraction::contact::first_clinic(&text);
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
            let extracted_text_preview = {
                let trimmed = text.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.chars().take(400).collect::<String>())
                }
            };
            let clinical_notes = crate::extraction::extract_clinical_notes(&text);
            return Ok(ExtractionSuggestions {
                draft_appointment_id: None,
                doctor_candidates,
                category_suggestion,
                document_tags,
                contact_suggestions: contact_dtos,
                clinic_suggestions,
                auto_tags,
                activity_date,
                extracted_text_preview,
                clinical_notes,
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

    let mut contact_dtos: Vec<ContactSuggestionDto> = result
        .contact_suggestions
        .iter()
        .map(|c| ContactSuggestionDto {
            draft_id: None,
            name: c.name.clone(),
            title: c.title.clone(),
            specialty: c.specialty.clone(),
            clinic: c.clinic.clone(),
            address: c.address.clone(),
            phone: c.phone.clone(),
            email: c.email.clone(),
        })
        .collect();
    let mut draft_appt_id: Option<String> = None;

    let clinic_suggestions = {
        let clinic_name = crate::extraction::contact::first_clinic(&result.text).or_else(|| {
            crate::extraction::clinic::extract_clinic_name_by_company_suffix(&result.text)
        });
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
                 extraction_status = 'done', \
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

        let entities = crate::extraction::entities::extract_entities(&result.text);
        let now = Utc::now().to_rfc3339();
        for entity in entities {
            conn.execute(
                "INSERT OR IGNORE INTO document_entities \
                 (id, document_id, entity_type, name, value, unit, raw_text, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                rusqlite::params![
                    entity.id,
                    id,
                    entity.entity_type.as_str(),
                    entity.name,
                    entity.value,
                    entity.unit,
                    entity.raw_text,
                    now,
                ],
            )?;
        }

        // Match diagnosis entities against ICD-10 FTS index
        let _ = crate::commands::icd10::match_and_store(conn, &id, &result.text);

        // Auto-create draft contacts from extraction suggestions
        for c in contact_dtos.iter_mut() {
            let existing_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM contacts WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                    rusqlite::params![c.name],
                    |row| row.get(0),
                )
                .optional()?;
            let contact_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO contacts \
                 (id, name, role, title, specialty, phone, email, clinic, address, \
                  is_draft, merge_candidate_id, created_at, updated_at) \
                 VALUES (?1, ?2, 'specialist', ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10, ?10)",
                rusqlite::params![
                    contact_id,
                    c.name,
                    c.title,
                    c.specialty,
                    c.phone,
                    c.email,
                    c.clinic,
                    c.address,
                    existing_id,
                    now,
                ],
            )?;
            c.draft_id = Some(contact_id);
        }

        // Auto-create draft clinics from extraction suggestions
        let mut created_clinic_ids: Vec<(String, String)> = Vec::new();
        for clinic in &clinic_suggestions {
            let existing_id: Option<String> = conn
                .query_row(
                    "SELECT id FROM clinics WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                    rusqlite::params![clinic.name],
                    |row| row.get(0),
                )
                .optional()?;
            let clinic_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO clinics \
                 (id, name, company_registration_number, is_draft, merge_candidate_id, created_at) \
                 VALUES (?1, ?2, ?3, 1, ?4, ?5)",
                rusqlite::params![
                    clinic_id,
                    clinic.name,
                    clinic.company_registration_number,
                    existing_id,
                    now,
                ],
            )?;
            for addr in &clinic.addresses {
                let addr_id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO clinic_addresses \
                     (id, clinic_id, label, line1, is_primary, created_at) \
                     VALUES (?1, ?2, ?3, ?4, 0, ?5)",
                    rusqlite::params![addr_id, clinic_id, addr.label, addr.line1, now],
                )?;
            }
            created_clinic_ids.push((clinic.name.clone(), clinic_id));
        }

        // Link draft contacts to their draft clinics via clinic_id + junction table
        for c in &contact_dtos {
            if let (Some(ref contact_id), Some(ref clinic_name)) = (&c.draft_id, &c.clinic) {
                if let Some((_, ref cid)) =
                    created_clinic_ids.iter().find(|(n, _)| n == clinic_name)
                {
                    conn.execute(
                        "UPDATE contacts SET clinic_id = ?1 WHERE id = ?2",
                        rusqlite::params![cid, contact_id],
                    )?;
                    conn.execute(
                        "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) \
                         VALUES (?1, ?2)",
                        rusqlite::params![cid, contact_id],
                    )?;
                }
            }
        }

        // Auto-create draft appointment if doctor+date OR clinic+date are available
        let has_doctor = !contact_dtos.is_empty();
        let has_clinic = !created_clinic_ids.is_empty();
        if has_doctor || has_clinic {
            let doctor_name: Option<String> = if has_doctor {
                Some(contact_dtos[0].name.clone())
            } else {
                None
            };
            let first_clinic_name = created_clinic_ids.first().map(|(n, _)| n.as_str());
            let existing_appt: Option<String> = if let Some(ref dname) = doctor_name {
                conn.query_row(
                    "SELECT id FROM appointments \
                     WHERE doctor_name = ?1 AND appt_date = ?2 AND is_draft = 0 LIMIT 1",
                    rusqlite::params![dname, resolved_activity_date],
                    |row| row.get(0),
                )
                .optional()?
            } else if let Some(cname) = first_clinic_name {
                conn.query_row(
                    "SELECT id FROM appointments \
                     WHERE clinic_name = ?1 AND appt_date = ?2 AND is_draft = 0 LIMIT 1",
                    rusqlite::params![cname, resolved_activity_date],
                    |row| row.get(0),
                )
                .optional()?
            } else {
                None
            };
            if existing_appt.is_none() {
                let appt_id = Uuid::new_v4().to_string();
                let title = match (doctor_name.as_deref(), first_clinic_name) {
                    (Some(doc), Some(clinic)) => format!("Appointment with {doc} in {clinic}"),
                    (Some(doc), None) => format!("Appointment with {doc}"),
                    (None, Some(clinic)) => format!("Visit at {clinic}"),
                    (None, None) => "Visit".to_string(),
                };
                let invoice_notes: Option<String> = if doctor_name.is_none() {
                    let items = crate::extraction::extract_invoice_line_items(&result.text);
                    if !items.is_empty() {
                        Some(items.join("\n"))
                    } else {
                        None
                    }
                } else {
                    None
                };
                conn.execute(
                    "INSERT INTO appointments \
                     (id, title, doctor_name, clinic_name, appt_date, notes, status, is_draft, created_at, updated_at) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'completed', 1, ?7, ?7)",
                    rusqlite::params![
                        appt_id,
                        title,
                        doctor_name,
                        first_clinic_name,
                        resolved_activity_date,
                        invoice_notes,
                        now
                    ],
                )?;
                let link_id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT OR IGNORE INTO document_appointments \
                     (id, document_id, appointment_id, link_type, confidence, created_at) \
                     VALUES (?1, ?2, ?3, 'related', 'auto', ?4)",
                    rusqlite::params![link_id, id, appt_id, now],
                )?;
                draft_appt_id = Some(appt_id);
            }
        }

        // Auto-create draft medications and symptoms from extracted entities
        let entities2 = crate::extraction::entities::extract_entities(&result.text);
        for entity in entities2 {
            use crate::extraction::entities::EntityType;
            match entity.entity_type {
                EntityType::Medication => {
                    let existing: Option<String> = conn
                        .query_row(
                            "SELECT id FROM medications WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                            rusqlite::params![entity.name],
                            |row| row.get(0),
                        )
                        .optional()?;
                    if existing.is_none() {
                        let med_id = Uuid::new_v4().to_string();
                        conn.execute(
                            "INSERT INTO medications \
                             (id, name, is_draft, created_at, updated_at) \
                             VALUES (?1, ?2, 1, ?3, ?3)",
                            rusqlite::params![med_id, entity.name, now],
                        )?;
                        conn.execute(
                            "INSERT OR IGNORE INTO document_medications \
                             (document_id, medication_id) VALUES (?1, ?2)",
                            rusqlite::params![id, med_id],
                        )?;
                    }
                }
                EntityType::Diagnosis => {
                    let existing: Option<String> = conn
                        .query_row(
                            "SELECT id FROM symptoms WHERE name = ?1 AND is_draft = 0 LIMIT 1",
                            rusqlite::params![entity.name],
                            |row| row.get(0),
                        )
                        .optional()?;
                    if existing.is_none() {
                        let sym_id = Uuid::new_v4().to_string();
                        conn.execute(
                            "INSERT INTO symptoms \
                             (id, name, is_draft, created_at, updated_at) \
                             VALUES (?1, ?2, 1, ?3, ?3)",
                            rusqlite::params![sym_id, entity.name, now],
                        )?;
                        conn.execute(
                            "INSERT OR IGNORE INTO document_symptoms \
                             (document_id, symptom_id) VALUES (?1, ?2)",
                            rusqlite::params![id, sym_id],
                        )?;
                    }
                }
                _ => {}
            }
        }

        // Format activity date as "18 Nov 2021" for note titles
        let friendly_date = chrono::NaiveDate::parse_from_str(&resolved_activity_date, "%Y-%m-%d")
            .map(|d| d.format("%-d %b %Y").to_string())
            .unwrap_or_else(|_| resolved_activity_date.clone());

        let first_clinic_name: Option<&str> = clinic_suggestions.first().map(|c| c.name.as_str());

        // Build note content + title: invoice descriptions → clinical notes → first-line fallback
        let invoice_descs = crate::extraction::extract_invoice_descriptions(&result.text);
        let (note_title, notes_content_opt): (String, Option<String>) = if !invoice_descs.is_empty()
        {
            let content = invoice_descs.join("; ");
            let title = match first_clinic_name {
                Some(clinic) => format!("[{friendly_date}] Invoice - {clinic}"),
                None => format!("[{friendly_date}] Invoice"),
            };
            (title, Some(content))
        } else {
            match crate::extraction::extract_clinical_notes(&result.text) {
                Some(s) => {
                    let title = match first_clinic_name {
                        Some(clinic) => format!("[{friendly_date}] Clinical Notes - {clinic}"),
                        None => format!("[{friendly_date}] Clinical Notes"),
                    };
                    (title, Some(s))
                }
                None => {
                    let title = match first_clinic_name {
                        Some(clinic) => format!("[{friendly_date}] Document - {clinic}"),
                        None => format!("[{friendly_date}] Document"),
                    };
                    let content = crate::extraction::extract_first_lines(&result.text);
                    (title, content)
                }
            }
        };

        if let Some(ref notes_content) = notes_content_opt {
            let now = Utc::now().to_rfc3339();
            let existing_note_id: Option<String> = conn
                .query_row(
                    "SELECT note_id FROM note_links \
                     WHERE entity_type = 'document' AND entity_id = ?1 LIMIT 1",
                    [&id],
                    |row| row.get(0),
                )
                .optional()?;

            let note_id = if let Some(ref nid) = existing_note_id {
                conn.execute(
                    "UPDATE notes SET title = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
                    rusqlite::params![note_title, notes_content, now, nid],
                )?;
                nid.clone()
            } else {
                let nid = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO notes (id, title, content, is_pinned, created_at, updated_at)
                     VALUES (?1, ?2, ?3, 0, ?4, ?4)",
                    rusqlite::params![nid, note_title, notes_content, now],
                )?;
                let link_id = Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT OR IGNORE INTO note_links \
                     (id, note_id, entity_type, entity_id, created_at) \
                     VALUES (?1, ?2, 'document', ?3, ?4)",
                    rusqlite::params![link_id, nid, id, now],
                )?;
                nid
            };
            upsert_search_index(
                conn,
                "note",
                &note_id,
                &note_title,
                notes_content,
                "",
                "",
                "",
                "",
                &now,
            );
        }

        // Propagate extracted_text into FTS5 so content search finds this document
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
                doc.extracted_text.as_deref().unwrap_or(""),
                doc.activity_date.as_deref().unwrap_or(""),
            );
        }
    }

    let extracted_text_preview = {
        let trimmed = result.text.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.chars().take(400).collect::<String>())
        }
    };
    let clinical_notes = crate::extraction::extract_clinical_notes(&result.text);
    Ok(ExtractionSuggestions {
        draft_appointment_id: draft_appt_id,
        doctor_candidates: result.doctor_candidates,
        category_suggestion: result.category_suggestion,
        document_tags: result.document_tags,
        contact_suggestions: contact_dtos,
        clinic_suggestions,
        auto_tags,
        activity_date: Some(resolved_activity_date),
        extracted_text_preview,
        clinical_notes,
    })
}

#[derive(Debug, Serialize)]
pub struct DocumentEntity {
    pub id: String,
    pub document_id: String,
    pub entity_type: String,
    pub name: String,
    pub value: Option<String>,
    pub unit: Option<String>,
    pub raw_text: String,
    pub created_at: String,
}

#[tauri::command]
pub fn document_entities_get(
    document_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<DocumentEntity>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT id, document_id, entity_type, name, value, unit, raw_text, created_at \
         FROM document_entities \
         WHERE document_id = ?1 \
         ORDER BY entity_type, created_at",
    )?;
    let entities = stmt
        .query_map(rusqlite::params![document_id], |row| {
            Ok(DocumentEntity {
                id: row.get(0)?,
                document_id: row.get(1)?,
                entity_type: row.get(2)?,
                name: row.get(3)?,
                value: row.get(4)?,
                unit: row.get(5)?,
                raw_text: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(entities)
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

// ── V3-F6: Appointment suggestion from extracted document data ────────────────

#[derive(Debug, Serialize)]
pub struct AppointmentSuggestion {
    pub appt_date: String,
    pub title: String,
    pub doctor_name: Option<String>,
    pub specialty: Option<String>,
    pub clinic_name: Option<String>,
}

/// Returns a pre-filled appointment suggestion when the document has an
/// `activity_date` AND one of the invoice/receipt/bill type tags in its
/// auto-extracted tags. Returns `None` otherwise.
#[tauri::command]
pub fn appointments_suggest_from_document(
    id: String,
    state: State<'_, AppState>,
) -> Result<Option<AppointmentSuggestion>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    suggest_appointment_from_doc(conn, &id)
}

fn suggest_appointment_from_doc(
    conn: &rusqlite::Connection,
    id: &str,
) -> Result<Option<AppointmentSuggestion>, CommandError> {
    let row: Option<(Option<String>, Option<String>, Option<String>)> = conn
        .query_row(
            "SELECT activity_date, extracted_text, extracted_metadata \
             FROM documents WHERE id = ?1 AND is_deleted = 0",
            rusqlite::params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()?;

    let (activity_date, extracted_text, extracted_metadata) = match row {
        None => return Err(CommandError::NotFound(format!("document {id} not found"))),
        Some(r) => r,
    };

    let appt_date = match activity_date {
        None => return Ok(None),
        Some(d) => d,
    };

    let text = extracted_text.unwrap_or_default();

    let meta_json: Option<serde_json::Value> = extracted_metadata
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok());

    // Derive doctor_candidates from stored metadata or re-extract.
    let doctor_candidates: Vec<String> = meta_json
        .as_ref()
        .and_then(|v| {
            v["doctor_candidates"].as_array().map(|arr| {
                arr.iter()
                    .filter_map(|x| x.as_str().map(String::from))
                    .collect()
            })
        })
        .unwrap_or_else(|| crate::extraction::doctor::extract_doctor_candidates(&text));

    // Re-extract contact suggestions live — the stored metadata JSON does not
    // persist contact_suggestions, so reading it from meta_json always yields None.
    let clinic_name: Option<String> = crate::extraction::contact::first_clinic(&text);

    let auto_tags =
        crate::extraction::auto_extract_tags(&text, &doctor_candidates, Some(&appt_date));
    let _ = &auto_tags; // retained for caller; specialty derived below

    // Use suggest_category for specialty — more semantically accurate than
    // the first UPPERCASE auto_tag, which is order-sensitive and prone to
    // false matches (e.g. "physiother" in a footer winning over "cardiol").
    // Extract the leaf after "→" so "Internal Medicine → Cardiology" → "Cardiology".
    let specialty: Option<String> = crate::extraction::category::suggest_category(&text)
        .map(|cat| cat.rsplit('→').next().unwrap_or(&cat).trim().to_string());

    let doctor_name: Option<String> = crate::extraction::doctor::extract_performing_doctor(&text);

    // Build title: "{specialty} with {doctor} — {clinic}" with graceful fallback.
    let core = match (&specialty, &doctor_name) {
        (Some(sp), Some(dr)) => format!("{sp} with {dr}"),
        (Some(sp), None) => format!("{sp} appointment"),
        (None, Some(dr)) => format!("Appointment with {dr}"),
        (None, None) => "Medical appointment".to_string(),
    };
    let title = match &clinic_name {
        Some(cl) => format!("{core} — {cl}"),
        None => core,
    };

    Ok(Some(AppointmentSuggestion {
        appt_date,
        title,
        doctor_name,
        specialty,
        clinic_name,
    }))
}

// ── Phase 50: PDF report data assembly ──────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ReportAppointment {
    pub id: String,
    pub title: String,
    pub appt_date: String,
    pub doctor_name: Option<String>,
    pub clinic_name: Option<String>,
    pub specialty: Option<String>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ReportData {
    pub document_id: String,
    pub title: String,
    pub document_date: Option<String>,
    pub category: String,
    pub clinic_name: Option<String>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub entities: Vec<DocumentEntity>,
    pub appointments: Vec<ReportAppointment>,
    pub ocr_excerpt: Option<String>,
}

fn fetch_linked_appointments(conn: &rusqlite::Connection, doc_id: &str) -> Vec<ReportAppointment> {
    conn.prepare(
        "SELECT a.id, a.title, a.appt_date, a.doctor_name, a.clinic_name, a.specialty, a.status
         FROM appointments a
         INNER JOIN appointment_documents ad ON ad.appointment_id = a.id
         WHERE ad.document_id = ?1 AND a.is_deleted = 0
         ORDER BY a.appt_date DESC",
    )
    .ok()
    .and_then(|mut stmt| {
        stmt.query_map(rusqlite::params![doc_id], |row| {
            Ok(ReportAppointment {
                id: row.get(0)?,
                title: row.get(1)?,
                appt_date: row.get(2)?,
                doctor_name: row.get(3)?,
                clinic_name: row.get(4)?,
                specialty: row.get(5)?,
                status: row.get(6)?,
            })
        })
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
    })
    .unwrap_or_default()
}

fn fetch_doc_entities(conn: &rusqlite::Connection, doc_id: &str) -> Vec<DocumentEntity> {
    conn.prepare(
        "SELECT id, document_id, entity_type, name, value, unit, raw_text, created_at \
         FROM document_entities \
         WHERE document_id = ?1 \
         ORDER BY entity_type, created_at",
    )
    .ok()
    .and_then(|mut stmt| {
        stmt.query_map(rusqlite::params![doc_id], |row| {
            Ok(DocumentEntity {
                id: row.get(0)?,
                document_id: row.get(1)?,
                entity_type: row.get(2)?,
                name: row.get(3)?,
                value: row.get(4)?,
                unit: row.get(5)?,
                raw_text: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
    })
    .unwrap_or_default()
}

fn assemble_report(conn: &rusqlite::Connection, doc_id: &str) -> Result<ReportData, CommandError> {
    let doc = load_doc(conn, doc_id)?;
    let entities = fetch_doc_entities(conn, doc_id);
    let appointments = fetch_linked_appointments(conn, doc_id);
    let ocr_excerpt = doc
        .extracted_text
        .as_deref()
        .map(|t| t.chars().take(500).collect::<String>());
    Ok(ReportData {
        document_id: doc.id,
        title: doc.filename,
        document_date: doc.document_date,
        category: doc.category,
        clinic_name: doc.clinic_name,
        notes: doc.notes,
        tags: doc.tags,
        entities,
        appointments,
        ocr_excerpt,
    })
}

#[tauri::command]
pub fn documents_export_report(
    id: String,
    state: State<'_, AppState>,
) -> Result<ReportData, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    assemble_report(conn, &id)
}

#[tauri::command]
pub fn get_pending_review_count(state: State<'_, AppState>) -> Result<u32, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let count: u32 = conn.query_row(
        "SELECT \
           (SELECT COUNT(*) FROM contacts WHERE is_draft = 1) + \
           (SELECT COUNT(*) FROM clinics  WHERE is_draft = 1) + \
           (SELECT COUNT(*) FROM document_tags WHERE is_draft = 1)",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}
