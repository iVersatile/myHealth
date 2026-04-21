# myHealth — Commit Strategy

Team reference for branch management, commit conventions, and release workflow.

---

## Branch Model

| Branch | Purpose | CI | Releases |
|--------|---------|-----|---------|
| `main` | Production-ready only | lint + test | Tagged commits trigger builds |
| `develop` | Integration branch | lint + test | No auto-release |
| `feature/<scope>/<desc>` | Feature work | on PR | — |
| `fix/<issue>` | Bug fixes | on PR | — |

- All feature branches cut from `develop`, merged back to `develop` via PR
- `develop` → `main` only via a release branch PR
- `main` is branch-protected: requires PR review + all CI checks green

---

## Commit Message Format

```
<type>(<scope>): <subject>

<optional body — explain WHY, not what>

<optional footer: Fixes #123 | BREAKING CHANGE: ...>
```

### Types

| Type | When to use |
|------|------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behaviour change |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Build scripts, version bumps, config |
| `perf` | Performance improvement |
| `ci` | GitHub Actions workflow changes |

### Scopes

| Scope | Layer |
|-------|-------|
| `frontend` | Next.js / TypeScript (catch-all) |
| `backend` | Rust / Tauri (catch-all) |
| `db` | Schema, migrations, FTS5 |
| `auth` | Encryption, lock/unlock |
| `documents` | Documents feature |
| `appointments` | Appointments feature |
| `notes` | Notes feature |
| `contacts` | Contacts feature |
| `search` | Full-text search |
| `timeline` | Timeline view |
| `settings` | Settings page |
| `ci` | CI/CD workflows |
| `release` | Version bumps and tagging |

### Rules

- Subject: imperative mood, lowercase, no period, max 50 chars
- Body: explain *why*, not what — wrap at 72 chars, blank line after subject
- Never commit code that doesn't compile or has failing tests

---

## Rust vs TypeScript — Separate Commits

Even within one PR, keep backend and frontend in separate commits:

```
commit 1: feat(backend): add appointments CRUD IPC commands
commit 2: feat(frontend): add AppointmentForm and AppointmentList UI
commit 3: feat(frontend): integrate appointments with Rust IPC hooks
commit 4: test(backend): 80% coverage for appointments module
commit 5: test(frontend): 80% coverage for appointments UI
```

**Why:** Reviewers read each side independently. Either side can be reverted without touching the other.

**Exception:** A tiny fix touching both layers (e.g. IPC type alignment) may go in one commit.

---

## PR and Merge Strategy

- **Merge method: Squash and rebase**
- Feature branches accumulate WIP commits — that is fine
- On merge, all branch commits collapse into one clean commit on `develop`
- `develop` history: one commit per merged PR
- `main` history: one commit per release

---

## Release Workflow

```bash
# 1. Cut a release branch from main (after develop → main PR)
git checkout -b release/v1.1.0 main

# 2. Bump version in all three files:
#    package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml

# 3. Commit the version bump
git commit -m "chore(release): bump version to v1.1.0"

# 4. PR: release/v1.1.0 → main — CI must be green; squash and rebase

# 5. Tag main after merge
git checkout main && git pull origin main
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
# → GitHub Actions builds 4 artifacts and creates the GitHub Release

# 6. Back-merge to develop
git checkout develop && git merge main && git push origin develop
```

**Tags only ever go on `main`.** A tag push is the sole release trigger.

### Versioning (SemVer)

| Increment | When |
|-----------|------|
| MAJOR | Breaking DB schema change, encryption format change |
| MINOR | New feature (backward compatible) |
| PATCH | Bug fix only |

---

## CI Conventions

| Workflow | Trigger |
|----------|---------|
| `lint.yml` | Any push or PR to `main` / `develop` |
| `test.yml` | Any push or PR to `main` / `develop` |
| `build-release.yml` | Push of tag matching `v*` |

**Skip CI** (docs-only commits only): append `[skip ci]` to subject. Never use on code changes.

---

## Example Commits

```
feat(backend): implement FTS5 search_query command

Query search_index virtual table with entity_type filter.
Benchmark: < 200ms on 10K records.

Related to Phase 9.2
```

```
feat(frontend): add SearchModal with Cmd/Ctrl+K shortcut

Focus trap captures keyboard while modal is open.
Highlights matched terms in result list.

Related to Phase 9.2
```

```
fix(search): handle UTF-8 diacritics in FTS5 queries

Escape FTS5 special chars before querying (backend).
Affected searches for accented characters.

Fixes #67
```

```
chore(release): bump version to v1.1.0
```

---

## Quick Reference

```
Branch:   feature/<scope>/<desc>  →  develop  →  main (via release branch)
Merge:    Squash and rebase
Format:   <type>(<scope>): <subject>
Layers:   Separate commits for Rust backend and TypeScript frontend
Release:  Tag on main → GitHub Actions builds artifacts automatically
```
