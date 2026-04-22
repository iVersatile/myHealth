// macOS EventKit calendar integration
// On non-macOS builds: stubs that return errors.

#[cfg(target_os = "macos")]
mod macos;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarSource {
    pub external_id: String,
    pub name: String,
    pub color_hex: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub external_id: String,
    pub calendar_id: String, // references calendar_sources.id
    pub title: String,
    pub start_at: String, // RFC3339
    pub end_at: Option<String>,
    pub location: Option<String>,
    pub notes: Option<String>,
}

/// List available macOS calendars.
pub fn list_calendars() -> Result<Vec<CalendarSource>, String> {
    #[cfg(target_os = "macos")]
    {
        macos::list_calendars()
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Calendar sync is only supported on macOS".to_string())
    }
}

/// Fetch events from specified calendars (by external_id).
/// Window: 1 year back, 2 years forward from now.
pub fn fetch_events(calendar_external_ids: &[String]) -> Result<Vec<CalendarEvent>, String> {
    #[cfg(target_os = "macos")]
    {
        macos::fetch_events(calendar_external_ids)
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = calendar_external_ids;
        Err("Calendar sync is only supported on macOS".to_string())
    }
}

#[cfg(test)]
#[cfg(not(target_os = "macos"))]
mod tests {
    use super::{fetch_events, list_calendars};

    #[test]
    fn list_calendars_returns_error_on_non_macos() {
        let result = list_calendars();
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Calendar sync is only supported on macOS"));
    }

    #[test]
    fn fetch_events_returns_error_on_non_macos() {
        let result = fetch_events(&["cal-1".to_string()]);
        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Calendar sync is only supported on macOS"));
    }
}
