# Scripts (`scripts`)

## Overview
Build and packaging utilities for compiling the React + Vite application into a self-contained, zero-dependency HTML bundle (`dist/standalone.html` and `./app.html`) capable of running directly from the local filesystem (`file://`).

## Interface
- `[scripts/build-standalone.js:top-level]`: Standalone ES module CLI script (no exported functions); invokes Vite's programmatic `build()` with `codeSplitting: false` into a temporary directory (`dist/standalone-temp`), inlines the resulting CSS and single-file JS bundle into HTML, and removes `dist/standalone-temp`.

## Invariants
- `[scripts/build-standalone.js:STANDALONE_BUILD]`: Sets `process.env.STANDALONE_BUILD = 'true'` and `rollupOptions.output.codeSplitting = false` so dynamic imports (`React.lazy`) and vendor modules are emitted as a single self-contained JavaScript file without external ES module imports.
- `[scripts/build-standalone.js:jsContent]`: Escapes closing `</script` sequences (`/<\/script/gi` -> `<\/script`) in the bundled JavaScript before inlining into HTML.
- `[scripts/build-standalone.js:standaloneHtml]`: Inlines CSS inside `<head>`, injects a synchronous theme bootstrapper reading `localStorage.getItem('FINTRACK_M3_THEME')` and `prefers-color-scheme` to set `document.documentElement` class `'dark'` and `data-theme`, and places the inlined `<script>` after `<div id="root"></div>` in `<body>`.

## Side Effects
- `[scripts/build-standalone.js:build]`: Executes a programmatic Vite build into `dist/standalone-temp` and cleans it up via `fs.rmSync(standaloneTempDir, { recursive: true, force: true })`.
- `[scripts/build-standalone.js:outStandalone]`: Writes the self-contained HTML bundle to `dist/standalone.html` via `fs.writeFileSync`.
- `[scripts/build-standalone.js:outAppHtml]`: Writes the self-contained HTML bundle to `./app.html` via `fs.writeFileSync`.
- `[scripts/build-standalone.js:downloadDir]`: Checks `fs.existsSync` on the local Downloads mirror folder and writes `app.html` via `fs.writeFileSync` if present.
- `[scripts/build-standalone.js:console.log]`: Logs output paths and bundle sizes (in KB) to standard output.

## Verification
- Run: `npm run build:standalone`
