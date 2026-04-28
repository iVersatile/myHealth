use std::collections::HashMap;

use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::commands::{AppState, CommandContext};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocumentLink {
    pub id: String,
    pub document_id: String,
    pub appointment_id: String,
    pub link_type: String,
    pub confidence: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct LinkCreateInput {
    pub document_id: String,
    pub appointment_id: String,
    pub link_type: Option<String>,
    pub confidence: Option<String>,
}

fn row_to_link(row: &rusqlite::Row<'_>) -> rusqlite::Result<DocumentLink> {
    Ok(DocumentLink {
        id: row.get(0)?,
        document_id: row.get(1)?,
        appointment_id: row.get(2)?,
        link_type: row.get(3)?,
        confidence: row.get(4)?,
        created_at: row.get(5)?,
    })
}

#[tauri::command]
pub fn links_create(
    state: State<'_, AppState>,
    input: LinkCreateInput,
) -> Result<DocumentLink, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let link_type = input.link_type.unwrap_or_else(|| "related".to_string());
    let confidence = input.confidence.unwrap_or_else(|| "manual".to_string());

    conn.execute(
        "INSERT INTO document_appointments (id, document_id, appointment_id, link_type, confidence, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, input.document_id, input.appointment_id, link_type, confidence, now],
    )
    ?;

    conn.query_row(
        "SELECT id, document_id, appointment_id, link_type, confidence, created_at
         FROM document_appointments WHERE id = ?1",
        params![id],
        row_to_link,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn links_delete(state: State<'_, AppState>, id: String) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.execute(
        "DELETE FROM document_appointments WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn links_list_for_document(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<Vec<DocumentLink>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT id, document_id, appointment_id, link_type, confidence, created_at
             FROM document_appointments WHERE document_id = ?1
             ORDER BY created_at DESC",
    )?;

    let rows = stmt.query_map(params![document_id], row_to_link)?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn links_list_for_appointment(
    state: State<'_, AppState>,
    appointment_id: String,
) -> Result<Vec<DocumentLink>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT id, document_id, appointment_id, link_type, confidence, created_at
             FROM document_appointments WHERE appointment_id = ?1
             ORDER BY created_at DESC",
    )?;

    let rows = stmt.query_map(params![appointment_id], row_to_link)?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

// ─── Task 2.2: typed CRUD commands ──────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct LinkedAppointment {
    pub appointment_id: String,
    pub title: String,
    pub appt_date: String,
    pub doctor_name: Option<String>,
    pub score: u8,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct LinkedDocument {
    pub document_id: String,
    pub filename: String,
    pub category: String,
    pub document_date: Option<String>,
    pub score: u8,
    pub created_at: String,
}

#[tauri::command]
pub fn link_document_to_appointment(
    state: State<'_, AppState>,
    _user_id: String,
    document_id: String,
    appointment_id: String,
    score: u8,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO document_appointments \
         (id, document_id, appointment_id, link_type, confidence, score, created_at) \
         VALUES (?1, ?2, ?3, 'related', 'auto', ?4, ?5)",
        params![id, document_id, appointment_id, score, now],
    )?;
    Ok(())
}

#[tauri::command]
pub fn unlink_document_from_appointment(
    state: State<'_, AppState>,
    _user_id: String,
    document_id: String,
    appointment_id: String,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.execute(
        "DELETE FROM document_appointments \
         WHERE document_id = ?1 AND appointment_id = ?2",
        params![document_id, appointment_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn get_document_links(
    state: State<'_, AppState>,
    _user_id: String,
    document_id: String,
) -> Result<Vec<LinkedAppointment>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT a.id, a.title, a.appt_date, a.doctor_name, da.score, da.created_at
             FROM document_appointments da
             JOIN appointments a ON a.id = da.appointment_id
             WHERE da.document_id = ?1
             ORDER BY da.score DESC, da.created_at DESC",
    )?;

    let rows = stmt.query_map(params![document_id], |row| {
        Ok(LinkedAppointment {
            appointment_id: row.get(0)?,
            title: row.get(1)?,
            appt_date: row.get(2)?,
            doctor_name: row.get(3)?,
            score: row.get::<_, u8>(4).unwrap_or(0),
            created_at: row.get(5)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn get_appointment_links(
    state: State<'_, AppState>,
    _user_id: String,
    appointment_id: String,
) -> Result<Vec<LinkedDocument>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let mut stmt = conn.prepare(
        "SELECT d.id, d.filename, d.category, d.document_date, da.score, da.created_at
             FROM document_appointments da
             JOIN documents d ON d.id = da.document_id
             WHERE da.appointment_id = ?1
             ORDER BY da.score DESC, da.created_at DESC",
    )?;

    let rows = stmt.query_map(params![appointment_id], |row| {
        Ok(LinkedDocument {
            document_id: row.get(0)?,
            filename: row.get(1)?,
            category: row.get(2)?,
            document_date: row.get(3)?,
            score: row.get::<_, u8>(4).unwrap_or(0),
            created_at: row.get(5)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[derive(Debug, Serialize)]
pub struct LinkSuggestion {
    pub appointment_id: String,
    pub appointment_title: String,
    pub score: u8,
    pub reasons: Vec<String>,
}

#[tauri::command]
pub fn links_score_candidates(
    state: State<'_, AppState>,
    document_id: String,
) -> Result<Vec<LinkSuggestion>, CommandError> {
    use crate::commands::appointments::Appointment;
    use crate::services::linking::scorer::score_candidates;

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    // Fetch the document
    let doc = conn.query_row(
        "SELECT id, filename, file_path, mime_type, file_size_bytes, category,
                    thumbnail_path, notes, created_at, updated_at, is_deleted,
                    document_date, extracted_metadata, extracted_text
             FROM documents WHERE id = ?1 AND is_deleted = 0",
        params![document_id],
        |row| {
            Ok(crate::commands::documents::Document {
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
                extracted_metadata: row.get(12)?,
                extracted_text: row.get(13)?,
                tags: vec![],
            })
        },
    )?;

    // Fetch all appointments
    let mut stmt = conn.prepare(
        "SELECT id, title, doctor_name, clinic_name, specialty, appt_date,
                    duration_min, location, notes, status, reminder_min, created_at, updated_at
             FROM appointments ORDER BY appt_date DESC",
    )?;

    let appointments: Vec<Appointment> = stmt
        .query_map([], |row| {
            Ok(Appointment {
                id: row.get(0)?,
                title: row.get(1)?,
                doctor_name: row.get(2)?,
                clinic_name: row.get(3)?,
                specialty: row.get(4)?,
                appt_date: row.get(5)?,
                duration_min: row.get(6)?,
                location: row.get(7)?,
                notes: row.get(8)?,
                status: row.get(9)?,
                reminder_min: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
                document_ids: vec![],
            })
        })?
        .collect::<Result<_, _>>()
        .map_err(|e: rusqlite::Error| CommandError::Internal(e.to_string()))?;

    // Build appt_id → category names map
    let mut appt_categories: HashMap<String, Vec<String>> = HashMap::new();
    let mut cat_stmt = conn.prepare(
        "SELECT ac.appointment_id, c.name
             FROM appointment_categories ac
             JOIN categories c ON c.id = ac.category_id",
    )?;

    let cat_rows = cat_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    for row in cat_rows {
        let (appt_id, cat_name) = row?;
        appt_categories.entry(appt_id).or_default().push(cat_name);
    }

    // Score all candidates and return those meeting the threshold
    let candidates = score_candidates(&doc, &appointments, &appt_categories);

    let mut suggestions: Vec<LinkSuggestion> = Vec::with_capacity(candidates.len());
    for candidate in candidates {
        let title: String = conn.query_row(
            "SELECT title FROM appointments WHERE id = ?1",
            params![candidate.appointment_id],
            |row| row.get(0),
        )?;
        suggestions.push(LinkSuggestion {
            appointment_id: candidate.appointment_id,
            appointment_title: title,
            score: candidate.score,
            reasons: candidate.reasons,
        });
    }

    Ok(suggestions)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::migrations;
    use rusqlite::Connection;

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        migrations::run(&conn).unwrap();
        conn
    }

    fn insert_link(
        conn: &Connection,
        id: &str,
        doc_id: &str,
        appt_id: &str,
        link_type: &str,
        confidence: &str,
    ) {
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, '2026-01-01T00:00:00Z')",
            params![id, doc_id, appt_id, link_type, confidence],
        )
        .unwrap();
    }

    fn insert_document(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category) \
             VALUES (?1, 'test.pdf', '/tmp/test.pdf', 'application/pdf', 100, 'other')",
            params![id],
        )
        .unwrap();
    }

    fn insert_appointment(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date) \
             VALUES (?1, 'Test Appt', '2026-01-01T09:00:00Z')",
            params![id],
        )
        .unwrap();
    }

    #[test]
    fn create_link_defaults() {
        let conn = open_test_db();
        insert_document(&conn, "doc1");
        insert_appointment(&conn, "appt1");

        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES (?1, 'doc1', 'appt1', 'related', 'manual', ?2)",
            params![id, now],
        )
        .unwrap();

        let link: DocumentLink = conn
            .query_row(
                "SELECT id, document_id, appointment_id, link_type, confidence, created_at \
                 FROM document_appointments WHERE id = ?1",
                params![id],
                row_to_link,
            )
            .unwrap();

        assert_eq!(link.document_id, "doc1");
        assert_eq!(link.appointment_id, "appt1");
        assert_eq!(link.link_type, "related");
        assert_eq!(link.confidence, "manual");
    }

    #[test]
    fn create_link_explicit_confidence() {
        let conn = open_test_db();
        insert_document(&conn, "doc2");
        insert_appointment(&conn, "appt2");

        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES (?1, 'doc2', 'appt2', 'primary', 'auto', ?2)",
            params![id, now],
        )
        .unwrap();

        let link: DocumentLink = conn
            .query_row(
                "SELECT id, document_id, appointment_id, link_type, confidence, created_at \
                 FROM document_appointments WHERE id = ?1",
                params![id],
                row_to_link,
            )
            .unwrap();

        assert_eq!(link.link_type, "primary");
        assert_eq!(link.confidence, "auto");
    }

    #[test]
    fn delete_link() {
        let conn = open_test_db();
        insert_document(&conn, "doc3");
        insert_appointment(&conn, "appt3");
        insert_link(&conn, "link3", "doc3", "appt3", "related", "manual");

        conn.execute("DELETE FROM document_appointments WHERE id = 'link3'", [])
            .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_appointments WHERE id = 'link3'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn list_for_document() {
        let conn = open_test_db();
        insert_document(&conn, "doc4");
        insert_appointment(&conn, "appt4a");
        insert_appointment(&conn, "appt4b");
        insert_link(&conn, "link4a", "doc4", "appt4a", "related", "manual");
        insert_link(&conn, "link4b", "doc4", "appt4b", "related", "auto");

        let mut stmt = conn
            .prepare(
                "SELECT id, document_id, appointment_id, link_type, confidence, created_at \
                 FROM document_appointments WHERE document_id = 'doc4'",
            )
            .unwrap();
        let links: Vec<DocumentLink> = stmt
            .query_map([], row_to_link)
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(links.len(), 2);
        assert!(links.iter().all(|l| l.document_id == "doc4"));
    }

    #[test]
    fn list_for_appointment() {
        let conn = open_test_db();
        insert_document(&conn, "doc5a");
        insert_document(&conn, "doc5b");
        insert_appointment(&conn, "appt5");
        insert_link(&conn, "link5a", "doc5a", "appt5", "related", "manual");
        insert_link(&conn, "link5b", "doc5b", "appt5", "related", "manual");

        let mut stmt = conn
            .prepare(
                "SELECT id, document_id, appointment_id, link_type, confidence, created_at \
                 FROM document_appointments WHERE appointment_id = 'appt5'",
            )
            .unwrap();
        let links: Vec<DocumentLink> = stmt
            .query_map([], row_to_link)
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(links.len(), 2);
        assert!(links.iter().all(|l| l.appointment_id == "appt5"));
    }

    #[test]
    fn duplicate_rejected() {
        let conn = open_test_db();
        insert_document(&conn, "doc6");
        insert_appointment(&conn, "appt6");
        insert_link(&conn, "link6", "doc6", "appt6", "related", "manual");

        let result = conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES ('link6dup', 'doc6', 'appt6', 'related', 'manual', '2026-01-01T00:00:00Z')",
            [],
        );
        assert!(result.is_err());
    }

    #[test]
    fn cascade_delete_with_document() {
        let conn = open_test_db();
        insert_document(&conn, "doc7");
        insert_appointment(&conn, "appt7");
        insert_link(&conn, "link7", "doc7", "appt7", "related", "manual");

        conn.execute("DELETE FROM documents WHERE id = 'doc7'", [])
            .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_appointments WHERE id = 'link7'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    // ─── Task 2.2 command tests ────────────────────────────────────────────

    fn insert_link_scored(conn: &Connection, id: &str, doc_id: &str, appt_id: &str, score: u8) {
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, score, created_at) \
             VALUES (?1, ?2, ?3, 'related', 'auto', ?4, '2026-01-01T00:00:00Z')",
            params![id, doc_id, appt_id, score],
        )
        .unwrap();
    }

    #[test]
    fn link_document_inserts_row_with_score() {
        let conn = open_test_db();
        insert_document(&conn, "da_doc1");
        insert_appointment(&conn, "da_appt1");

        let id = Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, score, created_at) \
             VALUES (?1, 'da_doc1', 'da_appt1', 'related', 'auto', 7, ?2)",
            params![id, now],
        )
        .unwrap();

        let score: u8 = conn
            .query_row(
                "SELECT score FROM document_appointments WHERE document_id = 'da_doc1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(score, 7);
    }

    #[test]
    fn unlink_by_pair_removes_only_that_row() {
        let conn = open_test_db();
        insert_document(&conn, "da_doc2");
        insert_appointment(&conn, "da_appt2a");
        insert_appointment(&conn, "da_appt2b");
        insert_link_scored(&conn, "da_link2a", "da_doc2", "da_appt2a", 5);
        insert_link_scored(&conn, "da_link2b", "da_doc2", "da_appt2b", 8);

        conn.execute(
            "DELETE FROM document_appointments \
             WHERE document_id = 'da_doc2' AND appointment_id = 'da_appt2a'",
            [],
        )
        .unwrap();

        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_appointments WHERE document_id = 'da_doc2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(remaining, 1);

        let still_there: String = conn
            .query_row(
                "SELECT appointment_id FROM document_appointments WHERE document_id = 'da_doc2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(still_there, "da_appt2b");
    }

    #[test]
    fn get_document_links_returns_appointments() {
        let conn = open_test_db();
        insert_document(&conn, "da_doc3");
        insert_appointment(&conn, "da_appt3a");
        insert_appointment(&conn, "da_appt3b");
        insert_link_scored(&conn, "da_link3a", "da_doc3", "da_appt3a", 6);
        insert_link_scored(&conn, "da_link3b", "da_doc3", "da_appt3b", 9);

        let mut stmt = conn
            .prepare(
                "SELECT a.id, a.title, a.appt_date, a.doctor_name, da.score, da.created_at
                 FROM document_appointments da
                 JOIN appointments a ON a.id = da.appointment_id
                 WHERE da.document_id = 'da_doc3'
                 ORDER BY da.score DESC",
            )
            .unwrap();
        let links: Vec<LinkedAppointment> = stmt
            .query_map([], |row| {
                Ok(LinkedAppointment {
                    appointment_id: row.get(0)?,
                    title: row.get(1)?,
                    appt_date: row.get(2)?,
                    doctor_name: row.get(3)?,
                    score: row.get::<_, u8>(4).unwrap_or(0),
                    created_at: row.get(5)?,
                })
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(links.len(), 2);
        assert_eq!(links[0].score, 9);
        assert_eq!(links[0].appointment_id, "da_appt3b");
        assert_eq!(links[1].score, 6);
    }

    #[test]
    fn get_appointment_links_returns_documents() {
        let conn = open_test_db();
        insert_document(&conn, "da_doc4a");
        insert_document(&conn, "da_doc4b");
        insert_appointment(&conn, "da_appt4");
        insert_link_scored(&conn, "da_link4a", "da_doc4a", "da_appt4", 5);
        insert_link_scored(&conn, "da_link4b", "da_doc4b", "da_appt4", 7);

        let mut stmt = conn
            .prepare(
                "SELECT d.id, d.filename, d.category, d.document_date, da.score, da.created_at
                 FROM document_appointments da
                 JOIN documents d ON d.id = da.document_id
                 WHERE da.appointment_id = 'da_appt4'
                 ORDER BY da.score DESC",
            )
            .unwrap();
        let links: Vec<LinkedDocument> = stmt
            .query_map([], |row| {
                Ok(LinkedDocument {
                    document_id: row.get(0)?,
                    filename: row.get(1)?,
                    category: row.get(2)?,
                    document_date: row.get(3)?,
                    score: row.get::<_, u8>(4).unwrap_or(0),
                    created_at: row.get(5)?,
                })
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(links.len(), 2);
        assert_eq!(links[0].score, 7);
        assert_eq!(links[0].document_id, "da_doc4b");
    }

    #[test]
    fn link_transaction_rolls_back_on_fk_violation() {
        let conn = open_test_db();
        insert_document(&conn, "da_doc5");

        // appointment 'ghost' does not exist → FK violation
        let result = conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, score, created_at) \
             VALUES ('da_lx', 'da_doc5', 'ghost', 'related', 'auto', 5, '2026-01-01')",
            [],
        );
        assert!(result.is_err(), "FK violation should prevent insert");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_appointments WHERE id = 'da_lx'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }
}
