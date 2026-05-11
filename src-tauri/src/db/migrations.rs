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

const SCHEMA_V5: &str = "ALTER TABLE categories ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;";

const SCHEMA_V6: &str = "
    CREATE TABLE IF NOT EXISTS appointment_tags (
        appointment_id  TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        tag             TEXT NOT NULL,
        PRIMARY KEY (appointment_id, tag)
    );
";

const SCHEMA_V7: &str = "
    CREATE TABLE IF NOT EXISTS users (
        id           TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE documents       ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE appointments    ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE contacts        ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE notes           ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE categories      ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE calendar_events ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
";

const SCHEMA_V8: &str = "
    ALTER TABLE clinics ADD COLUMN company_registration_number TEXT;
    CREATE TABLE IF NOT EXISTS clinic_addresses (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id  INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        address    TEXT NOT NULL,
        is_primary INTEGER NOT NULL DEFAULT 0
    );
    ALTER TABLE documents ADD COLUMN activity_date TEXT;
";

const SCHEMA_V9: &str = "
    ALTER TABLE contacts ADD COLUMN title TEXT;
    CREATE TABLE IF NOT EXISTS document_contacts (
        document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        contact_id   TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        PRIMARY KEY (document_id, contact_id)
    );
";

const SCHEMA_V10: &str = "
    CREATE TABLE IF NOT EXISTS clinic_contacts (
        clinic_id   TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
        contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        PRIMARY KEY (clinic_id, contact_id)
    );
";

const SCHEMA_V14: &str = "
    CREATE TABLE IF NOT EXISTS note_links (
        id           TEXT PRIMARY KEY,
        note_id      TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        entity_type  TEXT NOT NULL CHECK(entity_type IN ('appointment','document')),
        entity_id    TEXT NOT NULL,
        created_at   TEXT NOT NULL,
        UNIQUE(note_id, entity_type, entity_id)
    );
    CREATE TABLE IF NOT EXISTS note_versions (
        id       TEXT PRIMARY KEY,
        note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        content  TEXT NOT NULL,
        saved_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_note_versions_note_id_saved_at
        ON note_versions (note_id, saved_at DESC);
";

const SCHEMA_V13: &str = "
    CREATE TABLE IF NOT EXISTS recurrence_series (
        id          TEXT PRIMARY KEY,
        rule        TEXT NOT NULL CHECK(rule IN ('weekly','monthly')),
        interval_n  INTEGER NOT NULL DEFAULT 1,
        until_date  TEXT,
        created_at  TEXT NOT NULL
    );
    ALTER TABLE appointments ADD COLUMN recurrence_series_id TEXT REFERENCES recurrence_series(id);
";

const SCHEMA_V12: &str = "
    CREATE TABLE IF NOT EXISTS appointment_reminders (
        id              TEXT PRIMARY KEY,
        appointment_id  TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        remind_at       TEXT NOT NULL,
        offset_label    TEXT NOT NULL,
        is_fired        INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_appointment_reminders_remind_at_is_fired
        ON appointment_reminders (remind_at, is_fired);
";

const SCHEMA_V11: &str = "
    CREATE TABLE contacts_v11 (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        role              TEXT NOT NULL CHECK(role IN (
                            'gp','specialist','dentist','physio','pharmacist','hospital','clinic','other')),
        specialty         TEXT,
        phone             TEXT,
        email             TEXT,
        clinic            TEXT,
        address           TEXT,
        notes             TEXT,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        clinic_id         TEXT REFERENCES clinics(id),
        is_deduped_with   TEXT,
        dedup_score       REAL,
        user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
        title             TEXT,
        contact_clinic_id TEXT REFERENCES contacts_v11(id)
    );
    INSERT INTO contacts_v11 (id, name, role, specialty, phone, email, clinic, address, notes,
                               created_at, updated_at, clinic_id, is_deduped_with, dedup_score,
                               user_id, title)
    SELECT id, name, role, specialty, phone, email, clinic, address, notes,
           created_at, updated_at, clinic_id, is_deduped_with, dedup_score, user_id, title
    FROM contacts;
    DROP TABLE contacts;
    ALTER TABLE contacts_v11 RENAME TO contacts;
    CREATE INDEX IF NOT EXISTS idx_contacts_is_deduped_with ON contacts(is_deduped_with);
";

const SCHEMA_V15: &str = "
    INSERT OR IGNORE INTO clinics (id, name, address, phone, created_at)
    SELECT id, name, address, phone, created_at FROM contacts WHERE role = 'clinic';
    DELETE FROM contacts WHERE role = 'clinic';
    CREATE TABLE contacts_v15 (
        id                TEXT PRIMARY KEY,
        name              TEXT NOT NULL,
        role              TEXT NOT NULL CHECK(role IN (
                            'gp','specialist','dentist','physio','pharmacist','hospital','other')),
        specialty         TEXT,
        phone             TEXT,
        email             TEXT,
        clinic            TEXT,
        address           TEXT,
        notes             TEXT,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        clinic_id         TEXT REFERENCES clinics(id),
        is_deduped_with   TEXT,
        dedup_score       REAL,
        user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
        title             TEXT,
        contact_clinic_id TEXT REFERENCES contacts_v15(id)
    );
    INSERT INTO contacts_v15 (id, name, role, specialty, phone, email, clinic, address, notes,
                               created_at, updated_at, clinic_id, is_deduped_with, dedup_score,
                               user_id, title)
    SELECT id, name, role, specialty, phone, email, clinic, address, notes,
           created_at, updated_at, clinic_id, is_deduped_with, dedup_score, user_id, title
    FROM contacts;
    DROP TABLE contacts;
    ALTER TABLE contacts_v15 RENAME TO contacts;
    CREATE INDEX IF NOT EXISTS idx_contacts_is_deduped_with ON contacts(is_deduped_with);
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

    if version < 5 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V5)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [5])?;
        tx.commit()?;
    }

    if version < 6 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V6)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [6])?;
        tx.commit()?;
    }

    if version < 7 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V7)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [7])?;
        tx.commit()?;
    }

    if version < 8 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V8)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [8])?;
        tx.commit()?;
    }

    if version < 9 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V9)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [9])?;
        tx.commit()?;
    }

    if version < 10 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V10)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [10])?;
        tx.commit()?;
    }

    if version < 11 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V11)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [11])?;
        tx.commit()?;
    }

    if version < 12 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V12)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [12])?;
        tx.commit()?;
    }

    if version < 13 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V13)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [13])?;
        tx.commit()?;
    }

    if version < 14 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V14)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [14])?;
        tx.commit()?;
    }

    if version < 15 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V15)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [15])?;
        tx.commit()?;
    }

    if version < 16 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch("ALTER TABLE clinics ADD COLUMN email TEXT;")?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [16])?;
        tx.commit()?;
    }

    if version < 17 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch("ALTER TABLE documents ADD COLUMN clinic_name TEXT;")?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [17])?;
        tx.commit()?;
    }

    if version < 19 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "ALTER TABLE clinics      ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1));
             ALTER TABLE clinics      ADD COLUMN deleted_at TEXT;
             ALTER TABLE contacts     ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1));
             ALTER TABLE contacts     ADD COLUMN deleted_at TEXT;
             ALTER TABLE appointments ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1));
             ALTER TABLE appointments ADD COLUMN deleted_at TEXT;
             ALTER TABLE notes        ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1));
             ALTER TABLE notes        ADD COLUMN deleted_at TEXT;
             CREATE INDEX IF NOT EXISTS idx_clinics_is_deleted      ON clinics(is_deleted);
             CREATE INDEX IF NOT EXISTS idx_contacts_is_deleted     ON contacts(is_deleted);
             CREATE INDEX IF NOT EXISTS idx_appointments_is_deleted ON appointments(is_deleted);
             CREATE INDEX IF NOT EXISTS idx_notes_is_deleted        ON notes(is_deleted);",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [19])?;
        tx.commit()?;
    }

    if version < 18 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "DROP TABLE IF EXISTS clinic_addresses;
             CREATE TABLE clinic_addresses (
               id         TEXT PRIMARY KEY,
               clinic_id  TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
               label      TEXT,
               line1      TEXT NOT NULL,
               line2      TEXT,
               city       TEXT,
               postcode   TEXT,
               country    TEXT NOT NULL DEFAULT 'GB',
               is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
               created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
             );
             CREATE INDEX IF NOT EXISTS idx_clinic_addresses_clinic
               ON clinic_addresses(clinic_id);
             CREATE TABLE IF NOT EXISTS contact_addresses (
               id         TEXT PRIMARY KEY,
               contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
               label      TEXT,
               line1      TEXT NOT NULL,
               line2      TEXT,
               city       TEXT,
               postcode   TEXT,
               country    TEXT NOT NULL DEFAULT 'GB',
               is_primary INTEGER NOT NULL DEFAULT 0 CHECK(is_primary IN (0,1)),
               created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
             );
             CREATE INDEX IF NOT EXISTS idx_contact_addresses_contact
               ON contact_addresses(contact_id);",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [18])?;
        tx.commit()?;
    }

    if version < 20 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "DROP TABLE IF EXISTS search_index;
             CREATE VIRTUAL TABLE search_index USING fts5(
               entity_type,
               entity_id,
               title,
               body,
               tags,
               extracted_metadata,
               category_name,
               extracted_text,
               tokenize = 'porter unicode61'
             );",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [20])?;
        tx.commit()?;
    }

    if version < 21 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS document_entities (
               id          TEXT    PRIMARY KEY,
               document_id TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
               entity_type TEXT    NOT NULL CHECK(entity_type IN ('medication','diagnosis','lab_value','referral')),
               name        TEXT    NOT NULL,
               value       TEXT,
               unit        TEXT,
               raw_text    TEXT    NOT NULL,
               created_at  TEXT    NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_document_entities_document_id
               ON document_entities(document_id);",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [21])?;
        tx.commit()?;
    }

    if version < 22 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS symptoms (
               id          TEXT PRIMARY KEY,
               name        TEXT NOT NULL,
               severity    INTEGER CHECK(severity BETWEEN 1 AND 10),
               onset_date  TEXT,
               notes       TEXT,
               deleted_at  TEXT,
               created_at  TEXT NOT NULL,
               updated_at  TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_symptoms_deleted_at
               ON symptoms(deleted_at);",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [22])?;
        tx.commit()?;
    }

    if version < 23 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS medications (
               id         TEXT PRIMARY KEY,
               name       TEXT NOT NULL,
               dosage     TEXT,
               frequency  TEXT,
               start_date TEXT,
               end_date   TEXT,
               notes      TEXT,
               deleted_at TEXT,
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_medications_deleted_at
               ON medications(deleted_at);",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [23])?;
        tx.commit()?;
    }

    if version < 24 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "CREATE TABLE IF NOT EXISTS entity_links (
               id         TEXT PRIMARY KEY,
               from_type  TEXT NOT NULL,
               from_id    TEXT NOT NULL,
               to_type    TEXT NOT NULL,
               to_id      TEXT NOT NULL,
               created_at TEXT NOT NULL,
               UNIQUE(from_type, from_id, to_type, to_id)
             );
             CREATE INDEX IF NOT EXISTS idx_entity_links_from
               ON entity_links(from_type, from_id);",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [24])?;
        tx.commit()?;
    }

    if version < 25 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "DROP TABLE IF EXISTS search_index;
             CREATE VIRTUAL TABLE search_index USING fts5(
               entity_type,
               entity_id,
               title,
               body,
               tags,
               extracted_metadata,
               category_name,
               extracted_text,
               activity_date UNINDEXED,
               tokenize = 'porter unicode61'
             );",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [25])?;
        tx.commit()?;
    }

    if version < 26 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "ALTER TABLE contacts      ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE clinics       ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE appointments  ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE symptoms      ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE medications   ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE document_tags ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
             ALTER TABLE documents     ADD COLUMN batch_upload_id TEXT;",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [26])?;
        tx.commit()?;
    }

    if version < 27 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(
            "ALTER TABLE contacts ADD COLUMN merge_candidate_id TEXT REFERENCES contacts(id);
             ALTER TABLE clinics  ADD COLUMN merge_candidate_id TEXT REFERENCES clinics(id);",
        )?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [27])?;
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
    fn migration_runs_to_current_version() {
        let conn = migrated_conn();
        let version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(version, 27);
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
        assert_eq!(version, 27);
    }

    #[test]
    fn categories_has_is_archived_column() {
        let conn = migrated_conn();
        // Insert a category; is_archived should default to 0
        conn.execute(
            "INSERT INTO categories (id, name, color_hex, is_system, sort_order) \
             VALUES ('cat_arch_test', 'ArchTest', '#FFFFFF', 0, 200)",
            [],
        )
        .unwrap();
        let archived: i64 = conn
            .query_row(
                "SELECT is_archived FROM categories WHERE id = 'cat_arch_test'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived, 0);

        // Archiving works
        conn.execute(
            "UPDATE categories SET is_archived = 1 WHERE id = 'cat_arch_test'",
            [],
        )
        .unwrap();
        let archived: i64 = conn
            .query_row(
                "SELECT is_archived FROM categories WHERE id = 'cat_arch_test'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(archived, 1);
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

    #[test]
    fn appointment_tags_cascade_delete() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, status, created_at, updated_at) \
             VALUES ('appt-tag-1','Checkup','2024-06-01','scheduled','2024-01-01','2024-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointment_tags (appointment_id, tag) VALUES ('appt-tag-1', 'R07.9')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_tags WHERE appointment_id = 'appt-tag-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        conn.execute("DELETE FROM appointments WHERE id = 'appt-tag-1'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_tags WHERE appointment_id = 'appt-tag-1'",
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

    // ── v8 schema additions ──────────────────────────────────────────────────

    #[test]
    fn clinics_has_company_registration_number_column() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO clinics (id, name, company_registration_number) \
             VALUES ('clin-v8-1', 'PhysioPlus', 'CRN-12345')",
            [],
        )
        .unwrap();
        let crn: String = conn
            .query_row(
                "SELECT company_registration_number FROM clinics WHERE id = 'clin-v8-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(crn, "CRN-12345");
    }

    #[test]
    fn clinic_addresses_cascade_delete() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO clinics (id, name) VALUES ('clin-v18-1', 'BackCare')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO clinic_addresses (id, clinic_id, line1, is_primary) \
             VALUES ('addr-v18-1', 'clin-v18-1', '10 Spine St', 1)",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_addresses WHERE clinic_id = 'clin-v18-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        conn.execute("DELETE FROM clinics WHERE id = 'clin-v18-1'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_addresses WHERE clinic_id = 'clin-v18-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "clinic_addresses must cascade-delete with clinic");
    }

    #[test]
    fn contact_addresses_cascade_delete() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO contacts (id, name, role) VALUES ('con-v18-1', 'Dr Smith', 'gp')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO contact_addresses (id, contact_id, line1, is_primary) \
             VALUES ('addr-v18-2', 'con-v18-1', '22 Health Rd', 1)",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM contact_addresses WHERE contact_id = 'con-v18-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        conn.execute("DELETE FROM contacts WHERE id = 'con-v18-1'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM contact_addresses WHERE contact_id = 'con-v18-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 0,
            "contact_addresses must cascade-delete with contact"
        );
    }

    #[test]
    fn documents_has_activity_date_column() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              created_at, updated_at, is_deleted, activity_date) \
             VALUES ('doc-v8-1','invoice.pdf','/tmp/invoice.pdf','application/pdf',1024,'other', \
             '2024-01-01','2024-01-01',0,'2024-11-15')",
            [],
        )
        .unwrap();
        let date: String = conn
            .query_row(
                "SELECT activity_date FROM documents WHERE id = 'doc-v8-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(date, "2024-11-15");
    }

    #[test]
    fn existing_documents_have_null_activity_date() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents \
             (id, filename, file_path, mime_type, file_size_bytes, category, \
              created_at, updated_at, is_deleted) \
             VALUES ('doc-v8-old','old.pdf','/tmp/old.pdf','application/pdf',512,'other', \
             '2024-01-01','2024-01-01',0)",
            [],
        )
        .unwrap();
        let date: Option<String> = conn
            .query_row(
                "SELECT activity_date FROM documents WHERE id = 'doc-v8-old'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(date.is_none(), "activity_date must be NULL for pre-v8 rows");
    }

    // ── v9 schema additions ──────────────────────────────────────────────────

    #[test]
    fn v9_adds_title_column_to_contacts() {
        let conn = migrated_conn();
        let now = "2024-01-01T00:00:00Z";
        conn.execute(
            "INSERT INTO contacts (id, name, role, title, created_at, updated_at) \
             VALUES ('con-v9-1', 'Dr. Smith', 'specialist', 'Dr.', ?, ?)",
            rusqlite::params![now, now],
        )
        .unwrap();
        let title: Option<String> = conn
            .query_row(
                "SELECT title FROM contacts WHERE id = 'con-v9-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(title.as_deref(), Some("Dr."));
    }

    #[test]
    fn v9_creates_document_contacts_table() {
        let conn = migrated_conn();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master \
                 WHERE type='table' AND name='document_contacts'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "document_contacts table must exist after v9");
    }

    // ── v10 schema additions ─────────────────────────────────────────────────

    #[test]
    fn v10_creates_clinic_contacts_table() {
        let conn = migrated_conn();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master \
                 WHERE type='table' AND name='clinic_contacts'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "clinic_contacts table must exist after v10");
    }

    #[test]
    fn v10_clinic_contacts_cascade_delete() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO clinics (id, name) VALUES ('clin-v10-1', 'Heart Centre')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES ('con-v10-1', 'Dr. Lee', 'specialist', '2024-01-01', '2024-01-01')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO clinic_contacts (clinic_id, contact_id) \
             VALUES ('clin-v10-1', 'con-v10-1')",
            [],
        )
        .unwrap();
        conn.execute("DELETE FROM clinics WHERE id = 'clin-v10-1'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_contacts WHERE clinic_id = 'clin-v10-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "clinic_contacts must cascade-delete with clinic");
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

    #[test]
    fn migration_v12_creates_appointment_reminders_table() {
        let conn = migrated_conn();

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' \
                 AND name='appointment_reminders'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "appointment_reminders table must exist");
    }

    #[test]
    fn migration_v12_creates_remind_at_is_fired_index() {
        let conn = migrated_conn();

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' \
                 AND name='idx_appointment_reminders_remind_at_is_fired'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 1,
            "idx_appointment_reminders_remind_at_is_fired must exist"
        );
    }

    #[test]
    fn migration_v12_reminders_cascade_delete_with_appointment() {
        let conn = migrated_conn();

        // Insert a user (required FK in appointments)
        conn.execute(
            "INSERT INTO users (id, display_name) VALUES ('u1', 'Test User')",
            [],
        )
        .unwrap();

        // Insert a minimal appointment
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, created_at, user_id) \
             VALUES ('appt-1', 'Check-up', '2026-06-01', '2026-05-01', 'u1')",
            [],
        )
        .unwrap();

        // Insert a reminder for that appointment
        conn.execute(
            "INSERT INTO appointment_reminders \
             (id, appointment_id, remind_at, offset_label, is_fired, created_at) \
             VALUES ('rem-1', 'appt-1', '2026-05-31T09:00:00', '1 day before', 0, '2026-05-01')",
            [],
        )
        .unwrap();

        // Delete the appointment — reminder should cascade
        conn.execute("DELETE FROM appointments WHERE id='appt-1'", [])
            .unwrap();

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM appointment_reminders WHERE id='rem-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "reminder must cascade-delete with appointment");
    }

    // ── v14: note_links + note_versions ─────────────────────────────────────

    #[test]
    fn migration_v14_note_links_table_exists() {
        let conn = migrated_conn();
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='note_links'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "note_links table must exist");
    }

    #[test]
    fn migration_v14_note_versions_table_exists() {
        let conn = migrated_conn();
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='note_versions'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "note_versions table must exist");
    }

    #[test]
    fn migration_v14_note_links_cascade_delete() {
        let conn = migrated_conn();

        conn.execute(
            "INSERT INTO users (id, display_name) VALUES ('u1', 'Test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, user_id) \
             VALUES ('n1', 'Note', 'body', '2026-01-01T00:00:00', '2026-01-01T00:00:00', 'u1')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO note_links (id, note_id, entity_type, entity_id, created_at) \
             VALUES ('nl1', 'n1', 'document', 'doc-1', '2026-01-01T00:00:00')",
            [],
        )
        .unwrap();

        conn.execute("DELETE FROM notes WHERE id='n1'", []).unwrap();

        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM note_links WHERE id='nl1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "note_links must cascade-delete with note");
    }

    #[test]
    fn migration_v14_note_links_unique_constraint() {
        let conn = migrated_conn();

        conn.execute(
            "INSERT INTO users (id, display_name) VALUES ('u1', 'Test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, user_id) \
             VALUES ('n1', 'Note', 'body', '2026-01-01T00:00:00', '2026-01-01T00:00:00', 'u1')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO note_links (id, note_id, entity_type, entity_id, created_at) \
             VALUES ('nl1', 'n1', 'appointment', 'appt-1', '2026-01-01T00:00:00')",
            [],
        )
        .unwrap();

        let result = conn.execute(
            "INSERT INTO note_links (id, note_id, entity_type, entity_id, created_at) \
             VALUES ('nl2', 'n1', 'appointment', 'appt-1', '2026-01-01T00:00:00')",
            [],
        );
        assert!(
            result.is_err(),
            "duplicate (note_id, entity_type, entity_id) must be rejected"
        );
    }

    // ── v15: migrate role=clinic contacts → clinics ──────────────────────────

    #[test]
    fn v15_contacts_role_clinic_not_insertable() {
        let conn = migrated_conn();
        let result = conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES ('con-v15-bad', 'Old Clinic', 'clinic', '2024-01-01', '2024-01-01')",
            [],
        );
        assert!(
            result.is_err(),
            "role='clinic' must be rejected by contacts CHECK constraint after v15"
        );
    }

    #[test]
    fn v15_migration_moves_clinic_contacts_to_clinics_table() {
        // Simulate a database that had a role='clinic' contact before v15
        // by running only up to v14, inserting the row, then applying v15 manually
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

        // Run migrations 1..14
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version     INTEGER PRIMARY KEY,
                applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
            );",
        )
        .unwrap();
        for schema in [
            SCHEMA_V1, SCHEMA_V2, SCHEMA_V3, SCHEMA_V4, SCHEMA_V5, SCHEMA_V6, SCHEMA_V7, SCHEMA_V8,
            SCHEMA_V9, SCHEMA_V10, SCHEMA_V11, SCHEMA_V12, SCHEMA_V13, SCHEMA_V14,
        ]
        .iter()
        .enumerate()
        {
            let tx = conn.unchecked_transaction().unwrap();
            tx.execute_batch(schema.1).unwrap();
            tx.execute(
                "INSERT INTO schema_migrations (version) VALUES (?1)",
                [schema.0 as i32 + 1],
            )
            .unwrap();
            tx.commit().unwrap();
        }

        // Insert a role='clinic' contact (valid before v15)
        conn.execute(
            "INSERT INTO contacts (id, name, role, address, phone, created_at, updated_at) \
             VALUES ('con-clin-1', 'City Physio', 'clinic', '5 Park Rd', '555-0200', \
             '2024-03-01', '2024-03-01')",
            [],
        )
        .unwrap();

        // Now apply v15
        let tx = conn.unchecked_transaction().unwrap();
        tx.execute_batch(SCHEMA_V15).unwrap();
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [15])
            .unwrap();
        tx.commit().unwrap();

        // The clinic should now be in the clinics table
        let name: String = conn
            .query_row(
                "SELECT name FROM clinics WHERE id = 'con-clin-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(name, "City Physio");

        // The row must be gone from contacts
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM contacts WHERE id = 'con-clin-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 0,
            "role=clinic contact must be removed from contacts"
        );
    }

    #[test]
    fn v15_non_clinic_contacts_are_preserved() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES ('con-v15-gp', 'Dr. Green', 'gp', '2024-01-01', '2024-01-01')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM contacts WHERE id = 'con-v15-gp'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "non-clinic contacts must survive v15 migration");
    }

    // ── v19: is_deleted / deleted_at on all entity tables ───────────────────

    #[test]
    fn v19_clinics_is_deleted_defaults_to_zero() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO clinics (id, name) VALUES ('clin-v19-1', 'Test Clinic')",
            [],
        )
        .unwrap();
        let is_deleted: i64 = conn
            .query_row(
                "SELECT is_deleted FROM clinics WHERE id = 'clin-v19-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_deleted, 0);
        conn.execute(
            "UPDATE clinics SET is_deleted = 1 WHERE id = 'clin-v19-1'",
            [],
        )
        .unwrap();
        let is_deleted: i64 = conn
            .query_row(
                "SELECT is_deleted FROM clinics WHERE id = 'clin-v19-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_deleted, 1);
    }

    #[test]
    fn v19_contacts_is_deleted_defaults_to_zero() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO contacts (id, name, role) VALUES ('con-v19-1', 'Dr Test', 'gp')",
            [],
        )
        .unwrap();
        let is_deleted: i64 = conn
            .query_row(
                "SELECT is_deleted FROM contacts WHERE id = 'con-v19-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_deleted, 0);
        conn.execute(
            "UPDATE contacts SET is_deleted = 1, deleted_at = '2026-05-04T12:00:00Z' \
             WHERE id = 'con-v19-1'",
            [],
        )
        .unwrap();
        let (is_deleted, deleted_at): (i64, Option<String>) = conn
            .query_row(
                "SELECT is_deleted, deleted_at FROM contacts WHERE id = 'con-v19-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(is_deleted, 1);
        assert_eq!(deleted_at.as_deref(), Some("2026-05-04T12:00:00Z"));
    }

    #[test]
    fn v19_appointments_is_deleted_defaults_to_zero() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, status, created_at, updated_at) \
             VALUES ('appt-v19-1', 'ECG', '2026-01-01', 'scheduled', '2026-01-01', '2026-01-01')",
            [],
        )
        .unwrap();
        let is_deleted: i64 = conn
            .query_row(
                "SELECT is_deleted FROM appointments WHERE id = 'appt-v19-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_deleted, 0);
    }

    #[test]
    fn v19_notes_is_deleted_defaults_to_zero() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO users (id, display_name) VALUES ('u-v19', 'Test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at, user_id) \
             VALUES ('note-v19-1', 'Test Note', 'body', '2026-01-01T00:00:00', \
             '2026-01-01T00:00:00', 'u-v19')",
            [],
        )
        .unwrap();
        let is_deleted: i64 = conn
            .query_row(
                "SELECT is_deleted FROM notes WHERE id = 'note-v19-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_deleted, 0);
    }

    // ── v21: document_entities table ─────────────────────────────────────────

    #[test]
    fn v21_document_entities_table_exists() {
        let conn = migrated_conn();
        // Insert a document first
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at, is_deleted) \
             VALUES ('doc-v21-1','test.pdf','/tmp/test.pdf','application/pdf',1,'other', \
             '2026-01-01','2026-01-01',0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_entities (id, document_id, entity_type, name, raw_text, created_at) \
             VALUES ('ent-1', 'doc-v21-1', 'medication', 'Aspirin', '75mg Aspirin daily', '2026-01-01')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_entities WHERE document_id = 'doc-v21-1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn v21_document_entities_cascade_delete() {
        let conn = migrated_conn();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, \
             category, created_at, updated_at, is_deleted) \
             VALUES ('doc-v21-2','cascade.pdf','/tmp/cascade.pdf','application/pdf',1,'other', \
             '2026-01-01','2026-01-01',0)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO document_entities (id, document_id, entity_type, name, raw_text, created_at) \
             VALUES ('ent-2', 'doc-v21-2', 'diagnosis', 'Hypertension', 'essential hypertension', '2026-01-01')",
            [],
        )
        .unwrap();
        conn.execute("DELETE FROM documents WHERE id = 'doc-v21-2'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM document_entities WHERE id = 'ent-2'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            count, 0,
            "entities must cascade-delete when document deleted"
        );
    }
}
