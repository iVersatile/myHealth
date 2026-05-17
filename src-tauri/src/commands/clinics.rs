use chrono::Utc;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::commands::{AppState, CommandContext};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Clinic {
    pub id: String,
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub created_at: String,
    pub company_registration_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClinicAddressInput {
    pub label: Option<String>,
    pub line1: String,
}

#[derive(Debug, Deserialize)]
pub struct ClinicCreateInput {
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub company_registration_number: Option<String>,
    #[serde(default)]
    pub addresses: Vec<ClinicAddressInput>,
}

#[derive(Debug, Deserialize)]
pub struct ClinicUpdateInput {
    pub id: String,
    pub name: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub company_registration_number: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct LinkedDocument {
    pub id: String,
    pub filename: String,
    pub category: String,
    pub document_date: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Clone)]
#[allow(dead_code)]
pub struct LinkedContact {
    pub id: String,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Serialize, Clone)]
#[allow(dead_code)]
pub struct ClinicWithContacts {
    pub id: String,
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub created_at: String,
    pub company_registration_number: Option<String>,
    pub linked_contacts: Vec<LinkedContact>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ClinicForPicker {
    pub id: String,
    pub name: String,
    pub is_draft: bool,
}

const SELECT_CLINIC: &str =
    "SELECT id, name, address, phone, email, created_at, company_registration_number FROM clinics";

fn row_to_clinic(row: &rusqlite::Row) -> rusqlite::Result<Clinic> {
    Ok(Clinic {
        id: row.get(0)?,
        name: row.get(1)?,
        address: row.get(2)?,
        phone: row.get(3)?,
        email: row.get(4)?,
        created_at: row.get(5)?,
        company_registration_number: row.get(6)?,
    })
}

#[tauri::command]
pub fn clinics_list(state: State<'_, AppState>) -> Result<Vec<Clinic>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(&format!(
        "{SELECT_CLINIC} WHERE is_deleted = 0 AND is_draft = 0 ORDER BY name ASC"
    ))?;
    let rows = stmt.query_map([], row_to_clinic)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_list_including_drafts(
    state: State<'_, AppState>,
) -> Result<Vec<ClinicForPicker>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT id, name, is_draft FROM clinics \
         WHERE is_deleted = 0 ORDER BY is_draft ASC, name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ClinicForPicker {
            id: row.get(0)?,
            name: row.get(1)?,
            is_draft: row.get::<_, i64>(2)? != 0,
        })
    })?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_get(id: String, state: State<'_, AppState>) -> Result<Clinic, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.query_row(
        &format!("{SELECT_CLINIC} WHERE id = ? AND is_deleted = 0"),
        [&id],
        row_to_clinic,
    )
    .map_err(|e| {
        if e == rusqlite::Error::QueryReturnedNoRows {
            CommandError::NotFound(format!("clinic '{id}'"))
        } else {
            CommandError::Internal(e.to_string())
        }
    })
}

#[tauri::command]
pub fn clinics_create(
    input: ClinicCreateInput,
    state: State<'_, AppState>,
) -> Result<Clinic, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO clinics \
         (id, name, address, phone, created_at, company_registration_number) \
         VALUES (?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            id,
            input.name,
            input.address,
            input.phone,
            now,
            input.company_registration_number
        ],
    )?;

    for addr in &input.addresses {
        let addr_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinic_addresses (id, clinic_id, label, line1, is_primary, created_at) \
             VALUES (?, ?, ?, ?, 0, ?)",
            rusqlite::params![addr_id, id, addr.label, addr.line1, now],
        )?;
    }

    conn.query_row(
        &format!("{SELECT_CLINIC} WHERE id = ?"),
        [&id],
        row_to_clinic,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_update(
    input: ClinicUpdateInput,
    state: State<'_, AppState>,
) -> Result<Clinic, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let old_name: Option<String> = conn
        .query_row("SELECT name FROM clinics WHERE id = ?", [&input.id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if let Some(ref name) = input.name {
        tx.execute(
            "UPDATE clinics SET name = ? WHERE id = ?",
            rusqlite::params![name, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(ref address) = input.address {
        tx.execute(
            "UPDATE clinics SET address = ? WHERE id = ?",
            rusqlite::params![address, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(ref phone) = input.phone {
        tx.execute(
            "UPDATE clinics SET phone = ? WHERE id = ?",
            rusqlite::params![phone, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(ref crn) = input.company_registration_number {
        tx.execute(
            "UPDATE clinics SET company_registration_number = ? WHERE id = ?",
            rusqlite::params![crn, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }

    if let (Some(old), Some(ref new)) = (old_name, &input.name) {
        if old != *new {
            tx.execute(
                "UPDATE documents SET clinic_name = ? WHERE clinic_name = ?",
                rusqlite::params![new, old],
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;
            tx.execute(
                "UPDATE appointments SET clinic_name = ? WHERE clinic_name = ?",
                rusqlite::params![new, old],
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        }
    }

    tx.commit()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    conn.query_row(
        &format!("{SELECT_CLINIC} WHERE id = ?"),
        [&input.id],
        row_to_clinic,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_get_linked_contacts(
    clinic_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<crate::commands::contacts::Contact>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.role, c.specialty, c.phone, c.email, c.clinic, c.address, \
                c.notes, c.created_at, c.updated_at, c.title, c.contact_clinic_id \
         FROM contacts c \
         INNER JOIN clinic_contacts cc ON cc.contact_id = c.id \
         WHERE cc.clinic_id = ? AND c.is_deleted = 0 \
         ORDER BY c.name COLLATE NOCASE",
    )?;

    let rows = stmt.query_map([&clinic_id], |row| {
        Ok(crate::commands::contacts::Contact {
            id: row.get(0)?,
            name: row.get(1)?,
            role: row.get(2)?,
            specialty: row.get(3)?,
            phone: row.get(4)?,
            email: row.get(5)?,
            clinic: row.get(6)?,
            address: row.get(7)?,
            notes: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
            title: row.get(11)?,
            contact_clinic_id: row.get(12)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_get_linked_documents(
    clinic_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<LinkedDocument>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(
        "SELECT d.id, d.filename, d.category, d.document_date, d.created_at \
         FROM documents d \
         WHERE d.is_deleted = 0 \
           AND d.clinic_name = (SELECT name FROM clinics WHERE id = ?) \
         ORDER BY d.document_date DESC, d.created_at DESC",
    )?;

    let rows = stmt.query_map([&clinic_id], |row| {
        Ok(LinkedDocument {
            id: row.get(0)?,
            filename: row.get(1)?,
            category: row.get(2)?,
            document_date: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let name: Option<String> = conn
        .query_row("SELECT name FROM clinics WHERE id = ?1", [&id], |r| {
            r.get(0)
        })
        .optional()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    let clinic_name = match name {
        Some(n) => n,
        None => return Ok(()),
    };

    let contact_ids: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT contact_id FROM clinic_contacts WHERE clinic_id = ?1")
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        let ids = stmt
            .query_map([&id], |r| r.get(0))
            .map_err(|e| CommandError::Internal(e.to_string()))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        ids
    };

    let date = Utc::now().format("%Y-%m-%d").to_string();
    let note_suffix = format!("Previously at {} \u{2014} removed {}", clinic_name, date);

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    for cid in &contact_ids {
        tx.execute(
            "UPDATE contacts SET notes = TRIM(COALESCE(notes, '') || char(10) || ?1) WHERE id = ?2",
            rusqlite::params![note_suffix, cid],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }

    let now = Utc::now().to_rfc3339();
    tx.execute(
        "UPDATE clinics SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| CommandError::Internal(e.to_string()))?;

    tx.commit()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub fn clinics_hard_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.execute("DELETE FROM clinics WHERE id = ?1", [&id])
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    Ok(())
}

/// Returns existing clinic if one with the same name already exists; otherwise creates a new one.
#[tauri::command]
pub fn clinics_create_if_not_exists(
    input: ClinicCreateInput,
    state: State<'_, AppState>,
) -> Result<Clinic, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let existing: Option<Clinic> = conn
        .query_row(
            &format!("{SELECT_CLINIC} WHERE name = ? COLLATE NOCASE LIMIT 1"),
            [&input.name],
            row_to_clinic,
        )
        .optional()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if let Some(clinic) = existing {
        return Ok(clinic);
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO clinics \
         (id, name, address, phone, created_at, company_registration_number) \
         VALUES (?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            id,
            input.name,
            input.address,
            input.phone,
            now,
            input.company_registration_number
        ],
    )?;

    for addr in &input.addresses {
        let addr_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinic_addresses (id, clinic_id, label, line1, is_primary, created_at) \
             VALUES (?, ?, ?, ?, 0, ?)",
            rusqlite::params![addr_id, id, addr.label, addr.line1, now],
        )?;
    }

    conn.query_row(
        &format!("{SELECT_CLINIC} WHERE id = ?"),
        [&id],
        row_to_clinic,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

/// Links a contact to a clinic via the junction table. Idempotent (INSERT OR IGNORE).
#[tauri::command]
pub fn clinics_link_contact(
    clinic_id: String,
    contact_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute(
        "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) VALUES (?, ?)",
        rusqlite::params![clinic_id, contact_id],
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
    .map(|_| ())
}

#[tauri::command]
#[allow(dead_code)]
fn clinics_list_with_contacts_conn(
    conn: &rusqlite::Connection,
) -> Result<Vec<ClinicWithContacts>, CommandError> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.name, c.address, c.phone, c.created_at, c.company_registration_number,
                co.id AS contact_id, co.name AS contact_name, co.role AS contact_role
         FROM clinics c
         LEFT JOIN clinic_contacts cc ON cc.clinic_id = c.id
         LEFT JOIN contacts co ON co.id = cc.contact_id AND co.is_deleted = 0
         WHERE c.is_deleted = 0 AND c.is_draft = 0
         ORDER BY c.name COLLATE NOCASE, co.name COLLATE NOCASE",
    )?;

    let mut result: Vec<ClinicWithContacts> = Vec::new();
    let mut rows = stmt.query([])?;

    while let Some(row) = rows.next()? {
        let clinic_id: String = row.get(0)?;
        let contact_id: Option<String> = row.get(6)?;

        if result.last().map(|c: &ClinicWithContacts| c.id.as_str()) != Some(clinic_id.as_str()) {
            result.push(ClinicWithContacts {
                id: clinic_id,
                name: row.get(1)?,
                address: row.get(2)?,
                phone: row.get(3)?,
                created_at: row.get(4)?,
                company_registration_number: row.get(5)?,
                linked_contacts: Vec::new(),
            });
        }

        if let Some(cid) = contact_id {
            let last = result.last_mut().unwrap();
            last.linked_contacts.push(LinkedContact {
                id: cid,
                name: row.get(7)?,
                role: row.get(8)?,
            });
        }
    }

    Ok(result)
}

#[tauri::command]
pub fn clinics_list_with_contacts(
    state: State<'_, AppState>,
) -> Result<Vec<ClinicWithContacts>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    clinics_list_with_contacts_conn(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use rusqlite::OptionalExtension;

    fn open_test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn create_and_get_clinic() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, address, phone, created_at) \
             VALUES (?, 'City Hospital', '1 Main St', '555-1234', ?)",
            rusqlite::params![id, now],
        )
        .unwrap();

        let c = conn
            .query_row(
                &format!("{SELECT_CLINIC} WHERE id = ?"),
                [&id],
                row_to_clinic,
            )
            .unwrap();

        assert_eq!(c.name, "City Hospital");
        assert_eq!(c.address.as_deref(), Some("1 Main St"));
        assert_eq!(c.phone.as_deref(), Some("555-1234"));
    }

    #[test]
    fn list_clinics_ordered_by_name() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();
        for name in ["Zeta Clinic", "Alpha Clinic", "Beta Clinic"] {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO clinics (id, name, created_at) VALUES (?, ?, ?)",
                rusqlite::params![id, name, now],
            )
            .unwrap();
        }

        let mut stmt = conn
            .prepare(&format!("{SELECT_CLINIC} ORDER BY name ASC"))
            .unwrap();
        let clinics: Vec<Clinic> = stmt
            .query_map([], row_to_clinic)
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(clinics.len(), 3);
        assert_eq!(clinics[0].name, "Alpha Clinic");
        assert_eq!(clinics[2].name, "Zeta Clinic");
    }

    #[test]
    fn update_clinic_name() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Old Name', ?)",
            rusqlite::params![id, now],
        )
        .unwrap();

        conn.execute(
            "UPDATE clinics SET name = ? WHERE id = ?",
            rusqlite::params!["New Name", id],
        )
        .unwrap();

        let updated: String = conn
            .query_row("SELECT name FROM clinics WHERE id = ?", [&id], |r| r.get(0))
            .unwrap();

        assert_eq!(updated, "New Name");
    }

    #[test]
    fn delete_clinic() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'To Delete', ?)",
            rusqlite::params![id, now],
        )
        .unwrap();

        conn.execute("DELETE FROM clinics WHERE id = ?", [&id])
            .unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM clinics WHERE id = ?", [&id], |r| {
                r.get(0)
            })
            .unwrap();

        assert_eq!(count, 0);
    }

    #[test]
    fn soft_delete_sets_is_deleted_flag() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Soft Delete Test', ?)",
            rusqlite::params![id, now],
        )
        .unwrap();

        let deleted_at = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE clinics SET is_deleted = 1, deleted_at = ?1 WHERE id = ?2",
            rusqlite::params![deleted_at, id],
        )
        .unwrap();

        let (is_deleted, dt): (i64, Option<String>) = conn
            .query_row(
                "SELECT is_deleted, deleted_at FROM clinics WHERE id = ?",
                [&id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(is_deleted, 1);
        assert!(dt.is_some());
    }

    #[test]
    fn create_clinic_minimal_fields() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Minimal Clinic', ?)",
            rusqlite::params![id, now],
        )
        .unwrap();

        let c = conn
            .query_row(
                &format!("{SELECT_CLINIC} WHERE id = ?"),
                [&id],
                row_to_clinic,
            )
            .unwrap();

        assert_eq!(c.name, "Minimal Clinic");
        assert!(c.address.is_none());
        assert!(c.phone.is_none());
    }

    #[test]
    fn contact_clinic_id_foreign_key() {
        let conn = open_test_db();
        let clinic_id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'FK Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        let contact_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contacts (id, name, role, clinic_id, created_at, updated_at) \
             VALUES (?, 'Dr FK', 'gp', ?, ?, ?)",
            rusqlite::params![contact_id, clinic_id, now, now],
        )
        .unwrap();

        let linked: String = conn
            .query_row(
                "SELECT clinic_id FROM contacts WHERE id = ?",
                [&contact_id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(linked, clinic_id);
    }

    // --- Task 10.5 criteria (c), (d), (e) ---

    #[test]
    fn create_if_not_exists_returns_existing_on_duplicate_name() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'City Medical', ?)",
            rusqlite::params![id, now],
        )
        .unwrap();

        // A second lookup by name must return the existing row's id
        let found: Option<String> = conn
            .query_row(
                &format!("{SELECT_CLINIC} WHERE name = ? COLLATE NOCASE LIMIT 1"),
                ["City Medical"],
                |r| r.get(0),
            )
            .optional()
            .unwrap();

        assert_eq!(found.as_deref(), Some(id.as_str()));

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinics WHERE name = 'City Medical'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "must not create a duplicate row");
    }

    #[test]
    fn clinic_addresses_primary_row_created() {
        // V3-F3: creating a clinic with an address must persist a clinic_addresses row
        // with is_primary = 1.
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();
        let clinic_id = Uuid::new_v4().to_string();
        let addr_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'City Physio', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO clinic_addresses (id, clinic_id, line1, is_primary) VALUES (?, ?, ?, 1)",
            rusqlite::params![addr_id, clinic_id, "10 High St"],
        )
        .unwrap();

        let (line1, is_primary): (String, i64) = conn
            .query_row(
                "SELECT line1, is_primary FROM clinic_addresses WHERE clinic_id = ?",
                [&clinic_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(line1, "10 High St");
        assert_eq!(is_primary, 1);
    }

    #[test]
    fn clinic_addresses_second_address_not_primary() {
        // V3-F3: additional addresses must be stored with is_primary = 0
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();
        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Multi Physio', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO clinic_addresses (id, clinic_id, line1, is_primary) VALUES (?, ?, ?, 1)",
            rusqlite::params![Uuid::new_v4().to_string(), clinic_id, "10 High St"],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO clinic_addresses (id, clinic_id, line1, is_primary) VALUES (?, ?, ?, 0)",
            rusqlite::params![Uuid::new_v4().to_string(), clinic_id, "20 Low St"],
        )
        .unwrap();

        let primary_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_addresses WHERE clinic_id = ? AND is_primary = 1",
                [&clinic_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(primary_count, 1, "only one primary address allowed");

        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_addresses WHERE clinic_id = ?",
                [&clinic_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(total, 2);
    }

    #[test]
    fn link_contact_inserts_junction_row() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();

        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Link Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        let contact_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES (?, 'Dr Link', 'gp', ?, ?)",
            rusqlite::params![contact_id, now, now],
        )
        .unwrap();

        conn.execute(
            "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) VALUES (?, ?)",
            rusqlite::params![clinic_id, contact_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_contacts \
                 WHERE clinic_id = ? AND contact_id = ?",
                rusqlite::params![clinic_id, contact_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn list_with_contacts_no_linked_contacts() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();
        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Solo Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, c.address, c.phone, c.created_at, c.company_registration_number,
                        co.id, co.name, co.role
                 FROM clinics c
                 LEFT JOIN clinic_contacts cc ON cc.clinic_id = c.id
                 LEFT JOIN contacts co ON co.id = cc.contact_id
                 ORDER BY c.name COLLATE NOCASE, co.name COLLATE NOCASE",
            )
            .unwrap();

        let mut result: Vec<ClinicWithContacts> = Vec::new();
        let mut rows = stmt.query([]).unwrap();
        while let Some(row) = rows.next().unwrap() {
            let cid: String = row.get(0).unwrap();
            let contact_id: Option<String> = row.get(6).unwrap();
            if result.last().map(|c: &ClinicWithContacts| c.id.as_str()) != Some(cid.as_str()) {
                result.push(ClinicWithContacts {
                    id: cid,
                    name: row.get(1).unwrap(),
                    address: row.get(2).unwrap(),
                    phone: row.get(3).unwrap(),
                    created_at: row.get(4).unwrap(),
                    company_registration_number: row.get(5).unwrap(),
                    linked_contacts: Vec::new(),
                });
            }
            if let Some(kid) = contact_id {
                let last = result.last_mut().unwrap();
                last.linked_contacts.push(LinkedContact {
                    id: kid,
                    name: row.get(7).unwrap(),
                    role: row.get(8).unwrap(),
                });
            }
        }

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Solo Clinic");
        assert!(result[0].linked_contacts.is_empty());
    }

    #[test]
    fn list_with_contacts_two_linked_contacts() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();

        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Duo Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        let contact_ids: Vec<String> = (0..2).map(|_| Uuid::new_v4().to_string()).collect();
        for (i, cid) in contact_ids.iter().enumerate() {
            conn.execute(
                "INSERT INTO contacts (id, name, role, created_at, updated_at) \
                 VALUES (?, ?, 'gp', ?, ?)",
                rusqlite::params![cid, format!("Dr Contact {i}"), now, now],
            )
            .unwrap();
            conn.execute(
                "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) VALUES (?, ?)",
                rusqlite::params![clinic_id, cid],
            )
            .unwrap();
        }

        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.name, c.address, c.phone, c.created_at, c.company_registration_number,
                        co.id, co.name, co.role
                 FROM clinics c
                 LEFT JOIN clinic_contacts cc ON cc.clinic_id = c.id
                 LEFT JOIN contacts co ON co.id = cc.contact_id
                 ORDER BY c.name COLLATE NOCASE, co.name COLLATE NOCASE",
            )
            .unwrap();

        let mut result: Vec<ClinicWithContacts> = Vec::new();
        let mut rows = stmt.query([]).unwrap();
        while let Some(row) = rows.next().unwrap() {
            let cid: String = row.get(0).unwrap();
            let contact_id: Option<String> = row.get(6).unwrap();
            if result.last().map(|c: &ClinicWithContacts| c.id.as_str()) != Some(cid.as_str()) {
                result.push(ClinicWithContacts {
                    id: cid,
                    name: row.get(1).unwrap(),
                    address: row.get(2).unwrap(),
                    phone: row.get(3).unwrap(),
                    created_at: row.get(4).unwrap(),
                    company_registration_number: row.get(5).unwrap(),
                    linked_contacts: Vec::new(),
                });
            }
            if let Some(kid) = contact_id {
                let last = result.last_mut().unwrap();
                last.linked_contacts.push(LinkedContact {
                    id: kid,
                    name: row.get(7).unwrap(),
                    role: row.get(8).unwrap(),
                });
            }
        }

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "Duo Clinic");
        assert_eq!(result[0].linked_contacts.len(), 2);
    }

    #[test]
    fn link_contact_is_idempotent() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();

        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Idempotent Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        let contact_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES (?, 'Dr Idem', 'gp', ?, ?)",
            rusqlite::params![contact_id, now, now],
        )
        .unwrap();

        for _ in 0..3 {
            conn.execute(
                "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) VALUES (?, ?)",
                rusqlite::params![clinic_id, contact_id],
            )
            .unwrap();
        }

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_contacts \
                 WHERE clinic_id = ? AND contact_id = ?",
                rusqlite::params![clinic_id, contact_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1, "duplicate link_contact inserts must be ignored");
    }

    #[test]
    fn clinics_delete_writes_history_note_to_linked_contact() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();

        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'History Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        let contact_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES (?, 'Dr History', 'gp', ?, ?)",
            rusqlite::params![contact_id, now, now],
        )
        .unwrap();

        conn.execute(
            "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) VALUES (?, ?)",
            rusqlite::params![clinic_id, contact_id],
        )
        .unwrap();

        // Mirror clinics_delete logic inline
        let clinic_name: String = conn
            .query_row(
                "SELECT name FROM clinics WHERE id = ?1",
                [&clinic_id],
                |r| r.get(0),
            )
            .unwrap();

        let linked: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT contact_id FROM clinic_contacts WHERE clinic_id = ?1")
                .unwrap();
            stmt.query_map([&clinic_id], |r| r.get(0))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };

        let date = Utc::now().format("%Y-%m-%d").to_string();
        let note_suffix = format!("Previously at {} \u{2014} removed {}", clinic_name, date);

        let tx = conn.unchecked_transaction().unwrap();
        for cid in &linked {
            tx.execute(
                "UPDATE contacts SET notes = TRIM(COALESCE(notes, '') || char(10) || ?1) WHERE id = ?2",
                rusqlite::params![note_suffix, cid],
            )
            .unwrap();
        }
        tx.execute("DELETE FROM clinics WHERE id = ?1", [&clinic_id])
            .unwrap();
        tx.commit().unwrap();

        // Clinic must be gone
        let clinic_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinics WHERE id = ?",
                [&clinic_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(clinic_count, 0);

        // Contact still exists with history note
        let notes: Option<String> = conn
            .query_row(
                "SELECT notes FROM contacts WHERE id = ?",
                [&contact_id],
                |r| r.get(0),
            )
            .optional()
            .unwrap();
        let notes_str = notes.unwrap_or_default();
        assert!(
            notes_str.contains("Previously at History Clinic"),
            "notes should contain history: {notes_str}"
        );
    }

    #[test]
    fn clinics_delete_no_contacts_succeeds() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();

        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Empty Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        // Mirror clinics_delete logic inline — no linked contacts
        let clinic_name: Option<String> = conn
            .query_row(
                "SELECT name FROM clinics WHERE id = ?1",
                [&clinic_id],
                |r| r.get(0),
            )
            .optional()
            .unwrap();
        assert!(clinic_name.is_some());

        let linked: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT contact_id FROM clinic_contacts WHERE clinic_id = ?1")
                .unwrap();
            stmt.query_map([&clinic_id], |r| r.get(0))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };
        assert!(linked.is_empty());

        let tx = conn.unchecked_transaction().unwrap();
        tx.execute("DELETE FROM clinics WHERE id = ?1", [&clinic_id])
            .unwrap();
        tx.commit().unwrap();

        let clinic_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinics WHERE id = ?",
                [&clinic_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(clinic_count, 0);

        // No contacts were created or modified — contacts table should still be empty
        let contact_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM contacts", [], |r| r.get(0))
            .unwrap();
        assert_eq!(contact_count, 0);
    }

    #[test]
    fn draft_clinic_excluded_from_list() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, is_draft, created_at) VALUES (?, 'Draft Clinic', 1, ?)",
            rusqlite::params![id, now],
        )
        .unwrap();
        // Call the actual production query so any column or filter regression is caught here.
        let result = clinics_list_with_contacts_conn(&conn).unwrap();
        assert_eq!(
            result.len(),
            0,
            "draft clinic must not appear in the regular list"
        );
    }

    #[test]
    fn confirmed_clinic_included_in_list() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO clinics (id, name, is_draft, created_at) VALUES (?, 'Real Clinic', 0, ?)",
            rusqlite::params![id, now],
        )
        .unwrap();
        // Call the actual production query so any column or filter regression is caught here.
        let result = clinics_list_with_contacts_conn(&conn).unwrap();
        assert_eq!(
            result.len(),
            1,
            "confirmed clinic must appear in the regular list"
        );
        assert_eq!(result[0].name, "Real Clinic");
    }

    #[test]
    fn contact_linked_via_junction_table_appears_in_clinic_list() {
        // Regression test: contacts_update now writes clinic_contacts (not contacts.contact_clinic_id).
        // Verify clinics_list_with_contacts_conn reflects that link correctly.
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();

        let clinic_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Link Test Clinic', ?)",
            rusqlite::params![clinic_id, now],
        )
        .unwrap();

        let contact_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES (?, 'Dr Link', 'specialist', ?, ?)",
            rusqlite::params![contact_id, now, now],
        )
        .unwrap();

        // This is the path taken by contacts_update after migration 32
        conn.execute(
            "INSERT OR IGNORE INTO clinic_contacts (clinic_id, contact_id) VALUES (?, ?)",
            rusqlite::params![clinic_id, contact_id],
        )
        .unwrap();

        let result = clinics_list_with_contacts_conn(&conn).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].linked_contacts.len(), 1);
        assert_eq!(result[0].linked_contacts[0].id, contact_id);
        assert_eq!(result[0].linked_contacts[0].name, "Dr Link");
    }
}
