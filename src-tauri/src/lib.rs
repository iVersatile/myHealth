pub(crate) mod commands;
pub(crate) mod crypto;
pub(crate) mod db;

use commands::auth::{
    auth_change_password, auth_is_locked, auth_lock, auth_set_password, auth_unlock,
};
use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            auth_set_password,
            auth_unlock,
            auth_lock,
            auth_change_password,
            auth_is_locked,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
