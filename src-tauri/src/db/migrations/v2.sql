-- v2.sql: Schema migration for v1.1.0 features
-- This migration adds support for:
-- - F1: Filename date/tag parsing (document_date field)
-- - F2: PDF text + OCR extraction (extracted_metadata field)
-- - F3: Medical category hierarchy (categories tables)
-- - F4: Apple Calendar sync (calendar_sources, calendar_events)
-- - F5: Contact auto-creation (clinic_id, specialty on contacts)
-- - F6: Document-appointment linking + Timeline v2 (document_appointments table)

-- ============================================================================
-- CATEGORIES & HIERARCHIES
-- ============================================================================

CREATE TABLE categories (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  parent_id    TEXT REFERENCES categories(id),
  color_hex    TEXT NOT NULL DEFAULT '#6B7280',
  is_system    INTEGER NOT NULL DEFAULT 1,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE document_categories (
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  category_id  TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, category_id)
);

CREATE TABLE appointment_categories (
  appointment_id  TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  category_id     TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (appointment_id, category_id)
);

-- ============================================================================
-- DOCUMENTS ENHANCEMENTS
-- ============================================================================

ALTER TABLE documents ADD COLUMN document_date TEXT;
ALTER TABLE documents ADD COLUMN extracted_metadata TEXT;

-- ============================================================================
-- CLINICS & CONTACTS ENHANCEMENTS
-- ============================================================================

CREATE TABLE clinics (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT,
  phone      TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE contacts ADD COLUMN clinic_id TEXT REFERENCES clinics(id);

-- ============================================================================
-- DOCUMENT-APPOINTMENT LINKING (F6)
-- ============================================================================

CREATE TABLE document_appointments (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  appointment_id  TEXT NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  link_type       TEXT NOT NULL DEFAULT 'related',
  confidence      TEXT NOT NULL DEFAULT 'manual',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, appointment_id)
);

-- ============================================================================
-- CALENDAR SYNC (F4: Apple Calendar on macOS)
-- ============================================================================

CREATE TABLE calendar_sources (
  id              TEXT PRIMARY KEY,
  external_id     TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  color_hex       TEXT,
  enabled         INTEGER NOT NULL DEFAULT 1,
  last_synced_at  DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE calendar_events (
  id              TEXT PRIMARY KEY,
  external_id     TEXT NOT NULL UNIQUE,
  calendar_id     TEXT NOT NULL REFERENCES calendar_sources(id),
  appointment_id  TEXT REFERENCES appointments(id),
  title           TEXT NOT NULL,
  start_at        TEXT NOT NULL,
  end_at          TEXT,
  location        TEXT,
  notes           TEXT,
  is_imported     INTEGER NOT NULL DEFAULT 0,
  last_synced_at  DATETIME NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- SYSTEM CATEGORIES (seeded in 14.3)
-- ============================================================================

CREATE INDEX idx_document_categories_category_id    ON document_categories(category_id);
CREATE INDEX idx_appointment_categories_category_id ON appointment_categories(category_id);
CREATE INDEX idx_calendar_events_calendar_id         ON calendar_events(calendar_id);

INSERT INTO categories (id, name, parent_id, color_hex, is_system, sort_order) VALUES
  ('cat_cardiology',       'Cardiology',       NULL, '#EF4444', 1, 0),
  ('cat_dermatology',      'Dermatology',      NULL, '#EC4899', 1, 1),
  ('cat_general',          'General',          NULL, '#6B7280', 1, 2),
  ('cat_lab_results',      'Lab Results',      NULL, '#8B5CF6', 1, 3),
  ('cat_imaging',          'Imaging',          NULL, '#06B6D4', 1, 4),
  ('cat_prescriptions',    'Prescriptions',    NULL, '#10B981', 1, 5),
  ('cat_surgery',          'Surgery',          NULL, '#F59E0B', 1, 6),
  ('cat_other',            'Other',            NULL, '#64748B', 1, 7);
