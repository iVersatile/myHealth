use rand::RngCore;
use std::path::{Path, PathBuf};

use crate::{crypto, db};

use super::CommandError;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProfileEntry {
    pub id: String,
    pub name: String,
    pub db_path: String,
    pub created_at: String,
}

fn profiles_json_path(data_dir: &Path) -> PathBuf {
    data_dir.join("profiles.json")
}

fn profile_db_path(data_dir: &Path, id: &str) -> PathBuf {
    data_dir.join(format!("{id}.db"))
}

fn profile_salt_path(data_dir: &Path, id: &str) -> PathBuf {
    data_dir.join(format!("{id}.salt"))
}

fn read_profiles(data_dir: &Path) -> Vec<ProfileEntry> {
    std::fs::read_to_string(profiles_json_path(data_dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_profiles(data_dir: &Path, profiles: &[ProfileEntry]) -> Result<(), String> {
    let json = serde_json::to_string(profiles).map_err(|e| format!("serialize profiles: {e}"))?;
    std::fs::write(profiles_json_path(data_dir), json)
        .map_err(|e| format!("write profiles.json: {e}"))
}

fn generate_salt() -> [u8; 32] {
    let mut salt = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut salt);
    salt
}

#[tauri::command]
pub fn profiles_list(app_handle: tauri::AppHandle) -> Result<Vec<ProfileEntry>, CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;
    Ok(read_profiles(&data_dir))
}

#[tauri::command]
pub fn profiles_create(
    app_handle: tauri::AppHandle,
    name: String,
    password: String,
) -> Result<ProfileEntry, CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;

    let id = uuid::Uuid::new_v4().to_string();
    let db_path = profile_db_path(&data_dir, &id);
    let db_path_str = db_path
        .to_str()
        .ok_or_else(|| CommandError::Internal("db path is not valid UTF-8".into()))?
        .to_string();

    let salt = generate_salt();
    let key = crypto::derive_key(&password, &salt);
    let hex = crypto::key_to_hex(&key);

    std::fs::write(profile_salt_path(&data_dir, &id), salt)
        .map_err(|e| CommandError::Internal(format!("write salt: {e}")))?;

    db::open_db(&db_path_str, &hex)
        .map_err(|e| CommandError::Internal(format!("create profile db: {e}")))?;

    let created_at = chrono::Utc::now().to_rfc3339();
    let entry = ProfileEntry {
        id,
        name,
        db_path: db_path_str,
        created_at,
    };

    let mut profiles = read_profiles(&data_dir);
    profiles.push(entry.clone());
    write_profiles(&data_dir, &profiles).map_err(CommandError::Internal)?;

    Ok(entry)
}

#[tauri::command]
pub fn profiles_delete(app_handle: tauri::AppHandle, id: String) -> Result<(), CommandError> {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;

    let mut profiles = read_profiles(&data_dir);
    let before = profiles.len();
    profiles.retain(|p| p.id != id);
    if profiles.len() == before {
        return Err(CommandError::NotFound(format!("profile {id}")));
    }
    write_profiles(&data_dir, &profiles).map_err(CommandError::Internal)?;

    let db_path = profile_db_path(&data_dir, &id);
    if db_path.exists() {
        std::fs::remove_file(&db_path)
            .map_err(|e| CommandError::Internal(format!("delete db: {e}")))?;
    }
    let salt_path = profile_salt_path(&data_dir, &id);
    if salt_path.exists() {
        let _ = std::fs::remove_file(&salt_path);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn make_entry(id: &str) -> ProfileEntry {
        ProfileEntry {
            id: id.to_string(),
            name: "Test".to_string(),
            db_path: format!("/tmp/{id}.db"),
            created_at: "2026-01-01T00:00:00+00:00".to_string(),
        }
    }

    #[test]
    fn round_trips_empty() {
        let dir = TempDir::new().unwrap();
        let profiles = read_profiles(dir.path());
        assert!(profiles.is_empty());
        write_profiles(dir.path(), &profiles).unwrap();
        let loaded = read_profiles(dir.path());
        assert!(loaded.is_empty());
    }

    #[test]
    fn round_trips_entries() {
        let dir = TempDir::new().unwrap();
        let entries = vec![make_entry("aaa"), make_entry("bbb")];
        write_profiles(dir.path(), &entries).unwrap();
        let loaded = read_profiles(dir.path());
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded[0].id, "aaa");
        assert_eq!(loaded[1].id, "bbb");
        assert_eq!(loaded[0].name, "Test");
    }

    #[test]
    fn write_creates_json_file() {
        let dir = TempDir::new().unwrap();
        let entries = vec![make_entry("xyz")];
        write_profiles(dir.path(), &entries).unwrap();
        let raw = fs::read_to_string(dir.path().join("profiles.json")).unwrap();
        assert!(raw.contains("xyz"));
        assert!(raw.contains("db_path"));
        assert!(raw.contains("created_at"));
    }

    #[test]
    fn missing_file_returns_empty() {
        let dir = TempDir::new().unwrap();
        let profiles = read_profiles(dir.path());
        assert!(profiles.is_empty());
    }
}
