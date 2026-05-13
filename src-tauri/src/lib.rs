pub(crate) mod commands;
pub(crate) mod crypto;
pub mod db;
pub mod extraction;
pub(crate) mod parsing;
pub(crate) mod plugins;
pub(crate) mod services;

#[cfg(test)]
mod acceptance_tests;

use commands::appointments::{
    appointment_link_contact, appointment_unlink_contact, appointments_clear_doctor,
    appointments_create, appointments_delete, appointments_dismiss_conflict, appointments_get,
    appointments_hard_delete, appointments_link_document, appointments_list,
    appointments_list_conflicts, appointments_list_upcoming, appointments_update,
    contacts_for_appointment,
};
use commands::auth::{
    app_reset_data, auth_add_user, auth_change_password, auth_has_password, auth_is_locked,
    auth_list_users, auth_lock, auth_set_password, auth_switch_user, auth_unlock,
};
use commands::backup::{backup_export, backup_import};
use commands::calendar::{
    calendar_detect_conflicts, calendar_event_delete, calendar_import_events,
    calendar_list_sources, calendar_request_permission, calendar_sync, calendar_toggle_source,
    icalendar_export, icalendar_import,
};
use commands::categories::{
    assign_category_to_appointment, assign_category_to_document, categories_archive_stale,
    categories_assign_appointment, categories_assign_document, categories_bulk_link,
    categories_create, categories_create_if_not_exists, categories_delete,
    categories_for_appointment, categories_for_document, categories_list, categories_reorder,
    categories_unassign, categories_update, category_reorder, documents_valid_categories,
    unassign_category_from_appointment, unassign_category_from_document,
};
use commands::clinics::{
    clinics_create, clinics_create_if_not_exists, clinics_delete, clinics_get,
    clinics_get_linked_contacts, clinics_get_linked_documents, clinics_hard_delete,
    clinics_link_contact, clinics_list, clinics_list_with_contacts, clinics_update,
};
use commands::contacts::{
    contacts_create, contacts_create_with_clinic, contacts_delete, contacts_find_similar,
    contacts_get, contacts_hard_delete, contacts_list, contacts_update, documents_link_contact,
    find_duplicate_contacts, merge_contacts,
};
use commands::documents::{
    appointments_suggest_from_document, document_entities_get, documents_delete,
    documents_export_report, documents_get, documents_get_extraction_status,
    documents_get_file_url, documents_list, documents_restore, documents_run_extraction,
    documents_search_filtered, documents_set_clinic, documents_tags_set, documents_update,
    documents_upload, documents_upload_batch, get_document_preview_url, get_flagged_lab_values,
    get_linked_documents, get_pending_review_count,
};
use commands::drafts::{
    accept_draft_entity, get_draft_entities, merge_draft_entity, reject_draft_entity,
};
use commands::entity_links::{
    links_for_medication, links_for_symptom, medication_link, medication_unlink,
    medications_for_entity, symptom_link, symptom_unlink, symptoms_for_entity,
};
use commands::export::{export_pdf_bundle, export_pdf_summary_bytes, export_save_bytes};
use commands::icd10::{documents_get_icd10_tags, documents_tag_icd10};
use commands::links::{
    get_appointment_links, get_document_links, link_document_to_appointment, links_create,
    links_delete, links_list_for_appointment, links_list_for_document, links_score_candidates,
    unlink_document_from_appointment,
};
use commands::medications::{
    medications_create, medications_delete, medications_get, medications_hard_delete,
    medications_list, medications_update,
};
use commands::notes::{
    links_for_note, note_link, note_unlink, note_version_restore, note_versions_list, notes_create,
    notes_delete, notes_for_entity, notes_get, notes_hard_delete, notes_list, notes_pin,
    notes_tags_set, notes_update,
};
use commands::outlook::{
    outlook_disconnect, outlook_exchange_code, outlook_get_auth_url, outlook_is_connected,
    outlook_sync,
};
use commands::profiles::{profiles_create, profiles_delete, profiles_list};
use commands::recurrence::{recurrence_create, recurrence_delete_series};
use commands::reminders::{conn_fire_due, reminders_cancel, reminders_schedule};
use commands::search::{documents_content_search, search_query};
use commands::settings::{
    settings_get, settings_get_data_dir, settings_set, settings_wipe_all_data,
};
use commands::stats::stats_summary;
use commands::summarizer::summarize_appointment_notes;
use commands::symptoms::{
    symptoms_create, symptoms_delete, symptoms_get, symptoms_hard_delete, symptoms_list,
    symptoms_update,
};
use commands::tags::{appointment_tags_get, appointment_tags_set, icd10_suggest};
use commands::trash::{
    trash_empty, trash_hard_delete, trash_list, trash_purge_expired, trash_restore,
};
use commands::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                    // Collect due notifications while holding the DB lock, then
                    // release the lock before sending OS notifications.
                    let pending: Vec<(String, String)> = {
                        let state = handle.state::<AppState>();
                        let mut notifications = Vec::new();
                        if let Ok(guard) = state.db.lock() {
                            if let Some(conn) = guard.as_ref() {
                                let _ = conn_fire_due(conn, chrono::Utc::now(), |title, label| {
                                    notifications.push((title.to_string(), label.to_string()));
                                });
                            }
                        }
                        notifications
                    };
                    for (title, body) in pending {
                        use tauri_plugin_notification::NotificationExt;
                        let _ = handle
                            .notification()
                            .builder()
                            .title(&title)
                            .body(&body)
                            .show();
                    }
                }
            });
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
            documents_upload_batch,
            documents_update,
            documents_delete,
            documents_restore,
            documents_get_file_url,
            get_document_preview_url,
            get_flagged_lab_values,
            get_linked_documents,
            documents_get_extraction_status,
            documents_run_extraction,
            document_entities_get,
            documents_tags_set,
            documents_set_clinic,
            documents_export_report,
            get_pending_review_count,
            get_draft_entities,
            accept_draft_entity,
            reject_draft_entity,
            merge_draft_entity,
            appointments_suggest_from_document,
            documents_search_filtered,
            appointments_list,
            appointments_list_conflicts,
            appointments_dismiss_conflict,
            appointments_list_upcoming,
            appointments_get,
            appointments_create,
            appointments_update,
            appointments_delete,
            appointments_hard_delete,
            appointments_clear_doctor,
            appointments_link_document,
            appointment_link_contact,
            appointment_unlink_contact,
            contacts_for_appointment,
            notes_list,
            notes_get,
            notes_create,
            notes_update,
            notes_delete,
            notes_hard_delete,
            notes_pin,
            notes_tags_set,
            note_link,
            note_unlink,
            links_for_note,
            notes_for_entity,
            note_versions_list,
            note_version_restore,
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
            categories_reorder,
            categories_archive_stale,
            assign_category_to_document,
            unassign_category_from_document,
            assign_category_to_appointment,
            unassign_category_from_appointment,
            documents_valid_categories,
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
            clinics_list_with_contacts,
            clinics_get,
            clinics_create,
            clinics_update,
            clinics_delete,
            clinics_hard_delete,
            clinics_create_if_not_exists,
            clinics_link_contact,
            clinics_get_linked_contacts,
            clinics_get_linked_documents,
            contacts_list,
            contacts_get,
            contacts_create,
            contacts_create_with_clinic,
            contacts_update,
            contacts_delete,
            contacts_hard_delete,
            contacts_find_similar,
            find_duplicate_contacts,
            merge_contacts,
            documents_link_contact,
            search_query,
            documents_content_search,
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
            documents_tag_icd10,
            documents_get_icd10_tags,
            appointment_tags_get,
            appointment_tags_set,
            backup_export,
            backup_import,
            reminders_schedule,
            reminders_cancel,
            recurrence_create,
            recurrence_delete_series,
            commands::addresses::clinic_addresses_list,
            commands::addresses::clinic_address_create,
            commands::addresses::clinic_address_update,
            commands::addresses::clinic_address_delete,
            commands::addresses::contact_addresses_list,
            commands::addresses::contact_address_create,
            commands::addresses::contact_address_update,
            commands::addresses::contact_address_delete,
            symptoms_list,
            symptoms_get,
            symptoms_create,
            symptoms_update,
            symptoms_delete,
            symptoms_hard_delete,
            symptom_link,
            symptom_unlink,
            links_for_symptom,
            symptoms_for_entity,
            medications_list,
            medications_get,
            medications_create,
            medications_update,
            medications_delete,
            medications_hard_delete,
            medication_link,
            medication_unlink,
            links_for_medication,
            medications_for_entity,
            trash_list,
            trash_restore,
            trash_hard_delete,
            trash_empty,
            trash_purge_expired,
            profiles_list,
            profiles_create,
            profiles_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
