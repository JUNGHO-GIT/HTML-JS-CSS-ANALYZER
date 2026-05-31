# Skills

---

## Code Shape Rules

- Prefer explicit `if`, `else if`, and `switch` blocks over nested ternary chains or IIFE branches.
- Keep hot validation paths cache-aware: reuse normalized text, configuration values, glob regexes, and workspace search results.
- Keep VS Code activation lazy. Use language and command activation events instead of startup activation.
- Keep configuration reads behind one settings access layer and clear caches on `onDidChangeConfiguration`.
- Keep runtime boundary imports compatible with SWC output. Use namespace imports for Node built-ins and `vscode`.
- Preserve typed boundaries. Use `unknown` at module boundaries and narrow before use.
- Prefer local/linked CSS lookup before workspace-wide fallback in save-time validation.
- Keep docs current with extension commands, settings, runtime flow, and generated boundaries.

---

## Validation Rules

- Run `bunx tsc --noEmit --pretty false` after TypeScript edits.
- Run `bun run ~/.bootstrap/bootstrap-sync.ts --swc build-server` after runtime import or output-path changes.
- Use a VS Code API mock for focused runtime smoke checks when VS Code is unavailable.
- Re-run the save-path benchmark when validation, activation, CSS lookup, or diagnostics caching changes.
