use super::helpers::TempDb;
use rusqlite::params;

// ── contacts ────────────────────────────────────────────────────────────────

#[test]
fn accept_draft_contact_sets_is_draft_zero() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO contacts (id, name, role, is_draft) VALUES ('c1', 'Dr Draft', 'gp', 1)",
            [],
        )
        .unwrap();

    db.conn
        .execute(
            "UPDATE contacts SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
            params!["c1"],
        )
        .unwrap();

    let is_draft: i64 = db
        .conn
        .query_row(
            "SELECT is_draft FROM contacts WHERE id = 'c1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(is_draft, 0, "accepted draft contact must have is_draft = 0");
}

#[test]
fn reject_draft_contact_soft_deletes_via_integration_db() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO contacts (id, name, role, is_draft) VALUES ('c2', 'Dr Reject', 'gp', 1)",
            [],
        )
        .unwrap();

    let now = chrono::Utc::now().to_rfc3339();
    db.conn
        .execute(
            "UPDATE contacts SET is_deleted = 1, deleted_at = ?1 \
             WHERE id = ?2 AND is_draft = 1",
            params![now, "c2"],
        )
        .unwrap();

    let (is_deleted, deleted_at): (i64, Option<String>) = db
        .conn
        .query_row(
            "SELECT is_deleted, deleted_at FROM contacts WHERE id = 'c2'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(is_deleted, 1, "rejected draft contact must be soft-deleted");
    assert!(deleted_at.is_some(), "deleted_at must be populated on reject");
}

#[test]
fn rejected_draft_contact_excluded_from_active_list() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO contacts (id, name, role, is_draft, is_deleted) \
             VALUES ('c3', 'Active', 'gp', 0, 0)",
            [],
        )
        .unwrap();
    db.conn
        .execute(
            "INSERT INTO contacts (id, name, role, is_draft, is_deleted) \
             VALUES ('c4', 'Rejected', 'gp', 1, 1)",
            [],
        )
        .unwrap();

    let count: i64 = db
        .conn
        .query_row(
            "SELECT COUNT(*) FROM contacts WHERE is_deleted = 0 AND is_draft = 0",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1, "only the active non-draft contact must appear in active list");
}

// ── appointments ─────────────────────────────────────────────────────────────

#[test]
fn accept_draft_appointment_sets_is_draft_zero() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO appointments (id, title, appt_date, is_draft) \
             VALUES ('a1', 'Draft Appt', '2024-01-01T09:00:00Z', 1)",
            [],
        )
        .unwrap();

    db.conn
        .execute(
            "UPDATE appointments SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
            params!["a1"],
        )
        .unwrap();

    let is_draft: i64 = db
        .conn
        .query_row(
            "SELECT is_draft FROM appointments WHERE id = 'a1'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(is_draft, 0, "accepted draft appointment must have is_draft = 0");
}

#[test]
fn reject_draft_appointment_soft_deletes_via_integration_db() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO appointments (id, title, appt_date, is_draft) \
             VALUES ('a2', 'Reject Appt', '2024-01-02T09:00:00Z', 1)",
            [],
        )
        .unwrap();

    let now = chrono::Utc::now().to_rfc3339();
    db.conn
        .execute(
            "UPDATE appointments SET is_deleted = 1, deleted_at = ?1 \
             WHERE id = ?2 AND is_draft = 1",
            params![now, "a2"],
        )
        .unwrap();

    let (is_deleted, deleted_at): (i64, Option<String>) = db
        .conn
        .query_row(
            "SELECT is_deleted, deleted_at FROM appointments WHERE id = 'a2'",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .unwrap();
    assert_eq!(is_deleted, 1, "rejected draft appointment must be soft-deleted");
    assert!(deleted_at.is_some(), "deleted_at must be populated on reject");
}

// ── clinic_addresses (Bug A regression) ──────────────────────────────────────

#[test]
fn clinic_address_insert_explicit_null_on_not_null_column_fails() {
    let db = TempDb::new();
    db.conn
        .execute(
            "INSERT INTO clinics (id, name) VALUES ('cl1', 'Bug Clinic')",
            [],
        )
        .unwrap();

    // Explicit NULL on a NOT NULL column (country) must fail — this was Bug A root cause.
    let result = db.conn.execute(
        "INSERT INTO clinic_addresses (id, clinic_id, label, line1, city, state, country, \
         postal_code, phone) VALUES (?1, ?2, ?3, ?4, NULL, NULL, NULL, NULL, NULL)",
        params!["addr-bad", "cl1", "main", "1 Bad St"],
    );
    assert!(
        result.is_err(),
        "INSERT with explicit NULL on NOT NULL column 'country' must fail"
    );
}
