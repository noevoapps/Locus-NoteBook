# Releases & downloads

## For your website: Download button URL

Point your site’s **Download** button to:

**https://github.com/noevoapps/Locus-NoteBook/releases/latest**

That link always opens the latest release page. Users can click the Windows setup file (e.g. `Locus-1.0.0-setup.exe`) there to download.

### Example HTML

```html
<a href="https://github.com/noevoapps/Locus-NoteBook/releases/latest" target="_blank" rel="noopener">
  Download for Windows
</a>
```

---

## Creating a new release (upload the setup file)

1. Build the Windows installer:
   ```bash
   pnpm build:win
   ```
2. In the repo, go to **Releases** → **Draft a new release**.
3. Create a tag (e.g. `v1.0.0`) and add release notes.
4. Upload the file from `dist/`, e.g. `Locus-1.0.0-setup.exe`.
5. Publish the release.

After that, the “Download” link and the `/releases/latest` URL will show this release and its setup file.
