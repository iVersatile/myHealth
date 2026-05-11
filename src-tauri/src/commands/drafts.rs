use tauri::State;

use super::{AppState, CommandContext, CommandError};

#[derive(Debug, serde::Serialize)]
pub struct DraftEntityRow {
    pub id: String,
    pub entity_type: String,
    pub name: String,
    pub created_at: String,
    // contact / clinic
    pub role: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub merge_candidate_id: Option<String>,
    // appointment
    pub appt_date: Option<String>,
    pub doctor_name: Option<String>,
    pub clinic_name: Option<String>,
    pub status: Option<String>,
    // symptom
    pub severity: Option<i64>,
    pub onset_date: Option<String>,
    // medication
    pub dosage: Option<String>,
    pub frequency: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[tauri::command]
pub fn get_draft_entities(
    entity_type: String,
    state: State<'_, AppState>,
) -> Result<Vec<DraftEntityRow>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let rows = match entity_type.as_str() {
        "contact" => {
            let mut stmt = conn.prepare(
                "SELECT id, name, role, specialty, phone, email, clinic, notes, merge_candidate_id, created_at
                 FROM contacts
                 WHERE is_draft = 1 AND is_deleted = 0
                 ORDER BY created_at DESC",
            )?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(DraftEntityRow {
                        id: r.get(0)?,
                        entity_type: "contact".into(),
                        name: r.get(1)?,
                        role: r.get(2)?,
                        specialty: r.get(3)?,
                        phone: r.get(4)?,
                        email: r.get(5)?,
                        clinic: r.get(6)?,
                        notes: r.get(7)?,
                        merge_candidate_id: r.get(8)?,
                        created_at: r.get(9)?,
                        address: None,
                        appt_date: None,
                        doctor_name: None,
                        clinic_name: None,
                        status: None,
                        severity: None,
                        onset_date: None,
                        dosage: None,
                        frequency: None,
                        start_date: None,
                        end_date: None,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        "clinic" => {
            let mut stmt = conn.prepare(
                "SELECT id, name, address, phone, email, specialty, notes, merge_candidate_id, created_at
                 FROM clinics
                 WHERE is_draft = 1 AND is_deleted = 0
                 ORDER BY created_at DESC",
            )?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(DraftEntityRow {
                        id: r.get(0)?,
                        entity_type: "clinic".into(),
                        name: r.get(1)?,
                        address: r.get(2)?,
                        phone: r.get(3)?,
                        email: r.get(4)?,
                        specialty: r.get(5)?,
                        notes: r.get(6)?,
                        merge_candidate_id: r.get(7)?,
                        created_at: r.get(8)?,
                        role: None,
                        clinic: None,
                        appt_date: None,
                        doctor_name: None,
                        clinic_name: None,
                        status: None,
                        severity: None,
                        onset_date: None,
                        dosage: None,
                        frequency: None,
                        start_date: None,
                        end_date: None,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        "appointment" => {
            let mut stmt = conn.prepare(
                "SELECT id, title, doctor_name, clinic_name, specialty, appt_date, status, notes, created_at
                 FROM appointments
                 WHERE is_draft = 1 AND is_deleted = 0
                 ORDER BY created_at DESC",
            )?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(DraftEntityRow {
                        id: r.get(0)?,
                        entity_type: "appointment".into(),
                        name: r.get(1)?,
                        doctor_name: r.get(2)?,
                        clinic_name: r.get(3)?,
                        specialty: r.get(4)?,
                        appt_date: r.get(5)?,
                        status: r.get(6)?,
                        notes: r.get(7)?,
                        created_at: r.get(8)?,
                        role: None,
                        phone: None,
                        email: None,
                        clinic: None,
                        address: None,
                        merge_candidate_id: None,
                        severity: None,
                        onset_date: None,
                        dosage: None,
                        frequency: None,
                        start_date: None,
                        end_date: None,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        "symptom" => {
            let mut stmt = conn.prepare(
                "SELECT id, name, severity, onset_date, notes, created_at
                 FROM symptoms
                 WHERE is_draft = 1 AND deleted_at IS NULL
                 ORDER BY created_at DESC",
            )?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(DraftEntityRow {
                        id: r.get(0)?,
                        entity_type: "symptom".into(),
                        name: r.get(1)?,
                        severity: r.get(2)?,
                        onset_date: r.get(3)?,
                        notes: r.get(4)?,
                        created_at: r.get(5)?,
                        role: None,
                        specialty: None,
                        phone: None,
                        email: None,
                        clinic: None,
                        address: None,
                        merge_candidate_id: None,
                        appt_date: None,
                        doctor_name: None,
                        clinic_name: None,
                        status: None,
                        dosage: None,
                        frequency: None,
                        start_date: None,
                        end_date: None,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        "medication" => {
            let mut stmt = conn.prepare(
                "SELECT id, name, dosage, frequency, start_date, end_date, notes, created_at
                 FROM medications
                 WHERE is_draft = 1 AND deleted_at IS NULL
                 ORDER BY created_at DESC",
            )?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(DraftEntityRow {
                        id: r.get(0)?,
                        entity_type: "medication".into(),
                        name: r.get(1)?,
                        dosage: r.get(2)?,
                        frequency: r.get(3)?,
                        start_date: r.get(4)?,
                        end_date: r.get(5)?,
                        notes: r.get(6)?,
                        created_at: r.get(7)?,
                        role: None,
                        specialty: None,
                        phone: None,
                        email: None,
                        clinic: None,
                        address: None,
                        merge_candidate_id: None,
                        appt_date: None,
                        doctor_name: None,
                        clinic_name: None,
                        status: None,
                        severity: None,
                        onset_date: None,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        }
        other => {
            return Err(CommandError::InvalidInput(format!(
                "unknown entity_type: {other}"
            )))
        }
    };

    Ok(rows)
}

#[tauri::command]
pub fn accept_draft_entity(
    entity_type: String,
    entity_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let updated = match entity_type.as_str() {
        "contact" => conn.execute(
            "UPDATE contacts SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
            [&entity_id],
        )?,
        "clinic" => conn.execute(
            "UPDATE clinics SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
            [&entity_id],
        )?,
        "appointment" => conn.execute(
            "UPDATE appointments SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
            [&entity_id],
        )?,
        "symptom" => conn.execute(
            "UPDATE symptoms SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
            [&entity_id],
        )?,
        "medication" => conn.execute(
            "UPDATE medications SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
            [&entity_id],
        )?,
        other => {
            return Err(CommandError::InvalidInput(format!(
                "unknown entity_type: {other}"
            )))
        }
    };

    if updated == 0 {
        return Err(CommandError::NotFound(format!(
            "draft {entity_type} {entity_id} not found"
        )));
    }

    Ok(())
}

#[tauri::command]
pub fn reject_draft_entity(
    entity_type: String,
    entity_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let now = chrono::Utc::now().to_rfc3339();

    let updated = match entity_type.as_str() {
        "contact" => conn.execute(
            "UPDATE contacts SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
            rusqlite::params![now, entity_id],
        )?,
        "clinic" => conn.execute(
            "UPDATE clinics SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
            rusqlite::params![now, entity_id],
        )?,
        "appointment" => conn.execute(
            "UPDATE appointments SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
            rusqlite::params![now, entity_id],
        )?,
        "symptom" => conn.execute(
            "UPDATE symptoms SET deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
            rusqlite::params![now, entity_id],
        )?,
        "medication" => conn.execute(
            "UPDATE medications SET deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
            rusqlite::params![now, entity_id],
        )?,
        other => {
            return Err(CommandError::InvalidInput(format!(
                "unknown entity_type: {other}"
            )))
        }
    };

    if updated == 0 {
        return Err(CommandError::NotFound(format!(
            "draft {entity_type} {entity_id} not found"
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE contacts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                role TEXT,
                specialty TEXT,
                phone TEXT,
                email TEXT,
                clinic TEXT,
                notes TEXT,
                merge_candidate_id TEXT,
                created_at TEXT NOT NULL DEFAULT '',
                is_draft INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                updated_at TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE symptoms (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                severity INTEGER,
                onset_date TEXT,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT '',
                is_draft INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT
            );",
        )
        .unwrap();
        conn
    }

    #[test]
    fn get_draft_contacts_returns_only_drafts() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO contacts (id, name, is_draft, is_deleted) VALUES
                ('d1', 'Draft Doc', 1, 0),
                ('r1', 'Real Doc', 0, 0);",
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id FROM contacts WHERE is_draft = 1 AND is_deleted = 0 \
                 ORDER BY created_at DESC",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "d1");
    }

    #[test]
    fn accept_draft_contact_clears_is_draft() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO contacts (id, name, is_draft, is_deleted) VALUES ('d1', 'Draft', 1, 0);",
        )
        .unwrap();

        let updated = conn
            .execute(
                "UPDATE contacts SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
                ["d1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_draft: i64 = conn
            .query_row("SELECT is_draft FROM contacts WHERE id = 'd1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(is_draft, 0);
    }

    #[test]
    fn accept_draft_returns_zero_for_missing_id() {
        let conn = open_test_db();
        let updated = conn
            .execute(
                "UPDATE contacts SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
                ["nonexistent"],
            )
            .unwrap();
        assert_eq!(updated, 0);
    }

    #[test]
    fn reject_draft_contact_soft_deletes() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO contacts (id, name, is_draft, is_deleted) VALUES ('d1', 'Draft', 1, 0);",
        )
        .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let updated = conn
            .execute(
                "UPDATE contacts SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
                rusqlite::params![now, "d1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_deleted: i64 = conn
            .query_row("SELECT is_deleted FROM contacts WHERE id = 'd1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(is_deleted, 1);
    }

    #[test]
    fn reject_draft_symptom_sets_deleted_at() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO symptoms (id, name, is_draft) VALUES ('s1', 'Headache', 1);",
        )
        .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let updated = conn
            .execute(
                "UPDATE symptoms SET deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
                rusqlite::params![now, "s1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let deleted_at: Option<String> = conn
            .query_row("SELECT deleted_at FROM symptoms WHERE id = 's1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert!(deleted_at.is_some());
    }
}
