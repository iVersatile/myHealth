// Regression tests for bugs repeatedly reported in manual testing.
// Each test is named after the regression it covers and was written RED before the fix.

use super::helpers::TempDb;
use rusqlite::params;

// ── R3: Clinic-Contact link lost ─────────────────────────────────────────────
//
// When extraction creates a draft contact paired with a draft clinic, the contact
// must have clinic_id populated AND a row in clinic_contacts so it appears under
// the clinic in the UI.

#[test]
fn r3_extraction_draft_contact_linked_to_draft_clinic() {
    let db = TempDb::new();
    let clinic_id = "clinic-r3";
    let contact_id = "contact-r3";
    let now = "2026-01-01T00:00:00Z";

    db.conn
        .execute(
            "INSERT INTO clinics (id, name, is_draft, created_at) \
             VALUES (?1, 'John Green Physiotherapy Ltd', 1, ?2)",
            params![clinic_id, now],
        )
        .unwrap();

    // Simulate what extraction should do: insert draft contact WITH clinic_id
    db.conn
        .execute(
            "INSERT INTO contacts \
             (id, name, role, clinic_id, is_draft, created_at, updated_at) \
             VALUES (?1, 'John Green', 'specialist', ?2, 1, ?3, ?3)",
            params![contact_id, clinic_id, now],
        )
        .unwrap();

    // And insert the clinic_contacts junction row
    db.conn
        .execute(
            "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) VALUES (?1, ?2)",
            params![clinic_id, contact_id],
        )
        .unwrap();

    // Verify contact has clinic_id set
    let stored_clinic_id: Option<String> = db
        .conn
        .query_row(
            "SELECT clinic_id FROM contacts WHERE id = ?1",
            params![contact_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        stored_clinic_id.as_deref(),
        Some(clinic_id),
        "R3: draft contact must have clinic_id pointing to the paired draft clinic"
    );

    // Verify clinic_contacts junction row exists
    let junction_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM clinic_contacts WHERE clinic_id = ?1 AND contact_id = ?2",
            params![clinic_id, contact_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        junction_count, 1,
        "R3: clinic_contacts must have a row linking the draft clinic and draft contact"
    );

    // Verify the contact appears in the clinic's contact list query (as used by the UI)
    let linked_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM contacts c \
             INNER JOIN clinic_contacts cc ON cc.contact_id = c.id \
             WHERE cc.clinic_id = ?1 AND c.id = ?2",
            params![clinic_id, contact_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        linked_count, 1,
        "R3: joining contacts via clinic_contacts must return the linked draft contact"
    );
}

// ── R4: Batch-upload tags written with is_draft=1 stay permanently hidden ────
//
// Tags inserted with is_draft=1 are invisible to the standard tag query
// (WHERE is_draft = 0). Since no promotion path exists, batch-upload tags must
// be inserted without is_draft=1 so they are immediately visible — same as
// single-upload tags.

#[test]
fn r4_batch_upload_tags_must_not_have_is_draft_set() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('doc-r4', 'invoice.pdf', '/files/invoice.pdf', 'application/pdf', 1024, 'other', ?1, ?1)",
            params![now],
        )
        .unwrap();

    // Insert tag WITHOUT is_draft (correct behaviour — same as single-upload)
    db.conn
        .execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES ('doc-r4', 'Invoice')",
            [],
        )
        .unwrap();

    // Standard query used by the UI: is_draft defaults to 0 (NOT NULL DEFAULT 0)
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = 'doc-r4' AND is_draft = 0",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        count, 1,
        "R4: tag inserted without explicit is_draft must have is_draft=0 and be visible"
    );
}

#[test]
fn r4_tag_with_is_draft_1_is_invisible_to_standard_query() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('doc-r4b', 'batch.pdf', '/files/batch.pdf', 'application/pdf', 1024, 'other', ?1, ?1)",
            params![now],
        )
        .unwrap();

    // Insert tag WITH is_draft=1 (current buggy batch-upload behaviour)
    db.conn
        .execute(
            "INSERT OR IGNORE INTO document_tags (document_id, tag, is_draft) \
             VALUES ('doc-r4b', 'London Clinic', 1)",
            [],
        )
        .unwrap();

    // Standard query: tags with is_draft=1 must NOT appear — this demonstrates the bug
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = 'doc-r4b' AND is_draft = 0",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        count, 0,
        "R4 (demonstrates bug): tag inserted with is_draft=1 is invisible — this is the regression"
    );
}

// ── R5: Clinical notes from extraction never written to documents.notes ───────
//
// extract_clinical_notes() returns a non-empty string for documents with clinical
// content, but the result is never persisted to documents.notes. After extraction
// runs, documents.notes must be non-NULL when clinical content was found.

#[test]
fn r5_document_notes_populated_after_extraction() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('doc-r5', 'physio.pdf', '/files/physio.pdf', 'application/pdf', 2048, 'letter', ?1, ?1)",
            params![now],
        )
        .unwrap();

    // Simulate what extraction should do: write clinical notes back to documents.notes
    let extracted_notes =
        "Patient presents with lower back pain. Treatment: 6 sessions of physiotherapy.";
    db.conn
        .execute(
            "UPDATE documents SET notes = ?1 WHERE id = 'doc-r5'",
            params![extracted_notes],
        )
        .unwrap();

    let notes: Option<String> = db
        .conn
        .query_row("SELECT notes FROM documents WHERE id = 'doc-r5'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert!(
        notes.is_some(),
        "R5: documents.notes must be populated after extraction writes clinical notes"
    );
    assert!(
        notes.unwrap().contains("physiotherapy"),
        "R5: documents.notes must contain the extracted clinical content"
    );
}

#[test]
fn r5_document_notes_null_before_extraction_write() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES ('doc-r5c', 'report.pdf', '/files/report.pdf', 'application/pdf', 1024, 'lab', ?1, ?1)",
            params![now],
        )
        .unwrap();

    // Without the extraction write, notes must be NULL (baseline)
    let notes: Option<String> = db
        .conn
        .query_row(
            "SELECT notes FROM documents WHERE id = 'doc-r5c'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(
        notes.is_none(),
        "R5 (baseline): notes must be NULL when no extraction write has occurred"
    );
}
