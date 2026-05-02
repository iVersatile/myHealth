// macOS EventKit integration via objc + block crates.
// Requires macOS 10.15+. Gated by cfg(target_os = "macos").

use std::sync::{Arc, Condvar, Mutex};

use block::ConcreteBlock;
use objc::runtime::Object;
use objc::{class, msg_send, sel, sel_impl};

use super::{CalendarEvent, CalendarSource};

const EK_ENTITY_TYPE_EVENT: u64 = 0;
const EK_AUTHORIZATION_STATUS_AUTHORIZED: i64 = 3;
// NSDate reference date is 2001-01-01 00:00:00 UTC; Unix epoch is 1970-01-01.
const NSDATE_EPOCH_OFFSET: f64 = 978_307_200.0;

#[link(name = "EventKit", kind = "framework")]
extern "C" {}

/// Request calendar access. Blocks until the OS permission dialog is resolved.
pub fn request_permission() -> Result<bool, String> {
    let store: *mut Object = unsafe { msg_send![class!(EKEventStore), new] };
    if store.is_null() {
        return Err("failed to create EKEventStore".to_string());
    }

    let pair = Arc::new((Mutex::new(None::<bool>), Condvar::new()));
    let pair_cb = Arc::clone(&pair);

    let block = ConcreteBlock::new(move |granted: bool, _err: *mut Object| {
        let (lock, cvar) = &*pair_cb;
        let mut result = lock.lock().unwrap();
        *result = Some(granted);
        cvar.notify_one();
    });
    let block = block.copy();

    unsafe {
        let _: () = msg_send![store, requestAccessToEntityType: EK_ENTITY_TYPE_EVENT
                                     completion: &*block];
    }

    let (lock, cvar) = &*pair;
    let mut result = lock.lock().unwrap();
    while result.is_none() {
        result = cvar.wait(result).unwrap();
    }

    Ok(result.unwrap())
}

fn is_authorized() -> bool {
    let status: i64 = unsafe {
        msg_send![class!(EKEventStore), authorizationStatusForEntityType: EK_ENTITY_TYPE_EVENT]
    };
    status == EK_AUTHORIZATION_STATUS_AUTHORIZED
}

fn nsstring_to_string(nsstr: *mut Object) -> Option<String> {
    if nsstr.is_null() {
        return None;
    }
    let cstr: *const std::os::raw::c_char = unsafe { msg_send![nsstr, UTF8String] };
    if cstr.is_null() {
        return None;
    }
    // SAFETY: cstr is a valid null-terminated C string whose lifetime is tied to the
    // NSString object which is retained by the current autorelease pool for this call.
    let s = unsafe { std::ffi::CStr::from_ptr(cstr) }
        .to_string_lossy()
        .into_owned();
    Some(s)
}

fn nsdate_to_rfc3339(nsdate: *mut Object) -> Option<String> {
    if nsdate.is_null() {
        return None;
    }
    let ti: f64 = unsafe { msg_send![nsdate, timeIntervalSinceReferenceDate] };
    let unix_secs = (ti + NSDATE_EPOCH_OFFSET) as i64;
    chrono::TimeZone::timestamp_opt(&chrono::Utc, unix_secs, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
}

fn nscolor_to_hex(color: *mut Object) -> Option<String> {
    if color.is_null() {
        return None;
    }
    let r: f64 = unsafe { msg_send![color, redComponent] };
    let g: f64 = unsafe { msg_send![color, greenComponent] };
    let b: f64 = unsafe { msg_send![color, blueComponent] };
    Some(format!(
        "#{:02X}{:02X}{:02X}",
        (r * 255.0) as u8,
        (g * 255.0) as u8,
        (b * 255.0) as u8
    ))
}

/// List available calendars from EventKit.
pub fn list_calendars() -> Result<Vec<CalendarSource>, String> {
    if !is_authorized() {
        return Err("Calendar access not authorized".to_string());
    }

    let store: *mut Object = unsafe { msg_send![class!(EKEventStore), new] };
    if store.is_null() {
        return Err("failed to create EKEventStore".to_string());
    }

    let entity_type: u64 = EK_ENTITY_TYPE_EVENT;
    let calendars: *mut Object = unsafe { msg_send![store, calendarsForEntityType: entity_type] };
    if calendars.is_null() {
        return Ok(vec![]);
    }

    let count: usize = unsafe { msg_send![calendars, count] };
    let mut result = Vec::with_capacity(count);

    for i in 0..count {
        let cal: *mut Object = unsafe { msg_send![calendars, objectAtIndex: i] };
        if cal.is_null() {
            continue;
        }
        let cal_id: *mut Object = unsafe { msg_send![cal, calendarIdentifier] };
        let title: *mut Object = unsafe { msg_send![cal, title] };
        let color: *mut Object = unsafe { msg_send![cal, color] };

        if let Some(external_id) = nsstring_to_string(cal_id) {
            result.push(CalendarSource {
                external_id,
                name: nsstring_to_string(title).unwrap_or_else(|| "Untitled".to_string()),
                color_hex: nscolor_to_hex(color),
            });
        }
    }

    Ok(result)
}

/// Fetch events from specified calendars. Window: 1 year back, 2 years forward.
pub fn fetch_events(calendar_external_ids: &[String]) -> Result<Vec<CalendarEvent>, String> {
    if calendar_external_ids.is_empty() {
        return Ok(vec![]);
    }
    if !is_authorized() {
        return Err("Calendar access not authorized".to_string());
    }

    let store: *mut Object = unsafe { msg_send![class!(EKEventStore), new] };
    if store.is_null() {
        return Err("failed to create EKEventStore".to_string());
    }

    // Collect matching EKCalendar pointers by external_id
    let entity_type: u64 = EK_ENTITY_TYPE_EVENT;
    let all_cals: *mut Object = unsafe { msg_send![store, calendarsForEntityType: entity_type] };
    let cal_count: usize = if all_cals.is_null() {
        0
    } else {
        unsafe { msg_send![all_cals, count] }
    };

    let mut matched_cals: Vec<*mut Object> = Vec::new();
    for i in 0..cal_count {
        let cal: *mut Object = unsafe { msg_send![all_cals, objectAtIndex: i] };
        let cal_id_obj: *mut Object = unsafe { msg_send![cal, calendarIdentifier] };
        if let Some(id_str) = nsstring_to_string(cal_id_obj) {
            if calendar_external_ids.contains(&id_str) {
                matched_cals.push(cal);
            }
        }
    }
    if matched_cals.is_empty() {
        return Ok(vec![]);
    }

    // Build NSMutableArray of matched EKCalendar objects
    let ns_array: *mut Object = unsafe {
        let mutable: *mut Object =
            msg_send![class!(NSMutableArray), arrayWithCapacity: matched_cals.len()];
        for cal_ptr in &matched_cals {
            let _: () = msg_send![mutable, addObject: *cal_ptr];
        }
        mutable
    };

    // Date range: 1 year back, 2 years forward from now
    let now_epoch = chrono::Utc::now().timestamp() as f64;
    let start_ti = now_epoch - NSDATE_EPOCH_OFFSET - 365.0 * 86400.0;
    let end_ti = now_epoch - NSDATE_EPOCH_OFFSET + 2.0 * 365.0 * 86400.0;

    let start_date: *mut Object =
        unsafe { msg_send![class!(NSDate), dateWithTimeIntervalSinceReferenceDate: start_ti] };
    let end_date: *mut Object =
        unsafe { msg_send![class!(NSDate), dateWithTimeIntervalSinceReferenceDate: end_ti] };

    let predicate: *mut Object = unsafe {
        msg_send![store, predicateForEventsWithStartDate: start_date
                         endDate: end_date
                         calendars: ns_array]
    };

    let events: *mut Object = unsafe { msg_send![store, eventsMatchingPredicate: predicate] };
    if events.is_null() {
        return Ok(vec![]);
    }

    let count: usize = unsafe { msg_send![events, count] };
    let mut result = Vec::with_capacity(count);

    for i in 0..count {
        let ev: *mut Object = unsafe { msg_send![events, objectAtIndex: i] };
        let ek_id: *mut Object = unsafe { msg_send![ev, eventIdentifier] };
        let cal_obj: *mut Object = unsafe { msg_send![ev, calendar] };
        let cal_id_obj: *mut Object = unsafe { msg_send![cal_obj, calendarIdentifier] };
        let title_obj: *mut Object = unsafe { msg_send![ev, title] };
        let start_obj: *mut Object = unsafe { msg_send![ev, startDate] };
        let end_obj: *mut Object = unsafe { msg_send![ev, endDate] };
        let loc_obj: *mut Object = unsafe { msg_send![ev, location] };
        let notes_obj: *mut Object = unsafe { msg_send![ev, notes] };

        let Some(external_id) = nsstring_to_string(ek_id) else {
            continue;
        };
        let Some(calendar_id) = nsstring_to_string(cal_id_obj) else {
            continue;
        };
        let Some(start_at) = nsdate_to_rfc3339(start_obj) else {
            continue;
        };

        result.push(CalendarEvent {
            external_id,
            calendar_id,
            title: nsstring_to_string(title_obj).unwrap_or_else(|| "Untitled".to_string()),
            start_at,
            end_at: nsdate_to_rfc3339(end_obj),
            location: nsstring_to_string(loc_obj),
            notes: nsstring_to_string(notes_obj),
        });
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nscolor_hex_format() {
        let hex = format!("#{:02X}{:02X}{:02X}", 255u8, 0u8, 0u8);
        assert_eq!(hex, "#FF0000");
    }

    #[test]
    fn nsdate_epoch_offset_matches_2001_01_01() {
        // 2001-01-01 00:00:00 UTC in Unix seconds
        assert_eq!(NSDATE_EPOCH_OFFSET as i64, 978_307_200);
    }

    #[test]
    fn nsdate_zero_reference_date_is_2001() {
        let unix_secs = (0.0_f64 + NSDATE_EPOCH_OFFSET) as i64;
        let dt = chrono::TimeZone::timestamp_opt(&chrono::Utc, unix_secs, 0)
            .single()
            .unwrap();
        assert!(dt.to_rfc3339().starts_with("2001-01-01"));
    }

    // ── Apple Calendar smoke tests (G-02) ─────────────────────────────────────

    #[test]
    fn fetch_events_returns_empty_for_no_calendar_ids() {
        // Returns Ok(vec![]) immediately when id list is empty — no EventKit call,
        // no permission required. Safe to run in any environment.
        let result = fetch_events(&[]);
        assert!(result.is_ok(), "expected Ok but got: {result:?}");
        assert!(result.unwrap().is_empty());
    }

    #[test]
    fn list_calendars_returns_err_when_not_authorized() {
        // In CI / sandboxed environments EventKit is not authorized.
        // Verify the function returns a meaningful Err rather than panicking.
        if !is_authorized() {
            let result = list_calendars();
            assert!(result.is_err(), "expected Err when not authorized");
            let msg = result.unwrap_err();
            assert!(
                msg.contains("not authorized"),
                "unexpected error message: {msg}"
            );
        }
        // If the runner is authorized (e.g. developer machine), skip gracefully.
    }
}
