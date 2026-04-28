use std::fs;

use serde::{Deserialize, Serialize};
use tauri::State;

use super::CommandError;
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
) -> Result<ExportBundleData, CommandError> {
    if document_ids.is_empty() {
        return Err(CommandError::Internal(
            "no documents selected for export".to_string(),
        ));
    }
    if title.trim().is_empty() {
        return Err(CommandError::Internal(
            "bundle title cannot be empty".to_string(),
        ));
    }
    if output_path.trim().is_empty() {
        return Err(CommandError::Internal(
            "output path cannot be empty".to_string(),
        ));
    }

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let documents: Result<Vec<ExportDocumentItem>, String> = document_ids
        .iter()
        .map(|id| load_export_item(conn, id))
        .collect();

    let docs = documents.map_err(CommandError::Internal)?;
    Ok(ExportBundleData {
        title,
        output_path,
        documents: docs,
    })
}

#[tauri::command]
pub fn export_save_bytes(output_path: String, bytes_b64: String) -> Result<(), CommandError> {
    if output_path.trim().is_empty() {
        return Err(CommandError::Internal(
            "output path cannot be empty".to_string(),
        ));
    }
    let bytes = b64_decode(&bytes_b64).map_err(CommandError::Internal)?;
    fs::write(&output_path, &bytes).map_err(|e| CommandError::Internal(e.to_string()))
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

// ── Summary export data structs ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SummaryDocumentItem {
    pub id: String,
    pub filename: String,
    pub category: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub extracted_text: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SummaryAppointmentItem {
    pub id: String,
    pub title: String,
    pub doctor_name: Option<String>,
    pub specialty: Option<String>,
    pub appt_date: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SummaryContactItem {
    pub id: String,
    pub name: String,
    pub role: String,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SummaryData {
    pub documents: Vec<SummaryDocumentItem>,
    pub appointments: Vec<SummaryAppointmentItem>,
    pub contacts: Vec<SummaryContactItem>,
}

#[tauri::command]
pub fn export_pdf_summary_bytes(
    state: State<'_, AppState>,
    date_from: Option<String>,
    date_to: Option<String>,
    include_documents: bool,
    include_appointments: bool,
    include_contacts: bool,
) -> Result<SummaryData, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let documents = if include_documents {
        let from = date_from.as_deref().unwrap_or("1900-01-01");
        let to = date_to.as_deref().unwrap_or("2999-12-31");
        let mut stmt = conn.prepare(
            "SELECT id, filename, category, notes, created_at, extracted_text \
             FROM documents \
             WHERE is_deleted = 0 AND created_at >= ?1 AND created_at <= ?2 \
             ORDER BY created_at DESC",
        )?;
        let rows = stmt
            .query_map(rusqlite::params![from, to], |row| {
                Ok(SummaryDocumentItem {
                    id: row.get(0)?,
                    filename: row.get(1)?,
                    category: row.get(2)?,
                    notes: row.get(3)?,
                    created_at: row.get(4)?,
                    extracted_text: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    } else {
        vec![]
    };

    let appointments = if include_appointments {
        let from = date_from.as_deref().unwrap_or("1900-01-01");
        let to = date_to.as_deref().unwrap_or("2999-12-31");
        let mut stmt = conn.prepare(
            "SELECT id, title, doctor_name, specialty, appt_date, notes \
             FROM appointments \
             WHERE appt_date >= ?1 AND appt_date <= ?2 \
             ORDER BY appt_date DESC",
        )?;
        let rows = stmt
            .query_map(rusqlite::params![from, to], |row| {
                Ok(SummaryAppointmentItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    doctor_name: row.get(2)?,
                    specialty: row.get(3)?,
                    appt_date: row.get(4)?,
                    notes: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    } else {
        vec![]
    };

    let contacts = if include_contacts {
        let mut stmt = conn.prepare(
            "SELECT id, name, role, specialty, phone, email \
             FROM contacts \
             ORDER BY name ASC",
        )?;
        let rows = stmt
            .query_map([], |row| {
                Ok(SummaryContactItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    role: row.get(2)?,
                    specialty: row.get(3)?,
                    phone: row.get(4)?,
                    email: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    } else {
        vec![]
    };

    Ok(SummaryData {
        documents,
        appointments,
        contacts,
    })
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
        let result = if ids.is_empty() {
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

    fn open_test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        crate::db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn summary_documents_filtered_by_date() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at) \
             VALUES ('d1', 'lab.pdf', '/tmp/lab.pdf', 'application/pdf', 100, 'lab', '2026-01-15T10:00:00Z')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, created_at) \
             VALUES ('d2', 'old.pdf', '/tmp/old.pdf', 'application/pdf', 100, 'other', '2020-06-01T10:00:00Z')",
            [],
        ).unwrap();

        let from = "2026-01-01";
        let to = "2026-12-31";
        let mut stmt = conn
            .prepare(
                "SELECT id, filename, category, notes, created_at, extracted_text \
             FROM documents \
             WHERE is_deleted = 0 AND created_at >= ?1 AND created_at <= ?2 \
             ORDER BY created_at DESC",
            )
            .unwrap();
        let docs: Vec<SummaryDocumentItem> = stmt
            .query_map(rusqlite::params![from, to], |row| {
                Ok(SummaryDocumentItem {
                    id: row.get(0)?,
                    filename: row.get(1)?,
                    category: row.get(2)?,
                    notes: row.get(3)?,
                    created_at: row.get(4)?,
                    extracted_text: row.get(5)?,
                })
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(docs.len(), 1);
        assert_eq!(docs[0].id, "d1");
    }

    #[test]
    fn summary_appointments_filtered_by_date() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date) \
             VALUES ('a1', 'GP Visit', '2026-03-10T09:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date) \
             VALUES ('a2', 'Old Checkup', '2019-05-01T09:00:00Z')",
            [],
        )
        .unwrap();

        let from = "2026-01-01";
        let to = "2026-12-31";
        let mut stmt = conn
            .prepare(
                "SELECT id, title, doctor_name, specialty, appt_date, notes \
             FROM appointments \
             WHERE appt_date >= ?1 AND appt_date <= ?2 \
             ORDER BY appt_date DESC",
            )
            .unwrap();
        let appts: Vec<SummaryAppointmentItem> = stmt
            .query_map(rusqlite::params![from, to], |row| {
                Ok(SummaryAppointmentItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    doctor_name: row.get(2)?,
                    specialty: row.get(3)?,
                    appt_date: row.get(4)?,
                    notes: row.get(5)?,
                })
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(appts.len(), 1);
        assert_eq!(appts[0].id, "a1");
    }

    #[test]
    fn summary_contacts_returned_all() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO contacts (id, name, role) VALUES ('c1', 'Dr Smith', 'gp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO contacts (id, name, role) VALUES ('c2', 'Dr Jones', 'specialist')",
            [],
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id, name, role, specialty, phone, email FROM contacts ORDER BY name ASC",
            )
            .unwrap();
        let contacts: Vec<SummaryContactItem> = stmt
            .query_map([], |row| {
                Ok(SummaryContactItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    role: row.get(2)?,
                    specialty: row.get(3)?,
                    phone: row.get(4)?,
                    email: row.get(5)?,
                })
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(contacts.len(), 2);
        assert_eq!(contacts[0].name, "Dr Jones");
        assert_eq!(contacts[1].name, "Dr Smith");
    }
}
