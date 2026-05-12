use super::helpers::TempDb;

#[test]
fn insert_document_persists() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                "doc-001",
                "invoice.pdf",
                "docs/invoice.pdf",
                "application/pdf",
                12345_i64,
                "other",
            ],
        )
        .unwrap();

    let (filename, category): (String, String) = db
        .conn
        .query_row(
            "SELECT filename, category FROM documents WHERE id = ?1",
            rusqlite::params!["doc-001"],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert_eq!(filename, "invoice.pdf");
    assert_eq!(category, "other");
}

#[test]
fn list_documents_returns_non_deleted_only() {
    let db = TempDb::new();

    for i in 1..=3_i32 {
        db.conn
            .execute(
                "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category)
                 VALUES (?1, ?2, ?3, 'application/pdf', 100, 'other')",
                rusqlite::params![
                    format!("list-{i}"),
                    format!("file{i}.pdf"),
                    format!("f{i}.pdf"),
                ],
            )
            .unwrap();
    }

    db.conn
        .execute(
            "UPDATE documents SET is_deleted = 1 WHERE id = 'list-3'",
            [],
        )
        .unwrap();

    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(count, 2);
}

#[test]
fn soft_delete_sets_deleted_flag_and_timestamp() {
    let db = TempDb::new();

    db.conn
        .execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category)
             VALUES ('del-001', 'to_delete.pdf', 'to_delete.pdf', 'application/pdf', 500, 'lab')",
            [],
        )
        .unwrap();

    db.conn
        .execute(
            "UPDATE documents SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = 'del-001'",
            [],
        )
        .unwrap();

    let (is_deleted, deleted_at): (bool, Option<String>) = db
        .conn
        .query_row(
            "SELECT is_deleted, deleted_at FROM documents WHERE id = 'del-001'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert!(is_deleted);
    assert!(deleted_at.is_some());
}

#[test]
fn restore_document_clears_deleted_flag() {
    let db = TempDb::new();

    db.conn
        .execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, is_deleted, deleted_at)
             VALUES ('rst-001', 'restore.pdf', 'restore.pdf', 'application/pdf', 200, 'other', 1, CURRENT_TIMESTAMP)",
            [],
        )
        .unwrap();

    db.conn
        .execute(
            "UPDATE documents SET is_deleted = 0, deleted_at = NULL WHERE id = 'rst-001'",
            [],
        )
        .unwrap();

    let (is_deleted, deleted_at): (bool, Option<String>) = db
        .conn
        .query_row(
            "SELECT is_deleted, deleted_at FROM documents WHERE id = 'rst-001'",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap();

    assert!(!is_deleted);
    assert!(deleted_at.is_none());
}

#[test]
fn document_tags_cascade_on_hard_delete() {
    let db = TempDb::new();

    db.conn
        .execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category)
             VALUES ('tag-doc', 'tagged.pdf', 'tagged.pdf', 'application/pdf', 300, 'other')",
            [],
        )
        .unwrap();

    db.conn
        .execute(
            "INSERT INTO document_tags (document_id, tag) VALUES ('tag-doc', 'invoice')",
            [],
        )
        .unwrap();

    db.conn
        .execute("DELETE FROM documents WHERE id = 'tag-doc'", [])
        .unwrap();

    let tag_count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM document_tags WHERE document_id = 'tag-doc'",
            [],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(tag_count, 0);
}
