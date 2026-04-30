export const IPC = {
  // Auth
  authSetPassword: 'auth_set_password',
  authUnlock: 'auth_unlock',
  authLock: 'auth_lock',
  authChangePassword: 'auth_change_password',
  authIsLocked: 'auth_is_locked',
  authListUsers: 'auth_list_users',
  authAddUser: 'auth_add_user',
  authSwitchUser: 'auth_switch_user',

  // Documents
  documentsList: 'documents_list',
  documentsGet: 'documents_get',
  documentsUpload: 'documents_upload',
  documentsUpdate: 'documents_update',
  documentsDelete: 'documents_delete',
  documentsRestore: 'documents_restore',
  documentsGetFileUrl: 'documents_get_file_url',
  documentsGetExtractionStatus: 'documents_get_extraction_status',
  documentsRunExtraction: 'documents_run_extraction',
  documentsTagsSet: 'documents_tags_set',
  documentsSearchFiltered: 'documents_search_filtered',

  // Appointments
  appointmentsList: 'appointments_list',
  appointmentsListUpcoming: 'appointments_list_upcoming',
  appointmentsGet: 'appointments_get',
  appointmentsCreate: 'appointments_create',
  appointmentsUpdate: 'appointments_update',
  appointmentsDelete: 'appointments_delete',
  appointmentsLinkDocument: 'appointments_link_document',
  summarizeAppointmentNotes: 'summarize_appointment_notes',
  icd10Suggest: 'icd10_suggest',
  appointmentTagsGet: 'appointment_tags_get',
  appointmentTagsSet: 'appointment_tags_set',

  // Notes
  notesList: 'notes_list',
  notesGet: 'notes_get',
  notesCreate: 'notes_create',
  notesUpdate: 'notes_update',
  notesDelete: 'notes_delete',
  notesPin: 'notes_pin',
  notesTagsSet: 'notes_tags_set',

  // Categories
  categoriesList: 'categories_list',
  categoriesCreate: 'categories_create',
  categoriesUpdate: 'categories_update',
  categoriesDelete: 'categories_delete',
  categoriesAssignDocument: 'categories_assign_document',
  categoriesAssignAppointment: 'categories_assign_appointment',
  categoriesForDocument: 'categories_for_document',
  categoriesForAppointment: 'categories_for_appointment',
  categoriesUnassign: 'categories_unassign',
  categoriesBulkLink: 'categories_bulk_link',
  categoryReorder: 'category_reorder',
  categoriesArchiveStale: 'categories_archive_stale',
  assignCategoryToDocument: 'assign_category_to_document',
  unassignCategoryFromDocument: 'unassign_category_from_document',
  assignCategoryToAppointment: 'assign_category_to_appointment',
  unassignCategoryFromAppointment: 'unassign_category_from_appointment',

  // Calendar
  calendarListSources: 'calendar_list_sources',
  calendarSync: 'calendar_sync',
  calendarToggleSource: 'calendar_toggle_source',
  calendarRequestPermission: 'calendar_request_permission',
  calendarImportEvents: 'calendar_import_events',
  calendarDetectConflicts: 'calendar_detect_conflicts',
  calendarEventDelete: 'calendar_event_delete',
  icalendarImport: 'icalendar_import',
  icalendarExport: 'icalendar_export',

  // Outlook
  outlookGetAuthUrl: 'outlook_get_auth_url',
  outlookExchangeCode: 'outlook_exchange_code',
  outlookSync: 'outlook_sync',
  outlookIsConnected: 'outlook_is_connected',
  outlookDisconnect: 'outlook_disconnect',

  // Clinics
  clinicsList: 'clinics_list',
  clinicsGet: 'clinics_get',
  clinicsCreate: 'clinics_create',
  clinicsUpdate: 'clinics_update',
  clinicsDelete: 'clinics_delete',

  // Contacts
  contactsList: 'contacts_list',
  contactsGet: 'contacts_get',
  contactsCreate: 'contacts_create',
  contactsUpdate: 'contacts_update',
  contactsDelete: 'contacts_delete',
  contactsFindSimilar: 'contacts_find_similar',
  findDuplicateContacts: 'find_duplicate_contacts',
  mergeContacts: 'merge_contacts',

  // Search
  searchQuery: 'search_query',

  // Settings
  settingsGet: 'settings_get',
  settingsSet: 'settings_set',
  settingsGetDataDir: 'settings_get_data_dir',
  settingsWipeAllData: 'settings_wipe_all_data',
  appResetData: 'app_reset_data',

  // Stats
  statsSummary: 'stats_summary',

  // Export
  exportPdfBundle: 'export_pdf_bundle',
  exportSaveBytes: 'export_save_bytes',
  exportPdfSummaryBytes: 'export_pdf_summary_bytes',

  // Links
  linksCreate: 'links_create',
  linksDelete: 'links_delete',
  linksListForDocument: 'links_list_for_document',
  linksListForAppointment: 'links_list_for_appointment',
  linksScoreCandidates: 'links_score_candidates',
  linkDocumentToAppointment: 'link_document_to_appointment',
  unlinkDocumentFromAppointment: 'unlink_document_from_appointment',
  getDocumentLinks: 'get_document_links',
  getAppointmentLinks: 'get_appointment_links',
} as const

export type IpcCommand = (typeof IPC)[keyof typeof IPC]
