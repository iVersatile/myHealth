use rusqlite::{Connection, Result};

pub mod migrations;

pub fn open_db(path: &str, key: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;

    // Key must be set before any other DB operation.
    // key is expected to be a hex-encoded PBKDF2 output (chars: [0-9a-f]).
    conn.execute_batch(&format!(
        "PRAGMA key = '{key}';
         PRAGMA cipher_page_size = 4096;
         PRAGMA kdf_iter = 64000;
         PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
         PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;
         PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;"
    ))?;

    migrations::run(&conn)?;

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn open_close_roundtrip() {
        let tmp = std::env::temp_dir().join("myhealth_test_roundtrip.db");
        let _ = fs::remove_file(&tmp);
        let key = "testhex0000000000000000000000000000000000000000000000000000000001";

        {
            let conn = open_db(tmp.to_str().unwrap(), key).unwrap();
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)",
                rusqlite::params!["ping", "pong"],
            )
            .unwrap();
        }

        {
            let conn = open_db(tmp.to_str().unwrap(), key).unwrap();
            let val: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = ?1",
                    rusqlite::params!["ping"],
                    |row| row.get(0),
                )
                .unwrap();
            assert_eq!(val, "pong");
        }

        let _ = fs::remove_file(&tmp);
    }
}
