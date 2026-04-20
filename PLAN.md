# myHealth — Executive Execution Plan

> **HOW TO RESUME:** Type `go` in any session. Claude will read this file, find the ▶ marker, and start executing from that exact task. No context needed — every task is self-contained.

---

## RESUME POINT (always current)

```
▶ NEXT ACTION:  Phase 7 › Task 7.1
   WHAT:        Rust note commands — all 7 commands from docs/ARCHITECTURE.md §4.4
   CREATE:      src-tauri/src/commands/notes.rs
   THEN:        go
```

---

## Status Legend

```
[x]  complete
[ ]  pending
▶    next action (exactly one at any time)
```

---

## Phase 0 — Documentation  ✅ COMPLETE

| Task | File | Status |
|------|------|--------|
| 0.1 | `docs/PRD.md` | [x] |
| 0.2 | `docs/ARCHITECTURE.md` | [x] |
| 0.3 | `docs/WIREFRAMES.md` | [x] |
| 0.4 | `.github/workflows/lint.yml` | [x] |
| 0.5 | `.github/workflows/test.yml` | [x] |
| 0.6 | `.github/workflows/build-release.yml` | [x] |
| 0.7 | `README.md` | [x] |

---

## Phase 1 — Project Scaffold

[x] **1.1 — Initialize Tauri + Next.js**
   - Command: `npm create tauri-app@latest . -- --template next --manager npm`
   - Accept defaults; choose TypeScript when prompted
   - Creates: `package.json`, `src-tauri/`, `src/app/`, `next.config.ts`, `tailwind.config.ts`
   - Done when: `npm run tauri dev` opens a native window with the default page

[x] **1.2 — Configure TypeScript strict mode**
   - Edit `tsconfig.json`: set `"strict": true`, `"noUncheckedIndexedAccess": true`
   - Done when: `npm run typecheck` passes with zero errors

[x] **1.3 — Add project dependencies**
   - Run: `npm install zustand tiptap @tiptap/react @tiptap/extension-bold @tiptap/extension-italic @tiptap/extension-heading @tiptap/extension-bullet-list @tiptap/extension-ordered-list pdf-lib`
   - Run: `npm install -D vitest @testing-library/react @testing-library/user-event @vitejs/plugin-react jsdom`
   - Done when: `npm install` exits 0

[x] **1.4 — Configure Tailwind CSS**
   - Verify `tailwind.config.ts` covers `src/**/*.{ts,tsx}`
   - Add design tokens to `src/styles/tokens.css` (colors, spacing, typography)
   - Done when: a test component renders with Tailwind classes

[x] **1.5 — Configure Vitest**
   - Create `vitest.config.ts` with jsdom environment and coverage thresholds (80%)
   - Add `"test": "vitest"`, `"test:coverage": "vitest run --coverage"` to `package.json`
   - Done when: `npm run test` runs (no tests yet is fine)

[x] **1.6 — Git init & first commit**
   - `git init && git add . && git commit -m "chore: initial project scaffold"`
   - `git remote add origin <repo-url>` (user provides)
   - Done when: `git log --oneline` shows first commit

---

## Phase 2 — Database & Encryption Layer

[x] **2.1 — Add Rust dependencies**
   - In `src-tauri/Cargo.toml` add: `rusqlite` (features: `sqlcipher`, `bundled`), `uuid`, `chrono`, `serde`, `serde_json`, `pbkdf2`, `hmac`, `sha2`
   - Done when: `cargo build` in `src-tauri/` succeeds

[x] **2.2 — Write database schema**
   - Create `src-tauri/src/db/schema.sql` — copy schema verbatim from `docs/ARCHITECTURE.md §3`
   - Includes 9 tables + FTS5 virtual table
   - Done when: `sqlite3 :memory: < src-tauri/src/db/schema.sql` exits 0

[x] **2.3 — Implement DB module**
   - Create `src-tauri/src/db/mod.rs`: `open_db(path, key)` opens SQLCipher DB, applies PRAGMAs, runs migrations
   - Create `src-tauri/src/db/migrations.rs`: version table + schema application
   - Done when: `cargo test` passes for DB open/close round-trip

[x] **2.4 — Implement crypto module**
   - Create `src-tauri/src/crypto.rs`: `derive_key(password, salt)` — PBKDF2-SHA512, 64,000 iterations → 32-byte key
   - Done when: `cargo test` passes for a known PBKDF2 test vector

---

## Phase 3 — Auth (Lock / Unlock)

[x] **3.1 — Rust auth commands**
   - Create `src-tauri/src/commands/auth.rs`
   - Implement: `auth_unlock`, `auth_lock`, `auth_set_password`, `auth_change_password`, `auth_is_locked`
   - Register all in `main.rs`
   - Done when: `cargo test` passes for lock/unlock round-trip

[x] **3.2 — Frontend lock screen**
   - Create `src/app/page.tsx` — password input + Unlock button
   - Create `src/store/authStore.ts` — `isLocked`, `setLocked`
   - Create `src/hooks/useAuth.ts` — calls `auth_unlock` IPC
   - Match wireframe: Screen 1 in `docs/WIREFRAMES.md`
   - Done when: correct password unlocks to dashboard; wrong password shows error

[x] **3.3 — Auto-lock on inactivity**
   - Detect mouse/keyboard idle; after N minutes call `auth_lock`
   - N read from `settings` table (default 15 min)
   - Done when: app locks after idle period in dev mode

---

## Phase 4 — App Shell & Navigation

[x] **4.1 — Sidebar layout**
   - Create `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`
   - Navigation routes: Dashboard, Documents, Appointments, Notes, Contacts, Timeline, Settings
   - Match wireframe: Screen 2
   - Done when: all nav links render and route without errors

[x] **4.2 — Search modal skeleton**
   - Create `src/components/search/SearchModal.tsx`
   - Cmd/Ctrl+K opens; Escape closes; IPC wired in Phase 9
   - Done when: keyboard shortcut opens and closes modal

---

## Phase 5 — Documents Feature

[x] **5.1 — Rust document commands**
   - Create `src-tauri/src/commands/documents.rs`
   - Implement all 8 commands from `docs/ARCHITECTURE.md §4.2`
   - Copy file to `~/.myHealth/files/documents/<uuid>/original.<ext>`
   - Generate 200×200 WebP thumbnail for image types
   - Done when: `cargo test` covers upload, list, get, delete, restore

[x] **5.2 — Documents list page**
   - Create `src/app/documents/page.tsx`, `DocumentList.tsx`, `DocumentCard.tsx`
   - Category filter chips, pagination
   - Create `src/store/documentsStore.ts`, `src/hooks/useDocuments.ts`
   - Match wireframe: Screen 4
   - Done when: real uploaded files appear in list

[x] **5.3 — Upload dialog**
   - Create `src/components/documents/UploadDialog.tsx`
   - Drag-and-drop + Tauri `open()` file picker; category select; tags; notes
   - Match wireframe: Screen 5
   - Done when: uploading a PDF appears in list within 3 s

[x] **5.4 — Document detail page**
   - Create `src/app/documents/[id]/page.tsx`
   - PDF inline viewer (Tauri asset protocol); image fullscreen; edit tags/notes; soft delete
   - Match wireframe: Screen 6
   - Done when: clicking a document shows its full content

[x] **5.5 — Document tests** — coverage ≥ 80% for documents module

---

## Phase 6 — Appointments Feature

[x] **6.1 — Rust appointment commands**
   - Create `src-tauri/src/commands/appointments.rs`
   - Implement all 6 commands from `docs/ARCHITECTURE.md §4.3`
   - Done when: `cargo test` covers CRUD + document linking

[x] **6.2 — Appointments list + form**
   - Create `src/app/appointments/page.tsx`, `AppointmentCard.tsx`, `AppointmentForm.tsx`
   - List grouped by month; status badges; document links
   - Match wireframes: Screens 7 & 8
   - Done when: create/edit/delete appointment works end-to-end

[x] **6.3 — Appointments tests** — coverage ≥ 80%

---

## Phase 7 — Notes Feature

[ ] **7.1 — Rust note commands**
   - Create `src-tauri/src/commands/notes.rs` — all 7 commands from `docs/ARCHITECTURE.md §4.4`
   - Done when: `cargo test` passes

[ ] **7.2 — Notes list + editor**
   - Create `src/app/notes/page.tsx`, `src/app/notes/[id]/page.tsx`
   - Tiptap rich-text editor with Bold/Italic/Heading/List toolbar
   - Pin toggle; tag management; auto-save on keystroke idle (1 s debounce)
   - Match wireframes: Screens 9 & 10
   - Done when: create, edit, pin, and tag a note

[ ] **7.3 — Notes tests** — coverage ≥ 80%

---

## Phase 8 — Contacts Feature

[ ] **8.1 — Rust contact commands**
   - Create `src-tauri/src/commands/contacts.rs` — all 5 commands from `docs/ARCHITECTURE.md §4.5`
   - Done when: `cargo test` passes

[ ] **8.2 — Contacts list + form**
   - Create `src/app/contacts/page.tsx`, `ContactCard.tsx`, `ContactForm.tsx`
   - Role filter; quick-copy phone/email buttons
   - Match wireframe: Screen 11
   - Done when: CRUD works; copy-to-clipboard confirmed

[ ] **8.3 — Contacts tests** — coverage ≥ 80%

---

## Phase 9 — Timeline & Search

[ ] **9.1 — Timeline page**
   - Create `src/app/timeline/page.tsx`, `TimelineItem.tsx`
   - Aggregate documents + appointments + notes ordered by date
   - Filter by type and date range; group by month/year
   - Match wireframe: Screen 12
   - Done when: all event types appear in correct chronological order

[ ] **9.2 — Full-text search**
   - Create `src-tauri/src/commands/search.rs` — FTS5 query across all entity types
   - Populate `search_index` on every create/update/delete in all modules
   - Wire `SearchModal.tsx` to call `search_query` IPC; highlight matched terms
   - Match wireframe: Screen 13
   - Done when: "blood" returns matching records in < 200 ms

[ ] **9.3 — Search tests** — coverage ≥ 80%

---

## Phase 10 — Dashboard

[ ] **10.1 — Dashboard page**
   - Create `src/app/dashboard/page.tsx`
   - Stats cards (document count, upcoming appointments, note count)
   - Next appointment card; recent documents grid; pinned notes list
   - Match wireframe: Screen 3
   - Done when: all sections populate from live DB data

---

## Phase 11 — Settings

[ ] **11.1 — Settings page**
   - Create `src/app/settings/page.tsx`
   - Change password (calls `auth_change_password`); auto-lock timer; theme toggle; data dir; wipe
   - Match wireframe: Screen 14
   - Done when: password change re-encrypts DB; theme toggle persists across restarts

[ ] **11.2 — Settings tests** — coverage ≥ 80%

---

## Phase 12 — PDF Export Bundle

[ ] **12.1 — Export command**
   - Create `src-tauri/src/commands/export.rs` — `export_pdf_bundle`
   - Compose: cover page + TOC + embedded document pages using `pdf-lib` (JS side) called via Tauri IPC
   - Match wireframe: Screen 15
   - Done when: exported PDF opens and contains all selected documents with TOC

[ ] **12.2 — Export tests** — coverage ≥ 80%

---

## Phase 13 — Release  🏁

[ ] **13.1 — End-to-end smoke test**
   - Manual walkthrough: upload doc → view → search → link to appointment → export PDF
   - Verify all 15 wireframe screens match implementation

[ ] **13.2 — Bump version & tag**
   - Update `package.json` version to `1.0.0`
   - Update `src-tauri/tauri.conf.json` version to `1.0.0`
   - `git tag v1.0.0 && git push origin v1.0.0`
   - GitHub Actions builds 4 platform artifacts automatically

[ ] **13.3 — Verify GitHub Release**
   - Confirm `.dmg` (arm64 + x86_64), `.msi`, `.AppImage` all present
   - Install test on macOS: right-click → Open to bypass Gatekeeper

---

## Quick Reference

| Concern | File |
|---------|------|
| Features & acceptance criteria | `docs/PRD.md` |
| DB schema & IPC commands | `docs/ARCHITECTURE.md` |
| All screen layouts | `docs/WIREFRAMES.md` |
| CI/CD pipeline | `.github/workflows/` |
| **Where to resume** | **This file — find ▶** |
