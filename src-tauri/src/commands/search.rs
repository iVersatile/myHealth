use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use super::CommandError;
use crate::commands::{AppState, CommandContext};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub entity_type: String,
    pub entity_id: String,
    pub title: String,
    pub snippet: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResults {
    pub items: Vec<SearchResult>,
}

/// Strip HTML tags from a string (e.g. TipTap HTML content).
pub fn strip_html(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out
}

/// Insert or replace a row in search_index.
#[allow(clippy::too_many_arguments)]
pub fn upsert_search_index(
    conn: &Connection,
    entity_type: &str,
    entity_id: &str,
    title: &str,
    body: &str,
    tags: &str,
    extracted_metadata: &str,
    category_name: &str,
    extracted_text: &str,
    activity_date: &str,
) {
    let _ = conn.execute("DELETE FROM search_index WHERE entity_id = ?", [entity_id]);
    let _ = conn.execute(
        "INSERT INTO search_index (entity_type, entity_id, title, body, tags, extracted_metadata, category_name, extracted_text, activity_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        rusqlite::params![entity_type, entity_id, title, body, tags, extracted_metadata, category_name, extracted_text, activity_date],
    );
}

/// Remove a row from search_index by entity_id.
pub fn remove_from_search_index(conn: &Connection, entity_id: &str) {
    let _ = conn.execute("DELETE FROM search_index WHERE entity_id = ?", [entity_id]);
}

/// Build an FTS5 MATCH expression with prefix wildcards for each word.
pub(crate) fn build_fts_query(q: &str) -> String {
    let terms: Vec<String> = q
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|w| {
            let safe = w.replace('"', "");
            format!("{safe}*")
        })
        .collect();
    terms.join(" ")
}

#[tauri::command]
pub fn search_query(
    q: String,
    types: Option<Vec<String>>,
    state: State<'_, AppState>,
) -> Result<SearchResults, CommandError> {
    let q = q.trim().to_string();
    if q.is_empty() {
        return Ok(SearchResults { items: vec![] });
    }

    let fts_query = build_fts_query(&q);
    if fts_query.is_empty() {
        return Ok(SearchResults { items: vec![] });
    }

    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let filter_types = types.as_ref().filter(|t| !t.is_empty());

    let sql = if let Some(ft) = filter_types {
        let placeholders: Vec<String> = ft
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 2))
            .collect();
        format!(
            "SELECT entity_type, entity_id, title, \
             snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
             FROM search_index \
             WHERE search_index MATCH ?1 \
             AND entity_type IN ({}) \
             ORDER BY rank \
             LIMIT 50",
            placeholders.join(", ")
        )
    } else {
        "SELECT entity_type, entity_id, title, \
         snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
         FROM search_index \
         WHERE search_index MATCH ? \
         ORDER BY rank \
         LIMIT 50"
            .to_string()
    };

    let mut stmt = conn.prepare(&sql)?;

    let items: Vec<SearchResult> = if let Some(type_list) = filter_types {
        let mut params: Vec<rusqlite::types::Value> = vec![rusqlite::types::Value::Text(fts_query)];
        for t in type_list {
            params.push(rusqlite::types::Value::Text(t.clone()));
        }
        stmt.query_map(rusqlite::params_from_iter(params.iter()), row_to_result)?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map([&fts_query], row_to_result)?
            .filter_map(|r| r.ok())
            .collect()
    };

    Ok(SearchResults { items })
}

fn row_to_result(row: &rusqlite::Row<'_>) -> rusqlite::Result<SearchResult> {
    let tags_str: String = row.get::<_, Option<String>>(4)?.unwrap_or_default();
    let tags: Vec<String> = tags_str
        .split(',')
        .map(|t| t.trim().to_string())
        .filter(|t| !t.is_empty())
        .collect();
    Ok(SearchResult {
        entity_type: row.get(0)?,
        entity_id: row.get(1)?,
        title: row.get(2)?,
        snippet: row.get(3)?,
        tags,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentSearchResult {
    pub entity_type: String,
    pub id: String,
    pub title: String,
    pub snippet: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentSearchSummary {
    pub first_date: Option<String>,
    pub last_date: Option<String>,
    pub doc_count: u32,
    pub unique_providers: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ContentSearchResponse {
    pub results: Vec<ContentSearchResult>,
    pub summary: ContentSearchSummary,
}

fn content_search_inner(
    conn: &Connection,
    query: &str,
) -> Result<ContentSearchResponse, CommandError> {
    let empty = || ContentSearchResponse {
        results: vec![],
        summary: ContentSearchSummary {
            first_date: None,
            last_date: None,
            doc_count: 0,
            unique_providers: 0,
        },
    };

    let query = query.trim();
    if query.is_empty() {
        return Ok(empty());
    }

    let fts_query = build_fts_query(query);
    if fts_query.is_empty() {
        return Ok(empty());
    }

    let sql = "SELECT entity_type, entity_id, title, \
               snippet(search_index, 3, '<mark>', '</mark>', '…', 20) \
               FROM search_index \
               WHERE search_index MATCH ?1 \
               ORDER BY rank \
               LIMIT 50";

    let mut stmt = conn.prepare(sql)?;
    let results: Vec<ContentSearchResult> = stmt
        .query_map([&fts_query], |row| {
            Ok(ContentSearchResult {
                entity_type: row.get(0)?,
                id: row.get(1)?,
                title: row.get(2)?,
                snippet: row.get(3)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let doc_count = results.len() as u32;

    Ok(ContentSearchResponse {
        results,
        summary: ContentSearchSummary {
            first_date: None,
            last_date: None,
            doc_count,
            unique_providers: 0,
        },
    })
}

#[tauri::command]
pub fn documents_content_search(
    query: String,
    state: State<'_, AppState>,
) -> Result<ContentSearchResponse, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    content_search_inner(conn, &query)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn strip_html_removes_tags() {
        assert_eq!(strip_html("<p>hello world</p>"), "hello world");
        assert_eq!(strip_html("<b>blood</b> pressure"), "blood pressure");
        assert_eq!(strip_html("plain text"), "plain text");
        assert_eq!(strip_html("<br/>"), "");
    }

    #[test]
    fn strip_html_handles_nested() {
        assert_eq!(
            strip_html("<div><p>test <em>content</em></p></div>"),
            "test content"
        );
    }

    #[test]
    fn build_fts_query_single_word() {
        assert_eq!(build_fts_query("blood"), "blood*");
    }

    #[test]
    fn build_fts_query_multiple_words() {
        assert_eq!(build_fts_query("blood pressure"), "blood* pressure*");
    }

    #[test]
    fn build_fts_query_strips_quotes() {
        assert_eq!(build_fts_query(r#""blood""#), "blood*");
    }

    #[test]
    fn build_fts_query_empty_returns_empty() {
        assert_eq!(build_fts_query("   "), "");
    }

    #[test]
    fn upsert_adds_row() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Blood Pressure Log",
            "blood pressure 120/80",
            "health",
            "",
            "",
            "",
            "",
        );
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM search_index WHERE entity_id='n1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn upsert_replaces_existing_row() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Old Title",
            "old body",
            "",
            "",
            "",
            "",
            "",
        );
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "New Title",
            "new body",
            "",
            "",
            "",
            "",
            "",
        );
        let title: String = conn
            .query_row(
                "SELECT title FROM search_index WHERE entity_id='n1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(title, "New Title");
    }

    #[test]
    fn remove_deletes_row() {
        let conn = open_test_db();
        upsert_search_index(&conn, "note", "n1", "Title", "body", "", "", "", "", "");
        remove_from_search_index(&conn, "n1");
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM search_index WHERE entity_id='n1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn remove_nonexistent_is_noop() {
        let conn = open_test_db();
        remove_from_search_index(&conn, "nonexistent");
    }

    #[test]
    fn search_returns_matching_results() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Blood Pressure Log",
            "blood pressure 120/80 mmhg",
            "health",
            "",
            "",
            "",
            "",
        );
        upsert_search_index(
            &conn,
            "note",
            "n2",
            "Daily Journal",
            "feeling good today",
            "diary",
            "",
            "",
            "",
            "",
        );

        let fts_query = build_fts_query("blood");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].entity_id, "n1");
        assert_eq!(results[0].entity_type, "note");
    }

    #[test]
    fn search_prefix_matches_partial_word() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Prescription",
            "prescribed medication daily",
            "",
            "",
            "",
            "",
            "",
        );

        let fts_query = build_fts_query("presc");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(results.len(), 1);
    }

    #[test]
    fn tags_parsed_from_comma_separated() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "T",
            "b",
            "health,diary,lab",
            "",
            "",
            "",
            "",
        );
        let tags_str: String = conn
            .query_row(
                "SELECT tags FROM search_index WHERE entity_id='n1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let tags: Vec<String> = tags_str
            .split(',')
            .map(|t| t.trim().to_string())
            .filter(|t| !t.is_empty())
            .collect();
        assert_eq!(tags, vec!["health", "diary", "lab"]);
    }

    #[test]
    fn search_filtered_by_type() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Blood Note",
            "blood test results",
            "",
            "",
            "",
            "",
            "",
        );
        upsert_search_index(
            &conn,
            "appointment",
            "a1",
            "Blood Appointment",
            "blood draw scheduled",
            "",
            "",
            "",
            "",
            "",
        );

        let fts_query = build_fts_query("blood");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index \
                 WHERE search_index MATCH ?1 AND entity_type IN (?2) \
                 ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map(rusqlite::params![fts_query, "note"], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].entity_type, "note");
    }

    #[test]
    fn search_returns_empty_for_no_match() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Daily Journal",
            "feeling good today",
            "",
            "",
            "",
            "",
            "",
        );
        let fts_query = build_fts_query("blood");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(results.is_empty());
    }

    #[test]
    fn search_snippet_contains_mark_tag() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Blood Pressure Log",
            "blood pressure reading was normal",
            "",
            "",
            "",
            "",
            "",
        );
        let fts_query = build_fts_query("blood");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(results.len(), 1);
        assert!(
            results[0].snippet.contains("<mark>"),
            "snippet should contain <mark> highlight tags"
        );
    }

    #[test]
    fn upsert_with_empty_tags_gives_empty_vec() {
        let conn = open_test_db();
        upsert_search_index(&conn, "note", "n1", "Title", "body", "", "", "", "", "");
        let fts_query = build_fts_query("body");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(results.len(), 1);
        assert!(results[0].tags.is_empty());
    }

    #[test]
    fn multi_word_search_requires_all_terms() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "note",
            "n1",
            "Blood Pressure",
            "blood pressure high",
            "",
            "",
            "",
            "",
            "",
        );
        upsert_search_index(
            &conn,
            "note",
            "n2",
            "Blood Only",
            "just blood here",
            "",
            "",
            "",
            "",
            "",
        );

        let fts_query = build_fts_query("blood pressure");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].entity_id, "n1");
    }

    #[test]
    fn upsert_with_extracted_metadata() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "document",
            "d1",
            "Medical Report",
            "patient blood type O positive",
            "medical",
            r#"{"ocr_text": "blood type O positive", "confidence": 0.95}"#,
            "Lab Results",
            "",
            "",
        );

        let fts_query = build_fts_query("blood");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].entity_id, "d1");

        let metadata: String = conn
            .query_row(
                "SELECT extracted_metadata FROM search_index WHERE entity_id='d1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(metadata.contains("blood type O positive"));
    }

    #[test]
    fn search_returns_hits_from_extracted_text() {
        let conn = open_test_db();
        upsert_search_index(
            &conn,
            "document",
            "d1",
            "Invoice",
            "",
            "",
            "",
            "",
            "patient diagnosed with hypertension",
            "",
        );
        upsert_search_index(
            &conn,
            "document",
            "d2",
            "Receipt",
            "",
            "",
            "",
            "",
            "routine check-up visit",
            "",
        );

        let fts_query = build_fts_query("hypertension");
        let mut stmt = conn
            .prepare(
                "SELECT entity_type, entity_id, title, \
                 snippet(search_index, 3, '<mark>', '</mark>', '…', 16), tags \
                 FROM search_index WHERE search_index MATCH ? ORDER BY rank LIMIT 50",
            )
            .unwrap();
        let results: Vec<SearchResult> = stmt
            .query_map([&fts_query], row_to_result)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].entity_id, "d1");
    }

    #[allow(dead_code)]
    fn insert_document(conn: &Connection, id: &str, filename: &str, activity_date: Option<&str>) {
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, is_deleted, activity_date)
             VALUES (?1, ?2, '', 'application/pdf', 0, 'other', 0, ?3)",
            rusqlite::params![id, filename, activity_date],
        )
        .unwrap();
    }

    #[test]
    fn content_search_returns_matching_entities() {
        let conn = open_test_db();

        upsert_search_index(
            &conn,
            "document",
            "d1",
            "Invoice Jan",
            "blood pressure reading was elevated",
            "",
            "",
            "",
            "",
            "",
        );
        upsert_search_index(
            &conn,
            "document",
            "d2",
            "Invoice Mar",
            "blood pressure normal today",
            "",
            "",
            "",
            "",
            "",
        );
        upsert_search_index(
            &conn,
            "document",
            "d3",
            "Receipt May",
            "routine check-up visit",
            "",
            "",
            "",
            "",
            "",
        );

        let resp = content_search_inner(&conn, "blood").unwrap();
        assert_eq!(resp.results.len(), 2);
        assert_eq!(resp.summary.doc_count, 2);
        let ids: Vec<&str> = resp.results.iter().map(|r| r.id.as_str()).collect();
        assert!(ids.contains(&"d1"));
        assert!(ids.contains(&"d2"));
    }

    #[test]
    fn content_search_empty_query_returns_empty() {
        let conn = open_test_db();
        let resp = content_search_inner(&conn, "   ").unwrap();
        assert!(resp.results.is_empty());
        assert_eq!(resp.summary.doc_count, 0);
    }

    #[test]
    fn content_search_returns_all_matched_entities_regardless_of_type() {
        let conn = open_test_db();

        upsert_search_index(
            &conn,
            "document",
            "d1",
            "Doc One",
            "cholesterol levels high",
            "",
            "",
            "",
            "",
            "",
        );
        upsert_search_index(
            &conn,
            "symptom",
            "s1",
            "High Cholesterol",
            "cholesterol check routine",
            "",
            "",
            "",
            "",
            "",
        );

        let resp = content_search_inner(&conn, "cholesterol").unwrap();
        assert_eq!(resp.results.len(), 2);
        let types: Vec<&str> = resp
            .results
            .iter()
            .map(|r| r.entity_type.as_str())
            .collect();
        assert!(types.contains(&"document"));
        assert!(types.contains(&"symptom"));
    }

    #[test]
    fn content_search_snippet_contains_mark() {
        let conn = open_test_db();

        upsert_search_index(
            &conn,
            "document",
            "d1",
            "Lab Report",
            "glucose level was high this month",
            "",
            "",
            "",
            "",
            "",
        );

        let resp = content_search_inner(&conn, "glucose").unwrap();
        assert_eq!(resp.results.len(), 1);
        assert!(
            resp.results[0].snippet.contains("<mark>"),
            "snippet must contain <mark>"
        );
    }

    #[test]
    fn content_search_returns_symptom_in_results() {
        let conn = open_test_db();

        upsert_search_index(
            &conn,
            "symptom",
            "sym-1",
            "Migraine",
            "severe headache with light sensitivity",
            "",
            "",
            "",
            "",
            "",
        );

        let resp = content_search_inner(&conn, "headache").unwrap();
        assert_eq!(resp.results.len(), 1);
        assert_eq!(resp.results[0].id, "sym-1");
        assert_eq!(resp.results[0].entity_type, "symptom");
    }
}
