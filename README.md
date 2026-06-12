# presentation-assets

Curated, **client-safe** evisions images for AI-built presentation decks (HTML slides and PPTX). The AI reads `manifest.json`, picks an image by description/tags/orientation, and references its hosted `url` (or embeds from the local `path`).

**Hosting:** this is a **public** repo served via **jsDelivr** (free CDN, version-pinned). Image URLs look like:
```
https://cdn.jsdelivr.net/gh/ai-evisions/presentation-assets@v1/optimized/<file>
```
Pinning to a tag (`@v1`) keeps URLs stable and cached. (Decision + alternatives: `05_AI Team Context/Tech/research/presentation-image-hosting-research-2026-06-12.md`.)

## ⚠️ Public + permanent: client-safe images only
This repo is public and **git history is permanent** (a deleted image stays recoverable in history and in CDN cache). So:
- Only commit images cleared for external/client use.
- `manifest.json` flags each asset: `people` (true/false) and `usage` (`client-safe` or `review`). **`review` = personal data or consent to confirm before client-facing use.** Currently flagged `review`: `team-group-photo-rustonka.jpg` (~30 identifiable people) and `mockup-business-cards.jpg` (shows a real name + work email).
- Never commit the raw photographer archive or internal/un-consented people photos.

## Layout
```
originals/      # hand-picked source files (gitignored, kept local)
optimized/      # web derivatives, committed + served via jsDelivr
manifest.json   # the index decks read (file, path, url, description, tags, orientation, dimensions, people, usage)
build.mjs       # sips-based optimize + manifest generator (no npm deps)
publish.sh      # bump version, rebuild URLs, commit, tag, push
```

## Use in decks
- **HTML (hosted, default):** `<img src="https://cdn.jsdelivr.net/gh/ai-evisions/presentation-assets@v1/optimized/office-building-exterior-signage.jpg">`. Keeps the `.html` tiny; images cache across slides and decks.
- **HTML (offline export):** base64-embed from the local `path` when a deck must work with no internet.
- **PPTX:** embed from the local `path`.

## Update
1. Drop new client-safe originals into `originals/`, add an entry to the `ASSETS` array in `build.mjs` (with description/tags/usage).
2. `./publish.sh v2` (rebuilds the manifest URLs to `@v2`, commits, tags, pushes).

Optimization target: JPEG q82, longest edge capped at 1600px; logos/brandmark kept as SVG/PNG. Keep the served set under jsDelivr's ~50MB per-repo cap; if it grows much larger, move to Cloudflare R2 / Backblaze B2.
