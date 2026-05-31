# Html-Js-Css-Analyzer

## Overview

Html-Js-Css-Analyzer is a Visual Studio Code extension for HTML, CSS, and JavaScript diagnostics.
It validates the active editor document, reports language-specific issues, and tracks CSS selectors across
HTML markup, linked CSS, embedded styles, and JavaScript selector usages.

## Features

- HTML diagnostics through HTMLHint.
- JavaScript diagnostics through JSHint and local analyzer rules.
- JSHint configuration discovery through `.jshintrc`, `.jshintrc.json`, and `.jshintrc.js`.
- CSS selector parsing through css-tree plus a lightweight fallback scanner.
- Unused CSS selector detection for local and embedded CSS.
- Cross-file CSS lookup for linked stylesheets and workspace CSS files.
- Configurable exclusion patterns and analyzable file extensions.
- Output channel logging under `Html-Js-Css-Analyzer`.

## Commands

| Command | Title | Purpose |
| ------- | ----- | ------- |
| `Html-Js-Css-Analyzer.validate` | `Html-Js-Css-Analyzer: Validate Current Document` | Re-run validation for the active document. |
| `Html-Js-Css-Analyzer.clear` | `Html-Js-Css-Analyzer: Clear Style Cache` | Clear CSS selector and validation caches. |

## Settings

| Setting | Default | Scope | Purpose |
| ------- | ------- | ----- | ------- |
| `Html-Js-Css-Analyzer.logLevel` | `info` | Window | Controls extension output verbosity. |
| `Html-Js-Css-Analyzer.exclude` | Common generated and tool folders | Resource | Excludes files from workspace CSS scanning. |
| `Html-Js-Css-Analyzer.additionalExtensions` | `html`, `js`, `css` | Resource | Adds file extensions eligible for analysis. |
| `Html-Js-Css-Analyzer.htmlHint.enabled` | `true` | Resource | Enables HTML diagnostics. |
| `Html-Js-Css-Analyzer.cssHint.enabled` | `true` | Resource | Enables CSS diagnostics. |
| `Html-Js-Css-Analyzer.jsHint.enabled` | `false` | Resource | Enables JavaScript diagnostics. |

## Project Layout

```text
src/
|-- extension.ts                 VS Code activation and provider registration
|-- consts/ConstsConfig.ts       configuration defaults, cache, and setting accessors
|-- assets/scripts/              diagnostics, validation, glob, logging, and utility flow
|-- assets/type/domain/          shared domain types
|-- langs/html/                  HTMLHint integration and HTML code actions
|-- langs/js/                    JSHint integration and JavaScript code actions
|-- langs/css/                   CSS parser, cache, validator, and selector utilities
`-- exports/                     repository-local barrel exports
```

## Development

Install dependencies with Bun, then use the repository scripts and direct TypeScript checks.

```powershell
bun install
bunx tsc -p tsconfig.json --noEmit
bun run ~/.bootstrap/bootstrap-sync.ts --swc build-server
```

`out/` is generated extension output. Source changes belong under `src/`.
Runtime smoke checks can load `./out/extension.js` with a VS Code API mock when VS Code itself is not available.

## Packaging

The extension entry point is `./out/extension.js`, declared in `package.json`. The package metadata also declares
activation events, commands, configuration, the `logo.webp` icon, and the VS Code engine compatibility.
