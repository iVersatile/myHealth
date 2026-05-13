CREATE TABLE IF NOT EXISTS icd10_codes (
    code        TEXT PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS icd10_fts USING fts5(
    code,
    description,
    content='icd10_codes',
    content_rowid='rowid'
);

CREATE TABLE IF NOT EXISTS document_icd10_tags (
    document_id TEXT    NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    code        TEXT    NOT NULL,
    description TEXT    NOT NULL,
    confidence  REAL,
    PRIMARY KEY (document_id, code)
);
