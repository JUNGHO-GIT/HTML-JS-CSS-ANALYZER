# HTML-JS-CSS-ANALYZER Architecture

## Structure Map

```text
HTML-JS-CSS-ANALYZER
|-- src/
|   |-- langs/
|   |   |-- html/    -> HTML analysis rules
|   |   |-- js/      -> JavaScript analysis rules
|   |   `-- css/     -> CSS analysis rules
|   |-- consts/      -> shared constants
|   |-- assets/      -> helpers and shared types
|   `-- exports/     -> public barrels
|-- out/             -> compiled extension output
`-- package.json     -> extension metadata and scripts
```

## Flow Map

```text
Supported document change
  -> language selector chooses html/js/css module
  -> parser and rule set evaluate the file
  -> diagnostics are produced
  -> VS Code receives editor feedback
```

## Boundaries

- Language-specific logic lives under `src/langs/`.
- `out/` is generated from source and not edited directly.
- Packaging stays outside the analysis pipeline.