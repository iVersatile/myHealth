use crate::commands::{AppState, CommandContext, CommandError};
use crate::extraction::entities::EntityType;
use rusqlite::OptionalExtension;
use tauri::State;

#[derive(Debug, serde::Serialize, Clone)]
pub struct Icd10Tag {
    pub code: String,
    pub description: String,
    pub confidence: f32,
}

/// Match extracted diagnosis entities against the ICD-10-CM FTS index and
/// persist the top result per entity into `document_icd10_tags`.
#[tauri::command]
pub fn documents_tag_icd10(
    document_id: String,
    state: State<AppState>,
) -> Result<Vec<Icd10Tag>, CommandError> {
    let guard = state.db.lock()?;
    let ctx = CommandContext::new(&guard)?;
    let conn = ctx.conn;

    let extracted_text: Option<String> = conn
        .query_row(
            "SELECT extracted_text FROM documents WHERE id = ?1 AND is_deleted = 0",
            rusqlite::params![document_id],
            |row| row.get(0),
        )
        .optional()?;

    let text = match extracted_text {
        Some(t) if !t.is_empty() => t,
        _ => return Ok(vec![]),
    };

    let tags = match_and_store(conn, &document_id, &text)?;
    Ok(tags)
}

/// Return the ICD-10 tags already stored for a document (no re-matching).
#[tauri::command]
pub fn documents_get_icd10_tags(
    document_id: String,
    state: State<AppState>,
) -> Result<Vec<Icd10Tag>, CommandError> {
    let guard = state.db.lock()?;
    let ctx = CommandContext::new(&guard)?;
    let mut stmt = ctx.conn.prepare(
        "SELECT code, description, confidence \
         FROM document_icd10_tags \
         WHERE document_id = ?1 \
         ORDER BY confidence DESC",
    )?;
    let tags = stmt
        .query_map(rusqlite::params![document_id], |row| {
            Ok(Icd10Tag {
                code: row.get(0)?,
                description: row.get(1)?,
                confidence: row.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(tags)
}

/// Extract diagnosis entities, search FTS5, and write results to `document_icd10_tags`.
/// Extracted so tests can call it directly without a Tauri `State`.
pub(crate) fn match_and_store(
    conn: &rusqlite::Connection,
    document_id: &str,
    text: &str,
) -> Result<Vec<Icd10Tag>, CommandError> {
    let entities = crate::extraction::entities::extract_entities(text);
    let diagnoses: Vec<String> = entities
        .into_iter()
        .filter(|e| e.entity_type == EntityType::Diagnosis)
        .map(|e| e.name)
        .collect();

    if diagnoses.is_empty() {
        return Ok(vec![]);
    }

    let mut tags: Vec<Icd10Tag> = Vec::new();

    for diagnosis in &diagnoses {
        // Build FTS5 query from alphabetic tokens >= 3 chars
        let tokens: Vec<&str> = diagnosis
            .split(|c: char| !c.is_alphabetic())
            .filter(|t| t.len() >= 3)
            .collect();
        if tokens.is_empty() {
            continue;
        }
        let fts_query = tokens.join(" ");

        let result: Option<(String, String, f64)> = conn
            .query_row(
                "SELECT c.code, c.description, icd10_fts.rank \
                 FROM icd10_fts \
                 JOIN icd10_codes c ON c.rowid = icd10_fts.rowid \
                 WHERE icd10_fts MATCH ?1 \
                 ORDER BY icd10_fts.rank \
                 LIMIT 1",
                rusqlite::params![fts_query],
                |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, f64>(2)?)),
            )
            .optional()?;

        if let Some((code, description, rank)) = result {
            // FTS5 rank is negative BM25; values closer to 0 are better matches.
            // Threshold -10.0 keeps only reasonably relevant hits.
            const RANK_THRESHOLD: f64 = -10.0;
            if rank > RANK_THRESHOLD && !tags.iter().any(|t| t.code == code) {
                let confidence = (1.0_f64 / (1.0 + rank.abs())) as f32;
                tags.push(Icd10Tag {
                    code,
                    description,
                    confidence,
                });
            }
        }
    }

    // Atomically replace stored tags for this document
    conn.execute(
        "DELETE FROM document_icd10_tags WHERE document_id = ?1",
        rusqlite::params![document_id],
    )?;
    for tag in &tags {
        conn.execute(
            "INSERT OR REPLACE INTO document_icd10_tags \
             (document_id, code, description, confidence) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![document_id, tag.code, tag.description, tag.confidence],
        )?;
    }

    Ok(tags)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             CREATE TABLE documents (
                 id TEXT PRIMARY KEY,
                 extracted_text TEXT,
                 is_deleted INTEGER NOT NULL DEFAULT 0
             );
             CREATE TABLE icd10_codes (
                 code TEXT PRIMARY KEY,
                 description TEXT NOT NULL
             );
             CREATE VIRTUAL TABLE icd10_fts USING fts5(
                 code,
                 description,
                 content='icd10_codes',
                 content_rowid='rowid'
             );
             CREATE TABLE document_icd10_tags (
                 document_id TEXT NOT NULL,
                 code TEXT NOT NULL,
                 description TEXT NOT NULL,
                 confidence REAL,
                 PRIMARY KEY (document_id, code)
             );",
        )
        .unwrap();
        conn
    }

    fn seed_icd10(conn: &Connection, codes: &[(&str, &str)]) {
        for (code, desc) in codes {
            conn.execute(
                "INSERT INTO icd10_codes(code, description) VALUES (?1, ?2)",
                rusqlite::params![code, desc],
            )
            .unwrap();
        }
        conn.execute_batch("INSERT INTO icd10_fts(icd10_fts) VALUES('rebuild')")
            .unwrap();
    }

    #[test]
    fn matches_hypertension_diagnosis() {
        let conn = setup_db();
        seed_icd10(
            &conn,
            &[
                ("I10", "Essential primary hypertension"),
                ("E11.9", "Type 2 diabetes mellitus without complications"),
                ("J18.9", "Pneumonia unspecified organism"),
            ],
        );

        let tags = match_and_store(&conn, "doc-1", "Diagnosis: Hypertension").unwrap();

        assert!(!tags.is_empty(), "expected at least one ICD-10 tag");
        assert!(
            tags.iter().any(|t| t.code == "I10"),
            "expected I10 (hypertension) in tags, got: {:?}",
            tags.iter().map(|t| &t.code).collect::<Vec<_>>()
        );
    }

    #[test]
    fn returns_empty_when_no_diagnosis_entities() {
        let conn = setup_db();
        seed_icd10(&conn, &[("I10", "Essential primary hypertension")]);

        let tags = match_and_store(&conn, "doc-2", "Patient visited for routine checkup.").unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn returns_empty_when_icd10_table_empty() {
        let conn = setup_db();

        let tags = match_and_store(&conn, "doc-3", "Diagnosis: Type 2 diabetes mellitus").unwrap();
        assert!(tags.is_empty());
    }

    #[test]
    fn persists_tags_to_document_icd10_tags() {
        let conn = setup_db();
        seed_icd10(
            &conn,
            &[("E11.9", "Type 2 diabetes mellitus without complications")],
        );

        match_and_store(&conn, "doc-4", "Diagnosis: Diabetes mellitus type 2").unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_icd10_tags WHERE document_id = 'doc-4'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(count >= 1, "expected stored tags, got 0");
    }

    #[test]
    fn replaces_tags_on_re_run() {
        let conn = setup_db();
        seed_icd10(&conn, &[("I10", "Essential primary hypertension")]);

        match_and_store(&conn, "doc-5", "Diagnosis: Hypertension").unwrap();
        let count_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_icd10_tags WHERE document_id = 'doc-5'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        match_and_store(&conn, "doc-5", "Diagnosis: Hypertension").unwrap();
        let count_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_icd10_tags WHERE document_id = 'doc-5'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(
            count_before, count_after,
            "re-run should replace, not accumulate"
        );
    }
}
