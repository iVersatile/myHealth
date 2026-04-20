use tauri::State;

use crate::commands::AppState;

#[tauri::command]
pub fn settings_get(key: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    let result = conn.query_row("SELECT value FROM settings WHERE key = ?", [&key], |row| {
        row.get::<_, String>(0)
    });
    match result {
        Ok(val) => Ok(Some(val)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn settings_set(key: String, value: String, state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.db.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("database not open")?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn settings_get_data_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data dir: {e}"))?;
    Ok(dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn settings_wipe_all_data(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    use tauri::Manager;
    state.db.lock().map_err(|e| e.to_string())?.take();
    state.key_hex.lock().map_err(|e| e.to_string())?.take();

    let dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data dir: {e}"))?;

    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| format!("failed to wipe data: {e}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
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
