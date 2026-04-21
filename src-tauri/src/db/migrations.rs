use rusqlite::{Connection, Result};

const SCHEMA_V1: &str = include_str!("schema.sql");
const SCHEMA_V2: &str = include_str!("migrations/v2.sql");
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

    if version < 1 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V1)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [1])?;
        tx.commit()?;
    }

    if version < 2 {
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(SCHEMA_V2)?;
        tx.execute("INSERT INTO schema_migrations (version) VALUES (?1)", [2])?;
        tx.commit()?;
    }

    Ok(())
}
