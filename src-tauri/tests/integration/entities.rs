use super::helpers::TempDb;

#[test]
fn contacts_upsert_no_dup() {
    let db = TempDb::new();
    for _ in 0..2 {
        db.conn
            .execute(
                "INSERT OR REPLACE INTO contacts (id, name, role) VALUES ('c1', 'Dr. Smith', 'gp')",
                [],
            )
            .unwrap();
    }
    let count: i64 = db
        .conn
        .query_row("SELECT COUNT(*) FROM contacts WHERE id = 'c1'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn clinics_insert_and_link() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO clinics (id, name) VALUES ('clinic1', 'City Medical')",
            [],
        )
        .unwrap();
    db.conn
        .execute(
            "INSERT INTO contacts (id, name, role, clinic_id) \
             VALUES ('c2', 'Dr. Jones', 'specialist', 'clinic1')",
            [],
        )
        .unwrap();
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM contacts WHERE clinic_id = 'clinic1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn tags_bulk_insert() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category) \
             VALUES ('doc1', 'test.pdf', 'docs/test.pdf', 'application/pdf', 1024, 'lab')",
            [],
        )
        .unwrap();
    let tags = ["blood", "glucose", "2024", "annual", "lab"];
    for tag in &tags {
        db.conn
            .execute(
                "INSERT INTO document_tags (document_id, tag) VALUES ('doc1', ?1)",
                [tag],
            )
            .unwrap();
    }
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = 'doc1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 5);
}

#[test]
fn appointment_status_transition() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO appointments (id, title, appt_date, status) \
             VALUES ('a1', 'Annual Checkup', '2024-06-01 10:00:00', 'scheduled')",
            [],
        )
        .unwrap();
    db.conn
        .execute(
            "UPDATE appointments SET status = 'completed' WHERE id = 'a1'",
            [],
        )
        .unwrap();
    let status: String = db
        .conn
        .query_row("SELECT status FROM appointments WHERE id = 'a1'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(status, "completed");
}

#[test]
fn trash_purge_expired() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, is_deleted, deleted_at) \
             VALUES ('doc-old', 'old.pdf', 'docs/old.pdf', 'application/pdf', 512, 'other', \
             1, datetime('now', '-31 days'))",
            [],
        )
        .unwrap();
    db.conn
        .execute(
            "DELETE FROM documents WHERE is_deleted = 1 AND deleted_at < datetime('now', '-30 days')",
            [],
        )
        .unwrap();
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE id = 'doc-old'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 0);
}
