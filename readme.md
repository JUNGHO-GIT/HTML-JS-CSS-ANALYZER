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


## Architecture (Role 기반 분리)

언어별 핵심 로직을 공통 4단계 역할로 재구성:

| Language | Loader | Config | Analyzer | Runner | Actions / Provider | Legacy Shim |
|----------|--------|--------|----------|--------|--------------------|-------------|
| HTML | `HtmlLoader.ts` | `HtmlConfig.ts` | `HtmlAnalyzer.ts` | `HtmlRunner.ts` | `HtmlHintActions.ts` | `HtmlHint.ts` |
| JS / TS | `JsLoader.ts` | `JsConfig.ts` | `JsAnalyzer.ts` | `JsRunner.ts` | `JsHintActions.ts` | `JsHintCore.ts` |
| CSS | `CssLoader.ts` | `CssConfig.ts` | `CssAnalyzer.ts` | `CssRunner.ts` | (Completion/Definition via `CssSupport.ts`) | `CssSupport.ts` (shim) |

역할 정의:

- Loader: 외부 Linter / 원천 데이터 로딩(JSHint, HTMLHint, Remote CSS fetch)
- Config: 설정(.jshintrc, .htmlhintrc) 및 워크스페이스 확장자/제외 패턴 수집
- Analyzer: 문서/워크스페이스/링크/임베드 등 복합 소스 전처리 및 선택자/규칙 추출
- Runner: Loader+Config+Analyzer orchestration 후 Diagnostics 산출 (HTML/JS). CSS는 validate 단계에서 사용/미사용 진단, Runner는 수집 정상성 검증
- Actions: CodeActionProvider (Quick Fix)
- Shim: 기존 단일 진입점 호환 유지 (외부 코드 깨짐 방지)

Import 권장 패턴:

```ts
import { runHtmlHint } from "@langs/html/HtmlRunner";
import { runJsHint } from "@langs/js/JsRunner";
import { runCssAnalyzer } from "@langs/css/CssRunner";
```
 
Shim (`HtmlHint.ts`, `JsHintCore.ts`, `CssSupport.ts`) 은 하위 호환용.

## Migration Guide (v2 구조)

| 기존 | 신규 | 설명 |
|------|------|------|
| `@langs/html/HtmlHint` | `@langs/html/HtmlRunner` | 실행 책임 분리 |
| `@langs/js/JsHintCore` | `@langs/js/JsRunner` | Core 로직 역할 세분화 |
| `@langs/css/CssSupport` 단일 | `CssSupport` + `CssRunner` | 수집 + 사전 검증 분리 |
| 임의 fetch 구현 | `CssLoader.fetchCss` | 네트워크/리다이렉트/샘플링 통합 |
| 파싱+캐시 혼재 | `CssCache` | TTL+LRU 관리 표준화 |

변경 예:

```diff
 import { runHtmlHint } from "@langs/html/HtmlRunner";

 import { runJsHint } from "@langs/js/JsRunner";

 import { runCssAnalyzer } from "@langs/css/CssRunner"; // 선택자 수집 검증 확장 시
```
 

주요 흐름 요약:

1. `extension.ts` → `@exportLangs` 로부터 providers/runner import & 등록
2. 문서 변경 시 `validateDocument` 호출 → CSS/HTML/JS 각각 Runner + 로컬 Analyzer 조합
3. TypeScript 파일은 사전 변환 후 JSHint 실행
4. CSS Runner는 selector 수집 정상성 검증 (Diagnostics 직접 생성 X)

추가 개선 아이디어:

- CSS 실제 Lint(예: stylelint) 연동 Runner 확장
- 사용자 정의 규칙(HTMLHint/JSHint) 동적 로딩 인터페이스
- 대형 워크스페이스 incremental indexing / background worker 처리

- 🔓 Apache-2.0
