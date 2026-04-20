PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Documents ---------------------------------------------------------------
CREATE TABLE documents (
  id               TEXT PRIMARY KEY,           -- UUID v4
  filename         TEXT NOT NULL,
  file_path        TEXT NOT NULL,              -- relative to data dir
  mime_type        TEXT NOT NULL,
  file_size_bytes  INTEGER NOT NULL,
  category         TEXT NOT NULL CHECK(category IN (
                     'diagnosis','lab','imaging','prescription','letter','other')),
  thumbnail_path   TEXT,
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_deleted       BOOLEAN DEFAULT 0,
  deleted_at       DATETIME
);

CREATE TABLE document_tags (
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag          TEXT NOT NULL,
  PRIMARY KEY (document_id, tag)
);

-- Appointments ------------------------------------------------------------
CREATE TABLE appointments (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  doctor_name  TEXT,
  clinic_name  TEXT,
  specialty    TEXT,
  appt_date    DATETIME NOT NULL,
  duration_min INTEGER DEFAULT 30,
  location     TEXT,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN (
                 'scheduled','completed','cancelled','missed')),
  reminder_min INTEGER DEFAULT 60,            -- minutes before
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE appointment_documents (
  appointment_id  TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (appointment_id, document_id)
);

CREATE TABLE appointment_contacts (
  appointment_id  TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  contact_id      TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (appointment_id, contact_id)
);

-- Notes -------------------------------------------------------------------
CREATE TABLE notes (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  content     TEXT NOT NULL DEFAULT '',       -- HTML from tiptap
  is_pinned   BOOLEAN DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE note_tags (
  note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag      TEXT NOT NULL,
  PRIMARY KEY (note_id, tag)
);

-- Contacts ----------------------------------------------------------------
CREATE TABLE contacts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK(role IN (
               'gp','specialist','dentist','physio','pharmacist','hospital','other')),
  specialty  TEXT,
  phone      TEXT,
  email      TEXT,
  clinic     TEXT,
  address    TEXT,
  notes      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Settings ----------------------------------------------------------------
CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Full-text search --------------------------------------------------------
CREATE VIRTUAL TABLE search_index USING fts5(
  entity_type,      -- 'document' | 'appointment' | 'note' | 'contact'
  entity_id,
  title,
  body,
  tags,
  tokenize = 'porter unicode61'
);
