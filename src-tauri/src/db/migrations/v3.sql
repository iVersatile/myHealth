-- v3.sql: Phase 0 additions for v1.1.0
-- Adds OCR extraction columns, contact dedup fields, appointment clinic FK,
-- and integer score column on document_appointments junction table.

-- ============================================================================
-- DOCUMENTS: OCR / extraction columns
-- ============================================================================

ALTER TABLE documents ADD COLUMN extracted_text    TEXT;
ALTER TABLE documents ADD COLUMN extraction_status TEXT
    CHECK(extraction_status IN ('pending','running','done','failed','skipped'))
    DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN extracted_at      TEXT;
ALTER TABLE documents ADD COLUMN extraction_error  TEXT;
ALTER TABLE documents ADD COLUMN parsed_filename   TEXT;
ALTER TABLE documents ADD COLUMN parser_confidence REAL;

-- ============================================================================
-- APPOINTMENTS: clinic FK
-- ============================================================================

ALTER TABLE appointments ADD COLUMN clinic_id TEXT REFERENCES clinics(id);

CREATE INDEX idx_appointments_clinic_id ON appointments(clinic_id);

-- ============================================================================
-- CONTACTS: deduplication tracking
-- ============================================================================

ALTER TABLE contacts ADD COLUMN is_deduped_with TEXT;
ALTER TABLE contacts ADD COLUMN dedup_score     REAL;

-- ============================================================================
-- DOCUMENT_APPOINTMENTS: integer link score
-- ============================================================================

ALTER TABLE document_appointments ADD COLUMN score INTEGER NOT NULL DEFAULT 0;
