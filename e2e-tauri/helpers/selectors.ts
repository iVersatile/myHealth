export const SEL = {
  // Nav
  navDocuments: '[data-testid="nav-documents"]',
  navNotes: '[data-testid="nav-notes"]',
  navClinics: '[data-testid="nav-clinics"]',
  navTrash: '[data-testid="nav-trash"]',

  // Upload
  uploadBtn: '[data-testid="upload-btn"]',
  uploadDialog: '[data-testid="upload-dialog"]',
  uploadFileDrop: '[data-testid="upload-file-drop"]',
  uploadSave: '[data-testid="upload-save"]',

  // Document list
  documentList: '[data-testid="document-list"]',
  documentItem: '[data-testid="document-item"]',
  documentTitle: '[data-testid="document-title"]',

  // Document detail
  documentDetail: '[data-testid="document-detail"]',
  editTitleInput: '[data-testid="edit-title-input"]',
  categorySelect: '[data-testid="category-select"]',
  tagInput: '[data-testid="tag-input"]',
  saveBtn: '[data-testid="save-btn"]',
  deleteBtn: '[data-testid="delete-btn"]',

  // Search
  searchInput: '[data-testid="search-input"]',

  // Notes
  newNoteBtn: '[data-testid="new-note-btn"]',
  noteEditor: '[data-testid="note-editor"]',
  noteTitle: '[data-testid="note-title"]',

  // Clinics
  clinicList: '[data-testid="clinic-list"]',
  newClinicBtn: '[data-testid="new-clinic-btn"]',

  // Toast
  toast: '[data-testid="toast"]',
} as const
