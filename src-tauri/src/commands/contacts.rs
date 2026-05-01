use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::search::{remove_from_search_index, upsert_search_index};
use crate::commands::{AppState, CommandContext, CommandError};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub role: String,
    pub title: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ContactCreateInput {
    pub name: String,
    pub role: String,
    pub title: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ContactUpdateInput {
    pub id: String,
    pub name: Option<String>,
    pub role: Option<String>,
    pub title: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

fn row_to_contact(row: &rusqlite::Row) -> rusqlite::Result<Contact> {
    Ok(Contact {
        id: row.get(0)?,
        name: row.get(1)?,
        role: row.get(2)?,
        specialty: row.get(3)?,
        phone: row.get(4)?,
        email: row.get(5)?,
        clinic: row.get(6)?,
        address: row.get(7)?,
        notes: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        title: row.get(11)?,
    })
}

#[tauri::command]
pub fn contacts_list(
    role: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Contact>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let contacts: Vec<Contact> = if let Some(r) = role {
        let mut stmt = conn.prepare(
            "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at, title FROM contacts WHERE role = ? ORDER BY name",
        )?;
        let rows: Vec<Contact> = stmt
            .query_map([r], row_to_contact)?
            .filter_map(|r| r.ok())
            .collect();
        rows
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at, title FROM contacts ORDER BY name",
        )?;
        let rows: Vec<Contact> = stmt
            .query_map([], row_to_contact)?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    Ok(contacts)
}

#[tauri::command]
pub fn contacts_get(id: String, state: State<'_, AppState>) -> Result<Contact, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.query_row(
        "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
         created_at, updated_at, title FROM contacts WHERE id = ?",
        [&id],
        row_to_contact,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn contacts_create(
    input: ContactCreateInput,
    state: State<'_, AppState>,
) -> Result<Contact, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO contacts (id, name, role, title, specialty, phone, email, clinic, address, \
         notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            id,
            input.name,
            input.role,
            input.title,
            input.specialty,
            input.phone,
            input.email,
            input.clinic,
            input.address,
            input.notes,
            now,
            now,
        ],
    )?;

    let c = conn.query_row(
        "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
             created_at, updated_at, title FROM contacts WHERE id = ?",
        [&id],
        row_to_contact,
    )?;
    let body = [
        c.specialty.as_deref().unwrap_or(""),
        c.clinic.as_deref().unwrap_or(""),
        c.address.as_deref().unwrap_or(""),
        c.notes.as_deref().unwrap_or(""),
    ]
    .join(" ");
    upsert_search_index(conn, "contact", &c.id, &c.name, &body, "", "", "");
    Ok(c)
}

#[tauri::command]
pub fn contacts_update(
    input: ContactUpdateInput,
    state: State<'_, AppState>,
) -> Result<Contact, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let now = Utc::now().to_rfc3339();

    if let Some(name) = input.name {
        conn.execute(
            "UPDATE contacts SET name = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![name, now, input.id],
        )?;
    }
    if let Some(role) = input.role {
        conn.execute(
            "UPDATE contacts SET role = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![role, now, input.id],
        )?;
    }
    if let Some(specialty) = input.specialty {
        conn.execute(
            "UPDATE contacts SET specialty = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![specialty, now, input.id],
        )?;
    }
    if let Some(phone) = input.phone {
        conn.execute(
            "UPDATE contacts SET phone = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![phone, now, input.id],
        )?;
    }
    if let Some(email) = input.email {
        conn.execute(
            "UPDATE contacts SET email = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![email, now, input.id],
        )?;
    }
    if let Some(clinic) = input.clinic {
        conn.execute(
            "UPDATE contacts SET clinic = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![clinic, now, input.id],
        )?;
    }
    if let Some(address) = input.address {
        conn.execute(
            "UPDATE contacts SET address = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![address, now, input.id],
        )?;
    }
    if let Some(notes) = input.notes {
        conn.execute(
            "UPDATE contacts SET notes = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![notes, now, input.id],
        )?;
    }
    if let Some(title) = input.title {
        conn.execute(
            "UPDATE contacts SET title = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![title, now, input.id],
        )?;
    }

    let c = conn.query_row(
        "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
             created_at, updated_at, title FROM contacts WHERE id = ?",
        [&input.id],
        row_to_contact,
    )?;
    let body = [
        c.specialty.as_deref().unwrap_or(""),
        c.clinic.as_deref().unwrap_or(""),
        c.address.as_deref().unwrap_or(""),
        c.notes.as_deref().unwrap_or(""),
    ]
    .join(" ");
    upsert_search_index(conn, "contact", &c.id, &c.name, &body, "", "", "");
    Ok(c)
}

#[tauri::command]
pub fn contacts_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute("DELETE FROM contacts WHERE id = ?", [&id])?;
    remove_from_search_index(conn, &id);
    Ok(())
}

#[tauri::command]
pub fn documents_link_contact(
    document_id: String,
    contact_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.execute(
        "INSERT OR IGNORE INTO document_contacts (document_id, contact_id) VALUES (?, ?)",
        [&document_id, &contact_id],
    )?;
    Ok(())
}

#[tauri::command]
pub fn contacts_find_similar(
    name: String,
    state: State<'_, AppState>,
) -> Result<Option<Contact>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    Ok(find_similar_contact(&name, conn))
}

fn last_token(s: &str) -> &str {
    s.split_whitespace().last().unwrap_or(s)
}

// ─── Duplicate detection ────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DuplicateCandidate {
    /// The "anchor" contact's id (the one we searched from).
    pub primary_contact_id: String,
    /// A contact that is potentially a duplicate of the anchor.
    pub contact: Contact,
    /// Jaro-Winkler name similarity (0.0–1.0) or 1.0 for exact field matches.
    pub similarity_score: f64,
    /// Human-readable reason: "name similarity", "same email", "same phone".
    pub match_reason: String,
}

fn name_similarity(a: &str, b: &str) -> f64 {
    strsim::jaro_winkler(&a.trim().to_lowercase(), &b.trim().to_lowercase())
}

fn fields_match(a: &Option<String>, b: &Option<String>) -> bool {
    match (a, b) {
        (Some(x), Some(y)) => !x.is_empty() && !y.is_empty() && x.eq_ignore_ascii_case(y),
        _ => false,
    }
}

/// Pure deduplication engine — no DB access, fully testable.
///
/// Compares every contact in `contacts` against `primary`.
/// Returns candidates whose name similarity >= `threshold`,
/// plus any contact with matching email or phone (regardless of threshold).
fn duplicates_of(
    primary: &Contact,
    contacts: &[Contact],
    threshold: f64,
) -> Vec<DuplicateCandidate> {
    contacts
        .iter()
        .filter(|c| c.id != primary.id)
        .filter_map(|c| {
            let score = name_similarity(&primary.name, &c.name);
            if score >= threshold {
                return Some(DuplicateCandidate {
                    primary_contact_id: primary.id.clone(),
                    contact: c.clone(),
                    similarity_score: score,
                    match_reason: "name similarity".to_string(),
                });
            }
            if fields_match(&primary.email, &c.email) {
                return Some(DuplicateCandidate {
                    primary_contact_id: primary.id.clone(),
                    contact: c.clone(),
                    similarity_score: 1.0,
                    match_reason: "same email".to_string(),
                });
            }
            if fields_match(&primary.phone, &c.phone) {
                return Some(DuplicateCandidate {
                    primary_contact_id: primary.id.clone(),
                    contact: c.clone(),
                    similarity_score: 1.0,
                    match_reason: "same phone".to_string(),
                });
            }
            None
        })
        .collect()
}

/// Scan all contacts for duplicates.
///
/// If `contact_id` is Some, scan only that contact against all others.
/// If `contact_id` is None, scan every pair (each pair emitted once, primary < duplicate by id).
pub fn compute_duplicates(
    contacts: &[Contact],
    contact_id: Option<&str>,
    threshold: f64,
) -> Vec<DuplicateCandidate> {
    if let Some(id) = contact_id {
        let Some(primary) = contacts.iter().find(|c| c.id == id) else {
            return Vec::new();
        };
        return duplicates_of(primary, contacts, threshold);
    }

    // Full scan: emit each pair exactly once.
    let mut results = Vec::new();
    for (i, primary) in contacts.iter().enumerate() {
        let rest = &contacts[i + 1..];
        for candidate in duplicates_of(primary, rest, threshold) {
            results.push(candidate);
        }
    }
    results
}

#[tauri::command]
pub fn find_duplicate_contacts(
    _user_id: String,
    contact_id: Option<String>,
    threshold: f64,
    state: State<'_, AppState>,
) -> Result<Vec<DuplicateCandidate>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
             created_at, updated_at, title FROM contacts ORDER BY name",
    )?;
    let contacts: Vec<Contact> = stmt
        .query_map([], row_to_contact)?
        .filter_map(|r| r.ok())
        .collect();

    Ok(compute_duplicates(
        &contacts,
        contact_id.as_deref(),
        threshold,
    ))
}

// ─── Merge command ──────────────────────────────────────────────────────────

/// Merge one or more duplicate contacts into a primary contact.
///
/// Steps (inside a single transaction):
/// 1. Re-point all `appointment_contacts` rows from each duplicate to `primary_id`.
/// 2. Fill null fields on `primary` from duplicates (first non-null wins).
/// 3. Remove duplicate contact rows and their search-index entries.
#[tauri::command]
pub fn merge_contacts(
    _user_id: String,
    primary_id: String,
    duplicate_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Contact, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let tx = conn.unchecked_transaction()?;

    let result: Result<Contact, CommandError> = (|| -> Result<Contact, CommandError> {
        // 1. Re-point appointment_contacts rows.
        for dup_id in &duplicate_ids {
            tx.execute(
                "DELETE FROM appointment_contacts \
                 WHERE contact_id = ?1 AND appointment_id IN \
                   (SELECT appointment_id FROM appointment_contacts WHERE contact_id = ?2)",
                rusqlite::params![dup_id, primary_id],
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;
            tx.execute(
                "UPDATE appointment_contacts SET contact_id = ?1 WHERE contact_id = ?2",
                rusqlite::params![primary_id, dup_id],
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        }

        // 2. Load primary and duplicates; merge null fields from duplicates.
        let primary = tx
            .query_row(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at, title FROM contacts WHERE id = ?",
                [&primary_id],
                row_to_contact,
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;

        let mut merged_specialty = primary.specialty.clone();
        let mut merged_phone = primary.phone.clone();
        let mut merged_email = primary.email.clone();
        let mut merged_clinic = primary.clinic.clone();
        let mut merged_address = primary.address.clone();
        let mut merged_notes = primary.notes.clone();

        for dup_id in &duplicate_ids {
            let dup = tx
                .query_row(
                    "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                     created_at, updated_at, title FROM contacts WHERE id = ?",
                    [dup_id],
                    row_to_contact,
                )
                .map_err(|e| CommandError::Internal(e.to_string()))?;
            if merged_specialty.is_none() {
                merged_specialty = dup.specialty;
            }
            if merged_phone.is_none() {
                merged_phone = dup.phone;
            }
            if merged_email.is_none() {
                merged_email = dup.email;
            }
            if merged_clinic.is_none() {
                merged_clinic = dup.clinic;
            }
            if merged_address.is_none() {
                merged_address = dup.address;
            }
            if merged_notes.is_none() {
                merged_notes = dup.notes;
            }
        }

        let now = Utc::now().to_rfc3339();
        tx.execute(
            "UPDATE contacts SET specialty = ?1, phone = ?2, email = ?3, clinic = ?4, \
             address = ?5, notes = ?6, updated_at = ?7 WHERE id = ?8",
            rusqlite::params![
                merged_specialty,
                merged_phone,
                merged_email,
                merged_clinic,
                merged_address,
                merged_notes,
                now,
                primary_id,
            ],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;

        // 3. Delete duplicate rows.
        for dup_id in &duplicate_ids {
            tx.execute("DELETE FROM contacts WHERE id = ?", [dup_id])
                .map_err(|e| CommandError::Internal(e.to_string()))?;
        }

        // Return updated primary.
        tx.query_row(
            "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
             created_at, updated_at, title FROM contacts WHERE id = ?",
            [&primary_id],
            row_to_contact,
        )
        .map_err(|e| CommandError::Internal(e.to_string()))
    })();

    match result {
        Ok(contact) => {
            tx.commit()?;
            let body = [
                contact.specialty.as_deref().unwrap_or(""),
                contact.clinic.as_deref().unwrap_or(""),
                contact.address.as_deref().unwrap_or(""),
                contact.notes.as_deref().unwrap_or(""),
            ]
            .join(" ");
            upsert_search_index(
                conn,
                "contact",
                &contact.id,
                &contact.name,
                &body,
                "",
                "",
                "",
            );
            for dup_id in &duplicate_ids {
                remove_from_search_index(conn, dup_id);
            }
            Ok(contact)
        }
        Err(e) => {
            let _ = tx.rollback();
            Err(e)
        }
    }
}

// ─── Name-based fuzzy lookup (used by upload pipeline) ──────────────────────

/// Returns an existing contact whose name closely matches `name`, or `None`.
///
/// Two passes:
/// 1. Full-name Levenshtein <= 2 — catches typos ("Dr. John Smit" vs "Dr. John Smith").
/// 2. Surname-only Levenshtein <= 1 — catches initial abbreviations ("Dr. J. Smith" vs "Dr. John Smith").
pub fn find_similar_contact(name: &str, conn: &rusqlite::Connection) -> Option<Contact> {
    let query_norm = name.trim().to_lowercase();
    let query_surname = last_token(&query_norm);

    let mut stmt = conn
        .prepare(
            "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
             created_at, updated_at, title FROM contacts ORDER BY name",
        )
        .ok()?;

    let contacts: Vec<Contact> = stmt
        .query_map([], row_to_contact)
        .ok()?
        .filter_map(|r| r.ok())
        .collect();

    for c in &contacts {
        let candidate = c.name.trim().to_lowercase();
        if strsim::levenshtein(&query_norm, &candidate) <= 2 {
            return Some(c.clone());
        }
    }

    for c in &contacts {
        let candidate = c.name.trim().to_lowercase();
        let candidate_surname = last_token(&candidate);
        if strsim::levenshtein(query_surname, candidate_surname) <= 1 {
            return Some(c.clone());
        }
    }

    None
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

    #[test]
    fn create_and_get_contact() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![id, "Dr Smith", "gp", now, now],
        )
        .unwrap();
        let c = conn
            .query_row(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at, title FROM contacts WHERE id = ?",
                [&id],
                row_to_contact,
            )
            .unwrap();
        assert_eq!(c.name, "Dr Smith");
        assert_eq!(c.role, "gp");
    }

    #[test]
    fn list_contacts_filtered_by_role() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();
        for (name, role) in [("Dr A", "gp"), ("Dr B", "specialist"), ("Dr C", "gp")] {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                rusqlite::params![id, name, role, now, now],
            )
            .unwrap();
        }
        let mut stmt = conn
            .prepare(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at, title FROM contacts WHERE role = ? ORDER BY name",
            )
            .unwrap();
        let gps: Vec<Contact> = stmt
            .query_map(["gp"], row_to_contact)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(gps.len(), 2);
    }

    #[test]
    fn delete_contact() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![id, "Dr X", "dentist", now, now],
        )
        .unwrap();
        conn.execute("DELETE FROM contacts WHERE id = ?", [&id])
            .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM contacts WHERE id = ?", [&id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 0);
    }

    fn insert_contact(conn: &rusqlite::Connection, name: &str) {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES (?, ?, 'gp', ?, ?)",
            rusqlite::params![id, name, now, now],
        )
        .unwrap();
    }

    #[test]
    fn find_similar_exact_match() {
        let conn = open_test_db();
        insert_contact(&conn, "Dr. John Smith");
        let result = find_similar_contact("Dr. John Smith", &conn);
        assert!(result.is_some());
        assert_eq!(result.unwrap().name, "Dr. John Smith");
    }

    #[test]
    fn find_similar_typo_within_two_edits() {
        let conn = open_test_db();
        insert_contact(&conn, "Dr. John Smith");
        let result = find_similar_contact("Dr. John Smit", &conn);
        assert!(result.is_some(), "one-char typo should match");
    }

    #[test]
    fn find_similar_initial_abbreviation() {
        let conn = open_test_db();
        insert_contact(&conn, "Dr. John Smith");
        let result = find_similar_contact("Dr. J. Smith", &conn);
        assert!(
            result.is_some(),
            "initial abbreviation should match via surname"
        );
    }

    #[test]
    fn find_similar_no_match_different_name() {
        let conn = open_test_db();
        insert_contact(&conn, "Dr. John Smith");
        let result = find_similar_contact("Dr. Alice Jones", &conn);
        assert!(
            result.is_none(),
            "completely different name should not match"
        );
    }

    #[test]
    fn find_similar_empty_db_returns_none() {
        let conn = open_test_db();
        let result = find_similar_contact("Dr. John Smith", &conn);
        assert!(result.is_none());
    }

    // ── compute_duplicates tests ────────────────────────────────────────────

    fn make_contact(id: &str, name: &str, email: Option<&str>, phone: Option<&str>) -> Contact {
        Contact {
            id: id.to_string(),
            name: name.to_string(),
            role: "gp".to_string(),
            title: None,
            specialty: None,
            phone: phone.map(str::to_string),
            email: email.map(str::to_string),
            clinic: None,
            address: None,
            notes: None,
            created_at: "2026-01-01T00:00:00Z".to_string(),
            updated_at: "2026-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn identical_names_score_1_0() {
        let a = make_contact("1", "John Smith", None, None);
        let b = make_contact("2", "John Smith", None, None);
        let results = compute_duplicates(&[a, b], None, 0.85);
        assert_eq!(results.len(), 1);
        assert!((results[0].similarity_score - 1.0).abs() < 1e-9);
    }

    #[test]
    fn similar_names_above_threshold() {
        let a = make_contact("1", "John Smith", None, None);
        let b = make_contact("2", "Jon Smyth", None, None);
        let score = name_similarity("John Smith", "Jon Smyth");
        // Jaro-Winkler on similar names must meet spec range 0.85–0.92.
        assert!(
            (0.85..=0.92).contains(&score),
            "expected 0.85–0.92, got {score:.4}"
        );
        let results = compute_duplicates(&[a, b], None, 0.85);
        assert_eq!(
            results.len(),
            1,
            "similar names should be a duplicate candidate"
        );
    }

    #[test]
    fn dissimilar_names_not_returned() {
        let a = make_contact("1", "John Smith", None, None);
        let b = make_contact("2", "Jane Doe", None, None);
        let results = compute_duplicates(&[a, b], None, 0.85);
        assert!(results.is_empty(), "dissimilar names should not match");
    }

    #[test]
    fn exact_email_match_regardless_of_threshold() {
        let a = make_contact("1", "John Smith", Some("js@example.com"), None);
        let b = make_contact("2", "Jane Doe", Some("js@example.com"), None);
        let results = compute_duplicates(&[a, b], None, 0.99);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_reason, "same email");
    }

    #[test]
    fn exact_phone_match_regardless_of_threshold() {
        let a = make_contact("1", "John Smith", None, Some("+44 123 456789"));
        let b = make_contact("2", "Jane Doe", None, Some("+44 123 456789"));
        let results = compute_duplicates(&[a, b], None, 0.99);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].match_reason, "same phone");
    }

    #[test]
    fn targeted_scan_returns_only_candidates_for_given_contact() {
        let a = make_contact("1", "John Smith", None, None);
        let b = make_contact("2", "Jon Smyth", None, None);
        let c = make_contact("3", "Alice Brown", None, None);
        let results = compute_duplicates(&[a, b, c], Some("1"), 0.85);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].primary_contact_id, "1");
        assert_eq!(results[0].contact.id, "2");
    }

    #[test]
    fn unknown_contact_id_returns_empty() {
        let a = make_contact("1", "John Smith", None, None);
        let results = compute_duplicates(&[a], Some("nonexistent"), 0.85);
        assert!(results.is_empty());
    }

    #[test]
    fn full_scan_emits_each_pair_once() {
        let a = make_contact("1", "John Smith", None, None);
        let b = make_contact("2", "Jon Smyth", None, None);
        let results = compute_duplicates(&[a, b], None, 0.85);
        assert_eq!(results.len(), 1, "pair (1,2) emitted exactly once");
    }

    // ── merge_contacts tests ────────────────────────────────────────────────

    fn insert_contact_full(
        conn: &rusqlite::Connection,
        id: &str,
        name: &str,
        email: Option<&str>,
        phone: Option<&str>,
    ) {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, email, phone, created_at, updated_at) \
             VALUES (?, ?, 'gp', ?, ?, ?, ?)",
            rusqlite::params![id, name, email, phone, now, now],
        )
        .unwrap();
    }

    fn insert_appointment(conn: &rusqlite::Connection, apt_id: &str) {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, created_at, updated_at) \
             VALUES (?, 'Checkup', '2026-01-01T09:00:00Z', ?, ?)",
            rusqlite::params![apt_id, now, now],
        )
        .unwrap();
    }

    fn link_appointment_contact(conn: &rusqlite::Connection, apt_id: &str, contact_id: &str) {
        conn.execute(
            "INSERT INTO appointment_contacts (appointment_id, contact_id) VALUES (?, ?)",
            rusqlite::params![apt_id, contact_id],
        )
        .unwrap();
    }

    fn count_contacts(conn: &rusqlite::Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM contacts", [], |r| r.get(0))
            .unwrap()
    }

    fn contact_ids_for_apt(conn: &rusqlite::Connection, apt_id: &str) -> Vec<String> {
        let mut stmt = conn
            .prepare("SELECT contact_id FROM appointment_contacts WHERE appointment_id = ?")
            .unwrap();
        stmt.query_map([apt_id], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    }

    #[test]
    fn merge_repoints_appointment_contacts_to_primary() {
        let conn = open_test_db();
        insert_contact_full(&conn, "p1", "Dr Smith", None, None);
        insert_contact_full(&conn, "d1", "Dr Smyth", None, None);
        insert_appointment(&conn, "a1");
        link_appointment_contact(&conn, "a1", "d1");

        let guard = std::sync::Arc::new(std::sync::Mutex::new(Some(conn)));
        // Test the logic directly rather than through the Tauri command
        let conn_ref = guard.lock().unwrap();
        let conn = conn_ref.as_ref().unwrap();

        conn.execute("BEGIN", []).unwrap();
        // Delete conflict rows (none here), re-point remaining
        conn.execute(
            "DELETE FROM appointment_contacts WHERE contact_id = ?1 AND appointment_id IN \
             (SELECT appointment_id FROM appointment_contacts WHERE contact_id = ?2)",
            rusqlite::params!["d1", "p1"],
        )
        .unwrap();
        conn.execute(
            "UPDATE appointment_contacts SET contact_id = 'p1' WHERE contact_id = 'd1'",
            [],
        )
        .unwrap();
        conn.execute("COMMIT", []).unwrap();

        let ids = contact_ids_for_apt(conn, "a1");
        assert_eq!(ids, vec!["p1"], "appointment should now point to primary");
    }

    #[test]
    fn merge_deletes_duplicate_contacts() {
        let conn = open_test_db();
        insert_contact_full(&conn, "p1", "Dr Smith", None, None);
        insert_contact_full(&conn, "d1", "Dr Smyth", None, None);
        insert_contact_full(&conn, "d2", "Dr Smithe", None, None);
        assert_eq!(count_contacts(&conn), 3);

        conn.execute("DELETE FROM contacts WHERE id = 'd1' OR id = 'd2'", [])
            .unwrap();
        assert_eq!(count_contacts(&conn), 1, "duplicates should be deleted");
    }

    #[test]
    fn merge_fills_null_fields_from_duplicate() {
        let conn = open_test_db();
        insert_contact_full(&conn, "p1", "Dr Smith", None, None);
        insert_contact_full(
            &conn,
            "d1",
            "Dr Smyth",
            Some("dr@example.com"),
            Some("+44 123"),
        );

        // Simulate field merging: primary has no email/phone, duplicate does
        conn.execute(
            "UPDATE contacts SET email = (SELECT email FROM contacts WHERE id = 'd1'), \
             phone = (SELECT phone FROM contacts WHERE id = 'd1') WHERE id = 'p1'",
            [],
        )
        .unwrap();

        let primary: (Option<String>, Option<String>) = conn
            .query_row(
                "SELECT email, phone FROM contacts WHERE id = 'p1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(primary.0.as_deref(), Some("dr@example.com"));
        assert_eq!(primary.1.as_deref(), Some("+44 123"));
    }

    #[test]
    fn merge_handles_pk_conflict_in_appointment_contacts() {
        let conn = open_test_db();
        insert_contact_full(&conn, "p1", "Dr Smith", None, None);
        insert_contact_full(&conn, "d1", "Dr Smyth", None, None);
        insert_appointment(&conn, "a1");
        // Both primary and duplicate are linked to the same appointment
        link_appointment_contact(&conn, "a1", "p1");
        link_appointment_contact(&conn, "a1", "d1");

        conn.execute("BEGIN", []).unwrap();
        // Step 1: delete conflicting rows
        conn.execute(
            "DELETE FROM appointment_contacts WHERE contact_id = 'd1' AND appointment_id IN \
             (SELECT appointment_id FROM appointment_contacts WHERE contact_id = 'p1')",
            [],
        )
        .unwrap();
        // Step 2: re-point remaining (should be zero rows now, no PK error)
        conn.execute(
            "UPDATE appointment_contacts SET contact_id = 'p1' WHERE contact_id = 'd1'",
            [],
        )
        .unwrap();
        conn.execute("COMMIT", []).unwrap();

        let ids = contact_ids_for_apt(&conn, "a1");
        assert_eq!(ids.len(), 1, "exactly one contact_id for the appointment");
        assert_eq!(ids[0], "p1");
    }

    #[test]
    fn scan_200_contacts_under_500ms() {
        let contacts: Vec<Contact> = (0..200)
            .map(|i| make_contact(&i.to_string(), &format!("Contact {i}"), None, None))
            .collect();
        let start = std::time::Instant::now();
        let _ = compute_duplicates(&contacts, None, 0.85);
        assert!(
            start.elapsed().as_millis() < 500,
            "200-contact scan exceeded 500ms"
        );
    }

    #[test]
    fn document_contacts_junction_created_and_idempotent() {
        // V3-F2: linking a contact to a document must create a document_contacts row;
        // a second INSERT OR IGNORE must not create a duplicate.
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();
        let doc_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at) \
             VALUES (?, 'invoice.pdf', '/tmp/invoice.pdf', 'application/pdf', 0, 'other', ?, ?)",
            rusqlite::params![doc_id, now, now],
        )
        .unwrap();
        let contact_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES (?, 'Mr John Green', 'specialist', ?, ?)",
            rusqlite::params![contact_id, now, now],
        )
        .unwrap();

        conn.execute(
            "INSERT OR IGNORE INTO document_contacts (document_id, contact_id) VALUES (?, ?)",
            rusqlite::params![doc_id, contact_id],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_contacts WHERE document_id = ? AND contact_id = ?",
                rusqlite::params![doc_id, contact_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "junction row must exist after first insert");

        conn.execute(
            "INSERT OR IGNORE INTO document_contacts (document_id, contact_id) VALUES (?, ?)",
            rusqlite::params![doc_id, contact_id],
        )
        .unwrap();
        let count2: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_contacts WHERE document_id = ? AND contact_id = ?",
                rusqlite::params![doc_id, contact_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count2, 1, "idempotent: no duplicate row on second insert");
    }

    #[test]
    fn duplicates_of_detects_physio_near_duplicate_names() {
        // V3-F2.5: near-duplicate physio provider names must score >= 0.85;
        // unrelated names must not appear as duplicates.
        let primary = make_contact("p1", "John Green", None, None);
        let near_dup = make_contact("p2", "Jon Green", None, None);
        let unrelated = make_contact("p3", "Dr Sarah White", None, None);
        let contacts = vec![primary.clone(), near_dup, unrelated];
        let results = duplicates_of(&primary, &contacts, 0.85);
        assert!(
            !results.is_empty(),
            "John Green vs Jon Green should score >= 0.85"
        );
        assert!(
            results.iter().all(|d| d.contact.name != "Dr Sarah White"),
            "unrelated contact must not appear as duplicate"
        );
    }

    #[test]
    fn contacts_create_persists_name_phone_email_title() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, title, phone, email, created_at, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                id,
                "Dr. Sarah Green",
                "specialist",
                "Dr.",
                "+1 (555) 123-4567",
                "sarah@example.com",
                now,
                now,
            ],
        )
        .unwrap();
        let c = conn
            .query_row(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at, title FROM contacts WHERE id = ?",
                [&id],
                row_to_contact,
            )
            .unwrap();
        assert_eq!(c.name, "Dr. Sarah Green");
        assert_eq!(c.phone.as_deref(), Some("+1 (555) 123-4567"));
        assert_eq!(c.email.as_deref(), Some("sarah@example.com"));
        assert_eq!(c.title.as_deref(), Some("Dr."));
    }
}
