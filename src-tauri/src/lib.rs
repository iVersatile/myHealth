pub(crate) mod commands;
pub(crate) mod crypto;
pub(crate) mod db;
pub(crate) mod extraction;
pub(crate) mod parsing;
pub(crate) mod plugins;
pub(crate) mod services;

#[cfg(test)]
mod acceptance_tests;

use commands::appointments::{
    appointments_create, appointments_delete, appointments_get, appointments_link_document,
    appointments_list, appointments_list_upcoming, appointments_update,
};
use commands::auth::{
    app_reset_data, auth_add_user, auth_change_password, auth_has_password, auth_is_locked,
    auth_list_users, auth_lock, auth_set_password, auth_switch_user, auth_unlock,
};
use commands::calendar::{
    calendar_detect_conflicts, calendar_event_delete, calendar_import_events,
    calendar_list_sources, calendar_request_permission, calendar_sync, calendar_toggle_source,
    icalendar_export, icalendar_import,
};
use commands::categories::{
    assign_category_to_appointment, assign_category_to_document, categories_archive_stale,
    categories_assign_appointment, categories_assign_document, categories_bulk_link,
    categories_create, categories_create_if_not_exists, categories_delete,
    categories_for_appointment, categories_for_document, categories_list, categories_unassign,
    categories_update, category_reorder, unassign_category_from_appointment,
    unassign_category_from_document,
};
use commands::clinics::{
    clinics_create, clinics_create_if_not_exists, clinics_delete, clinics_get,
    clinics_link_contact, clinics_list, clinics_update,
};
use commands::contacts::{
    contacts_create, contacts_delete, contacts_find_similar, contacts_get, contacts_list,
    contacts_update, find_duplicate_contacts, merge_contacts,
};
use commands::documents::{
    documents_delete, documents_get, documents_get_extraction_status, documents_get_file_url,
    documents_list, documents_restore, documents_run_extraction, documents_search_filtered,
    documents_tags_set, documents_update, documents_upload,
};
use commands::export::{export_pdf_bundle, export_pdf_summary_bytes, export_save_bytes};
use commands::links::{
    get_appointment_links, get_document_links, link_document_to_appointment, links_create,
    links_delete, links_list_for_appointment, links_list_for_document, links_score_candidates,
    unlink_document_from_appointment,
};
use commands::notes::{
    notes_create, notes_delete, notes_get, notes_list, notes_pin, notes_tags_set, notes_update,
};
use commands::outlook::{
    outlook_disconnect, outlook_exchange_code, outlook_get_auth_url, outlook_is_connected,
    outlook_sync,
};
use commands::search::search_query;
use commands::settings::{
    settings_get, settings_get_data_dir, settings_set, settings_wipe_all_data,
};
use commands::stats::stats_summary;
use commands::summarizer::summarize_appointment_notes;
use commands::tags::{appointment_tags_get, appointment_tags_set, icd10_suggest};
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
            auth_has_password,
            auth_list_users,
            auth_add_user,
            auth_switch_user,
            app_reset_data,
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
            documents_search_filtered,
            appointments_list,
            appointments_list_upcoming,
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
            categories_create_if_not_exists,
            categories_update,
            categories_delete,
            categories_assign_document,
            categories_assign_appointment,
            categories_for_document,
            categories_for_appointment,
            categories_unassign,
            categories_bulk_link,
            category_reorder,
            categories_archive_stale,
            assign_category_to_document,
            unassign_category_from_document,
            assign_category_to_appointment,
            unassign_category_from_appointment,
            calendar_list_sources,
            calendar_sync,
            calendar_toggle_source,
            calendar_request_permission,
            calendar_import_events,
            calendar_detect_conflicts,
            calendar_event_delete,
            icalendar_import,
            icalendar_export,
            clinics_list,
            clinics_get,
            clinics_create,
            clinics_update,
            clinics_delete,
            clinics_create_if_not_exists,
            clinics_link_contact,
            contacts_list,
            contacts_get,
            contacts_create,
            contacts_update,
            contacts_delete,
            contacts_find_similar,
            find_duplicate_contacts,
            merge_contacts,
            search_query,
            settings_get,
            settings_set,
            settings_get_data_dir,
            settings_wipe_all_data,
            stats_summary,
            export_pdf_bundle,
            export_save_bytes,
            export_pdf_summary_bytes,
            links_create,
            links_delete,
            links_list_for_document,
            links_list_for_appointment,
            links_score_candidates,
            link_document_to_appointment,
            unlink_document_from_appointment,
            get_document_links,
            get_appointment_links,
            outlook_get_auth_url,
            outlook_exchange_code,
            outlook_sync,
            outlook_is_connected,
            outlook_disconnect,
            summarize_appointment_notes,
            icd10_suggest,
            appointment_tags_get,
            appointment_tags_set,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
