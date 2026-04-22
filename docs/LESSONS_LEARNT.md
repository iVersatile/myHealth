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

## Review Checklist (start of each task)

Before writing any code for a new task:

- [ ] Re-read lessons above and check if any applies to this task's scope
- [ ] Run `git status -s` — confirm no stale/untracked files from the previous task
- [ ] Check CI is green: `gh run list --branch develop --limit 1`
- [ ] If touching Rust: plan to run `cargo fmt --check && cargo clippy` before pushing
- [ ] If touching TypeScript: plan to run `pnpm typecheck && pnpm lint && pnpm test run` before pushing
