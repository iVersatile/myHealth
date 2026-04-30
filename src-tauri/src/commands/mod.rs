use rusqlite::Connection;

#[derive(Debug, serde::Serialize)]
#[serde(tag = "code", content = "message")]
pub enum CommandError {
    DbNotOpen,
    NotFound(String),
    #[allow(dead_code)]
    Constraint(String),
    Internal(String),
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommandError::DbNotOpen => write!(f, "database not open"),
            CommandError::NotFound(msg) => write!(f, "not found: {msg}"),
            CommandError::Constraint(msg) => write!(f, "constraint: {msg}"),
            CommandError::Internal(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<rusqlite::Error> for CommandError {
    fn from(e: rusqlite::Error) -> Self {
        CommandError::Internal(e.to_string())
    }
}

impl<T> From<std::sync::PoisonError<T>> for CommandError {
    fn from(e: std::sync::PoisonError<T>) -> Self {
        CommandError::Internal(format!("mutex poisoned: {}", e))
    }
}

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
pub mod outlook;
pub mod scoring;
pub mod search;
pub mod settings;
pub mod stats;
pub mod summarizer;
pub mod tags;

pub struct AuthRateLimit {
    pub fail_count: u32,
    pub locked_until: Option<std::time::Instant>,
}

impl AuthRateLimit {
    fn delay_for_count(count: u32) -> std::time::Duration {
        match count {
            0 => std::time::Duration::ZERO,
            1 => std::time::Duration::from_secs(2),
            2 => std::time::Duration::from_secs(10),
            3 => std::time::Duration::from_secs(30),
            4 => std::time::Duration::from_secs(60),
            _ => std::time::Duration::from_secs(300),
        }
    }

    pub fn check(&self) -> Result<(), String> {
        if let Some(until) = self.locked_until {
            let now = std::time::Instant::now();
            if now < until {
                let secs = (until - now).as_secs() + 1;
                return Err(format!("Too many failed attempts. Try again in {secs}s."));
            }
        }
        Ok(())
    }

    pub fn record_failure(&mut self) {
        self.fail_count += 1;
        let delay = Self::delay_for_count(self.fail_count);
        if !delay.is_zero() {
            self.locked_until = Some(std::time::Instant::now() + delay);
        }
    }

    pub fn reset(&mut self) {
        self.fail_count = 0;
        self.locked_until = None;
    }
}

pub struct CommandContext<'a> {
    pub conn: &'a Connection,
}

impl<'a> CommandContext<'a> {
    pub fn new(
        guard: &'a std::sync::MutexGuard<'a, Option<Connection>>,
    ) -> Result<Self, CommandError> {
        let conn = guard.as_ref().ok_or(CommandError::DbNotOpen)?;
        Ok(Self { conn })
    }
}

pub struct AppState {
    pub db: std::sync::Mutex<Option<Connection>>,
    pub key_hex: std::sync::Mutex<Option<zeroize::Zeroizing<String>>>,
    pub auth_rate_limit: std::sync::Mutex<AuthRateLimit>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: std::sync::Mutex::new(None),
            key_hex: std::sync::Mutex::new(None),
            auth_rate_limit: std::sync::Mutex::new(AuthRateLimit {
                fail_count: 0,
                locked_until: None,
            }),
        }
    }
}
