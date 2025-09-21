# Html-Js-Css-Analyzer 🚀

경량 · 고속 HTML / CSS 분석 & 사용성 진단 VS Code 확장

_(English description is kept below – Korean guide first)_

## 0. 한눈에 보기 (TL;DR)

| 기능 | 설명 | 퍼포먼스 고려 |
|------|------|---------------|
| 클래스 / ID 자동 완성 | `class`, `id`, `classList.*`, `querySelector*`, 템플릿 문자열 컨텍스트에서 제안 | 캐시 + 최소 파싱 |
| 정의로 이동 | 선언된 CSS 룰 위치로 Jump | 원격 CSS는 탐색 제외 (성능) |
| 존재하지 않는 선택자 경고 | 사용했지만 정의되지 않은 `.class` / `#id` 경고 | 빠른 정규식 스캔 |
| 미사용 선택자 표시 | 사용되지 않은 선택자 Warning + 흐리게 (Unnecessary Tag) | 로컬/임베디드 범위 차등 처리 |
| HTML 베스트 프랙티스 Lint | HTMLHint 부분 규칙 통합 + Quick Fix | 한 번에 병합 출력 |
| 원격 + 로컬 스타일 | `<link>` + 워크스페이스 CSS/SCSS + `<style>` 블록 | mtime / version 캐시 |

> 목표: 잦은 재-파싱 없이 실시간(250ms debounce)으로 HTML/JS/TS 코드 내 CSS 사용 상태를 정확히 보여줍니다.

---

## 1. 설치 (Installation)

### 마켓플레이스
VS Code Marketplace (검색: `Html-Js-Css-Analyzer`).

### 수동 설치 (로컬 빌드)

```bash
git clone https://github.com/JUNGHO-GIT/HTML-JS-CSS-ANALYZER.git
cd HTML-JS-CSS-ANALYZER
npm install
npm run compile
# VS Code 에서 F5 (Extension Development Host 실행)
```

### 요구 사항

| 항목 | 최소 버전 |
|------|-----------|
| VS Code | 1.104.0 |
| Node.js | 18+ |

---

## 2. 빠른 시작 (Quick Start)

1. HTML / CSS / SCSS / JS / TS 파일을 열면 자동 활성화됩니다.
2. `class=""` 안에서 타이핑하면 자동완성 목록이 뜹니다.
3. 사용 중 붉은/노란 경고가 보이면 마우스 오버로 메시지를 확인합니다.
4. 필요 시 명령 팔레트(CTRL/⌘ + Shift + P) → `Html-Js-Css-Analyzer: Validate Current Document`.
5. 캐시 문제나 대규모 리팩토링 후 `Clear Style Cache` 실행.

---

## 3. 주요 특징 (Detailed Features)

### 3-1. 선택자 수집 소스

- 현재 문서 (CSS / SCSS or HTML `<style>`)
- HTML `<link rel="stylesheet">` 로 연결된 로컬/원격(HTTP/S) CSS
- 워크스페이스 전체 `**/*.css`, `**/*.scss` (최대 500개, 초과 시 로그 안내)

### 3-2. 사용 패턴 스캔

- Attribute: `class=`, `className=`
- DOM API: `classList.add/remove/toggle/contains`
- Selector API: `querySelector(All)` 내부의 `.foo`, `#bar`
- ID 전용: `getElementById("id")`

### 3-3. 경고 분류

| 유형 | 메시지 예 | 비고 |
|------|-----------|------|
| 미정의 클래스 | `CSS class 'btn-primary' not found` | 워닝 |
| 미정의 ID | `CSS id '#main' not found` | 워닝 |
| 미사용 선택자 | `Unused CSS selector '.foo'` | DiagnosticTag.Unnecessary |
| HTML Lint | HTMLHint 규칙 위반 메시지 | Quick Fix 제공 가능 |

---

## 4. 명령어 (Commands)

| Command (Title) | 설명 |
|-----------------|------|
| Html-Js-Css-Analyzer: Validate Current Document | 현재 활성 문서 강제 검증 |
| Html-Js-Css-Analyzer: Clear Style Cache | 선택자 + 워크스페이스 CSS 파일 인덱스 초기화 |
| (실험) Open Inline `<script>` Virtual JS | 인라인 `<script>` 집계 가상 문서 열기 (현재 내부 기능 일부 비활성/정리됨) |

> 현재 `package.json` 기준 활성화 이벤트는 HTML/CSS/SCSS 언어 + 명령 호출 + 시작 후(onStartupFinished)입니다.

---

## 5. 설정 (Configuration)
`settings.json` (Workspace/User) 에서 편집

| Key | Type | Default | 설명 |
|-----|------|---------|------|
| Html-Js-Css-Analyzer.logLevel | string (`off`/`error`/`info`/`debug`) | `debug` | 출력 로그 상세도 |
| Html-Js-Css-Analyzer.exclude | string[] (glob) | 다양한 빌드/캐시 경로 기본 포함 | 워크스페이스 CSS/SCSS 스캔 제외 경로 |

예시:
```jsonc
{
  "Html-Js-Css-Analyzer.logLevel": "info",
  "Html-Js-Css-Analyzer.exclude": ["**/dist/**", "**/legacy/**"]
}
```

---

## 6. 퍼포먼스 & 캐싱 (Performance)
| 전략 | 설명 |
|------|------|
| 문서 버전 캐시 | VS Code TextDocument.version 기반 재-파싱 회피 |
| FS mtime 캐시 | 로컬 파일 stat.mtimeMs 를 키로 사용 |
| 원격 CSS (-1) | 원격 URL 은 `version: -1` 로 1회 fetch 후 재사용 |
| Debounce 250ms | 잦은 수정 중 중복 검증 회피 |
| 최대 500 CSS 파일 | 초과 시 나머지 무시 + info 로그 |

캐시 초기화: 명령 → Clear Style Cache.

---

## 7. 아키텍처 (Architecture Overview)
| 파일 / 모듈 | 역할 (요약) |
|-------------|------------|
| `src/extension.ts` | 활성화 / 리스너 / 명령 등록 |
| `langs/css/cssSupport.ts` | 선택자 수집 + Completion / Definition 제공 |
| `configs/validate.ts` | 문서 검사 파이프라인 (사용/미사용/HTMLHint 통합) |
| `utils/diagnostic.ts` | Debounce, DiagnosticCollection 관리 |
| `langs/css/cssParser.ts` | 경량 선택자 파서 (다중 선택자, escape 고려) |
| `langs/css/cssCache.ts` | 단순 Map 기반 캐시 (reinsertion) |
| `utils/glob.ts`, `configs/setting.ts` | 제외 패턴 / 설정 조회 |
| `utils/logger.ts` | logLevel 제어 + OutputChannel |

데이터 흐름:
문서 이벤트 → scheduleValidate → updateDiagnostics → CssSupport.getStyles() → validateDocument() → DiagnosticCollection 반영.

---

## 8. HTML Quick Fix (요약)
- DOCTYPE / 메타 / lang 누락 추가
- 속성 소문자/인용부호 정규화
- `<img>` alt, `<button>` type 보정
- Void element 자가 닫기, 특수문자 escape

---

## 9. 실험 기능 (Inline <script> Virtual JS)
현재 일부 주석 처리 / 정리 상태. 향후 개선 시:
- 가상 문서 → 원본 HTML 역방향 정의 이동 지원 예정
- TypeScript (`lang=ts`) 매핑 고려

---

## 10. Edge Cases 처리
| 케이스 | 처리 |
|--------|------|
| `.foo\:bar` | 역슬래시 해제 후 토큰 비교 |
| 템플릿 `${...}` | 임시 공백 치환 후 토큰화 |
| 원격 실패 | 오류 로그, 무시 |
| 재검증 루프 | 동일 version skip |
| 대규모 워크스페이스 | 500개 제한 후 중단 |

---

## 11. 문제 해결 (Troubleshooting)
| 증상 | 원인 | 해결 |
|------|------|------|
| 첫 검증 느림 | 초기 CSS 인덱싱 | 1회 후 빨라짐 |
| 자동완성 누락 | 파일 수 제한 초과 | exclude 조정 / CSS 분리 / 캐시 초기화 |
| 미사용 false positive | 런타임 동적 클래스 | (향후) 힌트 주석 도입 예정 |
| 원격 CSS 무시 | 네트워크 실패 | Output 로그 확인 |

이슈 등록 시: logLevel=debug 출력, CSS 파일 수, 재현 스니펫 포함.

---

## 12. Roadmap (간략)
- [ ] 역방향 Definition (가상 JS → HTML)
- [ ] 동적 클래스 무시 주석 (`/* analyzer-ignore */` 등)
- [ ] Selector 사용 통계 패널
- [ ] Incremental 파싱 / diff 기반 최적화

---

## 13. 기여 (Contributing)
간단한 구조이므로 PR 환영합니다.
1. Fork & Branch 생성
2. `npm install && npm run watch`
3. VS Code: F5 로 테스트
4. 변경 사항 + 스크린샷(필요시) 포함 PR

코드 스타일: TypeScript strict, 불필요한 외부 의존성 지양.

---

## 14. 라이선스 (License)
Apache-2.0

---

## 15. English Section (Original / Maintained)

Fast, lightweight HTML & CSS analysis for VS Code:

- Intelligent class / id autocomplete
- Jump to selector definition
- Missing selector warnings (class / id not defined in any CSS)
- Unused selector detection (highlighted as faded / grayed)
- Integrated HTML best‑practice lint (HTMLHint subset)

Works seamlessly across HTML, JavaScript, TypeScript, CSS, and SCSS files (including embedded `<style>` blocks and remote stylesheets).

---

### ✨ Features

| Feature | Description |
|---------|-------------|
| Completion | Suggests classes / ids while typing inside `class`, `id`, `classList.*`, `querySelector*`, template strings, and selector-like contexts. |
| Go to Definition | Jump to the CSS rule where a class or id is declared (local, linked, or workspace CSS). |
| Undefined Usage Warning | Flags `class` / `id` references that have no known CSS definition. |
| Unused Selector Detection | Marks selectors that are never referenced (tagged as `Unnecessary` so the editor fades them). |
| Remote + Local Styles | Parses both workspace files and `http(s)` linked stylesheets. |
| HTML Lint Merge | Basic HTMLHint rules merged into the same diagnostics panel. |

---

### 🧠 How It Works (Pipeline)

1. Collects CSS selectors from:
   - Current document (CSS / SCSS file or embedded `<style>` blocks in HTML)
   - `<link rel="stylesheet" ...>` referenced local or remote styles
   - One‑time indexed workspace `*.css`, `*.scss` (capped for performance)
2. Builds a selector index (class + id) with cached parsing (file version / mtime aware)
3. Scans the current document text for:
   - `class`, `className` attributes
   - `classList.add|remove|toggle|contains()` calls
   - `querySelector*()` selectors (`.foo`, `#bar` tokens)
   - `getElementById()` literals
4. Generates diagnostics:
   - Missing selector → Warning
   - Unused selector → Warning + `Unnecessary` tag (faded)
5. If HTML → runs HTMLHint subset and merges results (with Quick Fixes where applicable)

---

### 🛠 Quick Fix Examples (HTML)

- Add missing: `<!DOCTYPE html>`, `<title>`, `<meta charset>`, `<meta name="viewport">`, `<meta name="description">`
- Insert `lang="en"` on `<html>`
- Enforce lowercase tags & attributes
- Normalize attribute quotes / spacing
- Add `alt=""` to `<img>` / `type="button"` to `<button>`
- Self‑close void elements
- Escape special characters (&, <, >)

---

### ⚡ Performance Architecture

Optimization strategies built‑in:

1. Workspace CSS discovery is performed only once (first validation). Paths are cached; only content (selectors) re-parsed when mtime changes.
2. Selector extraction uses a lightweight custom parser (no heavy CSS AST library) with simple LRU-like recency reinsertion.
3. HTMLHint ranges are clamped to valid line bounds to avoid potential edge crashes.
4. Remote styles are fetched once per URL (cached under `version: -1`). Failures are logged silently.
5. Debounced validation (250ms) on document change; identical document versions are skipped.

Safety limits:

- Workspace CSS/SCSS file indexing stops after an internal cap (default 500) to prevent runaway memory usage in very large monorepos.
- Clearing the cache (`Html-Js-Css-Analyzer: Clear Style Cache`) resets both selector caches and the discovered workspace file list.

---

### 📦 Commands

| Command | Description |
|---------|-------------|
| Html-Js-Css-Analyzer: Validate Current Document | Force validation of the active editor. |
| Html-Js-Css-Analyzer: Clear Style Cache | Clears selector cache + workspace CSS index. |
| Html-Js-Css-Analyzer: Open Inline \<script\> Virtual JS | Opens a read‑only virtual JS document composed of inline `\<script\>` blocks for richer JS IntelliSense. |

---

### 🧩 Full IntelliSense for Inline `<script>` (Experimental)

Inline JavaScript inside HTML now receives the same language service features (type checking via `@ts-check`, IntelliSense, diagnostics) by exposing a virtual JavaScript document that aggregates all non‑`src` `<script>` blocks.

How it works:

1. A lightweight extractor finds `<script>` blocks with no `type`, or `type="module"`, `type="text/javascript"`, `application/javascript` (and no `src`).
2. Their contents are concatenated into a virtual document using the custom URI scheme: `htmljs:///<original path>.js`.
3. VS Code's built‑in JavaScript/TypeScript language service processes that virtual document → you gain completions, symbol info, diagnostics, and `@ts-check` validation.
4. Changes in the HTML immediately trigger regeneration (debounced by VS Code's own event batching).

Notes / Limitations:

| Aspect | Status |
|--------|--------|
| Go to Definition from virtual back to HTML | Not yet (planned) |
| Separate virtual file per `<script>` | Aggregated for simplicity |
| `lang="ts"` or TypeScript `<script>` blocks | Not yet (future) |
| External `<script src>` | Ignored (handled by normal JS files) |
| Source map accuracy | Basic (line preserving separators) |

If you rely heavily on per‑block isolation or need reverse mapping for navigation, feel free to open an issue—design hooks are prepared internally (`TODO`).

---

### 🧪 Advanced Inline `<script>` Type Checking (Experimental+)

In addition to surfacing the built-in JS language service via a virtual file, an internal lightweight TypeScript single-file language service now performs `checkJs` semantic validation automatically (no `// @ts-check` required) when `Html-Js-Css-Analyzer.inlineScripts.validate` is enabled (default: true).

What you get:

- Syntactic errors (missing brackets, etc.)
- Semantic issues (unknown variables, property typos)
- Suggestion diagnostics (unused vars, etc.)

Implementation highlights:

1. Extracted inline `<script>` blocks are composed into a virtual JS document (same as IntelliSense feature above).
2. A transient in-memory TypeScript LanguageService is created per validation pass with `allowJs + checkJs + noEmit`.
3. Diagnostics are translated back to ranges within the virtual document and shown with source `html-inline-js`.
4. Debounced (350ms) to avoid excessive recomputation while typing.

Disable if undesired by setting:

```jsonc
"Html-Js-Css-Analyzer.inlineScripts.validate": false
```

Current limitations mirror the base virtual document system (no reverse definition mapping, aggregated blocks). Future iterations may add per-block mapping + jump-back integration.

#### Mapping Behavior

Diagnostics are now shown directly on the original HTML `<script>` code (reverse‑mapped from the internal virtual JS). The virtual document still exists for language features, but you no longer need to open it just to see errors. Definition navigation back into HTML remains a future enhancement.

---

### 🔍 Logging

Set `Html-Js-Css-Analyzer.logLevel` to `info` or `debug` (user settings) to inspect:

- Cache hits / misses
- Number of diagnostics emitted
- Remote fetch errors
- Workspace indexing limit reached warnings

Open the Output panel → select “Html-Js-Css-Analyzer”.

---

### 🧪 Edge Cases Handled

| Case | Handling |
|------|----------|
| Escaped selectors (`.foo\:bar`) | Backslash unescaping during token scan. |
| Template fragments (`${...}` in class strings) | Stripped during normalization before token validation. |
| Missing remote stylesheet | Logged as error; ignored (no crash). |
| Revalidation loops | Skipped if document version unchanged (unless forced). |
| Oversized workspace | Early stop after cap to protect performance. |

---

### 🧹 When Is a Selector “Unused”?

For standalone CSS / SCSS files: a selector is unused if it does not appear in any scanned HTML / JS / TS usage context.

For embedded `<style>` blocks in HTML: a selector is unused if not referenced inside that same HTML document.

---

### ❓ Troubleshooting

| Symptom | Possible Cause | What to Do |
|---------|----------------|-----------|
| Slow first validation | Initial workspace CSS indexing | Wait once; later validations are faster. |
| Some selectors missing from completion | Workspace cap reached | Reduce project scope or split CSS; clear cache and reopen. |
| False “unused” warnings | Dynamic runtime class names | Add placeholders or comment markers (future enhancement planned). |
| Remote CSS not applied | Network / blocked fetch | Check Output log for fetch errors. |

If you file an issue, include: log output (debug), approximate CSS file count, and sample snippet.

---

### 🔄 Cache Reset Flow

1. Run: “Html-Js-Css-Analyzer: Clear Style Cache”
2. All selector maps are flushed
3. Workspace CSS file list is rebuilt lazily on next validation

---

Happy coding!
