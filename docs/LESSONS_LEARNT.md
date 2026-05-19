# myHealth — Lessons Learnt

Review this document at the **start of every task** before writing any code.

---

## L-001 — Untracked files committed without their dependencies

**What happened:** `feat(backend): add medical category hierarchy IPC commands` was committed. The extraction module (`src-tauri/src/extraction/`) and parsing module (`src-tauri/src/parsing/`) were referenced in `lib.rs` but the files were never staged. CI ran `cargo fmt` and failed because the referenced paths didn't exist on the remote.

**Root cause:** `git status` was not checked before committing. `git add` targeted specific files but missed newly created directories.

**Rule:** Before every Rust commit, run `git status -s` and confirm every `.rs` file referenced from `mod` declarations is staged. Never commit a `mod foo;` line without staging `foo.rs` or `foo/mod.rs`.

---

## L-002 — `cargo fmt` and `cargo clippy` not run locally before pushing

**What happened:** Multiple CI failures on `lint.yml` because Rust files were committed without formatting or clippy checks. `pnpm build` passed locally (TypeScript/Next.js), giving false confidence.

**Root cause:** Local verification only covered the TypeScript layer. The Rust layer has its own linting requirements that `pnpm build` does not exercise.

**Rule:** When any `.rs` file is modified, run the full Rust check sequence before pushing:
```bash
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test
```
Do not substitute `pnpm build` for this — they verify different layers.

---

## L-003 — Dead code in scaffolding modules breaks clippy `-D warnings`

**What happened:** Extraction functions (`extract`, `extract_image_text`, `extract_pdf_text`, `ExtractionResult`) were written as scaffolding for a future phase. `cargo clippy -D warnings` treats `dead_code` as an error, so CI failed.

**Root cause:** Scaffolding code that is not yet wired to any call site triggers `dead_code` lint. `-D warnings` means there is no grace period.

**Rule:** When writing scaffolding that will be wired in a later phase, annotate immediately with `#[allow(dead_code)]`. Remove the attribute when the code is wired. Never leave dead code without an explicit suppression.

---

## L-004 — `noUncheckedIndexedAccess` requires non-null assertions on array indexing

**What happened:** `AppointmentForm.test.tsx` failed TypeScript check with errors on `mock.calls[0][0]` because `mock.calls[0]` returns `T[] | undefined` under `noUncheckedIndexedAccess: true`.

**Root cause:** `tsconfig.json` has `"noUncheckedIndexedAccess": true`. Array subscript `arr[i]` always returns `T | undefined`, even inside a length guard.

**Rule:** Always use non-null assertion for logically-guaranteed array positions: `arr[0]!`. Also, `vi.fn(() => new Promise(...))` requires an explicit type parameter `new Promise<void>(...)` to avoid `Promise<unknown>` inference errors.

---

## L-005 — Marking a task complete before verifying the "Done when" criterion

**What happened:** Phase 16.4 ("wire extraction to documents_upload") was marked `[x]` in PLAN.md, but the actual call from `documents_upload` to `extraction::extract` was never added. This caused dead-code CI failures in a later session.

**Root cause:** The task marker was moved before running or verifying the integration.

**Rule:** Never mark a task `[x]` until:
1. The "Done when" test or behaviour is verified to pass.
2. The relevant code is reachable from a real call path (not just compiled).
3. Tests covering the new code pass locally.

---

## L-006 — CLAUDE.md is gitignored; team rules must live in docs/

**What happened:** Rules added to `CLAUDE.md` were not committed because `CLAUDE.md` is in `.gitignore`. Rules were lost across sessions.

**Root cause:** Project-level `CLAUDE.md` is excluded from version control intentionally.

**Rule:** All permanent workflow rules belong in `docs/COMMIT_STRATEGY.md`. When adding a new rule, update `docs/COMMIT_STRATEGY.md` first, then mirror it in `CLAUDE.md` for session convenience.

---

## L-007 — Implementing features before writing PRD requirements

**What happened:** Filename date extraction, PDF provider-name extraction, and the 2-step upload UX were all implemented and shipped before the corresponding requirements existed in `docs/PRD.md`. Manual testing revealed the features existed but were never specified, making it impossible to assess completeness or regression risk.

**Root cause:** Implementation was driven by user feedback during a session without first updating the PRD. The Manual Test Feedback Protocol was not yet in place.

**Rule:** Before implementing any feature discovered via manual test feedback, update `docs/PRD.md` first. Add the requirement row, commit it, then implement. Never implement a feature that has no PRD entry.

---

## L-008 — F1.6 document preview coded but broken (asset protocol scope unconfigured)

**What happened:** F1.6 ("View PDF inline; open image fullscreen") was in the PRD and code existed in `DocumentDetailClient.tsx` using `asset://localhost/<path>` URLs. Manual testing revealed the preview area was blank — the URL silently failed to load because Tauri's asset protocol requires an explicit scope allowlist, and none was configured in `tauri.conf.json`.

**Root cause:** The implementation was written without verifying that `tauri.conf.json` had `app.security.assetProtocol.scope` set. The code compiled and the route rendered, giving false confidence.

**Rule:** Whenever the `asset://` protocol or any Tauri protocol handler is used to serve local files, immediately verify that the corresponding scope is configured (`tauri.conf.json` → `app.security.assetProtocol`) and that the file actually loads in the running app before marking the task complete.

---

## L-009 — `invoke<T>` generic annotation not verified against actual Rust return type

**What happened (recurring — appeared ≥3 times in the same session):**
`handleAcceptCategorySuggestion` in `UploadDialog.tsx` called:
```typescript
const result = await invoke<{ id: string }>('categories_create_if_not_exists', { name: suggestion })
const id = result.id  // ← result IS the string; .id === undefined
```
The Rust command returns `Result<String, CommandError>` — a plain UUID string, not a struct.
`result.id` silently resolved to `undefined`, which was pushed into `selectedCategoryIds`.
`JSON.stringify({ documentId: ..., categoryId: undefined })` drops the `undefined` key entirely, so the downstream `categories_assign_document` IPC call arrived without `categoryId` and Tauri threw:
`invalid args 'categoryId' for command 'categories_assign_document': missing required key categoryId`.

**Why it keeps recurring:**
TypeScript's `invoke<T>` generic is a **trust annotation**, not a verified type. The compiler accepts `invoke<{ id: string }>` even when Rust returns `String`. There is no compile-time or test-time signal that the annotation is wrong — the mismatch only surfaces at runtime when the mistyped value is consumed downstream.

**Root cause:** The annotation was written (or copy-pasted) without checking the Rust function signature. The silent `undefined` propagated across multiple function calls before causing an observable error, making it hard to trace back to the source.

**Rules:**
1. **Always open the Rust file and read the return type before writing `invoke<T>`.**
   - Rust `-> Result<String, _>` → TypeScript `invoke<string>`
   - Rust `-> Result<Vec<Row>, _>` → TypeScript `invoke<Row[]>`
   - Rust `-> Result<SomeStruct, _>` → TypeScript `invoke<SomeStruct>` (matching the serialised shape)
   - Never wrap a primitive return in `{}` — `invoke<{ id: string }>` implies an object.
2. **Test mocks must match the real Rust return shape.** If the mock returns `{ id: 'x' }` but the command returns a plain string, the mock is lying and will hide the type mismatch.
3. **Add a defensive assertion after `invoke` for primitive returns:** `if (typeof id !== 'string') throw new Error('categories_create_if_not_exists: expected string, got ' + typeof id)`.

**Prevention — grep audit before every release:**
```bash
# Flag invoke calls that return a primitive but wrap it in {}
grep -rn "invoke<{" src/ --include="*.ts" --include="*.tsx"
```
Review every hit: confirm the Rust return type is actually an object, not `String`, `bool`, `i64`, etc.

---

## Review Checklist (start of each task)

Before writing any code for a new task:

- [ ] Re-read lessons above and check if any applies to this task's scope
- [ ] Run `git status -s` — confirm no stale/untracked files from the previous task
- [ ] Check CI is green: `gh run list --branch develop --limit 1`
- [ ] If touching Rust: plan to run `cargo fmt --check && cargo clippy` before pushing
- [ ] If touching TypeScript: plan to run `pnpm typecheck && pnpm lint && pnpm test run` before pushing
- [ ] If writing any `invoke<T>` call: open the Rust command file and verify the return type matches `T` (primitive vs struct — see L-009)

---

## L-010: Appointment specialty extraction — order-sensitive tag matching and missing patient-label exclusions

**Symptom:** Auto-generated appointment showed "PHYSIOTHERAPY with Ms Ying Wang" for an echocardiography document from a physiotherapy-footer letterhead.

**Root cause 1:** `auto_extract_tags` drives specialty from the first match in `SPECIALTY_MAP`, an ordered `&[(&str, &str)]`. "physiother" appeared before "cardiol", so any document with a physiotherapy footer phrase fired PHYSIOTHERAPY regardless of the clinical content.

**Root cause 2:** `extract_performing_doctor` excludes names preceded by referral phrases, but "patient:", "patient name:", "for patient", "name:" were absent from the list. Patient names in the header matched the doctor regex and were returned as the performing doctor.

**Fix:**
1. Derive specialty via `suggest_category` (multi-keyword scoring, order-independent) and extract the leaf after `→`.
2. Add patient-label phrases to `REFERRAL_PHRASES` in `extract_performing_doctor`.
3. Append clinic name to title: `"{specialty} with {doctor} — {clinic}"`.

**Rules:**
1. **Never use order-sensitive substring matching for classification.** If the first match wins, edge cases will silently produce wrong results. Use a scoring or precedence-aware approach.
2. **Exclusion lists must cover all label patterns that precede a name.** When adding a regex that matches `Title FirstName LastName`, audit the document for every label that can precede a name (patient:, name:, cc:, gp:, referred by, etc.) and add them all to the exclusion window.
3. **Title fields that combine multiple extraction results need a dedicated integration test** verifying the full composed string, not just the individual components.

---

## L-011 — Three regressions from incomplete clinic/role refactor

**What happened (2026-05-04):**
1. Confirm-upload view showed no clinic suggestion even for documents that clearly named a clinic.
2. A contact suggestion dismissed inside UploadDialog reappeared immediately after the dialog closed.
3. Accepting the reappeared suggestion and clicking Save crashed with `CHECK constraint failed: role IN ('gp','specialist','dentist','physio','pharmacist','hospital','other')`.

**Root cause 1 — Partial fix for clinic extraction:**
`appointments_suggest_from_document` was fixed to use `first_clinic(&text)`, but `documents_run_extraction` — the command that drives the confirm-upload view — was not updated. It still used `contact_suggestions.first().and_then(|c| c.clinic.clone())`, which is `None` for service-only appointments. The fix must be applied to every command that builds `clinic_suggestions`.

**Root cause 2 — Duplicate extraction after dialog close:**
`handleUploaded` in `documents/page.tsx` called `documents_run_extraction` again after UploadDialog closed and wrote the result into `extractedContactSuggestions`. This re-populated `DoctorSuggestionBanner` with contacts the user had just dismissed inside the dialog.

**Root cause 3 — Stale `CONTACT_ROLES` and hardcoded role string:**
`SCHEMA_V15` removed `'clinic'` from the `contacts.role` CHECK constraint, but `contactsStore.ts` was never updated — `'clinic'` remained in `CONTACT_ROLES`. Separately, `UploadDialog.tsx` saved AI-suggested contacts with a hardcoded `role: 'Doctor'` (capital D), which is not a valid DB role value.

**Fixes:**
1. Both `documents_run_extraction` paths — replaced broken `contact_suggestions.first().and_then(|c| c.clinic.clone())` with `first_clinic(&text)`.
2. `handleUploaded` in `page.tsx` — removed redundant `documents_run_extraction` call after dialog close.
3. `contactsStore.ts` — removed `'clinic'` from `CONTACT_ROLES` and `ROLE_LABELS`.
4. `UploadDialog.tsx` — changed hardcoded `role: 'Doctor'` to `role: 'other'`.

**Rules:**
1. **When fixing a bug in one command, grep for every command containing the same pattern.** A fix to one call site is a half-fix if the same logic lives in multiple commands.
2. **After any DB schema migration that changes a CHECK constraint, immediately audit the frontend** — update `CONTACT_ROLES`, `ROLE_LABELS`, and any role dropdowns to match the new constraint.
3. **Never hardcode a role string in inline IPC calls.** Reference `CONTACT_ROLES[n]` or a named constant — hardcoded strings bypass type-checking and silently violate DB constraints.
4. **Re-running extraction after dialog close undoes user decisions.** If a dialog already presented extraction results, do not re-run extraction in the parent's `onClose` handler.

---

## Lesson 8 — Regex anchor `(?m)^` silently prevented clinic suggestions (2026-05-04)

**Symptom:** Clinic suggestion card never appeared in the confirm-upload UI despite documents containing clinic names.

**Root cause:** `clinic_re()` in `extraction/contact.rs` compiled with `(?m)^` at the start of the pattern, requiring clinic names to appear at the very start of a line. Real medical letters embed clinic names mid-sentence (e.g., "Your appointment at City Medical Centre has been confirmed."), so the regex never matched and `first_clinic()` always returned `None`.

**Fix:** Removed `(?m)^` from the clinic regex. Added two regression tests: `detects_clinic_inline_mid_sentence` and `detects_clinic_inline_with_the_prefix`.

**Secondary fix:** Inline test schema in `commands::documents::tests::test_conn()` lacked the `clinic_name` column added by migration SCHEMA_V18, causing 6 document tests to fail with "no such column: clinic_name".

**Rules:**
1. **Regex anchors change semantics silently.** `(?m)^` means start-of-line — real documents rarely start a line with a clinic name. Always test regexes against realistic mid-sentence examples.
2. **Inline test schemas must track every `ALTER TABLE` migration.** When a new column is added via a migration, also add it to any inline `CREATE TABLE` strings in test helpers.

---

## Lesson 9 — Contact regex misses untitled names, role-labelled names, and non-standard UK phone formats (2026-05-09)

**Symptom:** Manual test of "Upload (30Jan2023-17_52_15).pdf" revealed three contact extraction failures:
1. "Mary Margaret MURPHY" not suggested — name has no title prefix (Dr/Prof/Mr/etc.)
2. "GP: Vaibhav SHARMA" not suggested — label is a role keyword, not a medical title
3. Phone "+44 (0) 203 423 7500" not correctly matched — extracted truncated

**Root cause 1 — Title-only `dr_re()`:** `extract_contact_suggestions()` in `contact.rs` only iterates `dr_re()`, which requires a title prefix (`Dr`, `Prof`, `Mr`, `Mrs`, `Ms`, `Miss`, `Sir`). Names with ALLCAPS surnames but no title are invisible.

**Root cause 2 — Missing role-label pattern:** No pattern exists for "GP:", "Consultant:", "Registrar:", "Physiotherapist:", "Nurse:", "Specialist:" as contact identifiers.

**Root cause 3 — Partial `+44` London phone match:** `phone_re()` uses `20[\s\-]?\d{4}[\s\-]?\d{4}` after `+44 (0)`. For "203 423 7500" the "20" matches, then `\d{4}` fails ("3 42" has a space). Falls to `\d{2,4}[\s\-]?\d{3,8}` which matches "203 423" without "7500". Fix: `20[\s\-]?(?:\d{4}[\s\-]?\d{4}|\d[\s\-]?\d{3}[\s\-]?\d{4})` handles both "20 7xxx xxxx" and "203 xxx xxxx" groupings.

**Fix:**
1. Add `ALLCAPS_NAME_PATTERN`: `\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+[A-Z]{2,}(?:\s+[A-Z]{2,})*)\b` — requires 2+ Title-case words before ALLCAPS surname (prevents false positives like "The NHS").
2. Add `GP_LABEL_PATTERN`: `\b(GP|Consultant|Registrar|Physiotherapist?|Nurse|Specialist):?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+[A-Z]{2,})+)`.
3. Fix `+44` London phone branch in `phone_re()`.
4. Extend `extract_contact_suggestions()` to iterate all three patterns with shared `seen` set (GP-label match inserts full name into `seen` to prevent allcaps_re from re-adding the same person).

**Rules:**
1. **Contact extraction must cover all name presentation styles in real medical letters:** titled (Dr/Prof), role-labelled (GP:, Consultant:), and plain name with ALLCAPS surname. Adding support for new document formats requires checking all three patterns.
2. **Phone regex branches must be tested against format variants, not just the canonical form.** London landlines appear as "020 7xxx xxxx", "020 3xxx xxxx", "+44 20 7xxx xxxx", and "+44 (0) 203 xxx xxxx" — each variant needs a unit test.
3. **Cross-pattern deduplication is mandatory when multiple patterns can match the same person.** Insert matched names into `seen` after each pattern so a second pattern cannot re-insert the same contact.

---

## L-012 — pdfjs-dist chunk size exceeds 300KB gzip threshold → use iframe strategy

**Phase:** 54.1 spike (2026-05-11)

**What happened:** Evaluated `pdfjs-dist@5.7.284` as a dynamic import for the `DocumentPreviewPanel`. After running `next build --webpack` with a spike page that executed `await import('pdfjs-dist')`, webpack split pdfjs into two chunks:

| Chunk | Raw | Gzipped |
|-------|-----|---------|
| pdfjs main | 612 KB | 252.7 KB |
| pdfjs worker | 376 KB | 160.5 KB |
| **Total** | **988 KB** | **413.2 KB** |

**Decision:** Combined gzipped size is **413 KB — exceeds the 300 KB threshold**. Proceeding with **option 2: iframe via Tauri `asset://` protocol**.

**Implementation plan:**
- Rust command `get_document_asset_url(doc_id)` returns an `asset://localhost/...` URL for the local PDF file
- `DocumentPreviewPanel` renders `<iframe src={assetUrl}>` for PDF MIME types
- Non-PDF fallback: render `extracted_text` in `<pre>` with `overflow-y: auto`
- No pdfjs-dist dependency shipped to users; native browser PDF rendering handles display inside the Tauri WebView

**Rule:** Before adopting any heavy PDF/rendering library as a bundled dependency, measure actual webpack chunk size with `next build`. `pdfjs-dist` raw size (~988 KB for lib + worker) compresses to ~413 KB gzipped — always exceeds a 300 KB budget. For a local-first desktop app, `asset://` iframe is simpler, faster, and requires zero extra bundle weight.

