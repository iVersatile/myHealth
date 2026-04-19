# myHealth

Personal health records manager. Local-first, encrypted, no cloud required.

## Features

- **Documents** — Store PDFs, images, and letters with categories and tags
- **Appointments** — Track past and upcoming medical appointments
- **Notes** — Rich-text notes linked to appointments or documents
- **Contacts** — Your doctors, clinics, and specialists in one place
- **Timeline** — Chronological view of your entire health history
- **Search** — Full-text search across all records (Cmd/Ctrl+K)
- **PDF Export** — Bundle selected documents into a single PDF

## Privacy

- All data is encrypted at rest with AES-256 (SQLCipher)
- No internet connection required or made
- No telemetry, analytics, or crash reporting
- Data lives in `~/.myHealth/` on your device only

## Install

| Platform | Download |
|----------|---------|
| macOS (Apple Silicon) | `myHealth_aarch64.dmg` |
| macOS (Intel) | `myHealth_x86_64.dmg` |
| Windows 10/11 | `myHealth_x86_64.msi` |
| Linux | `myHealth_x86_64.AppImage` |

Download the latest release from [GitHub Releases](../../releases).

**macOS:** The app is not notarised. Right-click the `.dmg` → Open on first launch.

**Linux:** `chmod +x myHealth_x86_64.AppImage && ./myHealth_x86_64.AppImage`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 (Rust) |
| Frontend | Next.js 14 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Database | SQLite + SQLCipher |
| Search | SQLite FTS5 |
| CI/CD | GitHub Actions |
| Distribution | GitHub Releases |

## Documentation

- [Product Requirements (PRD)](docs/PRD.md)
- [Architecture](docs/ARCHITECTURE.md)
- [UI Wireframes](docs/WIREFRAMES.md)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Run tests
npm run test

# Build for current platform
npm run tauri build
```

### Release

Push a version tag to trigger the automated build and release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build `.dmg`, `.msi`, and `.AppImage` artifacts and publish a GitHub Release automatically.

## License

MIT
