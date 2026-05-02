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

pub(crate) fn conn_fire_due(
    conn: &rusqlite::Connection,
    now: DateTime<Utc>,
    mut notify: impl FnMut(&str, &str),
) -> Result<(), CommandError> {
    let now_str = now.format("%Y-%m-%dT%H:%M:%S").to_string();
    let mut stmt = conn.prepare(
        "SELECT ar.id, a.title, ar.offset_label \
         FROM appointment_reminders ar \
         JOIN appointments a ON a.id = ar.appointment_id \
         WHERE ar.remind_at <= ?1 AND ar.is_fired = 0",
    )?;
    let rows: Vec<(String, String, String)> = stmt
        .query_map(rusqlite::params![now_str], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })?
        .collect::<Result<_, _>>()?;

    for (id, title, label) in rows {
        notify(&title, &label);
        conn.execute(
            "UPDATE appointment_reminders SET is_fired = 1 WHERE id = ?1",
            rusqlite::params![id],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use chrono::{DateTime, Duration, Utc};
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

    fn insert_reminder(conn: &Connection, id: &str, remind_at: &str, is_fired: i32) {
        conn.execute(
            "INSERT INTO appointment_reminders \
             (id, appointment_id, remind_at, offset_label, is_fired, created_at) \
             VALUES (?1, 'appt-1', ?2, '15 minutes before', ?3, '2090-01-01T00:00:00')",
            rusqlite::params![id, remind_at, is_fired],
        )
        .unwrap();
    }

    fn is_fired(conn: &Connection, id: &str) -> i32 {
        conn.query_row(
            "SELECT is_fired FROM appointment_reminders WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .unwrap()
    }

    #[test]
    fn due_reminder_fires_and_marks_fired() {
        let conn = setup();
        insert_reminder(&conn, "rem-1", "2026-01-01T09:00:00", 0);
        let now: DateTime<Utc> = "2026-01-01T10:00:00Z".parse().unwrap();
        let mut fired: Vec<(String, String)> = vec![];
        super::conn_fire_due(&conn, now, |title, label| {
            fired.push((title.to_string(), label.to_string()));
        })
        .unwrap();
        assert_eq!(fired.len(), 1);
        assert_eq!(fired[0].0, "Check-up");
        assert_eq!(fired[0].1, "15 minutes before");
        assert_eq!(is_fired(&conn, "rem-1"), 1);
    }

    #[test]
    fn future_reminder_not_fired() {
        let conn = setup();
        insert_reminder(&conn, "rem-2", "2090-06-01T10:00:00", 0);
        let now: DateTime<Utc> = "2026-01-01T10:00:00Z".parse().unwrap();
        let mut count = 0usize;
        super::conn_fire_due(&conn, now, |_, _| count += 1).unwrap();
        assert_eq!(count, 0);
        assert_eq!(is_fired(&conn, "rem-2"), 0);
    }

    #[test]
    fn already_fired_reminder_not_refired() {
        let conn = setup();
        insert_reminder(&conn, "rem-3", "2026-01-01T09:00:00", 1);
        let now: DateTime<Utc> = "2026-01-01T10:00:00Z".parse().unwrap();
        let mut count = 0usize;
        super::conn_fire_due(&conn, now, |_, _| count += 1).unwrap();
        assert_eq!(count, 0, "already-fired reminder must not fire again");
    }
}
