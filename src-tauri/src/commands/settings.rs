use tauri::State;

use super::CommandError;
use crate::commands::{AppState, CommandContext};

#[tauri::command]
pub fn settings_get(
    key: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    let result = conn.query_row("SELECT value FROM settings WHERE key = ?", [&key], |row| {
        row.get::<_, String>(0)
    });
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(CommandError::Internal(e.to_string())),
    }
}

#[tauri::command]
pub fn settings_set(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;
    Ok(())
}

#[tauri::command]
pub fn settings_get_data_dir(app_handle: tauri::AppHandle) -> Result<String, CommandError> {
    use tauri::Manager;
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn settings_wipe_all_data(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), CommandError> {
    use tauri::Manager;
    state.db.lock()?.take();
    state.key_hex.lock()?.take();

    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;

    if dir.exists() {
        std::fs::remove_dir_all(&dir)
            .map_err(|e| CommandError::Internal(format!("failed to wipe data: {e}")))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use crate::db;
    use rusqlite::Connection;

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        db::migrations::run(&conn).unwrap();
        conn
    }

    #[test]
    fn get_returns_none_for_missing_key() {
        let conn = open_test_db();
        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?",
            ["missing"],
            |row| row.get::<_, String>(0),
        );
        assert!(matches!(result, Err(rusqlite::Error::QueryReturnedNoRows)));
    }

    #[test]
    fn set_and_get_round_trip() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('theme', 'dark')",
            [],
        )
        .unwrap();
        let val: String = conn
            .query_row("SELECT value FROM settings WHERE key = 'theme'", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(val, "dark");
    }

    #[test]
    fn upsert_overwrites_existing_key() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('auto_lock_minutes', '15')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('auto_lock_minutes', '30')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .unwrap();
        let val: String = conn
            .query_row(
                "SELECT value FROM settings WHERE key = 'auto_lock_minutes'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(val, "30");
    }

    #[test]
    fn multiple_keys_coexist() {
        let conn = open_test_db();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('theme', 'light')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('auto_lock_minutes', '5')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM settings", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }
}
