use super::helpers::TempDb;
use app_lib::extraction::{
    auto_extract_tags, contact::extract_contact_suggestions, extract_activity_date,
};

const DOCTOR_TEXT: &str =
    "Dear Dr. Sarah Mitchell,\nPlease find enclosed the results from City Medical Clinic.\n\
     Dr. Mitchell specialises in Cardiology.";

const DATE_TEXT: &str = "Invoice Date: 2024-03-15\nBlood pressure 120/80. Follow-up in 4 weeks.";

#[test]
fn test_upload_batch_single_file() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, batch_upload_id) \
             VALUES ('doc-a', 'report.pdf', 'docs/report.pdf', 'application/pdf', 2048, \
             'other', 'batch-001')",
            [],
        )
        .unwrap();
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE batch_upload_id = 'batch-001'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}

#[test]
fn test_upload_batch_three_files() {
    let db = TempDb::new();
    let batch = "batch-xyz";
    for i in 0..3 {
        db.conn
            .execute(
                &format!(
                    "INSERT INTO documents (id, filename, file_path, mime_type, \
                     file_size_bytes, category, batch_upload_id) \
                     VALUES ('d{i}', 'file{i}.pdf', 'docs/file{i}.pdf', \
                     'application/pdf', 512, 'other', '{batch}')"
                ),
                [],
            )
            .unwrap();
    }
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE batch_upload_id = ?1",
            [batch],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 3);
}

#[test]
fn test_extract_suggestions_returns_contact() {
    let contacts = extract_contact_suggestions(DOCTOR_TEXT);
    assert!(
        !contacts.is_empty(),
        "expected contact suggestion for doctor text; got none"
    );
    let names: Vec<&str> = contacts.iter().map(|c| c.name.as_str()).collect();
    assert!(
        names.iter().any(|n| n.contains("Mitchell")),
        "expected 'Mitchell' in contact names; got {names:?}"
    );
}

#[test]
fn test_extract_suggestions_returns_tags() {
    let activity_date = extract_activity_date(DATE_TEXT);
    let tags = auto_extract_tags(DATE_TEXT, &[], activity_date.as_deref());
    assert!(
        tags.iter().any(|t| t.starts_with("2024")),
        "expected a 2024 date tag; got {tags:?}"
    );
}

#[test]
fn test_duplicate_upload_creates_new_row() {
    let db = TempDb::new();
    for id in ["dup-1", "dup-2"] {
        db.conn
            .execute(
                "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
                 category) \
                 VALUES (?1, 'same.pdf', 'docs/same.pdf', 'application/pdf', 1024, 'other')",
                [id],
            )
            .unwrap();
    }
    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE file_path = 'docs/same.pdf'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 2);
}
