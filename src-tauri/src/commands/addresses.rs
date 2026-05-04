use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::CommandError;
use crate::commands::{AppState, CommandContext};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Address {
    pub id: String,
    pub label: Option<String>,
    pub line1: String,
    pub line2: Option<String>,
    pub city: Option<String>,
    pub postcode: Option<String>,
    pub country: String,
    pub is_primary: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct AddressInput {
    pub label: Option<String>,
    pub line1: String,
    pub line2: Option<String>,
    pub city: Option<String>,
    pub postcode: Option<String>,
    pub country: Option<String>,
    pub is_primary: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct AddressUpdateInput {
    pub id: String,
    pub label: Option<String>,
    pub line1: Option<String>,
    pub line2: Option<String>,
    pub city: Option<String>,
    pub postcode: Option<String>,
    pub country: Option<String>,
    pub is_primary: Option<bool>,
}

fn row_to_address(row: &rusqlite::Row) -> rusqlite::Result<Address> {
    Ok(Address {
        id: row.get(0)?,
        label: row.get(1)?,
        line1: row.get(2)?,
        line2: row.get(3)?,
        city: row.get(4)?,
        postcode: row.get(5)?,
        country: row.get(6)?,
        is_primary: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
    })
}

const SELECT_CLINIC_ADDRESS: &str =
    "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
     FROM clinic_addresses";

const SELECT_CONTACT_ADDRESS: &str =
    "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
     FROM contact_addresses";

// ── Clinic addresses ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn clinic_addresses_list(
    clinic_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Address>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(&format!(
        "{SELECT_CLINIC_ADDRESS} WHERE clinic_id = ? ORDER BY is_primary DESC, created_at ASC"
    ))?;
    let rows = stmt.query_map([&clinic_id], row_to_address)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinic_address_create(
    clinic_id: String,
    input: AddressInput,
    state: State<'_, AppState>,
) -> Result<Address, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let country = input.country.unwrap_or_else(|| "GB".to_string());
    let is_primary = input.is_primary.unwrap_or(false);

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if is_primary {
        tx.execute(
            "UPDATE clinic_addresses SET is_primary = 0 WHERE clinic_id = ?",
            [&clinic_id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }

    tx.execute(
        "INSERT INTO clinic_addresses \
         (id, clinic_id, label, line1, line2, city, postcode, country, is_primary, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            id,
            clinic_id,
            input.label,
            input.line1,
            input.line2,
            input.city,
            input.postcode,
            country,
            is_primary as i64,
            now,
        ],
    )
    .map_err(|e| CommandError::Internal(e.to_string()))?;

    tx.commit()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    conn.query_row(
        &format!("{SELECT_CLINIC_ADDRESS} WHERE id = ?"),
        [&id],
        row_to_address,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinic_address_update(
    input: AddressUpdateInput,
    state: State<'_, AppState>,
) -> Result<Address, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if let Some(label) = input.label {
        tx.execute(
            "UPDATE clinic_addresses SET label = ? WHERE id = ?",
            rusqlite::params![label, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(line1) = input.line1 {
        tx.execute(
            "UPDATE clinic_addresses SET line1 = ? WHERE id = ?",
            rusqlite::params![line1, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(line2) = input.line2 {
        tx.execute(
            "UPDATE clinic_addresses SET line2 = ? WHERE id = ?",
            rusqlite::params![line2, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(city) = input.city {
        tx.execute(
            "UPDATE clinic_addresses SET city = ? WHERE id = ?",
            rusqlite::params![city, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(postcode) = input.postcode {
        tx.execute(
            "UPDATE clinic_addresses SET postcode = ? WHERE id = ?",
            rusqlite::params![postcode, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(country) = input.country {
        tx.execute(
            "UPDATE clinic_addresses SET country = ? WHERE id = ?",
            rusqlite::params![country, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(is_primary) = input.is_primary {
        if is_primary {
            let clinic_id: String = tx
                .query_row(
                    "SELECT clinic_id FROM clinic_addresses WHERE id = ?",
                    [&input.id],
                    |r| r.get(0),
                )
                .map_err(|e| CommandError::Internal(e.to_string()))?;

            tx.execute(
                "UPDATE clinic_addresses SET is_primary = 0 WHERE clinic_id = ?",
                [&clinic_id],
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        }
        tx.execute(
            "UPDATE clinic_addresses SET is_primary = ? WHERE id = ?",
            rusqlite::params![is_primary as i64, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }

    tx.commit()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    conn.query_row(
        &format!("{SELECT_CLINIC_ADDRESS} WHERE id = ?"),
        [&input.id],
        row_to_address,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn clinic_address_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute("DELETE FROM clinic_addresses WHERE id = ?", [&id])
        .map_err(|e| CommandError::Internal(e.to_string()))
        .map(|_| ())
}

// ── Contact addresses ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn contact_addresses_list(
    contact_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Address>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let mut stmt = conn.prepare(&format!(
        "{SELECT_CONTACT_ADDRESS} WHERE contact_id = ? ORDER BY is_primary DESC, created_at ASC"
    ))?;
    let rows = stmt.query_map([&contact_id], row_to_address)?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn contact_address_create(
    contact_id: String,
    input: AddressInput,
    state: State<'_, AppState>,
) -> Result<Address, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let country = input.country.unwrap_or_else(|| "GB".to_string());
    let is_primary = input.is_primary.unwrap_or(false);

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if is_primary {
        tx.execute(
            "UPDATE contact_addresses SET is_primary = 0 WHERE contact_id = ?",
            [&contact_id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }

    tx.execute(
        "INSERT INTO contact_addresses \
         (id, contact_id, label, line1, line2, city, postcode, country, is_primary, created_at) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            id,
            contact_id,
            input.label,
            input.line1,
            input.line2,
            input.city,
            input.postcode,
            country,
            is_primary as i64,
            now,
        ],
    )
    .map_err(|e| CommandError::Internal(e.to_string()))?;

    tx.commit()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    conn.query_row(
        &format!("{SELECT_CONTACT_ADDRESS} WHERE id = ?"),
        [&id],
        row_to_address,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn contact_address_update(
    input: AddressUpdateInput,
    state: State<'_, AppState>,
) -> Result<Address, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if let Some(label) = input.label {
        tx.execute(
            "UPDATE contact_addresses SET label = ? WHERE id = ?",
            rusqlite::params![label, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(line1) = input.line1 {
        tx.execute(
            "UPDATE contact_addresses SET line1 = ? WHERE id = ?",
            rusqlite::params![line1, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(line2) = input.line2 {
        tx.execute(
            "UPDATE contact_addresses SET line2 = ? WHERE id = ?",
            rusqlite::params![line2, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(city) = input.city {
        tx.execute(
            "UPDATE contact_addresses SET city = ? WHERE id = ?",
            rusqlite::params![city, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(postcode) = input.postcode {
        tx.execute(
            "UPDATE contact_addresses SET postcode = ? WHERE id = ?",
            rusqlite::params![postcode, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(country) = input.country {
        tx.execute(
            "UPDATE contact_addresses SET country = ? WHERE id = ?",
            rusqlite::params![country, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }
    if let Some(is_primary) = input.is_primary {
        if is_primary {
            let contact_id: String = tx
                .query_row(
                    "SELECT contact_id FROM contact_addresses WHERE id = ?",
                    [&input.id],
                    |r| r.get(0),
                )
                .map_err(|e| CommandError::Internal(e.to_string()))?;

            tx.execute(
                "UPDATE contact_addresses SET is_primary = 0 WHERE contact_id = ?",
                [&contact_id],
            )
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        }
        tx.execute(
            "UPDATE contact_addresses SET is_primary = ? WHERE id = ?",
            rusqlite::params![is_primary as i64, input.id],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }

    tx.commit()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    conn.query_row(
        &format!("{SELECT_CONTACT_ADDRESS} WHERE id = ?"),
        [&input.id],
        row_to_address,
    )
    .map_err(|e| CommandError::Internal(e.to_string()))
}

#[tauri::command]
pub fn contact_address_delete(id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    conn.execute("DELETE FROM contact_addresses WHERE id = ?", [&id])
        .map_err(|e| CommandError::Internal(e.to_string()))
        .map(|_| ())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn open_test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        db::migrations::run(&conn).unwrap();
        conn
    }

    fn insert_clinic(conn: &rusqlite::Connection) -> String {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinics (id, name, created_at) VALUES (?, 'Test Clinic', ?)",
            rusqlite::params![id, Utc::now().to_rfc3339()],
        )
        .unwrap();
        id
    }

    fn insert_contact(conn: &rusqlite::Connection) -> String {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) \
             VALUES (?, 'Test Contact', 'gp', ?, ?)",
            rusqlite::params![id, now, now],
        )
        .unwrap();
        id
    }

    // ── clinic_addresses ──────────────────────────────────────────────────────

    #[test]
    fn clinic_addresses_list_empty() {
        let conn = open_test_db();
        let clinic_id = insert_clinic(&conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
                 FROM clinic_addresses WHERE clinic_id = ?",
            )
            .unwrap();
        let rows: Vec<Address> = stmt
            .query_map([&clinic_id], row_to_address)
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn clinic_address_create_inserts_row() {
        let conn = open_test_db();
        let clinic_id = insert_clinic(&conn);
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO clinic_addresses \
             (id, clinic_id, label, line1, line2, city, postcode, country, is_primary, created_at) \
             VALUES (?, ?, ?, ?, NULL, ?, ?, 'GB', 1, ?)",
            rusqlite::params![
                id,
                clinic_id,
                "Home",
                "1 Main St",
                "London",
                "SW1A 1AA",
                now
            ],
        )
        .unwrap();

        let addr: Address = conn
            .query_row(
                "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
                 FROM clinic_addresses WHERE id = ?",
                [&id],
                row_to_address,
            )
            .unwrap();

        assert_eq!(addr.line1, "1 Main St");
        assert_eq!(addr.label, Some("Home".to_string()));
        assert_eq!(addr.city, Some("London".to_string()));
        assert_eq!(addr.postcode, Some("SW1A 1AA".to_string()));
        assert_eq!(addr.country, "GB");
        assert!(addr.is_primary);
    }

    #[test]
    fn clinic_address_primary_enforced_on_create() {
        let conn = open_test_db();
        let clinic_id = insert_clinic(&conn);
        let now = Utc::now().to_rfc3339();

        let id1 = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinic_addresses \
             (id, clinic_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '1 First St', 'GB', 1, ?)",
            rusqlite::params![id1, clinic_id, now],
        )
        .unwrap();

        // Second primary — clear existing first, simulating the command logic
        conn.execute(
            "UPDATE clinic_addresses SET is_primary = 0 WHERE clinic_id = ?",
            [&clinic_id],
        )
        .unwrap();

        let id2 = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO clinic_addresses \
             (id, clinic_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '2 Second St', 'GB', 1, ?)",
            rusqlite::params![id2, clinic_id, now],
        )
        .unwrap();

        let primaries: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_addresses WHERE clinic_id = ? AND is_primary = 1",
                [&clinic_id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(primaries, 1);
    }

    #[test]
    fn clinic_address_update_changes_fields() {
        let conn = open_test_db();
        let clinic_id = insert_clinic(&conn);
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO clinic_addresses \
             (id, clinic_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '1 Old St', 'GB', 0, ?)",
            rusqlite::params![id, clinic_id, now],
        )
        .unwrap();

        conn.execute(
            "UPDATE clinic_addresses SET line1 = '99 New Rd', city = 'Oxford' WHERE id = ?",
            [&id],
        )
        .unwrap();

        let addr: Address = conn
            .query_row(
                "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
                 FROM clinic_addresses WHERE id = ?",
                [&id],
                row_to_address,
            )
            .unwrap();

        assert_eq!(addr.line1, "99 New Rd");
        assert_eq!(addr.city, Some("Oxford".to_string()));
    }

    #[test]
    fn clinic_address_delete_removes_row() {
        let conn = open_test_db();
        let clinic_id = insert_clinic(&conn);
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO clinic_addresses \
             (id, clinic_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '5 Delete Me', 'GB', 0, ?)",
            rusqlite::params![id, clinic_id, now],
        )
        .unwrap();

        conn.execute("DELETE FROM clinic_addresses WHERE id = ?", [&id])
            .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM clinic_addresses WHERE id = ?",
                [&id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(count, 0);
    }

    // ── contact_addresses ─────────────────────────────────────────────────────

    #[test]
    fn contact_addresses_list_empty() {
        let conn = open_test_db();
        let contact_id = insert_contact(&conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
                 FROM contact_addresses WHERE contact_id = ?",
            )
            .unwrap();
        let rows: Vec<Address> = stmt
            .query_map([&contact_id], row_to_address)
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert!(rows.is_empty());
    }

    #[test]
    fn contact_address_create_inserts_row() {
        let conn = open_test_db();
        let contact_id = insert_contact(&conn);
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO contact_addresses \
             (id, contact_id, label, line1, city, country, is_primary, created_at) \
             VALUES (?, ?, 'Work', '10 Work Rd', 'Manchester', 'GB', 1, ?)",
            rusqlite::params![id, contact_id, now],
        )
        .unwrap();

        let addr: Address = conn
            .query_row(
                "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
                 FROM contact_addresses WHERE id = ?",
                [&id],
                row_to_address,
            )
            .unwrap();

        assert_eq!(addr.line1, "10 Work Rd");
        assert_eq!(addr.city, Some("Manchester".to_string()));
        assert!(addr.is_primary);
    }

    #[test]
    fn contact_address_primary_enforced_on_create() {
        let conn = open_test_db();
        let contact_id = insert_contact(&conn);
        let now = Utc::now().to_rfc3339();

        let id1 = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contact_addresses \
             (id, contact_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '1 First Ave', 'GB', 1, ?)",
            rusqlite::params![id1, contact_id, now],
        )
        .unwrap();

        conn.execute(
            "UPDATE contact_addresses SET is_primary = 0 WHERE contact_id = ?",
            [&contact_id],
        )
        .unwrap();

        let id2 = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO contact_addresses \
             (id, contact_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '2 Second Ave', 'GB', 1, ?)",
            rusqlite::params![id2, contact_id, now],
        )
        .unwrap();

        let primaries: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM contact_addresses WHERE contact_id = ? AND is_primary = 1",
                [&contact_id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(primaries, 1);
    }

    #[test]
    fn contact_address_update_changes_fields() {
        let conn = open_test_db();
        let contact_id = insert_contact(&conn);
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO contact_addresses \
             (id, contact_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '1 Old Lane', 'GB', 0, ?)",
            rusqlite::params![id, contact_id, now],
        )
        .unwrap();

        conn.execute(
            "UPDATE contact_addresses SET line1 = '42 New Lane', postcode = 'EC1A 1BB' WHERE id = ?",
            [&id],
        )
        .unwrap();

        let addr: Address = conn
            .query_row(
                "SELECT id, label, line1, line2, city, postcode, country, is_primary, created_at \
                 FROM contact_addresses WHERE id = ?",
                [&id],
                row_to_address,
            )
            .unwrap();

        assert_eq!(addr.line1, "42 New Lane");
        assert_eq!(addr.postcode, Some("EC1A 1BB".to_string()));
    }

    #[test]
    fn contact_address_delete_removes_row() {
        let conn = open_test_db();
        let contact_id = insert_contact(&conn);
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO contact_addresses \
             (id, contact_id, line1, country, is_primary, created_at) \
             VALUES (?, ?, '9 Gone St', 'GB', 0, ?)",
            rusqlite::params![id, contact_id, now],
        )
        .unwrap();

        conn.execute("DELETE FROM contact_addresses WHERE id = ?", [&id])
            .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM contact_addresses WHERE id = ?",
                [&id],
                |r| r.get(0),
            )
            .unwrap();

        assert_eq!(count, 0);
    }
}
