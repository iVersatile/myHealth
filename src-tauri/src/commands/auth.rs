use rand::RngCore;
use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::{crypto, db};

use super::AppState;

const LEGACY_ITERATIONS: u32 = 64_000;

fn db_path(data_dir: &Path) -> PathBuf {
    data_dir.join("myhealth.db")
}

fn salt_path(data_dir: &Path) -> PathBuf {
    data_dir.join("myhealth.salt")
}

fn kdf_path(data_dir: &Path) -> PathBuf {
    data_dir.join("myhealth.kdf")
}

fn read_stored_iterations(data_dir: &Path) -> u32 {
    std::fs::read_to_string(kdf_path(data_dir))
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(LEGACY_ITERATIONS)
}

fn write_iterations(data_dir: &Path, iterations: u32) -> Result<(), String> {
    std::fs::write(kdf_path(data_dir), iterations.to_string())
        .map_err(|e| format!("write kdf: {e}"))
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

fn validate_password_strength(password: &str) -> Result<(), String> {
    if password.len() < 12 {
        return Err("Password must be at least 12 characters".into());
    }
    if !password.chars().any(|c| c.is_uppercase()) {
        return Err("Password must contain at least one uppercase letter".into());
    }
    if !password.chars().any(|c| c.is_lowercase()) {
        return Err("Password must contain at least one lowercase letter".into());
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err("Password must contain at least one digit".into());
    }
    let specials = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
    if !password.chars().any(|c| specials.contains(c)) {
        return Err("Password must contain at least one special character".into());
    }
    Ok(())
}

// Internal functions — testable without Tauri runtime.

pub fn set_password_internal(
    data_dir: &Path,
    password: &str,
) -> Result<(Connection, String), String> {
    let salt = generate_salt();
    std::fs::create_dir_all(data_dir).map_err(|e| format!("create data dir: {e}"))?;
    std::fs::write(salt_path(data_dir), salt).map_err(|e| format!("write salt: {e}"))?;
    write_iterations(data_dir, crypto::ITERATIONS)?;
    let hex = crypto::key_to_hex(&crypto::derive_key(password, &salt));
    let conn = open_db_for_path(data_dir, &hex)?;
    Ok((conn, hex))
}

pub fn unlock_internal(data_dir: &Path, password: &str) -> Result<(Connection, String), String> {
    let salt = load_salt(data_dir)?;
    let stored_iters = read_stored_iterations(data_dir);
    let hex = {
        use hmac::Hmac;
        use pbkdf2::pbkdf2;
        use sha2::Sha512;
        let mut key = [0u8; crypto::KEY_LEN];
        pbkdf2::<Hmac<Sha512>>(password.as_bytes(), &salt, stored_iters, &mut key)
            .expect("HMAC<Sha512> key length is always valid");
        crypto::key_to_hex(&key)
    };
    let conn = open_db_for_path(data_dir, &hex).map_err(|_| "incorrect password".to_string())?;

    if stored_iters < crypto::ITERATIONS {
        let new_hex = crypto::key_to_hex(&crypto::derive_key(password, &salt));
        // PRAGMA rekey is unreliable on Linux with bundled-sqlcipher-vendored-openssl
        // (may be compiled out or produce a file that cannot be reopened). Use the
        // SQLite Online Backup API instead: copy all pages from the old connection
        // (keyed with old_hex) into a fresh connection (keyed with new_hex), then
        // atomically replace the original file.
        let db_file = db_path(data_dir);
        let tmp_file = db_file.with_extension("db.migration_tmp");
        {
            let mut new_conn = db::open_db(
                tmp_file.to_str().ok_or("tmp path is not valid UTF-8")?,
                &new_hex,
            )
            .map_err(|e| format!("open tmp db: {e}"))?;
            let backup = rusqlite::backup::Backup::new(&conn, &mut new_conn)
                .map_err(|e| format!("backup init: {e}"))?;
            backup
                .run_to_completion(1024, std::time::Duration::ZERO, None)
                .map_err(|e| format!("backup copy: {e}"))?;
        }
        drop(conn);
        std::fs::rename(&tmp_file, &db_file).map_err(|e| format!("rename migrated db: {e}"))?;
        // Remove any leftover WAL/SHM from the old connection.
        let _ = std::fs::remove_file(db_file.with_extension("db-wal"));
        let _ = std::fs::remove_file(db_file.with_extension("db-shm"));
        write_iterations(data_dir, crypto::ITERATIONS)?;
        let migrated_conn = open_db_for_path(data_dir, &new_hex)
            .map_err(|e| format!("reopen after migration: {e}"))?;
        return Ok((migrated_conn, new_hex));
    }

    Ok((conn, hex))
}

#[allow(dead_code)]
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
    validate_password_strength(&password)?;
    let (conn, hex) = set_password_internal(&data_dir, &password)?;
    *state.db.lock().unwrap() = Some(conn);
    *state.key_hex.lock().unwrap() = Some(zeroize::Zeroizing::new(hex));
    Ok(())
}

#[tauri::command]
pub fn auth_unlock(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    password: String,
) -> Result<(), String> {
    use tauri::Manager;
    state.auth_rate_limit.lock().unwrap().check()?;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("no data dir: {e}"))?;
    match unlock_internal(&data_dir, &password) {
        Ok((conn, hex)) => {
            state.auth_rate_limit.lock().unwrap().reset();
            *state.db.lock().unwrap() = Some(conn);
            *state.key_hex.lock().unwrap() = Some(zeroize::Zeroizing::new(hex));
            Ok(())
        }
        Err(e) => {
            state.auth_rate_limit.lock().unwrap().record_failure();
            Err(e)
        }
    }
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
    validate_password_strength(&new_password)?;
    let old_hex = crypto::key_to_hex(&crypto::derive_key(&old_password, &salt));
    let new_hex = crypto::key_to_hex(&crypto::derive_key(&new_password, &salt));

    // Verify old password matches the stored key.
    {
        let stored = state.key_hex.lock().unwrap();
        if stored.as_ref().map(|z| z.as_str()) != Some(old_hex.as_str()) {
            return Err("incorrect current password".into());
        }
    }

    // Rekey the database.
    {
        let db_guard = state.db.lock().unwrap();
        let conn = db_guard.as_ref().ok_or("app is locked")?;
        if new_hex.len() != 64 || !new_hex.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err("rekey value must be exactly 64 hex characters".into());
        }
        conn.execute_batch(&format!("PRAGMA rekey = \"x'{new_hex}'\";"))
            .map_err(|e| format!("rekey failed: {e}"))?;
    }

    *state.key_hex.lock().unwrap() = Some(zeroize::Zeroizing::new(new_hex));
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
        assert!(kdf_path(&dir).exists(), "kdf file should exist");
        let stored = read_stored_iterations(&dir);
        assert_eq!(
            stored,
            crypto::ITERATIONS,
            "kdf should store current iterations"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn legacy_db_migrates_to_new_iterations() {
        use hmac::Hmac;
        use pbkdf2::pbkdf2;
        use sha2::Sha512;

        let dir = test_dir();
        let salt = generate_salt();
        std::fs::write(salt_path(&dir), salt).unwrap();

        let mut old_key = [0u8; crypto::KEY_LEN];
        pbkdf2::<Hmac<Sha512>>(
            "mypassword".as_bytes(),
            &salt,
            LEGACY_ITERATIONS,
            &mut old_key,
        )
        .unwrap();
        let old_hex = crypto::key_to_hex(&old_key);
        let conn = open_db_for_path(&dir, &old_hex).unwrap();
        drop(conn);

        let (conn2, new_hex) = unlock_internal(&dir, "mypassword").unwrap();
        drop(conn2);

        assert_ne!(new_hex, old_hex, "key should change after migration");
        assert_eq!(
            read_stored_iterations(&dir),
            crypto::ITERATIONS,
            "kdf should be updated after migration"
        );

        let (conn3, _) = unlock_internal(&dir, "mypassword").unwrap();
        drop(conn3);

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

    #[test]
    fn rate_limit_check_passes_when_clean() {
        let rl = super::super::AuthRateLimit {
            fail_count: 0,
            locked_until: None,
        };
        assert!(rl.check().is_ok());
    }

    #[test]
    fn rate_limit_blocks_after_failures() {
        let mut rl = super::super::AuthRateLimit {
            fail_count: 0,
            locked_until: None,
        };
        // First failure sets a 2s lockout
        rl.record_failure();
        assert_eq!(rl.fail_count, 1);
        assert!(rl.check().is_err());
    }

    #[test]
    fn rate_limit_resets_on_success() {
        let mut rl = super::super::AuthRateLimit {
            fail_count: 3,
            locked_until: Some(std::time::Instant::now() + std::time::Duration::from_secs(30)),
        };
        rl.reset();
        assert_eq!(rl.fail_count, 0);
        assert!(rl.locked_until.is_none());
        assert!(rl.check().is_ok());
    }
}
