# 🚀 Html-Js-Css-Analyzer

html-js-css-analyzer is a lightweight Visual Studio Code extension that analyzes class and id usage across HTML, CSS/SCSS and JavaScript/TypeScript files. It reports undefined classes/ids, highlights unused selectors, provides completion and go-to-definition, and integrates HTMLHint and JsHint diagnostics with Quick Fixes.

## Key features 🔎

- ⚠️ Undefined class/id warnings (Problems panel)
- 🔍 Unused CSS/SCSS selectors highlighted (grayed as Unnecessary)
- ✨ Completion for class/id and Go to Definition (F12)
- 🛠️ HTMLHint and JsHint diagnostics with context-aware Quick Fixes
- 🔗 Parses embedded `<style>` blocks, linked stylesheets (local and remote), and workspace CSS/SCSS files (scan capped at 500 files)
- 🗄️ Style cache with a command to clear it

## Installation ⬇️

- ⬇️ Install from the Visual Studio Code Marketplace: `html-js-css-analyzer`
- ⚙️ Or build and package locally: `npm run vsce`
- ⚠️ Requirements: Node >= 18, npm >= 10, VS Code >= 1.105.0

## Usage ▶️

- ▶️ Activate by opening or editing HTML/CSS/SCSS/LESS/JavaScript/TypeScript files. Validation runs automatically on open/save/change (250ms debounce, adaptive up to 1s under rapid edits).
- 🛠️ Commands (Command Palette):
  - `html-js-css-analyzer: Validate Current Document` — revalidate the active document
  - `html-js-css-analyzer: Clear Style Cache` — clear cached style data
- ⌨️ Shortcuts: F12 (Go to Definition), Ctrl+Space (Completion)

## Settings ⚙️

- `html-js-css-analyzer.logLevel` — logging level (`off` | `error` | `info` | `debug`)
- `html-js-css-analyzer.exclude` — array of glob patterns to exclude from scanning
- `html-js-css-analyzer.additionalExtensions` — additional file extensions to analyze
- `html-js-css-analyzer.htmlHint.enabled` — enable HTML analysis
- `html-js-css-analyzer.cssHint.enabled` — enable CSS analysis
- `html-js-css-analyzer.jsHint.enabled` — enable JavaScript analysis
- `html-js-css-analyzer.tsHint.enabled` — enable TypeScript analysis

## Notes & limitations ⚠️

- ⚠️ Workspace CSS file scan is limited to 500 files for performance.
- ⛔ Very large CSS files (>2MB) are skipped or partially sampled to avoid memory issues.
- 🌐 Remote stylesheet fetching may fail due to network timeouts or redirects.
- 🧾 Cache keys are based on document version and file mtime.

## Development 🛠️

- 🧩 Source code is located in the `src/` folder.
- 🔧 Build: `npm run compile` — 📦 Package: `npm run vsce`


## License 📄

- 🔓 Apache-2.0