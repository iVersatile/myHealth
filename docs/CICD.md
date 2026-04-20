# CI/CD Workflow

## Branch Strategy

```
main      ──── stable, always green, gate-protected by CI
  ↑
develop   ──── active development, latest features
  ↑
feature/* ──── optional short-lived branches per feature
```

**Why two branches?**
`main` is the source of truth for stable releases. `develop` absorbs daily work without risking the stable baseline. When CI is red on `develop` you fix it there — `main` stays clean.

---

## Pipelines

Three workflow files live in `.github/workflows/`.

### 1. `lint.yml` — Code Quality (push to `main` or `develop`)

Runs on every push. Two parallel jobs:

| Job | What it checks |
|-----|----------------|
| Frontend | ESLint rules + TypeScript strict mode (`tsc --noEmit`) |
| Rust | `cargo fmt --check` (formatting) + `cargo clippy -D warnings` (lints) |

**Benefit:** Catches style drift and type errors immediately — before they accumulate into a hard-to-untangle mess. Fast feedback (~2 min).

### 2. `test.yml` — Automated Tests (push to `main` or `develop`)

Runs on every push. Two parallel jobs:

| Job | What it checks |
|-----|----------------|
| Frontend | Vitest unit tests + coverage report (threshold: 80%) |
| Rust | `cargo test --all` |

**Benefit:** Prevents regressions. Any push that breaks existing behaviour is caught immediately. Coverage report uploaded to Codecov for trend tracking.

### 3. `build-release.yml` — Distributable Artifacts (git tags only)

Only fires when you push a version tag. Produces native installers for all platforms in parallel:

| Platform | Artifact |
|----------|----------|
| macOS Apple Silicon | `.dmg` |
| macOS Intel | `.dmg` |
| Windows | `.msi` |
| Linux | `.AppImage` |

**Benefit:** Cross-platform builds run in the cloud — no need to own a Windows or Linux machine. Each build is reproducible and tied to an exact commit via the tag.

---

## Tag Convention

| Tag format | Release type | Example |
|------------|--------------|---------|
| `vX.Y.Z` | Stable release | `v1.0.0` |
| `vX.Y.Z-beta.N` | Beta — feature-complete, needs testing | `v1.0.0-beta.1` |
| `vX.Y.Z-alpha.N` | Alpha — early preview, known gaps | `v1.0.0-alpha.1` |
| `vX.Y.Z-rc.N` | Release candidate | `v1.0.0-rc.1` |

Any tag containing `-` is automatically published as a **pre-release** on GitHub Releases. Tags without `-` publish as **stable**.

---

## Day-to-Day Workflow

### Ongoing development
```bash
git push origin develop          # lint + test CI runs automatically
```

### Cut a test build (get a .dmg to try)
```bash
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1   # full build → GitHub pre-release with installers
```

### Promote to stable
```bash
git checkout main
git merge develop --ff-only
git tag v1.0.0
git push origin main
git push origin v1.0.0           # stable GitHub Release published
git checkout develop
```

---

## Why Not Build on Every Push?

A full Tauri cross-platform build takes ~20 minutes across 4 runners. Running it on every push would burn GitHub Actions minutes on routine changes.

Separating **fast checks** (lint + test, ~2–3 min) from **slow builds** (artifacts, ~20 min) means immediate feedback on code quality without paying the build cost until you actually need an installer.
