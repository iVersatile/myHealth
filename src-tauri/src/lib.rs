pub(crate) mod commands;
pub(crate) mod crypto;
pub(crate) mod db;
pub(crate) mod extraction;
pub(crate) mod parsing;
pub(crate) mod plugins;

use commands::appointments::{
    appointments_create, appointments_delete, appointments_get, appointments_link_document,
    appointments_list, appointments_update,
};
use commands::auth::{
    auth_change_password, auth_is_locked, auth_lock, auth_set_password, auth_unlock,
};
use commands::calendar::{calendar_list_sources, calendar_sync, calendar_toggle_source};
use commands::categories::{
    categories_assign_appointment, categories_assign_document, categories_create,
    categories_delete, categories_for_appointment, categories_for_document, categories_list,
    categories_unassign, categories_update,
};
use commands::clinics::{
    clinics_create, clinics_delete, clinics_get, clinics_list, clinics_update,
};
use commands::contacts::{
    contacts_create, contacts_delete, contacts_find_similar, contacts_get, contacts_list,
    contacts_update,
};
use commands::documents::{
    documents_delete, documents_get, documents_get_extraction_status, documents_get_file_url,
    documents_list, documents_restore, documents_run_extraction, documents_tags_set,
    documents_update, documents_upload,
};
use commands::export::{export_pdf_bundle, export_save_bytes};
use commands::notes::{
    notes_create, notes_delete, notes_get, notes_list, notes_pin, notes_tags_set, notes_update,
};
use commands::search::search_query;
use commands::settings::{
    settings_get, settings_get_data_dir, settings_set, settings_wipe_all_data,
};
use commands::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_dialog::init())
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
            documents_list,
            documents_get,
            documents_upload,
            documents_update,
            documents_delete,
            documents_restore,
            documents_get_file_url,
            documents_get_extraction_status,
            documents_run_extraction,
            documents_tags_set,
            appointments_list,
            appointments_get,
            appointments_create,
            appointments_update,
            appointments_delete,
            appointments_link_document,
            notes_list,
            notes_get,
            notes_create,
            notes_update,
            notes_delete,
            notes_pin,
            notes_tags_set,
            categories_list,
            categories_create,
            categories_update,
            categories_delete,
            categories_assign_document,
            categories_assign_appointment,
            categories_for_document,
            categories_for_appointment,
            categories_unassign,
            calendar_list_sources,
            calendar_sync,
            calendar_toggle_source,
            clinics_list,
            clinics_get,
            clinics_create,
            clinics_update,
            clinics_delete,
            contacts_list,
            contacts_get,
            contacts_create,
            contacts_update,
            contacts_delete,
            contacts_find_similar,
            search_query,
            settings_get,
            settings_set,
            settings_get_data_dir,
            settings_wipe_all_data,
            export_pdf_bundle,
            export_save_bytes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
