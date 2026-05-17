use super::helpers::TempDb;

/// After a clinic is renamed, documents with the old clinic_name must be updated
/// to carry the new name, and an appointment linked by that name must also update.
#[test]
fn rename_cascades_to_documents_and_appointments() {
    let db = TempDb::new();

    db.conn
        .execute(
            "INSERT INTO clinics (id, name) VALUES ('cl1', 'Old Name')",
            [],
        )
        .unwrap();

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, clinic_name) \
             VALUES ('doc1', 'test.pdf', 'docs/test.pdf', 'application/pdf', 1024, 'lab', 'Old Name')",
            [],
        )
        .unwrap();

    db.conn
        .execute(
            "INSERT INTO appointments (id, title, appt_date, clinic_name) \
             VALUES ('appt1', 'Checkup', '2025-01-01', 'Old Name')",
            [],
        )
        .unwrap();

    let old_name: String = db
        .conn
        .query_row("SELECT name FROM clinics WHERE id = 'cl1'", [], |r| {
            r.get(0)
        })
        .unwrap();
    let new_name = "New Name";

    let tx = db.conn.unchecked_transaction().unwrap();
    tx.execute(
        "UPDATE clinics SET name = ? WHERE id = 'cl1'",
        rusqlite::params![new_name],
    )
    .unwrap();
    if old_name != new_name {
        tx.execute(
            "UPDATE documents SET clinic_name = ? WHERE clinic_name = ?",
            rusqlite::params![new_name, old_name],
        )
        .unwrap();
        tx.execute(
            "UPDATE appointments SET clinic_name = ? WHERE clinic_name = ?",
            rusqlite::params![new_name, old_name],
        )
        .unwrap();
    }
    tx.commit().unwrap();

    let doc_clinic: String = db
        .conn
        .query_row(
            "SELECT clinic_name FROM documents WHERE id = 'doc1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        doc_clinic, "New Name",
        "document clinic_name must follow clinic rename"
    );

    let appt_clinic: String = db
        .conn
        .query_row(
            "SELECT clinic_name FROM appointments WHERE id = 'appt1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(
        appt_clinic, "New Name",
        "appointment clinic_name must follow clinic rename"
    );

    let clinic_name: String = db
        .conn
        .query_row("SELECT name FROM clinics WHERE id = 'cl1'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(clinic_name, "New Name");
}

/// Renaming a clinic to the same name must not error and must leave documents unchanged.
#[test]
fn no_op_rename_leaves_documents_intact() {
    let db = TempDb::new();

    db.conn
        .execute(
            "INSERT INTO clinics (id, name) VALUES ('cl2', 'Same Name')",
            [],
        )
        .unwrap();
    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, clinic_name) \
             VALUES ('doc2', 'x.pdf', 'docs/x.pdf', 'application/pdf', 512, 'lab', 'Same Name')",
            [],
        )
        .unwrap();

    let old_name: String = db
        .conn
        .query_row("SELECT name FROM clinics WHERE id = 'cl2'", [], |r| {
            r.get(0)
        })
        .unwrap();
    let new_name = "Same Name";

    let tx = db.conn.unchecked_transaction().unwrap();
    tx.execute(
        "UPDATE clinics SET name = ? WHERE id = 'cl2'",
        rusqlite::params![new_name],
    )
    .unwrap();
    if old_name != new_name {
        tx.execute(
            "UPDATE documents SET clinic_name = ? WHERE clinic_name = ?",
            rusqlite::params![new_name, old_name],
        )
        .unwrap();
    }
    tx.commit().unwrap();

    let doc_clinic: String = db
        .conn
        .query_row(
            "SELECT clinic_name FROM documents WHERE id = 'doc2'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(doc_clinic, "Same Name");
}
