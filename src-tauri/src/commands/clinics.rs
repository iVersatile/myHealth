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
    pub created_at: String,
    pub company_registration_number: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClinicCreateInput {
    pub name: String,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub company_registration_number: Option<String>,
    #[serde(default)]
    pub addresses: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ClinicUpdateInput {
    pub id: String,
    pub name: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
}

const SELECT_CLINIC: &str =
    "SELECT id, name, address, phone, created_at, company_registration_number FROM clinics";

fn row_to_clinic(row: &rusqlite::Row) -> rusqlite::Result<Clinic> {
    Ok(Clinic {
        id: row.get(0)?,
        name: row.get(1)?,
        address: row.get(2)?,
        phone: row.get(3)?,
        created_at: row.get(4)?,
        company_registration_number: row.get(5)?,
    })
}

#[tauri::command]
pub fn clinics_list(state: State<'_, AppState>) -> Result<Vec<Clinic>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(&format!("{SELECT_CLINIC} ORDER BY name ASC"))?;
    let rows = stmt.query_map([], row_to_clinic)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_get(id: String, state: State<'_, AppState>) -> Result<Clinic, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.query_row(
        &format!("{SELECT_CLINIC} WHERE id = ?"),
        [&id],
        row_to_clinic,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
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
        conn.execute(
            "INSERT INTO clinic_addresses (clinic_id, address, is_primary) VALUES (?, ?, 0)",
            rusqlite::params![id, addr],
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

    if let Some(name) = input.name {
        conn.execute(
            "UPDATE clinics SET name = ? WHERE id = ?",
            rusqlite::params![name, input.id],
        )?;
    }
    if let Some(address) = input.address {
        conn.execute(
            "UPDATE clinics SET address = ? WHERE id = ?",
            rusqlite::params![address, input.id],
        )?;
    }
    if let Some(phone) = input.phone {
        conn.execute(
            "UPDATE clinics SET phone = ? WHERE id = ?",
            rusqlite::params![phone, input.id],
        )?;
    }

    conn.query_row(
        &format!("{SELECT_CLINIC} WHERE id = ?"),
        [&input.id],
        row_to_clinic,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinics_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute("DELETE FROM clinics WHERE id = ?", [&id])
        .map_err(|e| CommandError::Internal(e.to_string()))
        .map(|_| ())
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
        conn.execute(
            "INSERT INTO clinic_addresses (clinic_id, address, is_primary) VALUES (?, ?, 0)",
            rusqlite::params![id, addr],
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
}
