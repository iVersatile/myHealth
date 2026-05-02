use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::{Duration, Utc};
use rand::Rng;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::State;

use super::{AppState, CommandError};

const CLIENT_ID: &str = "00000000-0000-0000-0000-000000000000";
const REDIRECT_URI: &str = "http://localhost:62749";
const AUTH_BASE: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_BASE: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE: &str = "https://graph.microsoft.com/v1.0";
const SCOPES: &str = "Calendars.Read offline_access";

// ── PKCE helpers ──────────────────────────────────────────────────────────────

pub fn generate_code_verifier() -> String {
    let bytes: Vec<u8> = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(64)
        .collect();
    String::from_utf8(bytes).expect("alphanumeric is valid UTF-8")
}

pub fn compute_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    URL_SAFE_NO_PAD.encode(hash)
}

// ── Response types ────────────────────────────────────────────────────────────

#[derive(Serialize, Debug)]
pub struct AuthUrlResponse {
    pub auth_url: String,
    pub code_verifier: String,
    pub redirect_uri: String,
}

#[derive(Deserialize, Debug)]
pub(crate) struct TokenResponse {
    pub(crate) access_token: String,
    pub(crate) refresh_token: Option<String>,
    #[allow(dead_code)]
    pub(crate) expires_in: u64,
}

#[derive(Deserialize, Debug)]
pub(crate) struct DateTimeTimeZone {
    #[serde(rename = "dateTime")]
    pub(crate) date_time: String,
}

#[derive(Deserialize, Debug, Default)]
pub(crate) struct Location {
    #[serde(rename = "displayName")]
    pub(crate) display_name: String,
}

#[derive(Deserialize, Debug, Default)]
pub(crate) struct Body {
    pub(crate) content: String,
}

#[derive(Deserialize, Debug)]
pub(crate) struct GraphEvent {
    pub(crate) id: String,
    pub(crate) subject: Option<String>,
    pub(crate) start: DateTimeTimeZone,
    #[allow(dead_code)]
    pub(crate) end: DateTimeTimeZone,
    #[serde(default)]
    pub(crate) location: Location,
    #[serde(default)]
    pub(crate) body: Body,
}

#[derive(Deserialize, Debug)]
struct GraphCalendarViewResponse {
    value: Vec<GraphEvent>,
    #[serde(rename = "@odata.nextLink")]
    next_link: Option<String>,
}

// ── Async HTTP helpers (injectable endpoints for testing) ─────────────────────

pub async fn exchange_code_for_tokens(
    code: &str,
    code_verifier: &str,
    redirect_uri: &str,
    token_url: &str,
) -> Result<TokenResponse, CommandError> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    let params = [
        ("client_id", CLIENT_ID),
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", redirect_uri),
        ("code_verifier", code_verifier),
        ("scope", SCOPES),
    ];

    let resp = client
        .post(token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(CommandError::Internal(format!(
            "token exchange failed: {text}"
        )));
    }

    resp.json::<TokenResponse>()
        .await
        .map_err(|e| CommandError::Internal(e.to_string()))
}

pub async fn refresh_access_token(
    refresh_token: &str,
    token_url: &str,
) -> Result<TokenResponse, CommandError> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    let params = [
        ("client_id", CLIENT_ID),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("scope", SCOPES),
    ];

    let resp = client
        .post(token_url)
        .form(&params)
        .send()
        .await
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(CommandError::Internal(format!(
            "token refresh failed: {text}"
        )));
    }

    resp.json::<TokenResponse>()
        .await
        .map_err(|e| CommandError::Internal(e.to_string()))
}

pub async fn fetch_calendar_events(
    access_token: &str,
    start_dt: &str,
    end_dt: &str,
    graph_base: &str,
) -> Result<Vec<GraphEvent>, CommandError> {
    let client = Client::builder()
        .use_rustls_tls()
        .build()
        .map_err(|e| CommandError::Internal(e.to_string()))?;

    let url = format!(
        "{graph_base}/me/calendarView?startDateTime={start_dt}&endDateTime={end_dt}&$select=id,subject,start,end,location,body"
    );

    let mut events: Vec<GraphEvent> = Vec::new();
    let mut next_url: Option<String> = Some(url);

    while let Some(current_url) = next_url {
        let resp = client
            .get(&current_url)
            .bearer_auth(access_token)
            .header("Prefer", "outlook.timezone=\"UTC\"")
            .send()
            .await
            .map_err(|e| CommandError::Internal(e.to_string()))?;

        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(CommandError::Internal(format!(
                "graph calendar fetch failed: {text}"
            )));
        }

        let page: GraphCalendarViewResponse = resp
            .json()
            .await
            .map_err(|e| CommandError::Internal(e.to_string()))?;

        next_url = page.next_link.clone();
        events.extend(page.value);
    }

    Ok(events)
}

// ── DB helper ─────────────────────────────────────────────────────────────────

pub fn upsert_graph_events(
    conn: &rusqlite::Connection,
    events: Vec<GraphEvent>,
    user_id: &str,
) -> Result<usize, CommandError> {
    let mut count = 0usize;
    for ev in events {
        let tag = format!("[outlook:{}]", ev.id);
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM appointments WHERE user_id = ?1 AND notes LIKE ?2",
                rusqlite::params![user_id, format!("{tag}%")],
                |r| r.get::<_, i64>(0),
            )
            .map(|n| n > 0)
            .map_err(|e| CommandError::Internal(e.to_string()))?;

        if exists {
            continue;
        }

        let title = ev.subject.unwrap_or_else(|| "(no subject)".to_string());
        let notes = format!("{tag} {}", ev.body.content.trim());
        let location = ev.location.display_name;

        conn.execute(
            "INSERT INTO appointments \
             (id, user_id, title, date, time, doctor, location, notes, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, '', ?6, ?7, ?8, ?8)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                user_id,
                title,
                &ev.start.date_time[..10],
                &ev.start.date_time[11..16],
                location,
                notes,
                Utc::now().to_rfc3339(),
            ],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;

        count += 1;
    }
    Ok(count)
}

// ── Tauri commands ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn outlook_get_auth_url() -> Result<AuthUrlResponse, CommandError> {
    let code_verifier = generate_code_verifier();
    let code_challenge = compute_code_challenge(&code_verifier);

    let mut url = reqwest::Url::parse(AUTH_BASE).expect("static URL is valid");
    url.query_pairs_mut()
        .append_pair("client_id", CLIENT_ID)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", REDIRECT_URI)
        .append_pair("scope", SCOPES)
        .append_pair("code_challenge", &code_challenge)
        .append_pair("code_challenge_method", "S256");

    Ok(AuthUrlResponse {
        auth_url: url.to_string(),
        code_verifier,
        redirect_uri: REDIRECT_URI.to_string(),
    })
}

#[tauri::command]
pub async fn outlook_exchange_code(
    code: String,
    code_verifier: String,
    redirect_uri: String,
    user_id: String,
    state: State<'_, AppState>,
) -> Result<(), CommandError> {
    let token = exchange_code_for_tokens(&code, &code_verifier, &redirect_uri, TOKEN_BASE).await?;

    let refresh = token
        .refresh_token
        .ok_or_else(|| CommandError::Internal("no refresh_token in response".into()))?;

    let db = state
        .db
        .lock()
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    let conn = db.as_ref().ok_or(CommandError::DbLocked)?;

    let key = format!("outlook_refresh_token_{user_id}");
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) \
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, refresh],
    )
    .map_err(|e| CommandError::Internal(e.to_string()))?;

    Ok(())
}

#[tauri::command]
pub async fn outlook_sync(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<usize, CommandError> {
    // Load refresh token without holding the mutex across await
    let refresh_token = {
        let db = state
            .db
            .lock()
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        let conn = db.as_ref().ok_or(CommandError::DbLocked)?;
        let key = format!("outlook_refresh_token_{user_id}");
        conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            rusqlite::params![key],
            |r| r.get::<_, String>(0),
        )
        .map_err(|_| CommandError::Internal("Outlook not connected".into()))?
    };

    let token = refresh_access_token(&refresh_token, TOKEN_BASE).await?;

    if let Some(new_refresh) = &token.refresh_token {
        let db = state
            .db
            .lock()
            .map_err(|e| CommandError::Internal(e.to_string()))?;
        let conn = db.as_ref().ok_or(CommandError::DbLocked)?;
        let key = format!("outlook_refresh_token_{user_id}");
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) \
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![key, new_refresh],
        )
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    }

    let now = Utc::now();
    let start = (now - Duration::days(90))
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    let end = (now + Duration::days(90))
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    let events = fetch_calendar_events(&token.access_token, &start, &end, GRAPH_BASE).await?;

    let db = state
        .db
        .lock()
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    let conn = db.as_ref().ok_or(CommandError::DbLocked)?;
    upsert_graph_events(conn, events, &user_id)
}

#[tauri::command]
pub fn outlook_is_connected(
    user_id: String,
    state: State<'_, AppState>,
) -> Result<bool, CommandError> {
    let db = state
        .db
        .lock()
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    let conn = db.as_ref().ok_or(CommandError::DbLocked)?;
    let key = format!("outlook_refresh_token_{user_id}");
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) FROM settings WHERE key = ?1",
            rusqlite::params![key],
            |r| r.get::<_, i64>(0),
        )
        .map(|n| n > 0)
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    Ok(exists)
}

#[tauri::command]
pub fn outlook_disconnect(user_id: String, state: State<'_, AppState>) -> Result<(), CommandError> {
    let db = state
        .db
        .lock()
        .map_err(|e| CommandError::Internal(e.to_string()))?;
    let conn = db.as_ref().ok_or(CommandError::DbLocked)?;
    let key = format!("outlook_refresh_token_{user_id}");
    conn.execute(
        "DELETE FROM settings WHERE key = ?1",
        rusqlite::params![key],
    )
    .map_err(|e| CommandError::Internal(e.to_string()))?;
    Ok(())
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use mockito::Server;
    use rusqlite::Connection;

    fn open_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
             CREATE TABLE appointments (
               id TEXT PRIMARY KEY,
               user_id TEXT NOT NULL,
               title TEXT NOT NULL,
               date TEXT NOT NULL,
               time TEXT NOT NULL,
               doctor TEXT NOT NULL DEFAULT '',
               location TEXT NOT NULL DEFAULT '',
               notes TEXT NOT NULL DEFAULT '',
               created_at TEXT NOT NULL,
               updated_at TEXT NOT NULL
             );",
        )
        .unwrap();
        conn
    }

    #[tokio::test]
    async fn exchange_code_returns_token_response() {
        let mut server = Server::new_async().await;
        let mock = server
            .mock("POST", "/token")
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(
                r#"{"access_token":"at123","refresh_token":"rt456","expires_in":3600,"token_type":"Bearer"}"#,
            )
            .create_async()
            .await;

        let token_url = format!("{}/token", server.url());
        let result = exchange_code_for_tokens(
            "code_abc",
            "verifier_xyz",
            "http://localhost:62749",
            &token_url,
        )
        .await
        .unwrap();

        assert_eq!(result.access_token, "at123");
        assert_eq!(result.refresh_token.as_deref(), Some("rt456"));
        mock.assert_async().await;
    }

    #[tokio::test]
    async fn sync_upserts_events_and_deduplicates() {
        let mut server = Server::new_async().await;

        let body = r#"{
            "value": [{
                "id": "event-001",
                "subject": "Doctor Visit",
                "start": {"dateTime": "2026-05-01T09:00:00", "timeZone": "UTC"},
                "end":   {"dateTime": "2026-05-01T10:00:00", "timeZone": "UTC"},
                "location": {"displayName": "Clinic A"},
                "body": {"content": "Annual checkup", "contentType": "text"}
            }]
        }"#;

        let mock = server
            .mock(
                "GET",
                mockito::Matcher::Regex(r"/me/calendarView".to_string()),
            )
            .with_status(200)
            .with_header("content-type", "application/json")
            .with_body(body)
            .expect(2)
            .create_async()
            .await;

        let conn = open_test_db();
        let graph_base = server.url();

        let events = fetch_calendar_events(
            "access_token_fake",
            "2026-02-01T00:00:00",
            "2026-08-01T00:00:00",
            &graph_base,
        )
        .await
        .unwrap();
        let inserted = upsert_graph_events(&conn, events, "user1").unwrap();
        assert_eq!(inserted, 1);

        // Second sync with same data — should deduplicate
        let events2 = fetch_calendar_events(
            "access_token_fake",
            "2026-02-01T00:00:00",
            "2026-08-01T00:00:00",
            &graph_base,
        )
        .await
        .unwrap();
        let inserted2 = upsert_graph_events(&conn, events2, "user1").unwrap();
        assert_eq!(inserted2, 0);

        mock.assert_async().await;
    }

    #[test]
    fn pkce_challenge_is_url_safe_base64() {
        let verifier = generate_code_verifier();
        assert_eq!(verifier.len(), 64);
        let challenge = compute_code_challenge(&verifier);
        assert!(!challenge.contains('+'));
        assert!(!challenge.contains('/'));
        assert!(!challenge.contains('='));
        assert_eq!(challenge.len(), 43);
    }
}
