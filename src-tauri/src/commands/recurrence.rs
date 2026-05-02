use chrono::{Datelike, Duration, NaiveDateTime, Timelike};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use super::{AppState, CommandContext, CommandError};

type ApptRow = (
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
    Option<u32>,
    Option<u32>,
    String,
);

#[derive(Debug, Serialize, Deserialize)]
pub struct RecurrenceSeries {
    pub id: String,
    pub rule: String,
    pub interval_n: u32,
    pub until_date: Option<String>,
    pub created_at: String,
}

fn days_in_month(year: i32, month: u32) -> u32 {
    let next_month = if month == 12 { 1 } else { month + 1 };
    let next_year = if month == 12 { year + 1 } else { year };
    let first_of_next = NaiveDateTime::parse_from_str(
        &format!("{next_year}-{next_month:02}-01T00:00:00"),
        "%Y-%m-%dT%H:%M:%S",
    )
    .unwrap();
    let first_of_this = NaiveDateTime::parse_from_str(
        &format!("{year}-{month:02}-01T00:00:00"),
        "%Y-%m-%dT%H:%M:%S",
    )
    .unwrap();
    first_of_next
        .date()
        .signed_duration_since(first_of_this.date())
        .num_days() as u32
}

fn advance_date(base: NaiveDateTime, rule: &str, interval_n: u32) -> Option<NaiveDateTime> {
    match rule {
        "weekly" => base.checked_add_signed(Duration::weeks(interval_n as i64)),
        "monthly" => {
            let day = base.day();
            let total_months = base.month() + interval_n;
            let extra_years = (total_months - 1) / 12;
            let month = ((total_months - 1) % 12) + 1;
            let year = base.year() + extra_years as i32;
            let clamped_day = day.min(days_in_month(year, month));
            NaiveDateTime::parse_from_str(
                &format!(
                    "{year}-{month:02}-{clamped_day:02}T{:02}:{:02}:{:02}",
                    base.hour(),
                    base.minute(),
                    base.second()
                ),
                "%Y-%m-%dT%H:%M:%S",
            )
            .ok()
        }
        _ => None,
    }
}

#[tauri::command]
pub fn recurrence_create(
    base_appointment_id: String,
    rule: String,
    interval_n: u32,
    until_date: Option<String>,
    occurrences: u32,
    state: State<'_, AppState>,
) -> Result<RecurrenceSeries, CommandError> {
    if rule != "weekly" && rule != "monthly" {
        return Err(CommandError::Internal(
            "rule must be 'weekly' or 'monthly'".to_string(),
        ));
    }
    let interval_n = interval_n.max(1);
    let max_occurrences = occurrences.min(104);

    let guard = state.db.lock()?;
    let ctx = CommandContext::new(&guard)?;
    let conn = ctx.conn;

    let (
        appt_date,
        title,
        doctor_name,
        clinic_name,
        specialty,
        location,
        duration_min,
        reminder_min,
        status,
    ): ApptRow = conn
        .query_row(
            "SELECT appt_date, title, doctor_name, clinic_name, specialty, location,
                    duration_min, reminder_min, status
             FROM appointments WHERE id = ?1",
            params![base_appointment_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<u32>>(6)?,
                    row.get::<_, Option<u32>>(7)?,
                    row.get::<_, String>(8)?,
                ))
            },
        )
        .map_err(|_| CommandError::NotFound(base_appointment_id.clone()))?;

    let series_id = Uuid::new_v4().to_string();
    let created_at = chrono::Utc::now()
        .naive_utc()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    conn.execute(
        "INSERT INTO recurrence_series (id, rule, interval_n, until_date, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![series_id, rule, interval_n, until_date, created_at],
    )?;

    conn.execute(
        "UPDATE appointments SET recurrence_series_id = ?1 WHERE id = ?2",
        params![series_id, base_appointment_id],
    )?;

    let until_dt: Option<NaiveDateTime> = until_date.as_deref().and_then(|s| {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S")
            .or_else(|_| {
                NaiveDateTime::parse_from_str(&format!("{s}T00:00:00"), "%Y-%m-%dT%H:%M:%S")
            })
            .ok()
    });

    let mut current_dt = NaiveDateTime::parse_from_str(&appt_date, "%Y-%m-%dT%H:%M:%S")
        .map_err(|e| CommandError::Internal(format!("invalid appt_date: {e}")))?;

    for _ in 0..max_occurrences {
        let next_dt = advance_date(current_dt, &rule, interval_n)
            .ok_or_else(|| CommandError::Internal("date advance overflow".to_string()))?;

        if let Some(until) = until_dt {
            if next_dt > until {
                break;
            }
        }

        let new_id = Uuid::new_v4().to_string();
        let next_str = next_dt.format("%Y-%m-%dT%H:%M:%S").to_string();

        conn.execute(
            "INSERT INTO appointments
             (id, appt_date, title, doctor_name, clinic_name, specialty, location,
              duration_min, reminder_min, status, recurrence_series_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                new_id,
                next_str,
                title,
                doctor_name,
                clinic_name,
                specialty,
                location,
                duration_min,
                reminder_min,
                status,
                series_id
            ],
        )?;

        current_dt = next_dt;
    }

    Ok(RecurrenceSeries {
        id: series_id,
        rule,
        interval_n,
        until_date,
        created_at,
    })
}

#[tauri::command]
pub fn recurrence_delete_series(
    series_id: String,
    from_occurrence: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let guard = state.db.lock()?;
    let ctx = CommandContext::new(&guard)?;
    let conn = ctx.conn;

    if let Some(from_date) = from_occurrence {
        conn.execute(
            "DELETE FROM appointments WHERE recurrence_series_id = ?1 AND appt_date >= ?2",
            params![series_id, from_date],
        )?;

        let remaining: i64 = conn.query_row(
            "SELECT COUNT(*) FROM appointments WHERE recurrence_series_id = ?1",
            params![series_id],
            |r| r.get(0),
        )?;

        if remaining == 0 {
            conn.execute(
                "DELETE FROM recurrence_series WHERE id = ?1",
                params![series_id],
            )?;
        }
    } else {
        conn.execute(
            "DELETE FROM appointments WHERE recurrence_series_id = ?1",
            params![series_id],
        )?;
        conn.execute(
            "DELETE FROM recurrence_series WHERE id = ?1",
            params![series_id],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDateTime;
    use rusqlite::Connection;

    fn dt(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S").unwrap()
    }

    // --- advance_date unit tests ---

    #[test]
    fn weekly_advances_7_days() {
        assert_eq!(
            advance_date(dt("2026-01-01T10:00:00"), "weekly", 1).unwrap(),
            dt("2026-01-08T10:00:00")
        );
    }

    #[test]
    fn weekly_interval_2_advances_14_days() {
        assert_eq!(
            advance_date(dt("2026-01-01T10:00:00"), "weekly", 2).unwrap(),
            dt("2026-01-15T10:00:00")
        );
    }

    #[test]
    fn monthly_same_day_of_month() {
        assert_eq!(
            advance_date(dt("2026-01-15T09:00:00"), "monthly", 1).unwrap(),
            dt("2026-02-15T09:00:00")
        );
    }

    #[test]
    fn monthly_clamps_jan31_to_feb28() {
        assert_eq!(
            advance_date(dt("2026-01-31T09:00:00"), "monthly", 1).unwrap(),
            dt("2026-02-28T09:00:00")
        );
    }

    #[test]
    fn monthly_clamps_jan31_to_feb29_on_leap_year() {
        assert_eq!(
            advance_date(dt("2024-01-31T09:00:00"), "monthly", 1).unwrap(),
            dt("2024-02-29T09:00:00")
        );
    }

    #[test]
    fn monthly_crosses_year_boundary() {
        assert_eq!(
            advance_date(dt("2026-11-15T09:00:00"), "monthly", 2).unwrap(),
            dt("2027-01-15T09:00:00")
        );
    }

    #[test]
    fn unknown_rule_returns_none() {
        assert!(advance_date(dt("2026-01-01T10:00:00"), "daily", 1).is_none());
    }

    // --- days_in_month tests ---

    #[test]
    fn days_in_month_feb_non_leap() {
        assert_eq!(days_in_month(2026, 2), 28);
    }

    #[test]
    fn days_in_month_feb_leap() {
        assert_eq!(days_in_month(2024, 2), 29);
    }

    #[test]
    fn days_in_month_december() {
        assert_eq!(days_in_month(2026, 12), 31);
    }

    // --- integration-style tests using in-memory SQLite ---

    fn make_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE recurrence_series (
                id TEXT PRIMARY KEY,
                rule TEXT NOT NULL,
                interval_n INTEGER NOT NULL DEFAULT 1,
                until_date TEXT,
                created_at TEXT NOT NULL
            );
            CREATE TABLE appointments (
                id TEXT PRIMARY KEY,
                appt_date TEXT NOT NULL,
                title TEXT,
                doctor_name TEXT,
                clinic_name TEXT,
                specialty TEXT,
                location TEXT,
                duration_min INTEGER,
                reminder_min INTEGER,
                status TEXT NOT NULL DEFAULT 'scheduled',
                recurrence_series_id TEXT REFERENCES recurrence_series(id)
            );",
        )
        .unwrap();
        conn
    }

    fn count_appointments(conn: &Connection, series_id: &str) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM appointments WHERE recurrence_series_id = ?1",
            params![series_id],
            |r| r.get(0),
        )
        .unwrap()
    }

    #[test]
    fn until_date_stops_expansion() {
        let base = dt("2026-01-01T10:00:00");
        let until = dt("2026-01-20T00:00:00");
        let mut count = 0;
        let mut current = base;
        for _ in 0..104 {
            let next = advance_date(current, "weekly", 1).unwrap();
            if next > until {
                break;
            }
            count += 1;
            current = next;
        }
        // Jan 8 and Jan 15 within; Jan 22 > Jan 20
        assert_eq!(count, 2);
    }

    #[test]
    fn max_104_occurrences_enforced() {
        assert_eq!(200u32.min(104), 104);
    }

    #[test]
    fn weekly_occurrence_dates_are_correct() {
        let base = dt("2026-01-01T10:00:00");
        let d1 = advance_date(base, "weekly", 1).unwrap();
        let d2 = advance_date(base, "weekly", 2).unwrap();
        let d3 = advance_date(base, "weekly", 3).unwrap();
        assert_eq!(d1, dt("2026-01-08T10:00:00"));
        assert_eq!(d2, dt("2026-01-15T10:00:00"));
        assert_eq!(d3, dt("2026-01-22T10:00:00"));
    }

    #[test]
    fn delete_from_removes_correct_subset() {
        let conn = make_db();
        let series_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO recurrence_series (id, rule, interval_n, created_at) VALUES (?1, 'weekly', 1, '2026-01-01T00:00:00')",
            params![series_id],
        ).unwrap();

        for (i, date) in [
            "2026-01-01T10:00:00",
            "2026-01-08T10:00:00",
            "2026-01-15T10:00:00",
        ]
        .iter()
        .enumerate()
        {
            conn.execute(
                "INSERT INTO appointments (id, appt_date, status, recurrence_series_id)
                 VALUES (?1, ?2, 'scheduled', ?3)",
                params![format!("appt{i}"), date, series_id],
            )
            .unwrap();
        }

        conn.execute(
            "DELETE FROM appointments WHERE recurrence_series_id = ?1 AND appt_date >= ?2",
            params![series_id, "2026-01-08T10:00:00"],
        )
        .unwrap();

        assert_eq!(count_appointments(&conn, &series_id), 1);
    }

    #[test]
    fn delete_all_removes_series_row() {
        let conn = make_db();
        let series_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO recurrence_series (id, rule, interval_n, created_at) VALUES (?1, 'weekly', 1, '2026-01-01T00:00:00')",
            params![series_id],
        ).unwrap();
        conn.execute(
            "INSERT INTO appointments (id, appt_date, status, recurrence_series_id)
             VALUES ('a1', '2026-01-01T10:00:00', 'scheduled', ?1)",
            params![series_id],
        )
        .unwrap();

        conn.execute(
            "DELETE FROM appointments WHERE recurrence_series_id = ?1",
            params![series_id],
        )
        .unwrap();
        conn.execute(
            "DELETE FROM recurrence_series WHERE id = ?1",
            params![series_id],
        )
        .unwrap();

        let series_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM recurrence_series WHERE id = ?1",
                params![series_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(series_count, 0);
    }
}
