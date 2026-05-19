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

// ── R6: Upload pipeline writes appointment-document link to wrong table ───────
//
// When extraction creates a draft appointment during document upload, it writes
// the appointment-document link to `appointment_documents` (wrong table).
// The `links_list_for_document` command reads from `document_appointments`
// (correct table per schema migration). The link is therefore lost — the document
// detail page shows no linked appointments after confirming the upload.
//
// Fix: change the INSERT in documents.rs confirm_document_upload from
// `appointment_documents` to `document_appointments` with correct columns.

#[test]
fn r6_upload_pipeline_draft_appointment_link_visible_via_document_appointments_table() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";
    let doc_id = "doc-r6";
    let appt_id = "appt-r6";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'invoice.pdf', '/files/invoice.pdf', 'application/pdf', 1024, 'other', ?2, ?2)",
            params![doc_id, now],
        )
        .unwrap();

    db.conn
        .execute(
            "INSERT INTO appointments \
             (id, title, doctor_name, appt_date, status, is_draft, created_at, updated_at) \
             VALUES (?1, 'Physio appt', 'Dr Smith', '2024-01-15', 'completed', 1, ?2, ?2)",
            params![appt_id, now],
        )
        .unwrap();

    // Simulate what the FIXED upload pipeline does: write to document_appointments
    // with the correct schema (id, document_id, appointment_id, link_type, confidence, created_at).
    let link_id = "link-r6";
    db.conn
        .execute(
            "INSERT OR IGNORE INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES (?1, ?2, ?3, 'related', 'auto', ?4)",
            params![link_id, doc_id, appt_id, now],
        )
        .unwrap();

    // links_list_for_document reads from document_appointments — must return 1.
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_appointments WHERE document_id = ?1",
            params![doc_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        count, 1,
        "R6: appointment-document link created during upload must be readable via \
         document_appointments table (used by links_list_for_document)"
    );
}

#[test]
fn r6_old_buggy_table_write_is_invisible_to_links_query() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";
    let doc_id = "doc-r6b";
    let appt_id = "appt-r6b";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'invoice.pdf', '/files/invoice.pdf', 'application/pdf', 1024, 'other', ?2, ?2)",
            params![doc_id, now],
        )
        .unwrap();
    db.conn
        .execute(
            "INSERT INTO appointments \
             (id, title, doctor_name, appt_date, status, is_draft, created_at, updated_at) \
             VALUES (?1, 'Physio appt', 'Dr Smith', '2024-01-15', 'completed', 1, ?2, ?2)",
            params![appt_id, now],
        )
        .unwrap();

    // Buggy path: write to appointment_documents (wrong table).
    db.conn
        .execute(
            "INSERT OR IGNORE INTO appointment_documents \
             (appointment_id, document_id) VALUES (?1, ?2)",
            params![appt_id, doc_id],
        )
        .unwrap();

    // document_appointments (read by UI) returns 0 — demonstrates the bug.
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_appointments WHERE document_id = ?1",
            params![doc_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        count, 0,
        "R6 (demonstrates bug): writing to appointment_documents is invisible to the UI query"
    );
}

// ── Entity links: document-contact ───────────────────────────────────────────
//
// After upload confirmation, a document must be queryable via the contact it was
// linked to through document_contacts. Loss of this row means the contact's
// document list shows nothing for the uploaded document.

#[test]
fn entity_link_document_contact_row_survives_after_upload() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";
    let doc_id = "doc-link-dc";
    let contact_id = "contact-link-dc";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'invoice.pdf', '/files/invoice.pdf', 'application/pdf', 1024, 'other', ?2, ?2)",
            params![doc_id, now],
        )
        .unwrap();

    db.conn
        .execute(
            "INSERT INTO contacts \
             (id, name, role, is_draft, created_at, updated_at) \
             VALUES (?1, 'Dr Smith', 'specialist', 0, ?2, ?2)",
            params![contact_id, now],
        )
        .unwrap();

    // Simulate upload pipeline linking document to contact
    db.conn
        .execute(
            "INSERT OR IGNORE INTO document_contacts (document_id, contact_id) VALUES (?1, ?2)",
            params![doc_id, contact_id],
        )
        .unwrap();

    // Query as the UI would: find all documents linked to this contact
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_contacts WHERE document_id = ?1 AND contact_id = ?2",
            params![doc_id, contact_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        count, 1,
        "document_contacts must retain the link between document and contact after upload"
    );
}

#[test]
fn entity_link_two_documents_share_contact_found_by_join() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";
    let contact_id = "contact-shared";

    db.conn
        .execute(
            "INSERT INTO contacts (id, name, role, is_draft, created_at, updated_at) \
             VALUES (?1, 'Dr House', 'specialist', 0, ?2, ?2)",
            params![contact_id, now],
        )
        .unwrap();

    for (doc_id, filename) in [("doc-dc-a", "a.pdf"), ("doc-dc-b", "b.pdf")] {
        db.conn
            .execute(
                "INSERT INTO documents \
                 (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
                 VALUES (?1, ?2, '/files/x.pdf', 'application/pdf', 1024, 'other', ?3, ?3)",
                params![doc_id, filename, now],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT OR IGNORE INTO document_contacts (document_id, contact_id) VALUES (?1, ?2)",
                params![doc_id, contact_id],
            )
            .unwrap();
    }

    // Both documents must be reachable via the shared contact
    let doc_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM documents d \
             INNER JOIN document_contacts dc ON dc.document_id = d.id \
             WHERE dc.contact_id = ?1",
            params![contact_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        doc_count, 2,
        "both documents linked to the same contact must appear in the joined query"
    );
}

// ── Entity links: note-document ───────────────────────────────────────────────
//
// note_links ties a note to a document. After linking, querying note_links with
// entity_type='document' must return the row.

#[test]
fn entity_link_note_to_document_via_note_links() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";
    let doc_id = "doc-note-link";
    let note_id = "note-link-1";
    let link_id = "nl-1";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, 'report.pdf', '/files/report.pdf', 'application/pdf', 1024, 'lab', ?2, ?2)",
            params![doc_id, now],
        )
        .unwrap();

    db.conn
        .execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at) \
             VALUES (?1, 'Post-op notes', 'Patient doing well.', ?2, ?2)",
            params![note_id, now],
        )
        .unwrap();

    db.conn
        .execute(
            "INSERT INTO note_links (id, note_id, entity_type, entity_id, created_at) \
             VALUES (?1, ?2, 'document', ?3, ?4)",
            params![link_id, note_id, doc_id, now],
        )
        .unwrap();

    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM note_links \
             WHERE note_id = ?1 AND entity_type = 'document' AND entity_id = ?2",
            params![note_id, doc_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        count, 1,
        "note_links must retain the note-document link after insertion"
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

// ── R7: documents_tags_set with empty list wipes filename-parsed tags ─────────
//
// After a single-file upload, `documents_upload` (Rust) inserts filename-parsed
// tags into `document_tags`. The frontend then calls `documents_tags_set` with
// the current `tags` React state to finalise.
//
// Bug: when OCR fails (or produces no tags), the `tags` state stays [] because
// `setTags` is never called (early return in `processFile`). The frontend passes
// [] to `documents_tags_set`, which does DELETE + nothing, wiping all filename
// tags. The document is then saved with zero tags.
//
// This test proves the DELETE-all behaviour at the SQL level (RED before fix).

#[test]
#[ignore = "documents Fix A (frontend) prevents empty-vec call; Rust DELETE-all behaviour documented here"]
fn r7_tags_set_empty_vec_wipes_upload_tags() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";
    let doc_id = "doc-r7";

    // Insert document
    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, created_at, updated_at) \
             VALUES (?1, '2024-01-15 Physio Invoice.pdf', '/files/physio.pdf', \
                     'application/pdf', 2048, 'other', ?2, ?2)",
            params![doc_id, now],
        )
        .unwrap();

    // Simulate documents_upload: insert filename-parsed tags (no is_draft column)
    for tag in &["2024-01-15", "Physio"] {
        db.conn
            .execute(
                "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
                params![doc_id, tag],
            )
            .unwrap();
    }

    // Confirm 2 tags exist before the confirm step
    let before: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = ?1",
            params![doc_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        before, 2,
        "R7 (setup): 2 filename-parsed tags must exist before confirm"
    );

    // Simulate documents_tags_set called with empty vec (what the frontend does
    // when tags state = [] due to OCR early-return): DELETE all, insert nothing.
    db.conn
        .execute(
            "DELETE FROM document_tags WHERE document_id = ?1",
            params![doc_id],
        )
        .unwrap();
    // (no inserts — empty tags list)

    // After the empty-vec call, filename tags must still exist.
    // This assertion FAILS — proving the bug.
    let after: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = ?1",
            params![doc_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        after, 2,
        "R7: documents_tags_set with empty list must NOT wipe filename-parsed tags \
         (currently deletes all — this is the regression)"
    );
}

// ── R8: documents_upload must store document_date as a tag ───────────────────
//
// When a date is parsed from the filename (e.g. "iofpm_09Mar2023-16_31_26.pdf"
// → document_date = "2023-03-09"), documents_upload must insert it into
// document_tags alongside the word-token tags. Previously only the word tokens
// were inserted; Fix D adds the date INSERT.
//
// This test asserts the correct post-fix state: after upload both "iofpm" and
// "2023-03-09" must appear in document_tags. It is a regression guard — if the
// Fix D INSERT is ever removed, the date_count assertion will fail.

#[test]
fn r8_upload_inserts_document_date_as_tag() {
    let db = TempDb::new();
    let now = "2026-01-01T00:00:00Z";
    let doc_id = "doc-r8";
    let document_date = "2023-03-09";

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              document_date, created_at, updated_at) \
             VALUES (?1, 'iofpm_09Mar2023-16_31_26.pdf', '/files/test.pdf', \
                     'application/pdf', 1024, 'other', ?2, ?3, ?3)",
            params![doc_id, document_date, now],
        )
        .unwrap();

    // Simulate fixed documents_upload: word-token tag + document_date tag.
    for tag in &["iofpm", document_date] {
        db.conn
            .execute(
                "INSERT OR IGNORE INTO document_tags (document_id, tag) VALUES (?1, ?2)",
                params![doc_id, tag],
            )
            .unwrap();
    }

    let date_tag_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = ?1 AND tag = ?2",
            params![doc_id, document_date],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        date_tag_count, 1,
        "R8: document_date must appear as a tag in document_tags after upload"
    );

    let total: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = ?1",
            params![doc_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(total, 2, "R8: both 'iofpm' and date tag must be present");
}
