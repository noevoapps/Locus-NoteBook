# Locus

Local note-taker with AI transcription and summarization. A Windows desktop app built with Electron.

## Download (Windows)

**[Download Locus for Windows](https://github.com/noevoapps/Locus-NoteBook/releases/latest)** — get the latest `Locus-*-setup.exe` from the [Releases](https://github.com/noevoapps/Locus-NoteBook/releases) page.

If you have a website with a download button, point it to:

- **Releases page (recommended):** `https://github.com/noevoapps/Locus-NoteBook/releases/latest`  
  Users land on the latest release and can click the setup file.

---

## Project setup

### Install

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

### Build

```bash
# Windows (produces Locus-1.0.0-setup.exe in dist/)
pnpm build:win

# macOS
pnpm build:mac

# Linux
pnpm build:linux
```

## Publishing a release (maintainers)

1. Bump version in `package.json` if needed.
2. Build the Windows installer: `pnpm build:win`
3. On GitHub: **Releases** → **Draft a new release** → choose a tag (e.g. `v1.0.0`), add notes, then upload the file from `dist/` (e.g. `Locus-1.0.0-setup.exe`).
4. Publish the release. The “Download” link above will then point to this release.

---

## Recommended IDE

[VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
