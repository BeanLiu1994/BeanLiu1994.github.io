# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GitHub Pages static site for Peng Liu (BeanLiu1994), deployed via GitHub Actions from the `master` branch. Custom domain configured in `CNAME`. The `_config.yml` is a minimal Jekyll config (jekyll-theme-minimal) used by GitHub Pages for the root site, but the actual homepage is `index.html` — a static landing page linking to standalone tools.

## Development

No build step, no package manager, no tests. All tools are vanilla HTML/CSS/JS single-page apps.

```bash
# Start local dev server (requires Python 3)
bash serve.sh
# → http://localhost:8080
# Tools: http://localhost:8080/tool/vps/digitalocean.html
```

The root `index.html` and all tool pages use relative paths (`tool/…`) — work correctly both locally and on GitHub Pages.

## Architecture

Each directory under `tool/` is a self-contained single-page application with no shared dependencies between them:

- **`games/`** — Browser games, each in its own subfolder (e.g. `games/lane-defender/`), self-contained vanilla HTML/CSS/JS with relative paths so they work both locally and on GitHub Pages. The root `index.html` links to them from a "Games" section. Add new games as new subfolders under `games/` and add a link on the homepage — keep files relative, no build step. Packaging wrappers (Electron/Capacitor) are kept out of the published site.

- **`tool/freqgen/`** — Audio tone generator via Web Audio API (`index.html` + `script.js`). Supports frequency presets, range limiting, volume/duration controls, waveform selection, and keyboard shortcuts. The `script.js` is loaded via `<script src>` tag.

- **`tool/bluetag/`** — Web Bluetooth e-ink tag sender (single `index.html`). Connects to BLE display tags, processes images through Floyd-Steinberg dithering into black/red layers, encodes them column-major with bit-packed bytes, and transmits via GATT write-without-response. Supports 3 screen sizes (2.13", 2.9", 3.7") and 4 rotation angles.

- **`tool/vps/`** — DigitalOcean droplet manager (single `digitalocean.html`). All JS is inline in a single `<script>` block. Manages DO droplets for sing-box VLESS+Reality proxy servers. Key implementation details:
  - API token stored in `localStorage` under key `do_api_token`
  - sing-box key material per-droplet stored under `do_singbox_uuids` (mapping `dropletId → {uuid, publicKey, shortId}`)
  - X25519 reality keypairs generated client-side via Web Crypto API (`crypto.subtle.generateKey` with X25519), exported as PKCS8/SPKI and base64url-encoded
  - Proxy setup automated via `user_data` cloud-init script injected at droplet creation — no SSH required
  - Setup completion detected by polling droplet tags (`setup-ok` / `setup-failed`) via DO API

## Deployment

Push to `master` triggers the GitHub Actions workflow (`.github/workflows/static.yml`) which deploys the entire repository to GitHub Pages. No build step — raw files are served directly.

## Common Patterns

- All tools use vanilla JS — no frameworks, no bundlers, no npm
- UI state management is DOM-based (no virtual DOM, no state libraries)
- API calls use `fetch()` with Bearer token auth (DO API)
- Local storage for persistence (tokens, sing-box configs)
- Dark-themed UI using GitHub-inspired color palette (`#0d1117`, `#161b22`, `#30363d`)
