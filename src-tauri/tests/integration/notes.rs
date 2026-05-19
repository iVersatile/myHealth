use super::helpers::TempDb;
use rusqlite::params;

fn month_num(mon: &str) -> Option<&'static str> {
    match mon {
        "Jan" => Some("01"),
        "Feb" => Some("02"),
        "Mar" => Some("03"),
        "Apr" => Some("04"),
        "May" => Some("05"),
        "Jun" => Some("06"),
        "Jul" => Some("07"),
        "Aug" => Some("08"),
        "Sep" => Some("09"),
        "Oct" => Some("10"),
        "Nov" => Some("11"),
        "Dec" => Some("12"),
        _ => None,
    }
}

fn parse_note_date(title: &str) -> Option<String> {
    if !title.starts_with('[') {
        return None;
    }
    let close = title.find(']')?;
    let inner = &title[1..close];
    let p: Vec<&str> = inner.splitn(3, ' ').collect();
    if p.len() == 3 {
        return Some(format!("{}-{}-{:0>2}", p[2], month_num(p[1])?, p[0]));
    }
    None
}

fn insert_note(conn: &rusqlite::Connection, id: &str, title: &str, created_at: &str) {
    let note_date = parse_note_date(title);
    conn.execute(
        "INSERT INTO notes (id, title, content, is_pinned, created_at, updated_at, note_date) \
         VALUES (?1, ?2, '', 0, ?3, ?3, ?4)",
        params![id, title, created_at, note_date],
    )
    .unwrap();
}

#[test]
fn notes_list_sorts_by_note_date_not_updated_at() {
    let db = TempDb::new();

    insert_note(&db.conn, "a", "[01 Jan 2023] A", "2026-05-01T00:00:00Z");
    insert_note(&db.conn, "b", "[15 Jun 2022] B", "2026-05-02T00:00:00Z");
    insert_note(&db.conn, "c", "[30 Dec 2023] C", "2026-05-03T00:00:00Z");

    // Re-save "a" — updated_at becomes newest but note_date must govern sort
    db.conn
        .execute(
            "UPDATE notes SET updated_at = '2026-05-10T00:00:00Z' WHERE id = 'a'",
            [],
        )
        .unwrap();

    let mut stmt = db
        .conn
        .prepare(
            "SELECT id FROM notes WHERE is_deleted = 0 \
             ORDER BY is_pinned DESC, note_date DESC NULLS LAST, created_at DESC",
        )
        .unwrap();

    let ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(ids, vec!["c", "a", "b"]);
}
