use rusqlite::Connection;

pub mod appointments;
pub mod auth;
pub mod calendar;
pub mod categories;
pub mod clinics;
pub mod contacts;
pub mod documents;
pub mod export;
pub mod links;
pub mod notes;
pub mod scoring;
pub mod search;
pub mod settings;
pub mod stats;

pub struct AppState {
    pub db: std::sync::Mutex<Option<Connection>>,
    pub key_hex: std::sync::Mutex<Option<zeroize::Zeroizing<String>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: std::sync::Mutex::new(None),
            key_hex: std::sync::Mutex::new(None),
        }
    }

    #[allow(dead_code)]
    pub fn with_db<T, F>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, String>,
    {
        let guard = self.db.lock().map_err(|e| e.to_string())?;
        let conn = guard.as_ref().ok_or("database not open")?;
        f(conn)
    }
}
