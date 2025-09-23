# Html-Js-Css-Analyzer (CSS-ANALYZER) 🚀

Unified analysis of class / id usage across HTML / JS / TS / CSS / SCSS:

- Autocomplete (class, id)
- Go to Definition
- Undefined reference warnings
- Unused selector highlighting (grayed with Unnecessary)
- Partial HTMLHint diagnostics + Quick Fix

Lightweight, fast, no extra runtime baggage.

---

## Feature Summary

| Feature | Description |
|---------|-------------|
| Autocomplete | Context aware in `class`, `id`, `#`, `.`, `classList.*`, `querySelector*` |
| Go to Definition | Jump token → declaration (local workspace + linked, excludes remote) |
| Undefined diagnostics | Warn when referenced class/id is not defined |
| Unused diagnostics | Unused selectors in CSS/SCSS shown as Hint + gray |
| Remote + Local CSS | `<link rel="stylesheet">`, http/https, workspace *.css/*.scss scan |
| HTMLHint | Subset rules + CodeAction |

---

## Installation

1. In VS Code marketplace: Html-Js-Css-Analyzer
2. Or build VSIX (`npm run vsce`) and install manually

Requires Node 18+, VS Code 1.104.0+.

---

## Basic Usage

1. Open your project
2. Edit HTML / CSS / JS / TS → validation runs after 250ms debounce
3. Undefined class/id → Warning in Problems panel
4. Unused selectors → grayed in CSS/SCSS editors
5. Use F12 (definition) / Ctrl+Space (completion)

Commands (Command Palette):

- Html-Js-Css-Analyzer: Validate Current Document
- Html-Js-Css-Analyzer: Clear Style Cache

---

## Settings

`Html-Js-Css-Analyzer.logLevel` : off | error | info | debug

`Html-Js-Css-Analyzer.exclude` : glob array of files/folders to ignore in scanning

`Html-Js-Css-Analyzer.additionalExtensions` : glob array of additional file extensions to include in scanning

---

## How It Works (Simplified)

1. Events (open/save/change) → 250ms debounce → validate
2. Collect selectors from:
   - Current document (or embedded style tags)
   - Linked `<link rel="stylesheet">` (local + remote)
   - Workspace `*.css` / `*.scss` (cap: 500 files)
3. Collect usage tokens (class/id/classList/querySelector) from open docs
4. Compare → produce undefined / unused diagnostics → store in DiagnosticCollection

Cache uses doc version / file mtime keyed entries with simple reinsertion policy.

---
