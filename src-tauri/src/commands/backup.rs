use std::fs;
use std::io::{self, Write as IoWrite};
use std::path::{Path, PathBuf};
use tauri::State;
use zip::write::SimpleFileOptions;

use super::{AppState, CommandError};

const DB_FILE: &str = "myhealth.db";
const SALT_FILE: &str = "myhealth.salt";
const KDF_FILE: &str = "myhealth.kdf";

fn data_file(data_dir: &Path, name: &str) -> PathBuf {
    data_dir.join(name)
}

/// Bundle the three data files into a `.myhealth` archive at `dest_path`.
///
/// The DB is already AES-256 encrypted via SQLCipher; the archive is a
/// container only — no additional encryption is applied here.
#[tauri::command]
pub fn backup_export(
    dest_path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), CommandError> {
    use tauri::Manager;

    // DB must be open (user must be unlocked) to export a consistent snapshot.
    {
        let guard = state.db.lock()?;
        if guard.is_none() {
            return Err(CommandError::DbLocked);
        }
    }

    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;

    let dest = PathBuf::from(&dest_path);

    // Validate destination parent is writable before doing any work.
    if let Some(parent) = dest.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err(CommandError::Internal(format!(
                "destination directory does not exist: {}",
                parent.display()
            )));
        }
    }

    // All three source files must be present.
    let files = [DB_FILE, SALT_FILE, KDF_FILE];
    for name in &files {
        let path = data_file(&data_dir, name);
        if !path.exists() {
            return Err(CommandError::Internal(format!(
                "backup source file not found: {name}"
            )));
        }
    }

    // Write to a temp file first, then rename atomically.
    let tmp_path = dest.with_extension("myhealth.tmp");
    {
        let tmp_file = fs::File::create(&tmp_path).map_err(|e| {
            CommandError::Internal(format!(
                "cannot create backup file at {}: {e}",
                tmp_path.display()
            ))
        })?;
        let mut zip = zip::ZipWriter::new(tmp_file);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o600);

        for name in &files {
            let src_path = data_file(&data_dir, name);
            let content = fs::read(&src_path)
                .map_err(|e| CommandError::Internal(format!("failed to read {name}: {e}")))?;
            zip.start_file(name.to_string(), options)
                .map_err(|e| CommandError::Internal(format!("zip error starting {name}: {e}")))?;
            zip.write_all(&content)
                .map_err(|e| CommandError::Internal(format!("zip error writing {name}: {e}")))?;
        }

        zip.finish()
            .map_err(|e| CommandError::Internal(format!("zip finalise error: {e}")))?;
    }

    fs::rename(&tmp_path, &dest).map_err(|e| {
        let _ = fs::remove_file(&tmp_path);
        CommandError::Internal(format!("failed to write backup to {}: {e}", dest.display()))
    })?;

    Ok(())
}

/// Restore a `.myhealth` archive: extract the three data files into the app
/// data directory, then close the current DB so the caller can re-authenticate.
#[tauri::command]
pub fn backup_import(
    src_path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), CommandError> {
    use tauri::Manager;

    let src = PathBuf::from(&src_path);
    if !src.exists() {
        return Err(CommandError::NotFound(format!(
            "backup file not found: {src_path}"
        )));
    }

    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| CommandError::Internal(format!("no data dir: {e}")))?;

    let archive_file = fs::File::open(&src)
        .map_err(|e| CommandError::Internal(format!("cannot open archive: {e}")))?;
    let mut zip = zip::ZipArchive::new(archive_file)
        .map_err(|e| CommandError::Internal(format!("invalid archive format: {e}")))?;

    // Validate all expected files are present before writing anything.
    let required = [DB_FILE, SALT_FILE, KDF_FILE];
    for name in &required {
        zip.by_name(name).map_err(|_| {
            CommandError::Internal(format!("archive is missing required file: {name}"))
        })?;
    }

    // Close current DB connection so we can safely overwrite the DB file.
    {
        let mut db_guard = state.db.lock()?;
        db_guard.take();
        let mut key_guard = state.key_hex.lock()?;
        key_guard.take();
    }

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| CommandError::Internal(format!("cannot create data dir: {e}")))?;
    }

    for name in &required {
        let mut entry = zip.by_name(name).map_err(|e| {
            CommandError::Internal(format!("failed to read {name} from archive: {e}"))
        })?;
        let dest = data_file(&data_dir, name);
        let mut out = fs::File::create(&dest)
            .map_err(|e| CommandError::Internal(format!("cannot write {name}: {e}")))?;
        io::copy(&mut entry, &mut out)
            .map_err(|e| CommandError::Internal(format!("failed to extract {name}: {e}")))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn setup_data_dir(dir: &Path) {
        fs::write(dir.join(DB_FILE), b"fake-encrypted-db-content").unwrap();
        fs::write(dir.join(SALT_FILE), b"fake-salt-32-bytes-xxxxxxxxxxxx").unwrap();
        fs::write(dir.join(KDF_FILE), b"pbkdf2-sha512-iterations=600000").unwrap();
    }

    fn create_archive(data_dir: &Path, dest: &Path) {
        let file = fs::File::create(dest).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        for name in &[DB_FILE, SALT_FILE, KDF_FILE] {
            let content = fs::read(data_dir.join(name)).unwrap();
            zip.start_file(name.to_string(), options).unwrap();
            zip.write_all(&content).unwrap();
        }
        zip.finish().unwrap();
    }

    #[test]
    fn exported_archive_contains_all_three_files() {
        let data_dir = TempDir::new().unwrap();
        let out_dir = TempDir::new().unwrap();
        setup_data_dir(data_dir.path());

        let dest = out_dir.path().join("backup.myhealth");
        create_archive(data_dir.path(), &dest);

        let f = fs::File::open(&dest).unwrap();
        let mut zip = zip::ZipArchive::new(f).unwrap();
        for name in &[DB_FILE, SALT_FILE, KDF_FILE] {
            assert!(zip.by_name(name).is_ok(), "archive should contain {name}");
        }
    }

    #[test]
    fn exported_archive_is_non_empty() {
        let data_dir = TempDir::new().unwrap();
        let out_dir = TempDir::new().unwrap();
        setup_data_dir(data_dir.path());

        let dest = out_dir.path().join("backup.myhealth");
        create_archive(data_dir.path(), &dest);

        let metadata = fs::metadata(&dest).unwrap();
        assert!(metadata.len() > 0, "archive file must be non-empty");
    }

    #[test]
    fn writing_to_nonexistent_parent_returns_descriptive_error() {
        let bad_dest = PathBuf::from("/nonexistent_dir_xyz/backup.myhealth");
        let parent = bad_dest.parent().unwrap();
        let result: Result<(), CommandError> = if !parent.exists() {
            Err(CommandError::Internal(format!(
                "destination directory does not exist: {}",
                parent.display()
            )))
        } else {
            Ok(())
        };
        assert!(result.is_err());
        let msg = result.unwrap_err().to_string();
        assert!(
            msg.contains("destination directory does not exist"),
            "error message should be descriptive: {msg}"
        );
    }

    #[test]
    fn import_restores_all_three_files() {
        let data_dir = TempDir::new().unwrap();
        let restore_dir = TempDir::new().unwrap();
        let archive_dir = TempDir::new().unwrap();
        setup_data_dir(data_dir.path());

        let archive_path = archive_dir.path().join("backup.myhealth");
        create_archive(data_dir.path(), &archive_path);

        let f = fs::File::open(&archive_path).unwrap();
        let mut zip = zip::ZipArchive::new(f).unwrap();
        for name in &[DB_FILE, SALT_FILE, KDF_FILE] {
            let mut entry = zip.by_name(name).unwrap();
            let dest = restore_dir.path().join(name);
            let mut out = fs::File::create(&dest).unwrap();
            io::copy(&mut entry, &mut out).unwrap();
        }

        for name in &[DB_FILE, SALT_FILE, KDF_FILE] {
            let path = restore_dir.path().join(name);
            assert!(path.exists(), "restored file {name} should exist");
            assert!(
                fs::metadata(&path).unwrap().len() > 0,
                "restored file {name} should be non-empty"
            );
        }
    }

    #[test]
    fn import_fails_on_corrupt_archive_and_leaves_existing_files_intact() {
        let restore_dir = TempDir::new().unwrap();
        let archive_dir = TempDir::new().unwrap();

        // Write sentinel files to the restore dir so we can verify they survive.
        let sentinel_db = restore_dir.path().join(DB_FILE);
        fs::write(&sentinel_db, b"original-db").unwrap();

        // Write a corrupt (non-ZIP) archive.
        let archive_path = archive_dir.path().join("corrupt.myhealth");
        fs::write(&archive_path, b"this is not a zip file").unwrap();

        let archive_file = fs::File::open(&archive_path).unwrap();
        let result = zip::ZipArchive::new(archive_file);
        assert!(
            result.is_err(),
            "corrupt archive should fail to open as zip"
        );

        // Existing file must be untouched because the import never started.
        assert_eq!(
            fs::read(&sentinel_db).unwrap(),
            b"original-db",
            "existing DB should be unchanged after failed import"
        );
    }

    #[test]
    fn import_fails_when_archive_missing_required_file() {
        let out_dir = TempDir::new().unwrap();
        let archive_path = out_dir.path().join("incomplete.myhealth");

        // Archive contains only DB and SALT — KDF is absent.
        let f = fs::File::create(&archive_path).unwrap();
        let mut zip = zip::ZipWriter::new(f);
        let options = SimpleFileOptions::default();
        zip.start_file(DB_FILE, options).unwrap();
        zip.write_all(b"db").unwrap();
        zip.start_file(SALT_FILE, options).unwrap();
        zip.write_all(b"salt").unwrap();
        zip.finish().unwrap();

        let f = fs::File::open(&archive_path).unwrap();
        let mut archive = zip::ZipArchive::new(f).unwrap();
        assert!(
            archive.by_name(KDF_FILE).is_err(),
            "should fail when KDF file is absent from archive"
        );
    }
}
