use rusqlite::OptionalExtension;
use tauri::State;

use super::{AppState, CommandContext, CommandError};
use crate::services::summarizer::summarize;

#[tauri::command]
pub fn summarize_appointment_notes(
    state: State<'_, AppState>,
    _user_id: String,
    appointment_id: String,
) -> Result<Vec<String>, CommandError> {
    let guard = state
        .db
        .lock()
        .map_err(|_| CommandError::Internal("failed to lock db".into()))?;
    let conn = CommandContext::new(&guard)?.conn;

    let notes: Option<String> = conn
        .query_row(
            "SELECT notes FROM appointments WHERE id = ?1",
            rusqlite::params![appointment_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(CommandError::from)?
        .ok_or_else(|| CommandError::NotFound(format!("appointment {appointment_id}")))?;

    match notes {
        None => Ok(vec![]),
        Some(text) if text.trim().is_empty() => Ok(vec![]),
        Some(text) => Ok(summarize(&text, 3)),
    }
}
