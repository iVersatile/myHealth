use rand::RngCore;
use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::{crypto, db};

use super::AppState;

fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join("myhealth.db")
}

fn salt_path(data_dir: &Path) -> PathBuf {
    data_dir.join("myhealth.salt")
}

fn generate_salt() -> [u8; 32] {
    let mut salt = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

fn load_salt(data_dir: &Path) -> Result<Vec<u8>, String> {
    std::fs::read(salt_path(data_dir)).map_err(|e| format!("failed to read salt: {e}"))
}

fn open_db_for_path(data_dir: &Path, hex: &str) -> Result<Connection, String> {
    let path = db_path(data_dir);
    let path_str = path.to_str().ok_or("db path is not valid UTF-8")?;
    db::open_db(path_str, hex).map_err(|e| format!("open db: {e}"))
}

// Internal functions — testable without Tauri runtime.

pub fn set_password_internal(
    data_dir: &Path,
    password: &str,
) -> Result<(Connection, String), String> {
    let salt = generate_salt();
    std::fs::create_dir_all(data_dir).map_err(|e| format!("create data dir: {e}"))?;
    std::fs::write(salt_path(data_dir), salt).map_err(|e| format!("write salt: {e}"))?;
    let hex = crypto::key_to_hex(&crypto::derive_key(password, &salt));
    let conn = open_db_for_path(data_dir, &hex)?;
    Ok((conn, hex))
}

pub fn unlock_internal(data_dir: &Path, password: &str) -> Result<(Connection, String), String> {
    let salt = load_salt(data_dir)?;
    let hex = crypto::key_to_hex(&crypto::derive_key(password, &salt));
    let conn = open_db_for_path(data_dir, &hex).map_err(|_| "incorrect password".to_string())?;
    Ok((conn, hex))
}

pub fn is_locked_internal(db: &Option<Connection>) -> bool {
    db.is_none()
}

// Tauri commands — thin wrappers over the internal functions.

#[tauri::command]
pub fn auth_set_password(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    password: String,
) -> Result<(), String> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data dir: {e}"))?;
    let (conn, hex) = set_password_internal(&data_dir, &password)?;
    *state.db.lock().unwrap() = Some(conn);
    *state.key_hex.lock().unwrap() = Some(hex);
    Ok(())
}

#[tauri::command]
pub fn auth_unlock(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    password: String,
) -> Result<(), String> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data dir: {e}"))?;
    let (conn, hex) = unlock_internal(&data_dir, &password)?;
    *state.db.lock().unwrap() = Some(conn);
    *state.key_hex.lock().unwrap() = Some(hex);
    Ok(())
}

#[tauri::command]
pub fn auth_lock(state: tauri::State<'_, AppState>) {
    state.db.lock().unwrap().take();
    state.key_hex.lock().unwrap().take();
}

#[tauri::command]
pub fn auth_change_password(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    old_password: String,
    new_password: String,
) -> Result<(), String> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data dir: {e}"))?;
    let salt = load_salt(&data_dir)?;
    let old_hex = crypto::key_to_hex(&crypto::derive_key(&old_password, &salt));
    let new_hex = crypto::key_to_hex(&crypto::derive_key(&new_password, &salt));

    // Verify old password matches the stored key.
    {
        let stored = state.key_hex.lock().unwrap();
        if stored.as_deref() != Some(old_hex.as_str()) {
            return Err("incorrect current password".into());
        }
    }

    // Rekey the database.
    {
        let db_guard = state.db.lock().unwrap();
        let conn = db_guard.as_ref().ok_or("app is locked")?;
        conn.execute_batch(&format!("PRAGMA rekey = '{new_hex}';"))
            .map_err(|e| format!("rekey failed: {e}"))?;
    }

    *state.key_hex.lock().unwrap() = Some(new_hex);
    Ok(())
}

#[tauri::command]
pub fn auth_is_locked(state: tauri::State<'_, AppState>) -> bool {
    state.db.lock().unwrap().is_none()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("myhealth_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn set_password_creates_files() {
        let dir = test_dir();
        let (conn, _) = set_password_internal(&dir, "secret").unwrap();
        drop(conn);
        assert!(db_path(&dir).exists(), "db file should exist");
        assert!(salt_path(&dir).exists(), "salt file should exist");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn lock_unlock_roundtrip() {
        let dir = test_dir();
        let (conn, _) = set_password_internal(&dir, "hunter2").unwrap();
        let mut opt: Option<Connection> = Some(conn);

        opt.take();
        assert!(is_locked_internal(&opt));

        let (conn2, _) = unlock_internal(&dir, "hunter2").unwrap();
        opt = Some(conn2);
        assert!(!is_locked_internal(&opt));

        drop(opt);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn wrong_password_fails() {
        let dir = test_dir();
        let (conn, _) = set_password_internal(&dir, "correct").unwrap();
        drop(conn);
        assert!(unlock_internal(&dir, "wrong").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn is_locked_reflects_state() {
        let dir = test_dir();
        let none: Option<Connection> = None;
        assert!(is_locked_internal(&none));
        let (conn, _) = set_password_internal(&dir, "pass").unwrap();
        assert!(!is_locked_internal(&Some(conn)));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
