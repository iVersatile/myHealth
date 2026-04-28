use serde::{Deserialize, Serialize};

use super::{AppState, CommandContext, CommandError};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatsSummary {
    pub total_documents: i64,
    pub total_notes: i64,
    pub upcoming_appointments: i64,
}

#[tauri::command]
pub fn stats_summary(state: tauri::State<'_, AppState>) -> Result<StatsSummary, CommandError> {
    let guard = state.db.lock()?;
    let conn = CommandContext::new(&guard)?.conn;

    let total_documents: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM documents WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|e| CommandError::Internal(format!("failed to count documents: {e}")))?;

    let total_notes: i64 = conn
        .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
        .map_err(|e| CommandError::Internal(format!("failed to count notes: {e}")))?;

    let upcoming_appointments: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM appointments WHERE status = 'scheduled' AND appt_date >= date('now')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| CommandError::Internal(format!("failed to count upcoming appointments: {e}")))?;

    Ok(StatsSummary {
        total_documents,
        total_notes,
        upcoming_appointments,
    })
}
