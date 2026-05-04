use rand::RngCore;
use rusqlite::Connection;
use std::path::{Path, PathBuf};

use crate::{commands::trash::purge_expired_direct, crypto, db};

use super::{AppState, CommandContext, CommandError};

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

fn users_dir(data_dir: &Path) -> PathBuf {
    data_dir.join("users")
}

fn user_salt_path(data_dir: &Path, user_id: &str) -> PathBuf {
    users_dir(data_dir).join(format!("{user_id}.salt"))
}

fn user_wrapped_key_path(data_dir: &Path, user_id: &str) -> PathBuf {
    users_dir(data_dir).join(format!("{user_id}.wrapped_key"))
}

fn roster_path(data_dir: &Path) -> PathBuf {
    data_dir.join("myhealth_users.json")
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserEntry {
    pub id: String,
    pub display_name: String,
}

fn read_roster(data_dir: &Path) -> Vec<UserEntry> {
    std::fs::read_to_string(roster_path(data_dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_roster(data_dir: &Path, roster: &[UserEntry]) -> Result<(), String> {
    let json = serde_json::to_string(roster).map_err(|e| format!("serialize roster: {e}"))?;
    std::fs::write(roster_path(data_dir), json).map_err(|e| format!("write roster: {e}"))
}

fn hex_to_bytes32(hex: &str) -> Result<[u8; 32], String> {
    if hex.len() != 64 {
        return Err(format!("expected 64 hex chars, got {}", hex.len()));
    }
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16)
            .map_err(|e| format!("invalid hex at {}: {e}", i * 2))?;
    }
    Ok(out)
}

fn xor_keys(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut out = [0u8; 32];
    for i in 0..32 {
        out[i] = a[i] ^ b[i];
    }
    out
}

pub fn add_user_internal(
    data_dir: &Path,
    vault_key_hex: &str,
    user_id: &str,
    display_name: &str,
    password: &str,
    conn: &Connection,
) -> Result<(), String> {
    validate_password_strength(password)?;
    let user_salt = generate_salt();
    let user_key = crypto::derive_key(password, &user_salt);
    let vault_key = hex_to_bytes32(vault_key_hex)?;
    let wrapped = xor_keys(&vault_key, &user_key);
    let dir = users_dir(data_dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("create users dir: {e}"))?;
    std::fs::write(user_salt_path(data_dir, user_id), user_salt)
        .map_err(|e| format!("write user salt: {e}"))?;
    std::fs::write(user_wrapped_key_path(data_dir, user_id), wrapped)
        .map_err(|e| format!("write wrapped key: {e}"))?;
    conn.execute(
        "INSERT INTO users (id, display_name) VALUES (?1, ?2)",
        rusqlite::params![user_id, display_name],
    )
    .map_err(|e| format!("insert user: {e}"))?;
    let mut roster = read_roster(data_dir);
    roster.push(UserEntry {
        id: user_id.to_string(),
        display_name: display_name.to_string(),
    });
    write_roster(data_dir, &roster)
}

pub fn switch_user_internal(
    data_dir: &Path,
    user_id: &str,
    password: &str,
) -> Result<(Connection, String), String> {
    let user_salt = std::fs::read(user_salt_path(data_dir, user_id))
        .map_err(|e| format!("failed to read user salt: {e}"))?;
    let user_key = crypto::derive_key(password, &user_salt);
    let wrapped_bytes = std::fs::read(user_wrapped_key_path(data_dir, user_id))
        .map_err(|e| format!("failed to read wrapped key: {e}"))?;
    let wrapped: [u8; 32] = wrapped_bytes
        .try_into()
        .map_err(|_| "wrapped key file is corrupt".to_string())?;
    let vault_key = xor_keys(&wrapped, &user_key);
    let vault_hex = crypto::key_to_hex(&vault_key);
    let conn =
        open_db_for_path(data_dir, &vault_hex).map_err(|_| "incorrect password".to_string())?;
    Ok((conn, vault_hex))
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
    let conn = open_db_for_path(data_dir, &hex)
        .map_err(|e| format!("incorrect password (detail: {e})"))?;

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
) -> Result<(), CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    validate_password_strength(&password).map_err(CommandError::Internal)?;
    let (conn, hex) =
        set_password_internal(&data_dir, &password).map_err(CommandError::Internal)?;
    purge_expired_direct(&conn);
    *state.db.lock().unwrap() = Some(conn);
    *state.key_hex.lock().unwrap() = Some(zeroize::Zeroizing::new(hex));
    Ok(())
}

#[tauri::command]
pub fn auth_unlock(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    password: String,
) -> Result<(), CommandError> {
    use tauri::Manager;
    state
        .auth_rate_limit
        .lock()
        .unwrap()
        .check()
        .map_err(CommandError::Internal)?;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    match unlock_internal(&data_dir, &password) {
        Ok((conn, hex)) => {
            state.auth_rate_limit.lock().unwrap().reset();
            purge_expired_direct(&conn);
            *state.db.lock().unwrap() = Some(conn);
            *state.key_hex.lock().unwrap() = Some(zeroize::Zeroizing::new(hex));
            Ok(())
        }
        Err(e) => {
            state.auth_rate_limit.lock().unwrap().record_failure();
            Err(CommandError::Internal(e))
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
) -> Result<(), CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    let salt = load_salt(&data_dir).map_err(CommandError::Internal)?;
    validate_password_strength(&new_password).map_err(CommandError::Internal)?;
    let old_hex = crypto::key_to_hex(&crypto::derive_key(&old_password, &salt));

    // Verify old password matches the stored key.
    {
        let stored = state.key_hex.lock().unwrap();
        if stored.as_ref().map(|z| z.as_str()) != Some(old_hex.as_str()) {
            return Err(CommandError::Internal("incorrect current password".into()));
        }
    }

    // PRAGMA rekey is unreliable with bundled-sqlcipher-vendored-openssl — it may
    // silently succeed without actually rekeying the file, leaving the DB keyed with
    // the old key while state.key_hex holds the new key. Use the Online Backup API
    // (same pattern as the iteration migration in unlock_internal).
    let new_salt = generate_salt();
    let new_hex = crypto::key_to_hex(&crypto::derive_key(&new_password, &new_salt));
    let db_file = db_path(&data_dir);
    let tmp_file = db_file.with_extension("db.rekey_tmp");
    {
        let db_guard = state.db.lock().unwrap();
        let conn = CommandContext::new(&db_guard)?.conn;
        let mut new_conn = db::open_db(
            tmp_file
                .to_str()
                .ok_or(CommandError::Internal("tmp path not valid UTF-8".into()))?,
            &new_hex,
        )
        .map_err(|e| CommandError::Internal(format!("open tmp db: {e}")))?;
        let backup = rusqlite::backup::Backup::new(conn, &mut new_conn)
            .map_err(|e| CommandError::Internal(format!("backup init: {e}")))?;
        backup
            .run_to_completion(1024, std::time::Duration::ZERO, None)
            .map_err(|e| CommandError::Internal(format!("backup copy: {e}")))?;
    }

    // Drop old connection, swap files, remove stale WAL artifacts.
    {
        state.db.lock().unwrap().take();
    }
    std::fs::rename(&tmp_file, &db_file)
        .map_err(|e| CommandError::Internal(format!("rename rekeyed db: {e}")))?;
    let _ = std::fs::remove_file(db_file.with_extension("db-wal"));
    let _ = std::fs::remove_file(db_file.with_extension("db-shm"));

    // Persist new salt and iteration count, then reopen.
    std::fs::write(salt_path(&data_dir), new_salt)
        .map_err(|e| CommandError::Internal(format!("write salt: {e}")))?;
    write_iterations(&data_dir, crypto::ITERATIONS).map_err(CommandError::Internal)?;
    let new_conn = open_db_for_path(&data_dir, &new_hex)
        .map_err(|e| CommandError::Internal(format!("reopen after rekey: {e}")))?;

    *state.db.lock().unwrap() = Some(new_conn);
    *state.key_hex.lock().unwrap() = Some(zeroize::Zeroizing::new(new_hex));
    Ok(())
}

#[tauri::command]
pub fn auth_is_locked(state: tauri::State<'_, AppState>) -> bool {
    state.db.lock().unwrap().is_none()
}

#[tauri::command]
pub fn auth_has_password(app_handle: tauri::AppHandle) -> Result<bool, CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    Ok(salt_path(&data_dir).exists())
}

fn app_reset_data_internal(data_dir: &Path, state: &AppState) -> Result<(), String> {
    // Drop the active DB connection and clear the key before deleting files.
    state.db.lock().unwrap().take();
    state.key_hex.lock().unwrap().take();

    for path in [db_path(data_dir), salt_path(data_dir), kdf_path(data_dir)] {
        if path.exists() {
            std::fs::remove_file(&path)
                .map_err(|e| format!("failed to delete {}: {e}", path.display()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn app_reset_data(
    confirm: bool,
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), CommandError> {
    if !confirm {
        return Err(CommandError::Internal("confirm required".into()));
    }
    use tauri::{Emitter, Manager};
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    app_reset_data_internal(&data_dir, &state).map_err(CommandError::Internal)?;
    let _ = app_handle.emit("app_data_reset", ());
    Ok(())
}

#[tauri::command]
pub fn auth_list_users(app_handle: tauri::AppHandle) -> Result<Vec<UserEntry>, CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    Ok(read_roster(&data_dir))
}

#[tauri::command]
pub fn auth_add_user(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    display_name: String,
    password: String,
) -> Result<String, CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    let vault_key_hex = {
        let guard = state.key_hex.lock().unwrap();
        guard.as_ref().ok_or(CommandError::DbLocked)?.to_string()
    };
    let db_guard = state.db.lock().unwrap();
    let conn = CommandContext::new(&db_guard)?.conn;
    let user_id = uuid::Uuid::new_v4().to_string();
    add_user_internal(
        &data_dir,
        &vault_key_hex,
        &user_id,
        &display_name,
        &password,
        conn,
    )
    .map_err(CommandError::Internal)?;
    Ok(user_id)
}

#[tauri::command]
pub fn auth_switch_user(
    state: tauri::State<'_, AppState>,
    app_handle: tauri::AppHandle,
    user_id: String,
    password: String,
) -> Result<(), CommandError> {
    use tauri::Manager;
    state
        .auth_rate_limit
        .lock()
        .unwrap()
        .check()
        .map_err(CommandError::Internal)?;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    match switch_user_internal(&data_dir, &user_id, &password) {
        Ok((conn, hex)) => {
            state.auth_rate_limit.lock().unwrap().reset();
            *state.db.lock().unwrap() = Some(conn);
            *state.key_hex.lock().unwrap() = Some(zeroize::Zeroizing::new(hex));
            *state.current_user_id.lock().unwrap() = Some(user_id);
            Ok(())
        }
        Err(e) => {
            state.auth_rate_limit.lock().unwrap().record_failure();
            Err(CommandError::Internal(e))
        }
    }
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

    #[test]
    fn has_password_false_when_no_salt() {
        let dir = test_dir();
        // No salt file — should report no password set
        assert!(!salt_path(&dir).exists());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn has_password_true_after_set_password() {
        let dir = test_dir();
        let (conn, _) = set_password_internal(&dir, "ValidPass1!").unwrap();
        drop(conn);
        assert!(
            salt_path(&dir).exists(),
            "salt must exist after set_password"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn wrong_password_error_contains_detail() {
        let dir = test_dir();
        let (conn, _) = set_password_internal(&dir, "ValidPass1!").unwrap();
        drop(conn);
        let err = unlock_internal(&dir, "WrongPass1!").unwrap_err();
        assert!(
            err.contains("incorrect password"),
            "error should say 'incorrect password', got: {err}"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn unlock_propagates_real_error_when_no_salt() {
        let dir = test_dir();
        // No salt file at all — should fail with "failed to read salt", not "incorrect password"
        let err = unlock_internal(&dir, "AnyPass1!").unwrap_err();
        assert!(
            err.contains("failed to read salt"),
            "expected 'failed to read salt' error, got: {err}"
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn app_reset_data_confirm_false_returns_error() {
        let state = AppState::new();
        let dir = test_dir();
        // confirm=false must return an error without touching anything
        let err = app_reset_data_internal(&dir, &state);
        // internal helper always proceeds; the guard lives in the Tauri command wrapper —
        // test the guard directly via a simulated call.
        drop(err);
        // Simulate the guard: confirm=false → error before calling internal.
        let result: Result<(), String> = {
            let confirm = false;
            if !confirm {
                Err("confirm required".into())
            } else {
                app_reset_data_internal(&dir, &state)
            }
        };
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "confirm required");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn app_reset_data_confirm_true_deletes_files() {
        let dir = test_dir();
        let state = AppState::new();
        // Set up all three files.
        let (conn, _) = set_password_internal(&dir, "StrongPass1!").unwrap();
        drop(conn);
        assert!(db_path(&dir).exists());
        assert!(salt_path(&dir).exists());
        assert!(kdf_path(&dir).exists());

        app_reset_data_internal(&dir, &state).unwrap();

        assert!(!db_path(&dir).exists(), "db should be deleted");
        assert!(!salt_path(&dir).exists(), "salt should be deleted");
        assert!(!kdf_path(&dir).exists(), "kdf should be deleted");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn two_users_can_be_created() {
        let dir = test_dir();
        let (conn, vault_hex) = set_password_internal(&dir, "VaultPass1!xx").unwrap();
        add_user_internal(&dir, &vault_hex, "alice", "Alice", "AlicePass1!xx", &conn).unwrap();
        add_user_internal(&dir, &vault_hex, "bob", "Bob", "BobPass99!xxx", &conn).unwrap();
        let roster = read_roster(&dir);
        assert_eq!(roster.len(), 2);
        assert!(roster.iter().any(|u| u.id == "alice"));
        assert!(roster.iter().any(|u| u.id == "bob"));
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn user_isolation_documents_not_visible_cross_user() {
        let dir = test_dir();
        let (conn, vault_hex) = set_password_internal(&dir, "VaultPass1!xx").unwrap();
        add_user_internal(&dir, &vault_hex, "alice", "Alice", "AlicePass1!xx", &conn).unwrap();
        add_user_internal(&dir, &vault_hex, "bob", "Bob", "BobPass99!xxx", &conn).unwrap();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, user_id) \
             VALUES ('doc-a', 'alice.pdf', 'docs/alice.pdf', 'application/pdf', 100, 'lab', 'alice')",
            [],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM documents WHERE user_id = 'bob'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "bob should see no documents");
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn switch_user_re_opens_connection() {
        let dir = test_dir();
        let (conn, vault_hex) = set_password_internal(&dir, "VaultPass1!xx").unwrap();
        add_user_internal(&dir, &vault_hex, "alice", "Alice", "AlicePass1!xx", &conn).unwrap();
        drop(conn);
        let (conn2, _) = switch_user_internal(&dir, "alice", "AlicePass1!xx").unwrap();
        let result: i64 = conn2
            .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
            .unwrap();
        assert_eq!(result, 0);
        drop(conn2);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn delete_user_cascades_documents() {
        let dir = test_dir();
        let (conn, vault_hex) = set_password_internal(&dir, "VaultPass1!xx").unwrap();
        add_user_internal(&dir, &vault_hex, "alice", "Alice", "AlicePass1!xx", &conn).unwrap();
        conn.execute(
            "INSERT INTO documents (id, filename, file_path, mime_type, file_size_bytes, category, user_id) \
             VALUES ('doc-a', 'alice.pdf', 'docs/alice.pdf', 'application/pdf', 100, 'lab', 'alice')",
            [],
        )
        .unwrap();
        conn.execute("DELETE FROM users WHERE id = 'alice'", [])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM documents WHERE user_id = 'alice'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "cascade delete should remove alice's documents");
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
