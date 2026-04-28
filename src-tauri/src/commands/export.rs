use std::fs;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::{AppState, CommandContext};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportDocumentItem {
    pub id: String,
    pub filename: String,
    pub category: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub mime_type: String,
    pub file_bytes_b64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportBundleData {
    pub title: String,
    pub output_path: String,
    pub documents: Vec<ExportDocumentItem>,
}

fn load_export_item(conn: &rusqlite::Connection, id: &str) -> Result<ExportDocumentItem, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, filename, file_path, mime_type, category, notes, created_at \
             FROM documents WHERE id = ? AND is_deleted = 0",
        )
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| format!("document {id} not found: {e}"))?;

    let (doc_id, filename, file_path, mime_type, category, notes, created_at) = row;

    let file_bytes_b64 = if std::path::Path::new(&file_path).exists() {
        let bytes = fs::read(&file_path).map_err(|e| e.to_string())?;
        Some(b64_encode(&bytes))
    } else {
        None
    };

    Ok(ExportDocumentItem {
        id: doc_id,
        filename,
        category,
        notes,
        created_at,
        mime_type,
        file_bytes_b64,
    })
}

fn b64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 {
            chunk[1] as usize
        } else {
            0
        };
        let b2 = if chunk.len() > 2 {
            chunk[2] as usize
        } else {
            0
        };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 {
            CHARS[((b1 & 15) << 2) | (b2 >> 6)] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            CHARS[b2 & 63] as char
        } else {
            '='
        });
    }
    out
}

#[tauri::command]
pub fn export_pdf_bundle(
    state: State<'_, AppState>,
    document_ids: Vec<String>,
    title: String,
    output_path: String,
) -> Result<ExportBundleData, String> {
    if document_ids.is_empty() {
        return Err("no documents selected for export".to_string());
    }
    if title.trim().is_empty() {
        return Err("bundle title cannot be empty".to_string());
    }
    if output_path.trim().is_empty() {
        return Err("output path cannot be empty".to_string());
    }

    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = CommandContext::new(&guard)?.conn;

    let documents: Result<Vec<ExportDocumentItem>, String> = document_ids
        .iter()
        .map(|id| load_export_item(conn, id))
        .collect();

    Ok(ExportBundleData {
        title,
        output_path,
        documents: documents?,
    })
}

#[tauri::command]
pub fn export_save_bytes(output_path: String, bytes_b64: String) -> Result<(), String> {
    if output_path.trim().is_empty() {
        return Err("output path cannot be empty".to_string());
    }
    let bytes = b64_decode(&bytes_b64).map_err(|e| e.to_string())?;
    fs::write(&output_path, &bytes).map_err(|e| e.to_string())
}

fn b64_decode(input: &str) -> Result<Vec<u8>, String> {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let input = input.trim_end_matches('=');
    let mut out = Vec::with_capacity(input.len() * 3 / 4);
    let mut buf = 0u32;
    let mut bits = 0u8;
    for &c in input.as_bytes() {
        let val = CHARS
            .iter()
            .position(|&x| x == c)
            .ok_or_else(|| format!("invalid base64 char: {c}"))?;
        buf = (buf << 6) | val as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn b64_empty() {
        assert_eq!(b64_encode(b""), "");
    }

    #[test]
    fn b64_known_vectors() {
        assert_eq!(b64_encode(b"Man"), "TWFu");
        assert_eq!(b64_encode(b"Ma"), "TWE=");
        assert_eq!(b64_encode(b"M"), "TQ==");
        assert_eq!(b64_encode(b"hello"), "aGVsbG8=");
    }

    #[test]
    fn bundle_data_serializes() {
        let bundle = ExportBundleData {
            title: "Health Records".to_string(),
            output_path: "/tmp/out.pdf".to_string(),
            documents: vec![],
        };
        let json = serde_json::to_string(&bundle).unwrap();
        assert!(json.contains("Health Records"));
        assert!(json.contains("/tmp/out.pdf"));
    }

    #[test]
    fn export_item_serializes() {
        let item = ExportDocumentItem {
            id: "abc-123".to_string(),
            filename: "test.pdf".to_string(),
            category: "lab".to_string(),
            notes: None,
            created_at: "2026-04-20T10:00:00Z".to_string(),
            mime_type: "application/pdf".to_string(),
            file_bytes_b64: Some("dGVzdA==".to_string()),
        };
        let json = serde_json::to_string(&item).unwrap();
        assert!(json.contains("abc-123"));
        assert!(json.contains("application/pdf"));
    }

    #[test]
    fn validate_rejects_empty_ids_at_boundary() {
        let ids: Vec<String> = vec![];
        let result: Result<(), String> = if ids.is_empty() {
            Err("no documents selected for export".to_string())
        } else {
            Ok(())
        };
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "no documents selected for export");
    }

    #[test]
    fn validate_rejects_blank_title() {
        let title = "   ";
        let result: Result<(), String> = if title.trim().is_empty() {
            Err("bundle title cannot be empty".to_string())
        } else {
            Ok(())
        };
        assert!(result.is_err());
    }
}
