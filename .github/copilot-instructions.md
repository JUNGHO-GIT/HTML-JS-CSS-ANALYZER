# Copilot / AI Agent Project Instructions

# IMPORTANT 1

1. Please update the following rules in your memory
2. I will apply these rules to all future conversations
3. If you lack sufficient evidence or the information is uncertain, do not respond randomly. Instead, respond with "I don't know" or "I have insufficient evidence".
4. Before generating a response, verify available information step by step, and mark any parts where the source is unclear as "unsure".
5. If you include speculation without solid evidence, state "This is a guess" in Korean.
6. Structure your response to be detailed, objective, and professional.
7. Keep your answers non-repetitive.
8. Never suggest that I should seek information elsewhere.
9. Focus on the core points of the question to understand my intent.
10. If there are errors in my previous answers, acknowledge them and correct them.
11. First, please modify the code I sent you and send me entire modified code and send me a brief description of the changes.

# IMPORTANT 2

1. Please reply in "Korean" unless requested in English.
2. Never change comments in the code I send, even if they are simple "-----" lines.
3. Use single spaces around assignment operators (ex. '=' or ':') and avoid more than one spacing for alignment.
4. Always use line breaks and indentation in parentheses, square brackets, etc.
5. Whenever possible, use the ternary operator or symbols like '&&' for conditional statements to make them more compact.
6. * When you have no choice but to use the 'if' conditional statement.
6-1. All if statements must use braces { } and proper line breaks/indentation, especially when they contain return statements.
6-2. Never write "if" statements on a single line. Always use braces { } even for single-line statements.
6-3. Use "}\n\telse {" or "}\n\telse if {" or "}\n\tcatch {" instead of "}else{" or "}else if {" or "}catch{".
6-4. Convert all single-line if statements like "if (condition) return value;" to:"if (condition) {\n\treturn value;\n}"

Purpose: Enable an AI assistant to quickly contribute to this VS Code extension (HTML & CSS analyzer) with correct architecture alignment and minimal context switching.

## 1. Extension Purpose (Know This First)
Analyzes open workspace HTML/JS/TS + CSS/SCSS to provide:
- Completion (class/id) & go-to-definition.
- Diagnostics: missing class/id usage and unused selectors (grayed via DiagnosticTag.Unnecessary).
- HTMLHint subset diagnostics merged into HTML validation.

## 2. High-Level Architecture
- Entry: `src/extension.ts` registers providers, commands, event hooks.
- Core analyzer state is stateless per request; caching of parsed selectors lives in `src/css/cache.ts` (simple LRU by reinsertion, capped at 200 entries).
- `CssSupport` (`src/css/support.ts`) aggregates selectors from:
  1. Current doc (embedded <style> blocks or direct CSS/SCSS).
  2. Linked `<link rel="stylesheet" href="...">` (local & remote http/https).
  3. Workspace glob scan (`**/*.css`, `**/*.scss`) excluding user globs.
- Validation pipeline: `updateDiagnostics` (`src/utils/diagnostic.ts`) → `CssSupport.validate()` → `validateDocument` (`src/core/validate.ts`).
- Separation: parsing (`parser.ts`), caching (`cache.ts`), validation logic (`core/validate.ts`), configuration access (`configs/setting.ts`), filtering of analyzable docs (`utils/filter.ts`), logging (`utils/logger.ts`).

## 3. Key Data Flows
1. Document event (save/open/change) → `scheduleValidate` (debounced 250ms) → `updateDiagnostics`.
2. `CssSupport.getStyles()` builds a Map<uri, SelectorPos[]> from cache or new parse.
3. `validateDocument()` composes:
   - Known selectors set.
   - Usage scan in markup / script contexts (class attributes, classList.*, querySelector*, getElementById).
   - Unused detection (CSS rule body token scan or embedded style presence vs usage).
   - Optional HTMLHint diagnostics via `runHtmlHint`.
4. Diagnostics stored in a shared `DiagnosticCollection` (no per-language separation).

## 4. Conventions & Patterns
- Strict TS ("strict": true) using NodeNext modules; imports end with `.js` after compilation.
- Selector positions use manual index→(line,col) mapping (`utils/lineIndex.ts`) instead of relying on incremental APIs.
- Avoid opening extra text documents for performance: filesystem reads (`fs.promises.readFile`) used for linked styles and workspace scanning.
- Caching key patterns:
  - Document: `doc.uri.toString()` with version check.
  - FS file: `fs://<absPath>` with `mtimeMs`.
  - Remote URL: raw URL with version `-1`.
- Exclusions rely solely on user config `Html-Js-Css-Analyzer.exclude` + hard language/extension filter (`utils/filter.ts`). No include list.
- Logging levels: off|error|info|debug; never log if `off`.
- Debounce logic: one timer per URI stored in `debounceTimers` Map.

## 5. Adding Features (Do This)
- For new diagnostics: extend `validateDocument()`; keep selector extraction isolated (don’t add parsing there—reuse `CssSupport` APIs).
- For new config options: declare in `package.json` under contributes.configuration then add accessor in `configs/setting.ts` (follow existing patterns, return safe defaults if misconfigured).
- When parsing more selector forms: update `parseSelectors` carefully—maintain escape handling and multi-selector (comma) splitting within prelude logic.
- Performance: always check `isAnalyzable(doc)` early in new providers/listeners.

## 6. Edge Cases Already Handled
- Escaped selectors (e.g. `.foo\:bar`).
- Template fragments in class attributes (removed via `${...}` placeholder normalization).
- Remote stylesheet failures: logged at error level, silently skipped (return empty string → zero selectors).
- Re-entrancy: repeated validations on unchanged `doc.version` are skipped unless forced (`AutoValidationMode.FORCE`).

## 7. Commands & Triggers
- User commands: `Html-Js-Css-Analyzer.validate`, `Html-Js-Css-Analyzer.clear`.
- Auto triggers: on open/save/change (change is debounced). Completion/definition active for html/js/ts/css/scss.

## 8. Testing & Manual Verification (No formal test suite here yet)
- Build: `npm run compile` (cleans + tsc). Watch: `npm run watch`.
- Package: `npm run vsce`.
- Quick smoke: open mixed HTML + CSS files, confirm diagnostics update after edits within ~250ms.

## 9. When Modifying
- Keep file boundaries: no circular imports (validate logic kept out of `CssSupport`).
- Do not bloat `extension.ts`; prefer utility modules.
- Ensure new async code catches & logs errors (use `log("error", ...)`).

## 10. Future Friendly Notes
- Potential: incremental parse or selector index diffing—if you add this, preserve current public shape of `SelectorPos`.
- Avoid introducing heavy deps; current footprint is light (htmlhint, glob only external at runtime).

(End) — Provide feedback if anything is unclear or missing.
