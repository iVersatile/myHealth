use chrono::{DateTime, Duration, Utc};
use tauri::State;
use uuid::Uuid;

use super::{AppState, CommandContext, CommandError};

/// Schedules up to 3 reminders (−1d, −1h, −15min) for an appointment.
/// Offsets that have already passed relative to now are skipped.
/// Uses INSERT OR REPLACE so re-scheduling after an edit is safe.
#[tauri::command]
pub fn reminders_schedule(
    appointment_id: String,
    appointment_datetime: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let appt_dt = appointment_datetime
        .parse::<DateTime<Utc>>()
        .map_err(|_| CommandError::Internal(format!("invalid datetime: {appointment_datetime}")))?;

    let guard = state.db.lock()?;
    let ctx = CommandContext::new(&guard)?;
    conn_schedule(ctx.conn, &appointment_id, appt_dt, Utc::now())
}

/// Deletes all reminder rows for the given appointment.
#[tauri::command]
pub fn reminders_cancel(
    appointment_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let ctx = CommandContext::new(&guard)?;
    conn_cancel(ctx.conn, &appointment_id)
}

const OFFSETS: &[(i64, &str)] = &[
    (60 * 24, "1 day before"),
    (60, "1 hour before"),
    (15, "15 minutes before"),
];

pub(crate) fn conn_schedule(
    conn: &rusqlite::Connection,
    appointment_id: &str,
    appt_dt: DateTime<Utc>,
    now: DateTime<Utc>,
) -> Result<(), CommandError> {
    for &(offset_min, label) in OFFSETS {
        let remind_at = appt_dt - Duration::minutes(offset_min);
        if remind_at <= now {
            continue;
        }
        let id = Uuid::new_v4().to_string();
        let remind_at_str = remind_at.format("%Y-%m-%dT%H:%M:%S").to_string();
        let created_at = now.format("%Y-%m-%dT%H:%M:%S").to_string();
        conn.execute(
            "INSERT OR REPLACE INTO appointment_reminders \
             (id, appointment_id, remind_at, offset_label, is_fired, created_at) \
             VALUES (?1, ?2, ?3, ?4, 0, ?5)",
            rusqlite::params![id, appointment_id, remind_at_str, label, created_at],
        )?;
    }
    Ok(())
}

pub(crate) fn conn_cancel(
    conn: &rusqlite::Connection,
    appointment_id: &str,
) -> Result<(), CommandError> {
    conn.execute(
        "DELETE FROM appointment_reminders WHERE appointment_id = ?1",
        rusqlite::params![appointment_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use chrono::{Duration, Utc};
    use rusqlite::Connection;

    use crate::db::migrations;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        migrations::run(&conn).unwrap();
        conn.execute(
            "INSERT INTO users (id, display_name) VALUES ('u1', 'Test')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO appointments (id, title, appt_date, created_at, user_id) \
             VALUES ('appt-1', 'Check-up', '2090-06-01', '2026-01-01', 'u1')",
            [],
        )
        .unwrap();
        conn
    }

    fn count_reminders(conn: &Connection, appt_id: &str) -> i32 {
        conn.query_row(
            "SELECT COUNT(*) FROM appointment_reminders WHERE appointment_id = ?1",
            rusqlite::params![appt_id],
            |row| row.get(0),
        )
        .unwrap()
    }

    #[test]
    fn future_appointment_creates_three_reminders() {
        let conn = setup();
        let appt_dt = "2090-06-01T10:00:00Z".parse().unwrap();
        super::conn_schedule(&conn, "appt-1", appt_dt, Utc::now()).unwrap();
        assert_eq!(count_reminders(&conn, "appt-1"), 3);
    }

    #[test]
    fn past_offsets_are_skipped() {
        // Appointment 30 min from now: only the 15-min offset qualifies
        let conn = setup();
        let appt_dt = Utc::now() + Duration::minutes(30);
        super::conn_schedule(&conn, "appt-1", appt_dt, Utc::now()).unwrap();
        assert_eq!(
            count_reminders(&conn, "appt-1"),
            1,
            "only the 15-min reminder should be created"
        );
    }

    #[test]
    fn cancel_deletes_all_reminders() {
        let conn = setup();
        let appt_dt = "2090-06-01T10:00:00Z".parse().unwrap();
        super::conn_schedule(&conn, "appt-1", appt_dt, Utc::now()).unwrap();
        assert_eq!(count_reminders(&conn, "appt-1"), 3);

        super::conn_cancel(&conn, "appt-1").unwrap();
        assert_eq!(count_reminders(&conn, "appt-1"), 0);
    }

    #[test]
    fn cancel_is_idempotent_when_no_reminders() {
        let conn = setup();
        super::conn_cancel(&conn, "appt-1").unwrap();
        assert_eq!(count_reminders(&conn, "appt-1"), 0);
    }
}
