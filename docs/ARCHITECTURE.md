# myHealth — Architecture Document

**Version:** 1.0  
**Date:** 2026-04-19  

---

## 1. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop shell | Tauri v2 (Rust) | Small binary (~5 MB), native OS APIs, Gatekeeper-compatible |
| Frontend framework | Next.js 14 (App Router) | SSG/SSR not needed; used as SPA served by Tauri |
| Language | TypeScript 5 | Type safety across IPC boundary |
| Styling | Tailwind CSS v3 | Utility-first, no runtime CSS-in-JS overhead |
| State management | Zustand 4 | Minimal boilerplate, compatible with React 18 |
| Database | SQLite via `better-sqlite3` (JS) or `rusqlite` (Rust) | Embedded, no server, supports SQLCipher |
| Encryption | SQLCipher AES-256-CBC | Industry-standard SQLite encryption |
| Search | SQLite FTS5 | Full-text search built into SQLite |
| File storage | Local filesystem via Tauri `fs` API | Native file access, no cloud dependency |
| PDF generation | `pdf-lib` (JS) | Pure JS, no native deps, good for composing PDFs |
| Rich text editor | `tiptap` | Headless, accessible, extensible |
| Testing (frontend) | Vitest + React Testing Library | Fast, Vite-compatible |
| Testing (Rust) | `cargo test` | Built-in |
| CI/CD | GitHub Actions | Free for public repos, matrix builds |
| Distribution | GitHub Releases | Free hosting, auto-generated download page |

---

## 2. Project Structure

```
myHealth/
├── src/                          # Next.js frontend (TypeScript)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Root — redirects to /dashboard
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── documents/
│   │   │   ├── page.tsx          # Document list
│   │   │   └── [id]/
│   │   │       └── page.tsx      # Document detail
│   │   ├── appointments/
│   │   │   └── page.tsx
│   │   ├── notes/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── contacts/
│   │   │   └── page.tsx
│   │   ├── timeline/
│   │   │   └── page.tsx
│   │   └── settings/
│   │       └── page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── documents/
│   │   │   ├── DocumentCard.tsx
│   │   │   ├── DocumentList.tsx
│   │   │   ├── UploadDialog.tsx
│   │   │   └── DocumentViewer.tsx
│   │   ├── appointments/
│   │   │   ├── AppointmentCard.tsx
│   │   │   ├── AppointmentForm.tsx
│   │   │   └── CalendarView.tsx
│   │   ├── notes/
│   │   │   ├── NoteCard.tsx
│   │   │   └── NoteEditor.tsx
│   │   ├── contacts/
│   │   │   ├── ContactCard.tsx
│   │   │   └── ContactForm.tsx
│   │   ├── timeline/
│   │   │   └── TimelineItem.tsx
│   │   ├── search/
│   │   │   └── SearchModal.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Dialog.tsx
│   │       ├── Badge.tsx
│   │       ├── Input.tsx
│   │       └── Spinner.tsx
│   ├── hooks/
│   │   ├── useDocuments.ts
│   │   ├── useAppointments.ts
│   │   ├── useNotes.ts
│   │   ├── useContacts.ts
│   │   ├── useSearch.ts
│   │   └── useAuth.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── documentsStore.ts
│   │   ├── appointmentsStore.ts
│   │   ├── notesStore.ts
│   │   └── contactsStore.ts
│   ├── lib/
│   │   ├── tauri.ts              # Typed wrappers around invoke()
│   │   ├── ipc.ts                # All IPC command definitions
│   │   └── utils.ts
│   └── types/
│       ├── document.ts
│       ├── appointment.ts
│       ├── note.ts
│       ├── contact.ts
│       └── common.ts
├── src-tauri/                    # Tauri / Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── documents.rs
│   │   │   ├── appointments.rs
│   │   │   ├── notes.rs
│   │   │   ├── contacts.rs
│   │   │   ├── search.rs
│   │   │   ├── export.rs
│   │   │   └── auth.rs
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── migrations.rs
│   │   │   └── schema.sql
│   │   ├── models/
│   │   │   ├── document.rs
│   │   │   ├── appointment.rs
│   │   │   ├── note.rs
│   │   │   └── contact.rs
│   │   └── crypto.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   └── WIREFRAMES.md
├── .github/
│   └── workflows/
│       ├── lint.yml
│       ├── test.yml
│       └── build-release.yml
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

## 3. Database Schema

All tables stored in `~/.myHealth/db/health.db` (encrypted with SQLCipher).

```sql
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
```

---

## 4. Tauri IPC Commands

All commands are defined in `src-tauri/src/commands/` and registered in `main.rs`.

### 4.1 Auth

| Command | Input | Output |
|---------|-------|--------|
| `auth_unlock` | `{ password: string }` | `{ success: bool }` |
| `auth_set_password` | `{ password: string }` | `{ success: bool }` |
| `auth_change_password` | `{ old_password: string, new_password: string }` | `{ success: bool }` |
| `auth_lock` | — | — |
| `auth_is_locked` | — | `bool` |

### 4.2 Documents

| Command | Input | Output |
|---------|-------|--------|
| `documents_list` | `{ category?: string, page: number, limit: number }` | `Document[]` |
| `documents_get` | `{ id: string }` | `Document` |
| `documents_upload` | `{ file_path: string, category: string, notes?: string }` | `Document` |
| `documents_update` | `{ id: string, category?: string, notes?: string }` | `Document` |
| `documents_delete` | `{ id: string }` | — |
| `documents_restore` | `{ id: string }` | — |
| `documents_get_file_url` | `{ id: string }` | `string` |
| `documents_tags_set` | `{ id: string, tags: string[] }` | — |

### 4.3 Appointments

| Command | Input | Output |
|---------|-------|--------|
| `appointments_list` | `{ month?: string, status?: string }` | `Appointment[]` |
| `appointments_get` | `{ id: string }` | `Appointment` |
| `appointments_create` | `AppointmentInput` | `Appointment` |
| `appointments_update` | `{ id: string } & Partial<AppointmentInput>` | `Appointment` |
| `appointments_delete` | `{ id: string }` | — |
| `appointments_link_document` | `{ appointment_id: string, document_id: string }` | — |

### 4.4 Notes

| Command | Input | Output |
|---------|-------|--------|
| `notes_list` | `{ pinned_first?: bool }` | `Note[]` |
| `notes_get` | `{ id: string }` | `Note` |
| `notes_create` | `{ title: string, content: string }` | `Note` |
| `notes_update` | `{ id: string, title?: string, content?: string }` | `Note` |
| `notes_delete` | `{ id: string }` | — |
| `notes_pin` | `{ id: string, pinned: bool }` | — |
| `notes_tags_set` | `{ id: string, tags: string[] }` | — |

### 4.5 Contacts

| Command | Input | Output |
|---------|-------|--------|
| `contacts_list` | `{ role?: string }` | `Contact[]` |
| `contacts_get` | `{ id: string }` | `Contact` |
| `contacts_create` | `ContactInput` | `Contact` |
| `contacts_update` | `{ id: string } & Partial<ContactInput>` | `Contact` |
| `contacts_delete` | `{ id: string }` | — |

### 4.6 Search

| Command | Input | Output |
|---------|-------|--------|
| `search_query` | `{ q: string, types?: string[] }` | `SearchResults` |

### 4.7 Export

| Command | Input | Output |
|---------|-------|--------|
| `export_pdf_bundle` | `{ document_ids: string[], title: string, output_path: string }` | `string` |
| `export_backup` | `{ output_path: string }` | — |
| `import_backup` | `{ file_path: string, password: string }` | — |

---

## 5. State Management (Zustand)

```typescript
// authStore.ts
interface AuthState {
  isLocked: boolean
  setLocked: (locked: boolean) => void
}

// documentsStore.ts
interface DocumentsState {
  documents: Document[]
  loading: boolean
  error: string | null
  fetchDocuments: (filters?: DocumentFilters) => Promise<void>
  uploadDocument: (filePath: string, category: string) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
}
```

Each feature module has its own Zustand slice. No shared mutable state across slices — cross-cutting concerns (e.g., search results) use local React state in the relevant component.

---

## 6. File Storage Layout

```
~/.myHealth/
├── db/
│   └── health.db          # SQLCipher encrypted SQLite
├── files/
│   ├── documents/
│   │   ├── <uuid>/
│   │   │   ├── original.<ext>
│   │   │   └── thumbnail.webp
│   │   └── ...
│   └── exports/
│       └── *.pdf
└── config.json            # Non-sensitive: data dir override, theme, auto-lock timeout
```

File paths stored in the database are relative to `~/.myHealth/` to allow the data directory to be moved.

---

## 7. Encryption

### Key Derivation

```
master_password  ──►  PBKDF2-SHA512  ──►  256-bit key
                       salt: device UUID + app ID
                       iterations: 64,000
                       ──► passed to SQLCipher PRAGMA key
```

### SQLCipher Configuration

```sql
PRAGMA key = '<derived_key_hex>';
PRAGMA cipher_page_size = 4096;
PRAGMA kdf_iter = 64000;
PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
PRAGMA cipher_kdf_algorithm = PBKDF2_HMAC_SHA512;
```

### Change Password Flow

1. Open DB with old key
2. `PRAGMA rekey = '<new_key_hex>'` — SQLCipher re-encrypts in-place
3. Verify DB integrity with `PRAGMA integrity_check`

---

## 8. CI/CD Pipeline

See `.github/workflows/` for full YAML.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `lint.yml` | push / PR to main, develop | ESLint, TypeScript, cargo fmt, clippy |
| `test.yml` | push / PR to main, develop | Vitest (frontend), cargo test (Rust) |
| `build-release.yml` | push tag `v*` | Build .dmg, .exe, .AppImage → GitHub Release |

### Build Matrix

| OS | Target triple | Artifact |
|----|--------------|---------|
| macos-latest | aarch64-apple-darwin | `.dmg` (Apple Silicon) |
| macos-latest | x86_64-apple-darwin | `.dmg` (Intel) |
| windows-latest | x86_64-pc-windows-msvc | `.msi` |
| ubuntu-22.04 | x86_64-unknown-linux-gnu | `.AppImage` |

---

## 9. Performance Targets

| Metric | Target |
|--------|--------|
| Cold startup | < 2 s |
| Document list (1,000 items) | < 500 ms |
| Search (10,000 records) | < 200 ms |
| File upload (50 MB) | < 3 s |
| PDF export (20 docs) | < 10 s |
| Memory (idle) | < 150 MB |

---

## 10. Security Threat Model

| Threat | Mitigation |
|--------|-----------|
| Stolen device / disk theft | SQLCipher AES-256 at rest |
| Weak master password | Minimum 8 chars enforced; PBKDF2 stretching |
| Network exfiltration | No network access in app; Tauri `allowlist` restricts APIs |
| Malicious file upload | MIME type validation + path sanitisation in Rust |
| Insecure file paths | All paths resolved relative to data dir; no `..` traversal |
| Memory scraping | Key held only in Rust process memory, not serialised to JS |
