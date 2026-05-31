# html-js-css-analyzer Architecture

## Runtime Shape

```text
VS Code
  -> package.json activation events
  -> src/extension.ts
  -> provider registration and event subscriptions
  -> src/assets/scripts/diagnostic.ts
  -> src/assets/scripts/validate.ts
  -> src/langs/{html,js,css}/
  -> VS Code diagnostics, completions, definitions, and code actions
```

## Source Map

```text
html-js-css-analyzer
|-- package.json                 extension manifest, commands, settings, entry point
|-- tsconfig.json                strict TypeScript project config
|-- tsconfig.paths.json          source root, output path, and local import aliases
|-- src/
|   |-- extension.ts             activation, commands, diagnostics, subscriptions
|   |-- consts/                  configuration defaults and cached setting reads
|   |-- assets/
|   |   |-- scripts/             diagnostic manager, validation runner, logging, glob helpers
|   |   `-- type/domain/         shared domain types
|   |-- langs/
|   |   |-- html/                HTMLHint diagnostics and HTML code actions
|   |   |-- js/                  JSHint diagnostics and JavaScript code actions
|   |   `-- css/                 selector parser, cache, validator, workspace CSS support
|   `-- exports/                 local barrel modules used by path aliases
`-- out/                         compiled VS Code extension output
```

## Activation Flow

```text
onLanguage:html / css / javascript
onCommand:Html-Js-Css-Analyzer.validate / clear
  -> activate(context)
  -> initialize logger and CssSupport
  -> register completion, definition, and code action providers
  -> subscribe to document change, save, close, and configuration events
  -> schedule or force validation
```

## Validation Flow

```text
TextDocument
  -> isAnalyzable and exclude checks
  -> validateDocument
  -> HTMLHint, JSHint, and CSS analyzer gates
  -> content snapshot reuse when text has not changed
  -> DiagnosticManager stores CSS, HTML, and JS collections
  -> version cache avoids duplicate validation for unchanged versions
```

## CSS Analysis Flow

```text
CssSupport.getStyles
  -> local document selectors
  -> linked stylesheet selectors
  -> workspace CSS selectors with exclude patterns when fallback is needed
  -> cache and pending promise de-duplication
  -> completions, definitions, and unused selector diagnostics
```

`cssParser.ts` uses css-tree for AST-backed parsing when advanced options are requested. The lightweight parser path
keeps selector positions for default class and ID scans, including escaped CSS identifiers.

## Configuration Boundary

`ConstsConfig.ts` is the only settings access layer. It normalizes extension lists, caches configuration values,
and exposes feature gates for HTML, CSS, JavaScript, logging, and workspace exclusions.
`jsConfig.ts` discovers JSHint configuration from `.jshintrc`, `.jshintrc.json`, and `.jshintrc.js` while preserving
the default config when no project file exists.

## Generated Boundary

`out/` and `*.vsix` are generated artifacts. Runtime source of truth is `src/`, `package.json`, and TypeScript
configuration files.
