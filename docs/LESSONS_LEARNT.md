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
