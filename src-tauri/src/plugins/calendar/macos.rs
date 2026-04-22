// macOS EventKit integration via objc2-event-kit
// Requires macOS 10.15+
// This is a placeholder implementation for the MVP.
// Real EventKit calls require async permission handling and will be added
// in a follow-up iteration with Tauri Swift bridge support.

#![allow(dead_code)]

use super::{CalendarEvent, CalendarSource};

/// Placeholder: list available calendars from EventKit.
/// The real implementation will call EKEventStore.requestAccess(to:) and enumerate calendars.
pub fn list_calendars() -> Result<Vec<CalendarSource>, String> {
    // Stub: EventKit requires async permission request on real devices.
    // For MVP, return a single placeholder calendar to prove IPC works.
    // TODO: wire real EventKit calls when Tauri Swift bridge is available.
    Ok(vec![CalendarSource {
        external_id: "placeholder-cal-1".to_string(),
        name: "Calendar (macOS placeholder)".to_string(),
        color_hex: Some("#FF3B30".to_string()),
    }])
}

/// Placeholder: fetch events from specified calendars.
/// Real implementation will call EKEventStore and apply date window filtering.
pub fn fetch_events(_calendar_external_ids: &[String]) -> Result<Vec<CalendarEvent>, String> {
    // Placeholder — returns empty; real EventKit calls added in Phase 18.2 follow-up.
    Ok(vec![])
}
