use rusqlite::Connection;

pub mod appointments;
pub mod auth;
pub mod documents;
pub mod notes;

pub struct AppState {
    pub db: std::sync::Mutex<Option<Connection>>,
    pub key_hex: std::sync::Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: std::sync::Mutex::new(None),
            key_hex: std::sync::Mutex::new(None),
        }
    }
}
