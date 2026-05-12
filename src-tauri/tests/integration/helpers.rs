use app_lib::db;
use rusqlite::Connection;
use std::path::PathBuf;

pub const TEST_KEY: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

pub struct TempDb {
    pub conn: Connection,
    pub path: PathBuf,
}

impl TempDb {
    pub fn new() -> Self {
        let path =
            std::env::temp_dir().join(format!("myhealth_integration_{}.db", unique_suffix()));
        let conn = db::open_db(path.to_str().unwrap(), TEST_KEY).expect("open_db failed in test");
        Self { conn, path }
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn unique_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    format!("{:x}{:x}", std::process::id(), ns)
}
