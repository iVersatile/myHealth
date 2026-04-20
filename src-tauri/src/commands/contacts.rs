use chrono::Utc;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::commands::AppState;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub role: String,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ContactCreateInput {
    pub name: String,
    pub role: String,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ContactUpdateInput {
    pub id: String,
    pub name: Option<String>,
    pub role: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub clinic: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

fn row_to_contact(row: &rusqlite::Row) -> rusqlite::Result<Contact> {
    Ok(Contact {
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
    })
}

#[tauri::command]
pub fn contacts_list(
    role: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Contact>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let contacts: Vec<Contact> = if let Some(r) = role {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at FROM contacts WHERE role = ? ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<Contact> = stmt
            .query_map([r], row_to_contact)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    } else {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at FROM contacts ORDER BY name",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<Contact> = stmt
            .query_map([], row_to_contact)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    Ok(contacts)
}

#[tauri::command]
pub fn contacts_get(id: String, state: State<'_, AppState>) -> Result<Contact, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    conn.query_row(
        "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
         created_at, updated_at FROM contacts WHERE id = ?",
        [&id],
        row_to_contact,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn contacts_create(
    input: ContactCreateInput,
    state: State<'_, AppState>,
) -> Result<Contact, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO contacts (id, name, role, specialty, phone, email, clinic, address, notes, \
         created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rusqlite::params![
            id,
            input.name,
            input.role,
            input.specialty,
            input.phone,
            input.email,
            input.clinic,
            input.address,
            input.notes,
            now,
            now,
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
         created_at, updated_at FROM contacts WHERE id = ?",
        [&id],
        row_to_contact,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn contacts_update(
    input: ContactUpdateInput,
    state: State<'_, AppState>,
) -> Result<Contact, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    let now = Utc::now().to_rfc3339();

    if let Some(name) = input.name {
        conn.execute(
            "UPDATE contacts SET name = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![name, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(role) = input.role {
        conn.execute(
            "UPDATE contacts SET role = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![role, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(specialty) = input.specialty {
        conn.execute(
            "UPDATE contacts SET specialty = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![specialty, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(phone) = input.phone {
        conn.execute(
            "UPDATE contacts SET phone = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![phone, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(email) = input.email {
        conn.execute(
            "UPDATE contacts SET email = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![email, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(clinic) = input.clinic {
        conn.execute(
            "UPDATE contacts SET clinic = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![clinic, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(address) = input.address {
        conn.execute(
            "UPDATE contacts SET address = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![address, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(notes) = input.notes {
        conn.execute(
            "UPDATE contacts SET notes = ?, updated_at = ? WHERE id = ?",
            rusqlite::params![notes, now, input.id],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.query_row(
        "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
         created_at, updated_at FROM contacts WHERE id = ?",
        [&input.id],
        row_to_contact,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn contacts_delete(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;

    conn.execute("DELETE FROM contacts WHERE id = ?", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn open_test_db() -> rusqlite::Connection {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn create_and_get_contact() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![id, "Dr Smith", "gp", now, now],
        )
        .unwrap();
        let c = conn
            .query_row(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at FROM contacts WHERE id = ?",
                [&id],
                row_to_contact,
            )
            .unwrap();
        assert_eq!(c.name, "Dr Smith");
        assert_eq!(c.role, "gp");
    }

    #[test]
    fn list_contacts_filtered_by_role() {
        let conn = open_test_db();
        let now = Utc::now().to_rfc3339();
        for (name, role) in [("Dr A", "gp"), ("Dr B", "specialist"), ("Dr C", "gp")] {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                rusqlite::params![id, name, role, now, now],
            )
            .unwrap();
        }
        let mut stmt = conn
            .prepare(
                "SELECT id, name, role, specialty, phone, email, clinic, address, notes, \
                 created_at, updated_at FROM contacts WHERE role = ? ORDER BY name",
            )
            .unwrap();
        let gps: Vec<Contact> = stmt
            .query_map(["gp"], row_to_contact)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert_eq!(gps.len(), 2);
    }

    #[test]
    fn delete_contact() {
        let conn = open_test_db();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO contacts (id, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![id, "Dr X", "dentist", now, now],
        )
        .unwrap();
        conn.execute("DELETE FROM contacts WHERE id = ?", [&id])
            .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM contacts WHERE id = ?", [&id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(count, 0);
    }
}
