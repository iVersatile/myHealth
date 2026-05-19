# myHealth v1.1 Architecture Document

## 1. Extended Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Desktop Shell** | Tauri v2 | v2.0+ | Cross-platform desktop runtime (macOS/Windows/Linux) |
| **Frontend Framework** | Next.js | 14 | React metaframework with SSG for embedded web view |
| **UI Library** | React | 18 | Component library |
| **Styling** | Tailwind CSS | 3.3+ | Utility-first CSS framework |
| **Type Safety** | TypeScript | 5.3+ | Strict type checking (`strict: true`) |
| **State Management** | Zustand | 4.4+ | Lightweight client state (reactive stores) |
| **Database** | SQLite | 3.45+ | Embedded relational database |
| **Encryption** | SQLCipher | AES-256 | Full-disk encryption with password key derivation |
| **Key Derivation** | PBKDF2-SHA512 | N/A | Password-to-key derivation (100k iterations) |
| **Full-Text Search** | SQLite FTS5 | N/A | Inverted index for full-text search |
| **Desktop Backend** | Tauri Rust Core | v2.0+ | IPC commands, file I/O, OS integration |
| **Async Runtime** | Tokio | 1.35+ | Multi-threaded async executor for background tasks |
| **PDF Extraction** | pdf-extract | Latest | PDF text and metadata extraction |
| **OCR Engine** | Tesseract / leptess | Latest | Optical character recognition (async via subprocess) |
| **PDF Renderer** | Poppler (`pdftoppm`) | 21.0+ | Converts PDF pages to PNG for per-page OCR; install: `brew install poppler` |
| **String Similarity** | strsim | Latest | Levenshtein distance for duplicate detection |
| **Calendar Integration** | EventKit (via FFI) | N/A | macOS Calendar sync (native Cocoa framework) |
| **HTTP Client** | reqwest | 0.11+ | Async HTTP client (for future cloud APIs) |
| **JSON Serialization** | serde_json | 1.0+ | JSON serialization/deserialization |
| **Testing** | Vitest + Playwright | Latest | Unit, integration, and E2E testing |
| **Package Manager** | pnpm | 8+ | Node.js workspace package manager |
| **Build Tool** | Vite (via Next.js) | Latest | Frontend build optimization |

## 2. Extended Project Structure

```
myHealth/
├── src/
│   ├── app/
│   │   ├── (app)/                      # Protected routes (auth required)
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx            # Dashboard home
│   │   │   │   └── dashboard.css
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx            # Document list & search
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx        # Document detail view
│   │   │   │   │   └── edit.tsx        # Document editor
│   │   │   │   └── documents.css
│   │   │   ├── appointments/
│   │   │   │   ├── page.tsx            # Appointment calendar view
│   │   │   │   ├── [id]/page.tsx       # Appointment detail
│   │   │   │   └── appointments.css
│   │   │   ├── categories/             # NEW: Categories management
│   │   │   │   ├── page.tsx            # Category browser & editor
│   │   │   │   ├── CategoryTree.tsx    # Hierarchical tree component
│   │   │   │   ├── CategoryForm.tsx    # Add/edit form
│   │   │   │   └── categories.css
│   │   │   ├── calendar/               # NEW: Calendar sync management
│   │   │   │   ├── page.tsx            # Calendar sources & sync status
│   │   │   │   ├── SyncStatus.tsx      # Real-time sync indicator
│   │   │   │   └── calendar.css
│   │   │   ├── contacts/
│   │   │   │   ├── page.tsx            # Contact list
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── page.tsx        # Contact detail
│   │   │   │   │   └── edit.tsx        # Contact editor
│   │   │   │   └── contacts.css
│   │   │   ├── links/                  # NEW: Document-appointment links
│   │   │   │   ├── page.tsx            # Link browser & scoring UI
│   │   │   │   ├── LinkScoreboard.tsx  # Scored link list
│   │   │   │   └── links.css
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx            # Settings/preferences
│   │   │   │   └── settings.css
│   │   │   └── notes/                  # Quick notes (existing)
│   │   │       ├── page.tsx
│   │   │       └── notes.css
│   │   ├── layout.tsx                  # Main app layout (nav, auth check)
│   │   ├── globals.css
│   │   └── page.tsx                    # Root page (redirects to dashboard)
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Tabs.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Spinner.tsx
│   │   ├── CategoryTaglist.tsx          # NEW: Shared category badge component
│   │   ├── CategorySelector.tsx        # NEW: Multi-select category picker
│   │   ├── DocumentUploadZone.tsx      # NEW: Drag-and-drop with filename parsing feedback
│   │   ├── ExtractionProgress.tsx      # NEW: Real-time PDF/OCR progress
│   │   ├── AppointmentLinkList.tsx     # NEW: Scored links component
│   │   ├── LinkScoreDetails.tsx        # NEW: Point scoring breakdown explanation
│   │   ├── CalendarSyncPanel.tsx       # NEW: Sync status and controls
│   │   └── ContactDeduplicationModal.tsx # NEW: Duplicate contact review
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                  # Auth state and login/logout
│   │   ├── useDocuments.ts             # NEW: Document fetching & filtering
│   │   ├── useCategories.ts            # NEW: Category CRUD and tree operations
│   │   ├── useAppointments.ts          # Appointment fetching
│   │   ├── useContacts.ts              # Contact CRUD
│   │   ├── useLinks.ts                 # NEW: Link fetching & scoring
│   │   ├── useCalendarSync.ts          # NEW: Calendar sync state & events
│   │   ├── useExtraction.ts            # NEW: PDF/OCR extraction progress
│   │   ├── useParsedFilename.ts        # NEW: Client-side filename parsing feedback
│   │   └── useSearch.ts                # FTS search across documents/notes
│   │
│   ├── store/
│   │   ├── authStore.ts                # Auth state (user, session, masterPassword)
│   │   ├── documentStore.ts            # Documents, search results, filters
│   │   ├── appointmentStore.ts         # Appointments and events
│   │   ├── contactStore.ts             # Contacts and deduplication state (EXTENDED)
│   │   ├── categoryStore.ts            # NEW: Categories tree, selected categories, hierarchy
│   │   ├── calendarStore.ts            # NEW: Calendar sources, sync status, events
│   │   └── linkStore.ts                # NEW: Scored links, point scoring state, suggestions
│   │
│   ├── lib/
│   │   ├── api.ts                      # Tauri IPC client (command invocations)
│   │   ├── crypto.ts                   # Client-side crypto utils
│   │   ├── search.ts                   # FTS search utilities
│   │   ├── dateUtils.ts                # Date formatting and timezone
│   │   ├── fileParser.ts               # NEW: Client-side filename regex patterns
│   │   ├── scoring.ts                  # NEW: Client-side link score display helpers
│   │   └── validators.ts               # Input validation schemas
│   │
│   └── styles/
│       ├── tokens.css                  # Design tokens (colors, spacing, fonts)
│       ├── typography.css              # Type styles and scales
│       ├── animations.css              # Transition and animation definitions
│       └── globals.css                 # Global resets and base styles
│
├── src-tauri/                          # Rust backend
│   ├── src/
│   │   ├── lib.rs                      # Main entry point
│   │   ├── db/
│   │   │   ├── mod.rs                  # Database initialization
│   │   │   ├── schema.sql              # Full database schema (EXTENDED)
│   │   │   └── migrations.rs           # Schema migrations
│   │   ├── commands/
│   │   │   ├── mod.rs                  # Command registration
│   │   │   ├── auth.rs                 # Auth commands (login, logout, register)
│   │   │   ├── documents.rs            # EXTENDED: document CRUD, extraction pipeline
│   │   │   ├── categories.rs           # NEW: category CRUD and hierarchy
│   │   │   ├── appointments.rs         # EXTENDED: appointment CRUD, link scoring trigger
│   │   │   ├── contacts.rs             # EXTENDED: contact CRUD, deduplication
│   │   │   ├── calendar.rs             # NEW: calendar sync, EventKit integration
│   │   │   ├── extraction.rs           # NEW: PDF extraction, OCR coordination
│   │   │   ├── links.rs                # NEW: link scoring and retrieval
│   │   │   └── parsing.rs              # NEW: filename parsing and tag extraction
│   │   ├── services/
│   │   │   ├── auth.rs                 # Password hashing, session management
│   │   │   ├── extraction/
│   │   │   │   ├── mod.rs              # NEW: extraction pipeline orchestration
│   │   │   │   ├── pdf.rs              # PDF text/metadata extraction
│   │   │   │   └── ocr.rs              # Tesseract subprocess coordination
│   │   │   ├── parsing/
│   │   │   │   ├── mod.rs              # NEW: filename parsing logic
│   │   │   │   └── patterns.rs         # Regex patterns for date/format recognition
│   │   │   ├── calendar/
│   │   │   │   ├── mod.rs              # NEW: EventKit integration (macOS)
│   │   │   │   └── events.rs           # Calendar event sync and mapping
│   │   │   ├── linking/
│   │   │   │   ├── mod.rs              # NEW: link scoring orchestration
│   │   │   │   └── scorer.rs           # Point scoring: date, doctor, category, clinic
│   │   │   ├── deduplication/
│   │   │   │   ├── mod.rs              # Contact deduplication logic
│   │   │   │   └── contact.rs          # Levenshtein distance matching
│   │   │   └── search.rs               # FTS search query builder
│   │   ├── crypto.rs                   # Encryption, PBKDF2, SQLCipher setup
│   │   └── error.rs                    # Error types and handling
│   │
│   ├── Cargo.toml                      # Rust dependencies
│   └── tauri.conf.json                 # Tauri build configuration

├── tests/
│   ├── unit/
│   │   ├── parsing.test.ts             # NEW: Filename parsing tests
│   │   ├── scoring.test.ts             # NEW: Point scoring signal tests
│   │   ├── search.test.ts              # FTS search tests
│   │   └── crypto.test.ts              # Encryption tests
│   ├── integration/
│   │   ├── document.integration.ts     # Document CRUD + extraction
│   │   ├── category.integration.ts     # NEW: Category hierarchy and relationships
│   │   ├── calendar.integration.ts     # NEW: Calendar sync flow
│   │   ├── link.integration.ts         # NEW: Link scoring pipeline
│   │   ├── contact.integration.ts      # Contact CRUD + deduplication
│   │   └── auth.integration.ts         # Login/logout flow
│   └── e2e/
│       ├── upload-and-parse.e2e.ts     # NEW: Upload file, verify parsing, create tags
│       ├── extract-and-link.e2e.ts     # NEW: Extract document, score appointments
│       ├── calendar-sync.e2e.ts        # NEW: Add calendar source, sync events
│       ├── contact-dedup.e2e.ts        # NEW: Duplicate detection and merge
│       └── search.e2e.ts               # FTS search across documents and notes
│
├── docs/
│   ├── PRD.md                          # v1.0 feature requirements
│   ├── PRD_V2.md                       # v1.1 feature requirements (NEW)
│   ├── ARCHITECTURE.md                 # v1.0 architecture
│   ├── ARCHITECTURE_V2.md              # v1.1 architecture (THIS FILE)
│   ├── WIREFRAMES.md                   # UI screen layouts
│   ├── CICD.md                         # CI/CD pipeline documentation
│   └── DEV_SETUP.md                    # Developer environment setup
│
├── .github/
│   └── workflows/
│       ├── lint.yml                    # ESLint and Prettier checks
│       ├── test.yml                    # Vitest + Playwright suite
│       ├── build-release.yml           # Build Tauri app + GitHub Release
│       └── security.yml                # Dependency scanning (Dependabot)
│
├── package.json                        # Node.js dependencies and scripts
├── tsconfig.json                       # TypeScript strict configuration
├── next.config.ts                      # Next.js build configuration
├── vitest.config.ts                    # Vitest test runner config
├── tailwind.config.js                  # Tailwind CSS configuration
├── postcss.config.js                   # PostCSS plugins (Tailwind)
├── .eslintrc.json                      # ESLint rules
├── .prettierrc.json                    # Code formatting configuration
├── README.md                           # Project overview
├── PLAN.md                             # Execution tracker and current task
└── CLAUDE.md                           # Claude Code project instructions
```

## 3. Extended Database Schema

### v1.0 Tables (Existing)

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  master_password_hash TEXT NOT NULL,
  master_key_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Documents (encrypted)
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Document content full-text search index
CREATE VIRTUAL TABLE documents_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  tokenize = 'porter'
);

-- Appointments (encrypted)
CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  provider_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Contacts (encrypted)
CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  title TEXT,
  organization TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notes (encrypted)
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### v1.1 New Tables

```sql
-- Categories (hierarchical, encrypted)
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  color_hex TEXT,
  icon_name TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, parent_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Document-Category many-to-many junction table
CREATE TABLE document_categories (
  document_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (document_id, category_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Appointment-Category many-to-many junction table
CREATE TABLE appointment_categories (
  appointment_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (appointment_id, category_id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Clinics/healthcare providers (encrypted)
CREATE TABLE clinics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Document-Appointment many-to-many junction with link metadata
CREATE TABLE document_appointments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'related', -- 'related', 'result', 'referral'
  confidence TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto'
  score INTEGER NOT NULL DEFAULT 0,          -- point total (0 if manual)
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (document_id, appointment_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
);

-- Full-text search index for appointments
CREATE VIRTUAL TABLE appointments_fts USING fts5(
  id UNINDEXED,
  title,
  description,
  provider_name,
  tokenize = 'porter'
);

-- Calendar sources (sync configuration)
CREATE TABLE calendar_sources (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'APPLE_CALENDAR', 'GOOGLE_CALENDAR', 'EXCHANGE' (future)
  source_name TEXT NOT NULL,
  source_identifier TEXT, -- e.g., EventKit calendar identifier
  is_synced BOOLEAN DEFAULT 1,
  last_sync_at TEXT,
  sync_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, source_type, source_name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Calendar events (synced from external calendars)
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  calendar_source_id TEXT NOT NULL,
  external_event_id TEXT, -- Source system's event ID
  title TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  location TEXT,
  organizer TEXT,
  is_synced BOOLEAN DEFAULT 1,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, calendar_source_id, external_event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (calendar_source_id) REFERENCES calendar_sources(id) ON DELETE CASCADE
);
```

### Extended v1.0 Tables

```sql
-- Extended documents table (add extraction metadata)
ALTER TABLE documents ADD COLUMN extraction_status TEXT DEFAULT 'PENDING'; -- PENDING, EXTRACTED, FAILED, SKIPPED
ALTER TABLE documents ADD COLUMN extracted_text TEXT; -- OCR results
ALTER TABLE documents ADD COLUMN extracted_at TEXT; -- Timestamp of extraction
ALTER TABLE documents ADD COLUMN extraction_error TEXT; -- Error message if failed
ALTER TABLE documents ADD COLUMN document_date TEXT; -- Parsed or user-provided date
ALTER TABLE documents ADD COLUMN parsed_filename TEXT; -- Original filename before parsing
ALTER TABLE documents ADD COLUMN parser_confidence REAL DEFAULT 1.0; -- Date extraction confidence (0.0-1.0)

-- Extended appointments table (add clinic association)
ALTER TABLE appointments ADD COLUMN clinic_id TEXT;
ALTER TABLE appointments FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE SET NULL;

-- Extended contacts table (add deduplication tracking)
ALTER TABLE contacts ADD COLUMN is_deduped_with TEXT; -- Links to primary contact if this is a duplicate
ALTER TABLE contacts ADD COLUMN dedup_score REAL; -- Levenshtein distance score if deduped
ALTER TABLE contacts FOREIGN KEY (is_deduped_with) REFERENCES contacts(id) ON DELETE SET NULL;
```

## 4. Extended Tauri IPC Commands

### Document Commands (Extended)

```rust
// src-tauri/src/commands/documents.rs

#[tauri::command]
async fn create_document(
  user_id: String,
  title: String,
  file_path: String,
  file_type: String,
  created_at: String,
  document_date: Option<String>, // NEW: user-provided date
) -> Result<DocumentDTO, String>

#[tauri::command]
async fn get_document(
  user_id: String,
  document_id: String,
) -> Result<DocumentDTO, String> // Now includes extracted_text, extraction_status

#[tauri::command]
async fn list_documents(
  user_id: String,
  filter: DocumentFilter, // filter by categories, date range, extraction status
  limit: i64,
  offset: i64,
) -> Result<Vec<DocumentDTO>, String>

#[tauri::command]
async fn update_document(
  user_id: String,
  document_id: String,
  title: Option<String>,
  document_date: Option<String>, // NEW: allow date override
  categories: Option<Vec<String>>, // NEW: assign categories
) -> Result<DocumentDTO, String>

#[tauri::command]
async fn delete_document(
  user_id: String,
  document_id: String,
) -> Result<(), String>

#[tauri::command]
async fn search_documents(
  user_id: String,
  query: String,
  limit: i64,
) -> Result<Vec<DocumentDTO>, String> // Uses FTS5 search

// NEW: Trigger extraction pipeline
#[tauri::command]
async fn extract_document(
  user_id: String,
  document_id: String,
) -> Result<ExtractionProgressDTO, String>

// NEW: Get extraction progress
#[tauri::command]
async fn get_extraction_progress(
  user_id: String,
  document_id: String,
) -> Result<ExtractionProgressDTO, String>
```

### Category Commands (NEW)

```rust
// src-tauri/src/commands/categories.rs

#[tauri::command]
async fn create_category(
  user_id: String,
  parent_id: Option<String>,
  name: String,
  color_hex: Option<String>,
  icon_name: Option<String>,
  description: Option<String>,
) -> Result<CategoryDTO, String>

#[tauri::command]
async fn get_category(
  user_id: String,
  category_id: String,
) -> Result<CategoryDTO, String>

#[tauri::command]
async fn list_categories(
  user_id: String,
) -> Result<Vec<CategoryDTO>, String> // Flat list for client-side tree building

#[tauri::command]
async fn get_category_tree(
  user_id: String,
) -> Result<CategoryTreeDTO, String> // Hierarchical tree structure

#[tauri::command]
async fn update_category(
  user_id: String,
  category_id: String,
  name: Option<String>,
  parent_id: Option<String>,
  color_hex: Option<String>,
  icon_name: Option<String>,
  description: Option<String>,
) -> Result<CategoryDTO, String>

#[tauri::command]
async fn delete_category(
  user_id: String,
  category_id: String,
  cascade: bool, // If true, move children to parent; if false, cascade delete
) -> Result<(), String>

#[tauri::command]
async fn assign_category_to_document(
  user_id: String,
  document_id: String,
  category_id: String,
) -> Result<(), String>

#[tauri::command]
async fn unassign_category_from_document(
  user_id: String,
  document_id: String,
  category_id: String,
) -> Result<(), String>

#[tauri::command]
async fn assign_category_to_appointment(
  user_id: String,
  appointment_id: String,
  category_id: String,
) -> Result<(), String>

#[tauri::command]
async fn unassign_category_from_appointment(
  user_id: String,
  appointment_id: String,
  category_id: String,
) -> Result<(), String>
```

### Appointment Commands (Extended)

```rust
// src-tauri/src/commands/appointments.rs

#[tauri::command]
async fn create_appointment(
  user_id: String,
  title: String,
  start_time: String,
  end_time: String,
  clinic_id: Option<String>,
  description: Option<String>,
  location: Option<String>,
  provider_name: Option<String>,
  categories: Option<Vec<String>>, // NEW
) -> Result<AppointmentDTO, String>

#[tauri::command]
async fn list_appointments(
  user_id: String,
  start_date: Option<String>,
  end_date: Option<String>,
  categories: Option<Vec<String>>, // NEW: filter by categories
  limit: i64,
  offset: i64,
) -> Result<Vec<AppointmentDTO>, String>

#[tauri::command]
async fn search_appointments(
  user_id: String,
  query: String,
) -> Result<Vec<AppointmentDTO>, String> // FTS search

// NEW: Get documents linked to appointment with scores
#[tauri::command]
async fn get_appointment_links(
  user_id: String,
  appointment_id: String,
) -> Result<Vec<LinkedDocumentDTO>, String>
```

### Extraction Commands (NEW)

```rust
// src-tauri/src/commands/extraction.rs

#[tauri::command]
async fn extract_document_text(
  user_id: String,
  document_id: String,
  use_ocr: bool, // If PDF is scanned, use Tesseract
) -> Result<ExtractionResultDTO, String>

#[tauri::command]
async fn extract_document_metadata(
  user_id: String,
  document_id: String,
) -> Result<DocumentMetadataDTO, String>
```

### Link Commands (NEW)

```rust
// src-tauri/src/commands/links.rs

#[tauri::command]
async fn score_document_appointment_links(
  user_id: String,
  document_id: String,
) -> Result<Vec<LinkedAppointmentDTO>, String>

#[tauri::command]
async fn get_all_links(
  user_id: String,
  min_score: f64, // e.g., 0.5
  limit: i64,
) -> Result<Vec<LinkScoreDTO>, String>

#[tauri::command]
async fn link_document_to_appointment(
  user_id: String,
  document_id: String,
  appointment_id: String,
  link_type: String, // 'EVIDENCE', 'REFERENCE', 'CONTEXT', 'AUTO'
) -> Result<(), String>

#[tauri::command]
async fn unlink_document_from_appointment(
  user_id: String,
  document_id: String,
  appointment_id: String,
) -> Result<(), String>
```

### Parsing Commands (NEW)

```rust
// src-tauri/src/commands/parsing.rs

#[tauri::command]
async fn parse_filename(
  filename: String,
) -> Result<ParsedFilenameDTO, String> // Returns date tags, format type, confidence

#[tauri::command]
async fn parse_bulk_filenames(
  filenames: Vec<String>,
) -> Result<Vec<ParsedFilenameDTO>, String>
```

### Calendar Commands (NEW)

```rust
// src-tauri/src/commands/calendar.rs

#[tauri::command]
async fn list_calendar_sources(
  user_id: String,
) -> Result<Vec<CalendarSourceDTO>, String>

#[tauri::command]
async fn add_calendar_source(
  user_id: String,
  source_type: String, // 'APPLE_CALENDAR'
  source_name: String,
  source_identifier: String,
) -> Result<CalendarSourceDTO, String>

#[tauri::command]
async fn sync_calendar_source(
  user_id: String,
  source_id: String,
) -> Result<SyncResultDTO, String> // Fetches events from EventKit

#[tauri::command]
async fn get_synced_calendar_events(
  user_id: String,
  source_id: Option<String>, // If None, return all synced events
  start_date: Option<String>,
  end_date: Option<String>,
) -> Result<Vec<CalendarEventDTO>, String>

#[tauri::command]
async fn sync_all_calendars(
  user_id: String,
) -> Result<SyncResultDTO, String> // Batch sync all sources

#[tauri::command]
async fn remove_calendar_source(
  user_id: String,
  source_id: String,
) -> Result<(), String>
```

### Contact Commands (Extended)

```rust
// src-tauri/src/commands/contacts.rs

#[tauri::command]
async fn create_contact(
  user_id: String,
  name: String,
  phone: Option<String>,
  email: Option<String>,
  title: Option<String>,
  organization: Option<String>,
) -> Result<ContactDTO, String>

#[tauri::command]
async fn list_contacts(
  user_id: String,
) -> Result<Vec<ContactDTO>, String>

#[tauri::command]
async fn search_contacts(
  user_id: String,
  query: String,
) -> Result<Vec<ContactDTO>, String>

// NEW: Auto-create contacts from appointment providers
#[tauri::command]
async fn auto_create_contact_from_appointment(
  user_id: String,
  appointment_id: String,
) -> Result<ContactDTO, String>

// NEW: Find duplicate contacts
#[tauri::command]
async fn find_duplicate_contacts(
  user_id: String,
  contact_id: String,
  similarity_threshold: f64, // e.g., 0.85
) -> Result<Vec<DuplicateContactDTO>, String>

// NEW: Merge duplicate contacts
#[tauri::command]
async fn merge_contacts(
  user_id: String,
  primary_id: String,
  duplicate_ids: Vec<String>,
) -> Result<ContactDTO, String>
```

## 5. Zustand State Management (Extended)

### New categoryStore

```typescript
// src/store/categoryStore.ts

interface Category {
  id: string
  userId: string
  parentId: string | null
  name: string
  colorHex?: string
  iconName?: string
  description?: string
  createdAt: string
  updatedAt: string
}

interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[]
}

interface CategoryStoreState {
  // Data
  categories: Category[]
  categoryTree: CategoryTreeNode | null
  selectedCategoryIds: Set<string>
  
  // Status
  isLoading: boolean
  error: string | null
  
  // Actions
  fetchCategories: () => Promise<void>
  fetchCategoryTree: () => Promise<void>
  createCategory: (
    parentId: string | null,
    name: string,
    colorHex?: string,
  ) => Promise<void>
  updateCategory: (
    id: string,
    updates: Partial<Category>,
  ) => Promise<void>
  deleteCategory: (id: string, cascade?: boolean) => Promise<void>
  toggleCategorySelection: (id: string) => void
  clearSelection: () => void
  getCategoryPath: (id: string) => string // Returns "Parent > Child > Name"
}

export const useCategoryStore = create<CategoryStoreState>(...)
```

### New calendarStore

```typescript
// src/store/calendarStore.ts

interface CalendarSource {
  id: string
  userId: string
  sourceType: 'APPLE_CALENDAR'
  sourceName: string
  sourceIdentifier: string
  isSynced: boolean
  lastSyncAt?: string
  syncError?: string
  createdAt: string
  updatedAt: string
}

interface CalendarEvent {
  id: string
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  organizer?: string
}

interface CalendarStoreState {
  // Data
  sources: CalendarSource[]
  syncedEvents: CalendarEvent[]
  
  // Status
  isSyncing: boolean
  syncStatus: Record<string, SyncStatus> // source_id => status
  error: string | null
  
  // Actions
  fetchCalendarSources: () => Promise<void>
  addCalendarSource: (
    sourceType: string,
    sourceName: string,
    sourceIdentifier: string,
  ) => Promise<void>
  syncCalendarSource: (sourceId: string) => Promise<void>
  syncAllCalendars: () => Promise<void>
  removeCalendarSource: (sourceId: string) => Promise<void>
  getSyncedEvents: (
    sourceId?: string,
    startDate?: string,
    endDate?: string,
  ) => Promise<void>
}

export const useCalendarStore = create<CalendarStoreState>(...)
```

### New linkStore

```typescript
// src/store/linkStore.ts

interface LinkedDocument {
  documentId: string
  title: string
  score: number           // point total (0 if manual)
  confidence: 'manual' | 'auto'
  linkType: 'related' | 'result' | 'referral'
  reasons: string[]       // e.g. ['date_proximity', 'doctor_match']
  linkedAt: string
}

interface LinkStoreState {
  // Data
  links: LinkedDocument[]
  scoringCache: Record<string, LinkedDocument[]> // appointmentId => links
  
  // Filters
  minScore: number
  linkedType: 'ALL' | 'EVIDENCE' | 'REFERENCE' | 'CONTEXT' | 'AUTO'
  
  // Status
  isLoading: boolean
  isScoring: boolean
  error: string | null
  
  // Actions
  fetchLinksForAppointment: (appointmentId: string) => Promise<void>
  fetchAllLinks: (minScore: number) => Promise<void>
  scoreDocumentAppointmentLinks: (
    documentId: string,
  ) => Promise<LinkedDocument[]>
  linkDocumentToAppointment: (
    documentId: string,
    appointmentId: string,
    linkType: string,
  ) => Promise<void>
  unlinkDocumentFromAppointment: (
    documentId: string,
    appointmentId: string,
  ) => Promise<void>
  setMinScore: (score: number) => void
  setLinkedTypeFilter: (type: string) => void
}

export const useLinkStore = create<LinkStoreState>(...)
```

### Extended contactStore

```typescript
// src/store/contactStore.ts (EXTENDED)

interface ContactStoreState {
  // Existing
  contacts: Contact[]
  selectedContactIds: Set<string>
  isLoading: boolean
  error: string | null
  
  // NEW: Deduplication
  duplicateCandidates: DuplicateContactGroup[]
  isDedupLoading: boolean
  
  // Existing actions
  fetchContacts: () => Promise<void>
  createContact: (contact: Partial<Contact>) => Promise<void>
  updateContact: (id: string, updates: Partial<Contact>) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  
  // NEW: Auto-create from appointment
  autoCreateContactFromAppointment: (
    appointmentId: string,
  ) => Promise<void>
  
  // NEW: Deduplication actions
  findDuplicates: (
    contactId: string,
    threshold?: number,
  ) => Promise<void>
  mergeDuplicateContacts: (
    primaryId: string,
    duplicateIds: string[],
  ) => Promise<void>
}

export const useContactStore = create<ContactStoreState>(...)
```

## 6. File Storage Layout

```
~/Library/Application Support/com.myhealth.app/  (macOS)
├── data/
│   └── myhealth.db              # SQLite database (encrypted with SQLCipher)
├── files/
│   ├── documents/
│   │   ├── {document_id}/
│   │   │   ├── original.pdf     # Original uploaded file
│   │   │   ├── extracted.txt    # Extracted text from PDF/OCR
│   │   │   └── metadata.json    # Document metadata
│   │   └── {document_id}/
│   ├── cache/
│   │   ├── thumbnails/          # Document preview images
│   │   └── thumbnails/          # Regenerable document preview cache
│   └── logs/
│       └── app.log              # Application logs
└── config/
    └── app.config.json          # App preferences, calendar sync config
```

## 7. Encryption & Security

### Database Encryption

```rust
// src-tauri/src/crypto.rs

use sqlcipher::Connection;
use pbkdf2::{Pbkdf2, Hmac};
use sha2::Sha512;

pub fn derive_key(password: &str, salt: &[u8]) -> Vec<u8> {
  // PBKDF2-SHA512 with 100,000 iterations
  let key = Pbkdf2::new(
    Hmac::<Sha512>::new_from_slice(password.as_bytes()).unwrap(),
    salt,
    100_000,
    32 // 256 bits
  );
  // Derive key
}

pub fn open_encrypted_db(
  path: &str,
  derived_key: &[u8],
) -> Result<Connection, Error> {
  let conn = Connection::open(path)?;
  let key_hex = hex::encode(derived_key);
  conn.execute(&format!("PRAGMA key = \"x'{}'\"", key_hex))?;
  conn.pragma_update(None, "cipher", "sqlcipher")?;
  Ok(conn)
}
```

### Data at Rest

- All database tables encrypted via SQLCipher AES-256
- Master key derived via PBKDF2-SHA512 (100k iterations) from user password
- Salt stored in `users` table with password hash
- Extracted text (including OCR results) stored encrypted in `extracted_text` column

### Data in Transit

- No network calls from application (offline-only)
- IPC communication between frontend and Rust backend is unencrypted (in-process, secure)
- No credentials transmitted outside application

## 8. Extraction Pipeline

### High-Level Flow

```
User uploads document (PDF/image)
    ↓
Frontend: Parse filename for date/tags
    ↓
Frontend: Create document record in DB
    ↓
Frontend: Call extract_document() IPC
    ↓
Rust: Check file type
    ├─ If PDF → Extract text via pdf-extract crate
    └─ If image/scanned PDF → Extract text via Tesseract OCR
    ↓
Rust: Update document.extracted_text and document.extraction_status
    ↓
Frontend: Listen for extraction_progress event (via tauri::emit)
    ↓
Frontend: Display completion and trigger link scoring
    ↓
Rust: (Optional) Automatically score document against appointments
    ↓
Frontend: Display linked appointments with scores
```

### Async Implementation

```rust
// src-tauri/src/services/extraction/mod.rs

pub async fn extract_document_async(
  db: &AppState,
  user_id: &str,
  document_id: &str,
  use_ocr: bool,
) -> Result<ExtractionResult, ExtractError> {
  let doc = db.fetch_document(document_id)?;
  
  // Step 1: Determine extraction method
  let file_type = &doc.file_type;
  let extracted_text = match file_type.as_str() {
    "application/pdf" => {
      if use_ocr || is_pdf_scanned(&doc.file_path)? {
        extract_via_ocr(&doc.file_path).await?
      } else {
        extract_text_from_pdf(&doc.file_path)?
      }
    }
    "image/jpeg" | "image/png" => extract_via_ocr(&doc.file_path).await?,
    _ => return Err(ExtractError::UnsupportedFileType),
  };
  
  // Step 2: Store extracted text
  db.update_document_extraction(
    document_id,
    &extracted_text,
    ExtractionStatus::Extracted,
  )?;
  
  // Step 3: (Optional) Score document against appointments
  let scores = score_document_appointments(db, user_id, document_id).await?;
  
  Ok(ExtractionResult {
    extracted_text,
    word_count: extracted_text.split_whitespace().count(),
    extracted_at: now(),
    scores,
  })
}

pub async fn extract_text_from_pdf(
  file_path: &str,
) -> Result<String, ExtractError> {
  let document = pdf_extract::Document::load(file_path)?;
  let pages = document.get_pages();
  let mut content = String::new();
  
  for (_, page_id) in pages.iter() {
    let content_data = document.get_page_content(*page_id)?;
    let content_str = String::from_utf8_lossy(&content_data);
    content.push_str(&content_str);
  }
  
  Ok(content)
}

pub async fn extract_via_ocr(
  file_path: &str,
) -> Result<String, ExtractError> {
  // Spawn Tesseract as subprocess
  let output = tokio::process::Command::new("tesseract")
    .arg(file_path)
    .arg("stdout")
    .output()
    .await?;
  
  Ok(String::from_utf8(output.stdout)?)
}
```

## 9. Link Scoring Engine

### Point Scoring Algorithm

Links between documents and appointments are scored by accumulating points across four signals. A candidate pair is surfaced as a suggestion only when the total reaches the threshold.

| Signal | Points | Implementation |
|--------|--------|----------------|
| Document date within ±3 days of appointment date | +3 | Compare `document_date` vs `appt_date` |
| Doctor name in extracted text matches `doctor_name` (Levenshtein ≤ 2) | +3 | `strsim::levenshtein` |
| Shared category (document and appointment share a `category_id`) | +2 | JOIN on `document_categories` / `appointment_categories` |
| Shared clinic (`contact.clinic_id` matches appointment's clinic context) | +2 | JOIN on `clinics` |
| **Threshold to surface suggestion** | **≥ 4** | Below this = not shown |

> **Note:** TF-IDF is used only by FTS5 full-text search (SQLite built-in). It is not used for link scoring.

```rust
// src-tauri/src/services/linking/scorer.rs

pub struct LinkCandidate {
    pub appointment_id: String,
    pub score: u8,
    pub reasons: Vec<&'static str>,
}

pub fn score_link_candidates(
    doc: &Document,
    appointments: &[Appointment],
    conn: &Connection,
) -> Vec<LinkCandidate> {
    let mut candidates: Vec<LinkCandidate> = appointments
        .iter()
        .filter_map(|apt| {
            let mut score: u8 = 0;
            let mut reasons = Vec::new();

            // Signal 1: date proximity
            if let (Some(doc_date), Ok(apt_date)) = (
                &doc.document_date,
                NaiveDate::parse_from_str(&apt.appt_date, "%Y-%m-%d"),
            ) {
                if let Ok(d) = NaiveDate::parse_from_str(doc_date, "%Y-%m-%d") {
                    let diff = (d - apt_date).num_days().abs();
                    if diff <= 3 {
                        score += 3;
                        reasons.push("date_proximity");
                    }
                }
            }

            // Signal 2: doctor name match
            if let (Some(extracted), Some(doctor)) =
                (&doc.extracted_text, &apt.doctor_name)
            {
                let name_lower = doctor.to_lowercase();
                if extracted.to_lowercase().contains(&name_lower)
                    || strsim::levenshtein(&name_lower, &extracted.to_lowercase()) <= 2
                {
                    score += 3;
                    reasons.push("doctor_match");
                }
            }

            // Signal 3: shared category
            if shared_category(doc.id(), apt.id(), conn) {
                score += 2;
                reasons.push("shared_category");
            }

            // Signal 4: shared clinic
            if shared_clinic(doc.id(), apt.id(), conn) {
                score += 2;
                reasons.push("shared_clinic");
            }

            if score >= 4 {
                Some(LinkCandidate { appointment_id: apt.id.clone(), score, reasons })
            } else {
                None
            }
        })
        .collect();

    candidates.sort_by(|a, b| b.score.cmp(&a.score));
    candidates
}
```

## 10. Calendar Sync Architecture

### EventKit Integration (macOS)

```rust
// src-tauri/src/services/calendar/events.rs

#[cfg(target_os = "macos")]
pub mod eventkit {
  use objc::{msg_send, sel, sel_impl};
  use objc_foundation::{NSString, NSArray, NSDictionary};
  
  pub fn fetch_calendar_events(
    calendar_identifier: &str,
  ) -> Result<Vec<CalendarEventData>, CalendarError> {
    unsafe {
      // Get EventStore
      let event_store_class = class!(EKEventStore);
      let event_store: *mut NSObject = msg_send![event_store_class, alloc];
      let event_store: *mut NSObject = msg_send![event_store, init];
      
      // Get Calendar by identifier
      let calendar_id_ns = NSString::alloc(calendar_identifier);
      let calendar: *mut NSObject = msg_send![
        event_store,
        calendarWithIdentifier: calendar_id_ns
      ];
      
      // Fetch events
      let predicate: *mut NSObject = msg_send![
        event_store,
        predicateForEventsWithStartDate:start_date endDate:end_date calendars:calendar_array
      ];
      
      let events: *mut NSArray = msg_send![
        event_store,
        eventsMatchingPredicate: predicate
      ];
      
      // Convert to Rust structs
      let events_count: u64 = msg_send![events, count];
      let mut result = Vec::new();
      
      for i in 0..events_count {
        let event: *mut NSObject = msg_send![events, objectAtIndex: i];
        let title: *const i8 = msg_send![event, title];
        let start_date: *mut NSObject = msg_send![event, startDate];
        let end_date: *mut NSObject = msg_send![event, endDate];
        
        result.push(CalendarEventData {
          title: CStr::from_ptr(title).to_string_lossy().to_string(),
          start_time: format_ns_date(start_date),
          end_time: format_ns_date(end_date),
        });
      }
      
      Ok(result)
    }
  }
}
```

## 11. Filename Parsing Module

### Pattern Recognition

```rust
// src-tauri/src/services/parsing/patterns.rs

pub struct FilenameParser;

impl FilenameParser {
  pub fn parse(filename: &str) -> ParsedFilename {
    let mut result = ParsedFilename {
      date_tag: None,
      date_confidence: 0.0,
      format_type: None,
      extracted_name: filename.to_string(),
    };
    
    // Pattern 1: DD Mon YYYY (e.g., "01 Dec 2023")
    if let Some((date, confidence)) = self.extract_dmy_pattern(filename) {
      result.date_tag = Some(date);
      result.date_confidence = confidence;
      return result;
    }
    
    // Pattern 2: YYYY-MM-DD (e.g., "2023-12-01")
    if let Some((date, confidence)) = self.extract_iso_pattern(filename) {
      result.date_tag = Some(date);
      result.date_confidence = confidence;
      return result;
    }
    
    // Pattern 3: MM/DD/YYYY (e.g., "12/01/2023")
    if let Some((date, confidence)) = self.extract_mdy_pattern(filename) {
      result.date_tag = Some(date);
      result.date_confidence = confidence;
      return result;
    }
    
    // Pattern 4: Year only (e.g., "2023" somewhere in filename)
    if let Some((year, confidence)) = self.extract_year_only(filename) {
      result.date_tag = Some(year);
      result.date_confidence = confidence;
      return result;
    }
    
    result
  }
  
  fn extract_dmy_pattern(&self, filename: &str) -> Option<(String, f64)> {
    let re = regex::Regex::new(r"(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})").ok()?;
    
    if let Some(caps) = re.captures(filename) {
      let date = format!("{} {} {}", &caps[1], &caps[2], &caps[3]);
      Some((date, 0.95))
    } else {
      None
    }
  }
  
  fn extract_iso_pattern(&self, filename: &str) -> Option<(String, f64)> {
    let re = regex::Regex::new(r"(\d{4})-(\d{2})-(\d{2})").ok()?;
    
    if let Some(caps) = re.captures(filename) {
      let date = format!("{}-{}-{}", &caps[1], &caps[2], &caps[3]);
      Some((date, 0.95))
    } else {
      None
    }
  }
  
  fn extract_year_only(&self, filename: &str) -> Option<(String, f64)> {
    let re = regex::Regex::new(r"\b(19|20)\d{2}\b").ok()?;
    
    if let Some(caps) = re.captures(filename) {
      Some((caps[1].to_string(), 0.6))
    } else {
      None
    }
  }
}
```

## 12. Contact Deduplication

### Levenshtein Distance Matching

```rust
// src-tauri/src/services/deduplication/contact.rs

use strsim::levenshtein;

pub struct ContactDeduplicator;

impl ContactDeduplicator {
  pub fn find_duplicates(
    primary_contact: &Contact,
    all_contacts: &[Contact],
    threshold: f64,
  ) -> Vec<DuplicateCandidate> {
    let mut candidates = Vec::new();
    
    for other in all_contacts {
      if primary_contact.id == other.id {
        continue;
      }
      
      // Normalize names for comparison
      let primary_name = primary_contact.name.to_lowercase();
      let other_name = other.name.to_lowercase();
      
      // Compute Levenshtein distance (0 = identical, higher = more different)
      let distance = levenshtein(&primary_name, &other_name);
      let max_len = primary_name.len().max(other_name.len());
      
      // Convert to similarity score (0.0-1.0)
      let similarity = if max_len == 0 {
        1.0
      } else {
        1.0 - (distance as f64 / max_len as f64)
      };
      
      // Check email and phone matches
      let email_match = primary_contact.email
        .as_ref()
        .and_then(|e1| other.email.as_ref().map(|e2| e1 == e2))
        .unwrap_or(false);
      
      let phone_match = primary_contact.phone
        .as_ref()
        .and_then(|p1| other.phone.as_ref().map(|p2| p1 == p2))
        .unwrap_or(false);
      
      // If similarity > threshold OR exact email/phone match, flag as duplicate
      if similarity >= threshold || email_match || phone_match {
        candidates.push(DuplicateCandidate {
          contact: other.clone(),
          similarity_score: similarity,
          match_reason: if email_match {
            "Email match"
          } else if phone_match {
            "Phone match"
          } else {
            "Name similarity"
          },
        });
      }
    }
    
    candidates.sort_by(|a, b| b.similarity_score.partial_cmp(&a.similarity_score).unwrap());
    candidates
  }
  
  pub fn merge_contacts(
    primary_id: &str,
    duplicate_ids: &[String],
    db: &Database,
  ) -> Result<Contact, Error> {
    // Fetch all contacts
    let primary = db.fetch_contact(primary_id)?;
    let duplicates: Vec<Contact> = duplicate_ids
      .iter()
      .map(|id| db.fetch_contact(id))
      .collect::<Result<Vec<_>, _>>()?;
    
    // Merge data (prefer non-null fields from primary)
    let merged = Contact {
      id: primary.id.clone(),
      name: primary.name.clone(),
      email: primary.email.clone().or_else(
        || duplicates.iter().find_map(|d| d.email.clone())
      ),
      phone: primary.phone.clone().or_else(
        || duplicates.iter().find_map(|d| d.phone.clone())
      ),
      title: primary.title.clone().or_else(
        || duplicates.iter().find_map(|d| d.title.clone())
      ),
      organization: primary.organization.clone().or_else(
        || duplicates.iter().find_map(|d| d.organization.clone())
      ),
      ..primary.clone()
    };
    
    // Update primary contact with merged data
    db.update_contact(&merged)?;
    
    // Mark duplicates as merged
    for dup_id in duplicate_ids {
      db.update_contact(&Contact {
        is_deduped_with: Some(primary_id.to_string()),
        dedup_score: Some(0.9),
        ..db.fetch_contact(dup_id)?
      })?;
    }
    
    Ok(merged)
  }
}
```

## 13. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/build-release.yml

name: Build & Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: x86_64-apple-darwin
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Type check
        run: pnpm tsc --noEmit
      
      - name: Lint
        run: pnpm eslint src --max-warnings 0
      
      - name: Test
        run: pnpm test:coverage
      
      - name: Build Tauri app
        run: pnpm tauri build
      
      - name: Upload to GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: src-tauri/target/release/bundle/dmg/*

  build-windows:
    runs-on: windows-latest
    steps:
      # Similar steps for Windows .exe and .msi builds

  test-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests with coverage
        run: pnpm vitest --coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## 14. Performance Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| Document upload | < 2s | File copy and DB insert |
| Filename parsing | < 200ms | Regex pattern matching |
| PDF text extraction | < 10s | For 10 pages |
| PDF OCR extraction | < 30s | For 5 scanned pages |
| Document search (FTS) | < 500ms | For 100+ documents |
| Appointment load (100+) | < 500ms | From calendar sync |
| Link scoring (doc + 200 apts) | < 200ms | Point scoring across 4 signals |
| Category tree build | < 100ms | For 50+ categories |
| Calendar sync | < 5s | Fetch 1-2 months of events from EventKit |
| Contact dedup scan | < 2s | For 500 contacts |
| Database open/decrypt | < 1s | SQLCipher AES-256 unlock |

## 15. Security Threat Model

| Threat | Impact | Mitigation |
|--------|--------|-----------|
| Stolen device | HIGH | Master password + SQLCipher AES-256 |
| Weak password | HIGH | Enforce min 12 chars, PBKDF2 100k iterations |
| Unencrypted backups | MEDIUM | Educate users; document encryption method |
| Malicious app on device | MEDIUM | No network calls; IPC is in-process |
| Plaintext OCR output | MEDIUM | Encrypt extracted_text in DB |
| SQL injection | MEDIUM | Parameterized queries only (Rust sqlcipher) |
| XSS in frontend | MEDIUM | React auto-escapes; CSP in Tauri |
| Race condition in extraction | LOW | Tokio mutex on extraction state |

## 16. Migration Strategy (v1 → v1.1)

### Schema Migration

```sql
-- 1. Create new tables (non-breaking)
CREATE TABLE categories (...)
CREATE TABLE document_categories (...)
CREATE TABLE appointment_categories (...)
CREATE TABLE clinics (...)
CREATE TABLE document_appointments (...)
CREATE TABLE calendar_sources (...)
CREATE TABLE calendar_events (...)

-- 2. Add new columns to existing tables
ALTER TABLE documents ADD COLUMN extraction_status TEXT DEFAULT 'SKIPPED';
ALTER TABLE documents ADD COLUMN extracted_text TEXT;
ALTER TABLE documents ADD COLUMN extracted_at TEXT;
ALTER TABLE documents ADD COLUMN extraction_error TEXT;
ALTER TABLE documents ADD COLUMN document_date TEXT;
ALTER TABLE documents ADD COLUMN parsed_filename TEXT;
ALTER TABLE documents ADD COLUMN parser_confidence REAL DEFAULT 1.0;

ALTER TABLE appointments ADD COLUMN clinic_id TEXT;

ALTER TABLE contacts ADD COLUMN is_deduped_with TEXT;
ALTER TABLE contacts ADD COLUMN dedup_score REAL;

-- 3. Run background migrations
-- Mark all existing documents as SKIPPED (user can re-extract if desired)
UPDATE documents SET extraction_status = 'SKIPPED' WHERE extraction_status = 'PENDING';

-- 4. Create default system category
INSERT INTO categories (id, user_id, parent_id, name, color_hex, icon_name)
SELECT uuid(), id, NULL, 'Uncategorized', '#999999', 'folder'
FROM users;
```

### Frontend Migration

- No breaking changes to existing routes
- New routes (`/categories`, `/calendar`, `/links`) are non-blocking
- Existing document/appointment views continue to work
- Graceful degradation if extraction fails

### Data Integrity

- All new columns have sensible defaults
- Existing documents/appointments/contacts remain unchanged
- No data loss during upgrade
- User can safely rollback to v1.0 if needed (schema is forward-compatible)

## 17. API Reference for Hooks

### useCategories

```typescript
const { 
  categories,      // Category[]
  categoryTree,    // CategoryTreeNode | null
  selectedIds,     // Set<string>
  isLoading,       // boolean
  error,           // string | null
  
  fetchCategories,     // () => Promise<void>
  fetchCategoryTree,   // () => Promise<void>
  createCategory,      // (parentId, name, colorHex?) => Promise<void>
  updateCategory,      // (id, updates) => Promise<void>
  deleteCategory,      // (id, cascade?) => Promise<void>
  toggleSelection,     // (id) => void
  clearSelection,      // () => void
  getCategoryPath,     // (id) => string
} = useCategories()
```

### useCalendarSync

```typescript
const {
  sources,               // CalendarSource[]
  syncedEvents,          // CalendarEvent[]
  isSyncing,             // boolean
  syncStatus,            // Record<string, SyncStatus>
  error,                 // string | null
  
  fetchCalendarSources,  // () => Promise<void>
  addCalendarSource,     // (type, name, id) => Promise<void>
  syncCalendarSource,    // (sourceId) => Promise<void>
  syncAllCalendars,      // () => Promise<void>
  removeCalendarSource,  // (sourceId) => Promise<void>
  getSyncedEvents,       // (sourceId?, startDate?, endDate?) => Promise<void>
} = useCalendarSync()
```

### useLinks

```typescript
const {
  links,                    // LinkedDocument[]
  scoringCache,             // Record<string, LinkedDocument[]>
  minScore,                 // number
  linkedType,               // 'ALL' | 'EVIDENCE' | ...
  isLoading,                // boolean
  isScoring,                // boolean
  error,                    // string | null
  
  fetchLinksForAppointment, // (appointmentId) => Promise<void>
  fetchAllLinks,            // (minScore) => Promise<void>
  scoreDocumentAppointmentLinks, // (documentId) => Promise<LinkedDocument[]>
  linkDocumentToAppointment,     // (docId, aptId, type) => Promise<void>
  unlinkDocumentFromAppointment, // (docId, aptId) => Promise<void>
  setMinScore,              // (score) => void
  setLinkedTypeFilter,      // (type) => void
} = useLinks()
```

## 18. Build & Deployment

### Development Build

```bash
# Install dependencies
pnpm install

# Type check
pnpm tsc --noEmit

# Lint
pnpm eslint src

# Test
pnpm test

# Run dev server (hot reload)
pnpm dev

# Build Tauri app in dev mode
pnpm tauri dev
```

### Production Build

```bash
# Build Next.js static export
pnpm build

# Build Tauri desktop app
pnpm tauri build

# Outputs:
# - macOS: src-tauri/target/release/bundle/dmg/myHealth_x.x.x_x64.dmg
# - Windows: src-tauri/target/release/bundle/msi/myHealth_x.x.x_x64_en-US.msi
# - Linux: src-tauri/target/release/bundle/deb/myhealth_x.x.x_amd64.deb
```

### Release Process

1. Create a semantic version tag (`v1.1.0`)
2. Push tag to GitHub
3. GitHub Actions automatically builds and creates release
4. Release artifacts available at `/releases`

## 19. Summary

myHealth v1.1 extends the v1.0 foundation with six major features:

1. **Intelligent Filename Parsing (F1)** — Extracts dates and auto-creates tags
2. **PDF/OCR Text Extraction (F2)** — Async extraction pipeline with Tesseract fallback
3. **Hierarchical Categories (F3)** — Many-to-many relationships with documents and appointments
4. **Apple Calendar Integration (F4)** — EventKit sync with event-to-appointment mapping
5. **Contact Auto-Creation (F5)** — From appointment providers with deduplication
6. **Document-Appointment Link Scoring (F6)** — Point scoring across date, doctor, category, and clinic signals (threshold ≥ 4)

All features maintain **80%+ test coverage**, **local-first design**, and **end-to-end encryption**. The architecture supports graceful scaling, background task processing via Tokio, and a clear IPC boundary between frontend and Rust backend.
