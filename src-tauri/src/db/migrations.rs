use rusqlite::{Connection, Result};

const SCHEMA: &str = include_str!("schema.sql");
const CURRENT_VERSION: i32 = 1;

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INTEGER PRIMARY KEY,
            applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
    )?;

    let version: i32 = conn.query_row(
        "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
        [],
        |row| row.get(0),
    )?;

    if version < CURRENT_VERSION {
        conn.execute_batch(SCHEMA)?;
        conn.execute(
            "INSERT INTO schema_migrations (version) VALUES (?1)",
            [CURRENT_VERSION],
        )?;
    }

    Ok(())
}
