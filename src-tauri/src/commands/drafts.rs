use rusqlite::OptionalExtension;
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
    pub existing_name: Option<String>,
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
                "SELECT c.id, c.name, c.role, c.specialty, c.phone, c.email, c.clinic, c.notes,
                        c.merge_candidate_id, c.created_at, c2.name AS existing_name
                 FROM contacts c
                 LEFT JOIN contacts c2 ON c.merge_candidate_id = c2.id AND c2.is_deleted = 0
                 WHERE c.is_draft = 1 AND c.is_deleted = 0
                 ORDER BY c.created_at DESC",
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
                        existing_name: r.get(10)?,
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
                "SELECT cl.id, cl.name, cl.address, cl.phone, cl.email,
                        cl.merge_candidate_id, cl.created_at, cl2.name AS existing_name
                 FROM clinics cl
                 LEFT JOIN clinics cl2 ON cl.merge_candidate_id = cl2.id AND cl2.is_deleted = 0
                 WHERE cl.is_draft = 1 AND cl.is_deleted = 0
                 ORDER BY cl.created_at DESC",
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
                        specialty: None,
                        notes: None,
                        merge_candidate_id: r.get(5)?,
                        created_at: r.get(6)?,
                        existing_name: r.get(7)?,
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
                        existing_name: None,
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
                        existing_name: None,
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
                        existing_name: None,
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
        "clinic" => {
            let clinic_name: Option<String> = conn
                .query_row(
                    "SELECT name FROM clinics WHERE id = ?1 AND is_draft = 1",
                    [&entity_id],
                    |row| row.get(0),
                )
                .optional()?;
            let rows = conn.execute(
                "UPDATE clinics SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
                [&entity_id],
            )?;
            if let Some(ref name) = clinic_name {
                let now_str = chrono::Utc::now().to_rfc3339();
                conn.execute(
                    "UPDATE appointments \
                     SET title = 'Appointment with ' || doctor_name || ' in ' || clinic_name, \
                         updated_at = ?1 \
                     WHERE clinic_name = ?2 AND is_deleted = 0",
                    rusqlite::params![now_str, name],
                )?;
            }
            rows
        }
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
        "clinic" => {
            let clinic_name: Option<String> = conn
                .query_row(
                    "SELECT name FROM clinics WHERE id = ?1 AND is_draft = 1",
                    [&entity_id],
                    |row| row.get(0),
                )
                .optional()?;
            let rows = conn.execute(
                "UPDATE clinics SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
                rusqlite::params![now, entity_id],
            )?;
            if let Some(ref name) = clinic_name {
                conn.execute(
                    "UPDATE appointments \
                     SET clinic_name = NULL, \
                         title = 'Appointment with ' || doctor_name, \
                         updated_at = ?1 \
                     WHERE clinic_name = ?2 AND is_deleted = 0",
                    rusqlite::params![now, name],
                )?;
            }
            rows
        }
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

#[allow(clippy::type_complexity)]
#[tauri::command]
pub fn merge_draft_entity(
    entity_type: String,
    draft_id: String,
    existing_id: String,
    field_choices: std::collections::HashMap<String, String>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let now = chrono::Utc::now().to_rfc3339();

    let pick =
        |field: &str, draft_val: Option<String>, existing_val: Option<String>| -> Option<String> {
            if field_choices.get(field).map(|s| s.as_str()) == Some("existing") {
                existing_val
            } else {
                draft_val
            }
        };

    match entity_type.as_str() {
        "contact" => {
            let (d_name, d_role, d_specialty, d_phone, d_email, d_clinic, d_notes): (
                String,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
            ) = conn.query_row(
                "SELECT name, role, specialty, phone, email, clinic, notes
                 FROM contacts WHERE id = ?1 AND is_draft = 1 AND is_deleted = 0",
                [&draft_id],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                        r.get(6)?,
                    ))
                },
            )?;
            let (e_name, e_role, e_specialty, e_phone, e_email, e_clinic, e_notes): (
                String,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
                Option<String>,
            ) = conn.query_row(
                "SELECT name, role, specialty, phone, email, clinic, notes
                 FROM contacts WHERE id = ?1 AND is_draft = 0 AND is_deleted = 0",
                [&existing_id],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                        r.get(6)?,
                    ))
                },
            )?;

            let name = pick("name", Some(d_name), Some(e_name)).unwrap_or_default();
            let role = pick("role", d_role, e_role);
            let specialty = pick("specialty", d_specialty, e_specialty);
            let phone = pick("phone", d_phone, e_phone);
            let email = pick("email", d_email, e_email);
            let clinic = pick("clinic", d_clinic, e_clinic);
            let notes = pick("notes", d_notes, e_notes);

            conn.execute(
                "UPDATE contacts SET name=?1, role=?2, specialty=?3, phone=?4, email=?5,
                 clinic=?6, notes=?7, updated_at=?8
                 WHERE id=?9 AND is_draft=0 AND is_deleted=0",
                rusqlite::params![
                    name,
                    role,
                    specialty,
                    phone,
                    email,
                    clinic,
                    notes,
                    now,
                    existing_id
                ],
            )?;
            let deleted = conn.execute(
                "UPDATE contacts SET is_deleted=1, deleted_at=?1 WHERE id=?2 AND is_draft=1",
                rusqlite::params![now, draft_id],
            )?;
            if deleted == 0 {
                return Err(CommandError::NotFound(format!(
                    "draft contact {draft_id} not found"
                )));
            }
        }
        "clinic" => {
            let (d_name, d_address, d_phone, d_email): (
                String,
                Option<String>,
                Option<String>,
                Option<String>,
            ) = conn.query_row(
                "SELECT name, address, phone, email FROM clinics WHERE id=?1 AND is_draft=1 AND is_deleted=0",
                [&draft_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )?;
            let (e_name, e_address, e_phone, e_email): (
                String,
                Option<String>,
                Option<String>,
                Option<String>,
            ) = conn.query_row(
                "SELECT name, address, phone, email FROM clinics WHERE id=?1 AND is_draft=0 AND is_deleted=0",
                [&existing_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )?;

            let name = pick("name", Some(d_name), Some(e_name)).unwrap_or_default();
            let address = pick("address", d_address, e_address);
            let phone = pick("phone", d_phone, e_phone);
            let email = pick("email", d_email, e_email);

            conn.execute(
                "UPDATE clinics SET name=?1, address=?2, phone=?3, email=?4
                 WHERE id=?5 AND is_draft=0 AND is_deleted=0",
                rusqlite::params![name, address, phone, email, existing_id],
            )?;
            let deleted = conn.execute(
                "UPDATE clinics SET is_deleted=1, deleted_at=?1 WHERE id=?2 AND is_draft=1",
                rusqlite::params![now, draft_id],
            )?;
            if deleted == 0 {
                return Err(CommandError::NotFound(format!(
                    "draft clinic {draft_id} not found"
                )));
            }
        }
        other => {
            return Err(CommandError::InvalidInput(format!(
                "merge not supported for entity_type: {other}"
            )))
        }
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
            );
            CREATE TABLE clinics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                address TEXT,
                phone TEXT,
                email TEXT,
                merge_candidate_id TEXT,
                created_at TEXT NOT NULL DEFAULT '',
                is_draft INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT
            );
            CREATE TABLE appointments (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL DEFAULT '',
                doctor_name TEXT,
                clinic_name TEXT,
                specialty TEXT,
                appt_date TEXT,
                status TEXT,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT '',
                is_draft INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT
            );
            CREATE TABLE medications (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                dosage TEXT,
                frequency TEXT,
                start_date TEXT,
                end_date TEXT,
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

    #[test]
    fn merge_draft_contact_applies_chosen_fields_and_soft_deletes_draft() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO contacts (id, name, role, specialty, phone, email, clinic, notes, is_draft, is_deleted)
             VALUES
               ('d1', 'Dr. Draft', 'GP', 'Cardiology', '111', 'draft@x.com', 'DraftClinic', 'dnote', 1, 0),
               ('e1', 'Dr. Exist', 'Surgeon', 'Neurology', '222', 'exist@x.com', 'ExistClinic', 'enote', 0, 0);",
        )
        .unwrap();

        // name=draft, role=existing, specialty=draft, rest=draft
        let mut choices = std::collections::HashMap::new();
        choices.insert("role".to_string(), "existing".to_string());

        let pick = |field: &str,
                    draft_val: Option<String>,
                    existing_val: Option<String>|
         -> Option<String> {
            if choices.get(field).map(|s| s.as_str()) == Some("existing") {
                existing_val
            } else {
                draft_val
            }
        };

        type ContactRow = (
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
        );
        let (d_name, d_role, d_specialty, d_phone, d_email, d_clinic, d_notes): ContactRow = conn.query_row(
            "SELECT name, role, specialty, phone, email, clinic, notes FROM contacts WHERE id='d1'",
            [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?)),
        ).unwrap();
        let (e_name, e_role, e_specialty, e_phone, e_email, e_clinic, e_notes): ContactRow =
            conn.query_row(
                "SELECT name, role, specialty, phone, email, clinic, notes FROM contacts WHERE id='e1'",
                [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?)),
            ).unwrap();

        let name = pick("name", Some(d_name), Some(e_name)).unwrap_or_default();
        let role = pick("role", d_role, e_role);
        let specialty = pick("specialty", d_specialty, e_specialty);
        let phone = pick("phone", d_phone, e_phone);
        let email = pick("email", d_email, e_email);
        let clinic = pick("clinic", d_clinic, e_clinic);
        let notes = pick("notes", d_notes, e_notes);
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE contacts SET name=?1, role=?2, specialty=?3, phone=?4, email=?5,
             clinic=?6, notes=?7, updated_at=?8 WHERE id='e1' AND is_draft=0 AND is_deleted=0",
            rusqlite::params![name, role, specialty, phone, email, clinic, notes, now],
        )
        .unwrap();
        conn.execute(
            "UPDATE contacts SET is_deleted=1, deleted_at=?1 WHERE id='d1' AND is_draft=1",
            rusqlite::params![now],
        )
        .unwrap();

        // existing entity: name from draft, role from existing
        let (merged_name, merged_role): (String, String) = conn
            .query_row("SELECT name, role FROM contacts WHERE id='e1'", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(merged_name, "Dr. Draft");
        assert_eq!(merged_role, "Surgeon");

        // draft is soft-deleted
        let is_deleted: i64 = conn
            .query_row("SELECT is_deleted FROM contacts WHERE id='d1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(is_deleted, 1);
    }

    // ── get_draft_entities — clinic / appointment / medication branches ──────

    #[test]
    fn get_draft_clinics_returns_only_drafts() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO clinics (id, name, is_draft, is_deleted) VALUES
                ('c1', 'Draft Clinic', 1, 0),
                ('c2', 'Real Clinic',  0, 0);",
        )
        .unwrap();

        // Use the exact production query from get_draft_entities so column mismatches
        // are caught here rather than at runtime.
        let mut stmt = conn
            .prepare(
                "SELECT cl.id, cl.name, cl.address, cl.phone, cl.email,
                        cl.merge_candidate_id, cl.created_at, cl2.name AS existing_name
                 FROM clinics cl
                 LEFT JOIN clinics cl2 ON cl.merge_candidate_id = cl2.id AND cl2.is_deleted = 0
                 WHERE cl.is_draft = 1 AND cl.is_deleted = 0
                 ORDER BY cl.created_at DESC",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "c1");
    }

    #[test]
    fn get_draft_clinics_existing_name_populated_when_merge_candidate_set() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO clinics (id, name, is_draft, is_deleted) VALUES
                ('live1', 'Live Clinic', 0, 0),
                ('draft1', 'Draft Clinic', 1, 0);
             UPDATE clinics SET merge_candidate_id = 'live1' WHERE id = 'draft1';",
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT cl.id, cl2.name AS existing_name
                 FROM clinics cl
                 LEFT JOIN clinics cl2 ON cl.merge_candidate_id = cl2.id AND cl2.is_deleted = 0
                 WHERE cl.id = 'draft1'",
            )
            .unwrap();
        let result: (String, Option<String>) =
            stmt.query_row([], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();

        assert_eq!(result.0, "draft1");
        assert_eq!(result.1, Some("Live Clinic".to_string()));
    }

    #[test]
    fn get_draft_clinics_existing_name_null_when_no_merge_candidate() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO clinics (id, name, is_draft, is_deleted) VALUES
                ('draft2', 'Another Draft', 1, 0);",
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT cl.id, cl2.name AS existing_name
                 FROM clinics cl
                 LEFT JOIN clinics cl2 ON cl.merge_candidate_id = cl2.id AND cl2.is_deleted = 0
                 WHERE cl.id = 'draft2'",
            )
            .unwrap();
        let result: (String, Option<String>) =
            stmt.query_row([], |r| Ok((r.get(0)?, r.get(1)?))).unwrap();

        assert_eq!(result.0, "draft2");
        assert!(result.1.is_none());
    }

    #[test]
    fn get_draft_appointments_returns_only_drafts() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO appointments (id, title, is_draft, is_deleted) VALUES
                ('a1', 'Draft Appt', 1, 0),
                ('a2', 'Real Appt',  0, 0);",
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id FROM appointments WHERE is_draft = 1 AND is_deleted = 0 \
                 ORDER BY created_at DESC",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "a1");
    }

    #[test]
    fn get_draft_medications_returns_only_drafts() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO medications (id, name, is_draft) VALUES
                ('m1', 'Draft Med', 1),
                ('m2', 'Real Med',  0);",
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT id FROM medications WHERE is_draft = 1 AND deleted_at IS NULL \
                 ORDER BY created_at DESC",
            )
            .unwrap();
        let ids: Vec<String> = stmt
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(ids.len(), 1);
        assert_eq!(ids[0], "m1");
    }

    // ── accept_draft_entity — clinic / appointment / symptom / medication ────

    #[test]
    fn accept_draft_clinic_clears_is_draft() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO clinics (id, name, is_draft, is_deleted) VALUES ('c1', 'Draft', 1, 0);",
        )
        .unwrap();

        let updated = conn
            .execute(
                "UPDATE clinics SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
                ["c1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_draft: i64 = conn
            .query_row("SELECT is_draft FROM clinics WHERE id = 'c1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(is_draft, 0);
    }

    #[test]
    fn accept_draft_appointment_clears_is_draft() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO appointments (id, title, is_draft, is_deleted) VALUES ('a1', 'Appt', 1, 0);",
        )
        .unwrap();

        let updated = conn
            .execute(
                "UPDATE appointments SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
                ["a1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_draft: i64 = conn
            .query_row(
                "SELECT is_draft FROM appointments WHERE id = 'a1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_draft, 0);
    }

    #[test]
    fn accept_draft_symptom_clears_is_draft() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO symptoms (id, name, is_draft) VALUES ('s1', 'Headache', 1);",
        )
        .unwrap();

        let updated = conn
            .execute(
                "UPDATE symptoms SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
                ["s1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_draft: i64 = conn
            .query_row("SELECT is_draft FROM symptoms WHERE id = 's1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(is_draft, 0);
    }

    #[test]
    fn accept_draft_medication_clears_is_draft() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO medications (id, name, is_draft) VALUES ('m1', 'Aspirin', 1);",
        )
        .unwrap();

        let updated = conn
            .execute(
                "UPDATE medications SET is_draft = 0 WHERE id = ?1 AND is_draft = 1",
                ["m1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_draft: i64 = conn
            .query_row(
                "SELECT is_draft FROM medications WHERE id = 'm1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_draft, 0);
    }

    // ── reject_draft_entity — clinic / appointment / medication branches ─────

    #[test]
    fn reject_draft_clinic_soft_deletes() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO clinics (id, name, is_draft, is_deleted) VALUES ('c1', 'Draft', 1, 0);",
        )
        .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let updated = conn
            .execute(
                "UPDATE clinics SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
                rusqlite::params![now, "c1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_deleted: i64 = conn
            .query_row("SELECT is_deleted FROM clinics WHERE id = 'c1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(is_deleted, 1);
    }

    #[test]
    fn reject_draft_appointment_soft_deletes() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO appointments (id, title, is_draft, is_deleted) VALUES ('a1', 'Appt', 1, 0);",
        )
        .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let updated = conn
            .execute(
                "UPDATE appointments SET is_deleted = 1, deleted_at = ?1 \
                 WHERE id = ?2 AND is_draft = 1",
                rusqlite::params![now, "a1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let is_deleted: i64 = conn
            .query_row(
                "SELECT is_deleted FROM appointments WHERE id = 'a1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(is_deleted, 1);
    }

    #[test]
    fn reject_draft_medication_sets_deleted_at() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO medications (id, name, is_draft) VALUES ('m1', 'Aspirin', 1);",
        )
        .unwrap();

        let now = chrono::Utc::now().to_rfc3339();
        let updated = conn
            .execute(
                "UPDATE medications SET deleted_at = ?1 WHERE id = ?2 AND is_draft = 1",
                rusqlite::params![now, "m1"],
            )
            .unwrap();
        assert_eq!(updated, 1);

        let deleted_at: Option<String> = conn
            .query_row(
                "SELECT deleted_at FROM medications WHERE id = 'm1'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(deleted_at.is_some());
    }

    // ── merge_draft_entity — clinic branch + field-choice logic ─────────────

    #[test]
    fn merge_draft_clinic_applies_chosen_fields_and_soft_deletes_draft() {
        let conn = open_test_db();
        conn.execute_batch(
            "INSERT INTO clinics (id, name, address, phone, email, is_draft, is_deleted) VALUES
               ('d1', 'Draft Clinic', '1 Draft St', '111', 'draft@x.com', 1, 0),
               ('e1', 'Real Clinic',  '2 Real Ave',  '222', 'real@x.com',  0, 0);",
        )
        .unwrap();

        // address chosen from existing; everything else defaults to draft
        let mut choices = std::collections::HashMap::new();
        choices.insert("address".to_string(), "existing".to_string());

        let pick = |field: &str,
                    draft_val: Option<String>,
                    existing_val: Option<String>|
         -> Option<String> {
            if choices.get(field).map(|s| s.as_str()) == Some("existing") {
                existing_val
            } else {
                draft_val
            }
        };

        let (d_name, d_address, d_phone, d_email): (String, Option<String>, Option<String>, Option<String>) =
            conn.query_row(
                "SELECT name, address, phone, email FROM clinics WHERE id='d1' AND is_draft=1 AND is_deleted=0",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();
        let (e_name, e_address, e_phone, e_email): (String, Option<String>, Option<String>, Option<String>) =
            conn.query_row(
                "SELECT name, address, phone, email FROM clinics WHERE id='e1' AND is_draft=0 AND is_deleted=0",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap();

        let name = pick("name", Some(d_name), Some(e_name)).unwrap_or_default();
        let address = pick("address", d_address, e_address);
        let phone = pick("phone", d_phone, e_phone);
        let email = pick("email", d_email, e_email);
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE clinics SET name=?1, address=?2, phone=?3, email=?4
             WHERE id='e1' AND is_draft=0 AND is_deleted=0",
            rusqlite::params![name, address, phone, email],
        )
        .unwrap();
        let deleted = conn
            .execute(
                "UPDATE clinics SET is_deleted=1, deleted_at=?1 WHERE id='d1' AND is_draft=1",
                rusqlite::params![now],
            )
            .unwrap();
        assert_eq!(deleted, 1);

        // name from draft, address from existing
        let (merged_name, merged_address): (String, Option<String>) = conn
            .query_row("SELECT name, address FROM clinics WHERE id='e1'", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(merged_name, "Draft Clinic");
        assert_eq!(merged_address.as_deref(), Some("2 Real Ave"));

        // draft soft-deleted
        let is_deleted: i64 = conn
            .query_row("SELECT is_deleted FROM clinics WHERE id='d1'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(is_deleted, 1);
    }

    #[test]
    fn merge_draft_clinic_not_found_returns_zero_deleted() {
        let conn = open_test_db();
        // no rows inserted — soft-delete on nonexistent draft returns 0
        let deleted = conn
            .execute(
                "UPDATE clinics SET is_deleted=1, deleted_at='now' WHERE id='x' AND is_draft=1",
                [],
            )
            .unwrap();
        assert_eq!(deleted, 0);
    }
}
