use rusqlite::{Connection, Result};

const SCHEMA_V1: &str = include_str!("schema.sql");
const SCHEMA_V2: &str = include_str!("migrations/v2.sql");
const SCHEMA_V3: &str = include_str!("migrations/v3.sql");
const SCHEMA_V4: &str = "
    CREATE INDEX IF NOT EXISTS idx_documents_category
        ON documents (category);
    CREATE INDEX IF NOT EXISTS idx_appointments_appt_date
        ON appointments (appt_date);
    CREATE INDEX IF NOT EXISTS idx_calendar_events_appointment_id
        ON calendar_events (appointment_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_is_deduped_with
        ON contacts (is_deduped_with);
    CREATE INDEX IF NOT EXISTS idx_document_appointments_appointment_id
        ON document_appointments (appointment_id);
    CREATE INDEX IF NOT EXISTS idx_documents_created_at
        ON documents (created_at);
";

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INTEGER PRIMARY KEY,
            applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
    )?;

    let version: i32 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    if version < 1 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V1)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [1])?;
        tx.commit()?;
    }

    if version < 2 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V2)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [2])?;
        tx.commit()?;
    }

    if version < 3 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V3)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [3])?;
        tx.commit()?;
    }

    if version < 4 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V4)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [4])?;
        tx.commit()?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn migrated_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        run(&conn).unwrap();
        conn
    }

    // ── Migration round-trip ─────────────────────────────────────────────────

    #[test]
    fn migration_runs_to_version_3() {
        let conn = migrated_conn();
        let version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 4);
    }

    #[test]
    fn migration_is_idempotent() {
        let conn = migrated_conn();
        run(&conn).unwrap(); // second run must not error
        let version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 4);
    }

    // ── Categories ───────────────────────────────────────────────────────────

    #[test]
    fn system_categories_seeded() {
        let conn = migrated_conn();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE is_system = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 8, "expected 8 system categories");
    }

    #[test]
    fn categories_has_expected_names() {
        let conn = migrated_conn();
        let mut stmt = conn
            .prepare("SELECT name FROM categories ORDER BY sort_order")
            .unwrap();
        let names: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(names.contains(&"Lab Results".to_string()));
        assert!(names.contains(&"Cardiology".to_string()));
        assert!(names.contains(&"Prescriptions".to_string()));
    }

    #[test]
    fn categories_user_create_and_delete() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO categories (id, name, color_hex, is_system, sort_order) \
             VALUES ('cat_test', 'Test', '#FFFFFF', 0, 99)",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE id = 'cat_test'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        conn.execute("DELETE FROM categories WHERE id = 'cat_test'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM categories WHERE id = 'cat_test'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn categories_parent_child_reference() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order) \
             VALUES ('cat_child', 'Child', 'cat_cardiology', '#FF0000', 0, 100)",
            [],
        )
        .unwrap();
        let parent: String = conn
            .query_row(
                "SELECT parent_id FROM categories WHERE id = 'cat_child'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(parent, "cat_cardiology");
    }

    // ── Document categories ──────────────────────────────────────────────────

    #[test]
    fn document_categories_cascade_delete() {
        let conn = migrated_conn();
        // insert a document then assign a category
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at, is_deleted) \
             VALUES ('doc-v2-1','f.pdf','/tmp/f.pdf','application/pdf',1,'other', \
             '2024-01-01','2024-01-01',0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_categories (document_id, category_id) \
             VALUES ('doc-v2-1', 'cat_general')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_categories WHERE document_id = 'doc-v2-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        // deleting the document must cascade
        conn.execute("DELETE FROM documents WHERE id = 'doc-v2-1'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_categories WHERE document_id = 'doc-v2-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    // ── Appointment categories ───────────────────────────────────────────────

    #[test]
    fn appointment_categories_cascade_delete() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, status, created_at, updated_at) \
             VALUES ('appt-v2-1','Checkup','2024-06-01','scheduled','2024-01-01','2024-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointment_categories (appointment_id, category_id) \
             VALUES ('appt-v2-1', 'cat_general')",
            [],
        )
        .unwrap();
        conn.execute("DELETE FROM appointments WHERE id = 'appt-v2-1'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_categories WHERE appointment_id = 'appt-v2-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    // ── Clinics ──────────────────────────────────────────────────────────────

    #[test]
    fn clinics_crud() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO clinics (id, name, address, phone) \
             VALUES ('clin-1', 'City Hospital', '1 Main St', '555-0100')",
            [],
        )
        .unwrap();
        let name: String = conn
            .query_row("SELECT name FROM clinics WHERE id = 'clin-1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(name, "City Hospital");
        conn.execute("DELETE FROM clinics WHERE id = 'clin-1'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinics WHERE id = 'clin-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    // ── Document appointments ────────────────────────────────────────────────

    #[test]
    fn document_appointments_unique_pair() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at, is_deleted) \
             VALUES ('doc-v2-2','g.pdf','/tmp/g.pdf','application/pdf',1,'other', \
             '2024-01-01','2024-01-01',0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, status, created_at, updated_at) \
             VALUES ('appt-v2-2','Scan','2024-07-01','scheduled','2024-01-01','2024-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES ('lnk-1','doc-v2-2','appt-v2-2','related','manual','2024-01-01')",
            [],
        )
        .unwrap();
        // duplicate pair must fail
        let result = conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES ('lnk-2','doc-v2-2','appt-v2-2','related','manual','2024-01-01')",
            [],
        );
        assert!(
            result.is_err(),
            "duplicate (doc, appt) pair should be rejected"
        );
    }

    #[test]
    fn document_appointments_cascade_delete_on_document() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at, is_deleted) \
             VALUES ('doc-v2-3','h.pdf','/tmp/h.pdf','application/pdf',1,'other', \
             '2024-01-01','2024-01-01',0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, status, created_at, updated_at) \
             VALUES ('appt-v2-3','MRI','2024-08-01','scheduled','2024-01-01','2024-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, created_at) \
             VALUES ('lnk-3','doc-v2-3','appt-v2-3','related','auto','2024-01-01')",
            [],
        )
        .unwrap();
        conn.execute("DELETE FROM documents WHERE id = 'doc-v2-3'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_appointments WHERE id = 'lnk-3'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    // ── Calendar sources & events ────────────────────────────────────────────

    #[test]
    fn calendar_sources_insert_and_query() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO calendar_sources \
             (id, external_id, name, color_hex, enabled, last_synced_at) \
             VALUES ('src-1', 'ext-abc', 'Personal', '#3B82F6', 1, NULL)",
            [],
        )
        .unwrap();
        let name: String = conn
            .query_row(
                "SELECT name FROM calendar_sources WHERE id = 'src-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(name, "Personal");
    }

    #[test]
    fn calendar_sources_external_id_unique() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-2', 'ext-dup', 'Work', 1)",
            [],
        )
        .unwrap();
        let result = conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-3', 'ext-dup', 'Duplicate', 1)",
            [],
        );
        assert!(result.is_err(), "duplicate external_id should be rejected");
    }

    #[test]
    fn calendar_events_link_to_source() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-4', 'ext-ev', 'Health', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, is_imported, last_synced_at) \
             VALUES ('ev-1','evt-001','src-4','GP Appointment', \
             '2024-09-15T10:00:00Z', 0, '2024-09-15T00:00:00Z')",
            [],
        )
        .unwrap();
        let title: String = conn
            .query_row(
                "SELECT title FROM calendar_events WHERE id = 'ev-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(title, "GP Appointment");
    }

    #[test]
    fn calendar_events_external_id_unique() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO calendar_sources (id, external_id, name, enabled) \
             VALUES ('src-5', 'ext-ev2', 'Family', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, is_imported, last_synced_at) \
             VALUES ('ev-2','evt-dup','src-5','Dentist','2024-10-01T09:00:00Z',0, \
             '2024-10-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let result = conn.execute(
            "INSERT INTO calendar_events \
             (id, external_id, calendar_id, title, start_at, is_imported, last_synced_at) \
             VALUES ('ev-3','evt-dup','src-5','Duplicate','2024-10-02T09:00:00Z',0, \
             '2024-10-02T00:00:00Z')",
            [],
        );
        assert!(
            result.is_err(),
            "duplicate external_id in calendar_events should be rejected"
        );
    }

    // ── v2 column additions ──────────────────────────────────────────────────

    #[test]
    fn documents_has_document_date_column() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at, is_deleted, document_date) \
             VALUES ('doc-v2-col','x.pdf','/tmp/x.pdf','application/pdf',1,'lab', \
             '2024-01-01','2024-01-01',0,'2024-12-01')",
            [],
        )
        .unwrap();
        let date: String = conn
            .query_row(
                "SELECT document_date FROM documents WHERE id = 'doc-v2-col'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(date, "2024-12-01");
    }

    #[test]
    fn contacts_has_clinic_id_column() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO clinics (id, name) VALUES ('clin-ref', 'Ref Clinic')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO contacts (id, name, role, clinic_id, created_at, updated_at) \
             VALUES ('con-1','Dr Smith','gp','clin-ref','2024-01-01','2024-01-01')",
            [],
        )
        .unwrap();
        let clinic: String = conn
            .query_row(
                "SELECT clinic_id FROM contacts WHERE id = 'con-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(clinic, "clin-ref");
    }

    // ── v3 column additions ──────────────────────────────────────────────────

    #[test]
    fn documents_has_extraction_columns() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              created_at, updated_at, is_deleted, \
              extracted_text, extraction_status, extracted_at, extraction_error, \
              parsed_filename, parser_confidence) \
             VALUES ('doc-v3-1','scan.pdf','/tmp/scan.pdf','application/pdf',2048,'lab', \
             '2024-01-01','2024-01-01',0, \
             'blood glucose 5.4','done','2024-06-01T10:00:00Z',NULL,'scan_2024',0.92)",
            [],
        )
        .unwrap();
        let (text, status, confidence): (String, String, f64) = conn
            .query_row(
                "SELECT extracted_text, extraction_status, parser_confidence \
                 FROM documents WHERE id = 'doc-v3-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!(text, "blood glucose 5.4");
        assert_eq!(status, "done");
        assert!((confidence - 0.92).abs() < 0.001);
    }

    #[test]
    fn existing_documents_have_null_extraction_columns() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              created_at, updated_at, is_deleted) \
             VALUES ('doc-v3-old','old.pdf','/tmp/old.pdf','application/pdf',512,'other', \
             '2024-01-01','2024-01-01',0)",
            [],
        )
        .unwrap();
        let text: Option<String> = conn
            .query_row(
                "SELECT extracted_text FROM documents WHERE id = 'doc-v3-old'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(
            text.is_none(),
            "extracted_text must be NULL for pre-v3 rows"
        );
    }

    #[test]
    fn appointments_has_clinic_id_column() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO clinics (id, name) VALUES ('clin-appt', 'Heart Centre')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointments \
             (id, title, appt_date, status, created_at, updated_at, clinic_id) \
             VALUES ('appt-v3-1','ECG','2024-09-01','scheduled', \
             '2024-01-01','2024-01-01','clin-appt')",
            [],
        )
        .unwrap();
        let clinic: String = conn
            .query_row(
                "SELECT clinic_id FROM appointments WHERE id = 'appt-v3-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(clinic, "clin-appt");
    }

    #[test]
    fn contacts_has_dedup_columns() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO contacts \
             (id, name, role, created_at, updated_at, is_deduped_with, dedup_score) \
             VALUES ('con-v3-1','Jane Doe','gp','2024-01-01','2024-01-01','con-v3-2',0.91)",
            [],
        )
        .unwrap();
        let (deduped_with, score): (String, f64) = conn
            .query_row(
                "SELECT is_deduped_with, dedup_score FROM contacts WHERE id = 'con-v3-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(deduped_with, "con-v3-2");
        assert!((score - 0.91).abs() < 0.001);
    }

    #[test]
    fn document_appointments_has_score_column() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              created_at, updated_at, is_deleted) \
             VALUES ('doc-v3-s','s.pdf','/tmp/s.pdf','application/pdf',1,'other', \
             '2024-01-01','2024-01-01',0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, status, created_at, updated_at) \
             VALUES ('appt-v3-s','Blood Test','2024-10-01','scheduled', \
             '2024-01-01','2024-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_appointments \
             (id, document_id, appointment_id, link_type, confidence, score) \
             VALUES ('lnk-v3','doc-v3-s','appt-v3-s','related','auto',5)",
            [],
        )
        .unwrap();
        let score: i64 = conn
            .query_row(
                "SELECT score FROM document_appointments WHERE id = 'lnk-v3'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(score, 5);
    }

    #[test]
    fn migration_v4_creates_indexes() {
        let conn = migrated_conn();

        // Check that all 6 indexes exist in sqlite_master
        let mut stmt = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' \
                 ORDER BY name",
            )
            .unwrap();

        let indexes: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<rusqlite::Result<Vec<String>>>()
            .unwrap();

        // Expected indexes from SCHEMA_V4
        let expected = vec![
            "idx_documents_category",
            "idx_appointments_appt_date",
            "idx_calendar_events_appointment_id",
            "idx_contacts_is_deduped_with",
            "idx_document_appointments_appointment_id",
            "idx_documents_created_at",
        ];

        // v2 already created idx_calendar_events_calendar_id; v4 adds 6 more
        assert!(
            indexes.len() >= 6,
            "Expected at least 6 indexes, found: {:?}",
            indexes
        );
        for expected_idx in expected {
            assert!(
                indexes.contains(&expected_idx.to_string()),
                "Index {} not found in {:?}",
                expected_idx,
                indexes
            );
        }
    }
}
