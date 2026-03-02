# Html-Js-Css-Analyzer — Architecture

## 1. 프로젝트 설명

HTML, JavaScript, CSS 파일을 분석하여 미사용 CSS 셀렉터, 잘못된 HTML 마크업, JS 린트 오류를 진단하고 IntelliSense를 제공하는 **Visual Studio Code 확장(Extension)**.

---

## 2. 기술 스택

| 항목 | 상세 |
|------|------|
| Language | TypeScript 5.9.3 (target: esnext, module: commonjs) |
| Runtime | Node.js ≥ 21.0.0 |
| Package Manager | Bun (primary), npm ≥ 10.0.0 |
| Framework | VS Code Extension API ≥ 1.109.0 |
| 빌드 | SWC (`@swc/core` 1.15.11) + `tsc-alias` 1.8.16 |
| 린트 | ESLint 10.0.0 + `@typescript-eslint` 8.54.0 + `@stylistic/eslint-plugin` |
| 핵심 의존성 | `css-tree` ^3.1.0 (CSS AST), `htmlhint` ^1.8.1, `jshint` ^2.13.6 |
| 패키징 | `@vscode/vsce` ^3.7.1 |

---

## 3. 디렉토리 구조

```
.
├── .github/
│   ├── copilot-instructions.md   # 코딩 규칙 + 에이전트 행동 지침
│   └── architecture.md           # 이 파일
├── .node/
│   ├── lib/                      # 공유 유틸 (settings.mjs, utils.mjs, env.mjs)
│   └── mjs/                      # 빌드 스크립트 (swc.mjs, fix.mjs, vsce.mjs 등)
├── src/
│   ├── extension.ts              # Extension 진입점 (activate/deactivate)
│   ├── assets/
│   │   ├── scripts/              # 핵심 유틸: diagnostic, logger, performance, validate 등
│   │   └── type/domain/          # TypeScript 타입 정의
│   ├── consts/
│   │   └── ConstsConfig.ts       # 전역 설정 상수
│   ├── exports/                  # Barrel re-exports (ExportConsts, ExportLangs 등)
│   └── langs/
│       ├── css/                  # CSS 분석: cssAnalyzer, cssCache, cssParser, cssValidator
│       ├── html/                 # HTML 분석: htmlAnalyzer, htmlValidator, htmlConfig
│       └── js/                   # JS 분석: jsAnalyzer, jsValidator, jsConfig
├── out/                          # 빌드 산출물 (자동 생성, 수정 금지)
├── eslint.config.mjs             # ESLint flat config
├── tsconfig.json                 # TypeScript 컴파일러 옵션
├── tsconfig.paths.json           # Path alias 정의 (@assets/*, @langs/* 등)
├── .server.swcrc                 # SWC 컴파일러 설정
└── package.json                  # 프로젝트 매니페스트 & 스크립트
```

### 수정 금지 목록

| 경로 | 이유 |
|------|------|
| `node_modules/` | 패키지 매니저 관리 |
| `out/` | 빌드 산출물 — 매 빌드시 재생성 |
| `*.bak` | `fix.mjs`가 자동 생성하는 백업 |
| `*.vsix` | 패키징된 확장 파일 |
| `.gitattributes`, `.editorconfig`, `license.md`, `package.default.json` | CDN sync 관리 |

---

## 4. 빌드 / 실행 명령어

### 의존성 설치

```shell
npm install --legacy-peer-deps
# Expected: "added 771 packages ..." (exit 0)
```

> `--legacy-peer-deps` 필수 — ESLint v10 peer dependency 충돌 해결

### 빌드

```shell
npm run build
# → bun .node/mjs/swc.mjs --bun --build --server
# Expected: "Successfully compiled: 34 files with swc" + tsc-alias 완료 (exit 0)
```

빌드 과정: `out/` 삭제 → SWC로 `src/` → `out/` 컴파일 → `tsc-alias`로 path alias 해소

### Bun 미설치 시 대안

```shell
node .node/mjs/swc.mjs --npm --build --server
```

### 테스트

N/A — 자동 테스트 스위트 없음. 빌드 성공 + VS Code 확장 로드로 검증.

### CI

N/A — CI 워크플로 미구성. 수동 검증 체크리스트:

1. `npm install --legacy-peer-deps`
2. `npm run build` (exit 0)
3. `bunx eslint src/` (린트 에러 없음)

---

## 5. 사용 가능한 스크립트

| 스크립트 | 명령어 | 설명 |
|----------|--------|------|
| `build` | `npm run build` | SWC 빌드 (server 모드) |
| `start` | `npm run start` | Watch 모드 (빌드 + 파일 감시) |
| `fix` | `npm run fix` | ts-prune + ts-morph로 미사용 export 제거 ⚠️ 파일 덮어쓰기 주의 |
| `vsce` | `npm run vsce` | .vsix 확장 패키징 |
| `sync` | `npm run sync` | CDN 동기화 |
| `reset` | `npm run reset` | 의존성 초기화 |

### 자주 발생하는 빌드 에러

| 에러 | 원인 | 해결 |
|------|------|------|
| `bun: command not found` | Bun 미설치 | `npm i -g bun` 또는 `node .node/mjs/swc.mjs --npm --build --server` |
| `unable to resolve dependency tree` | ESLint peer mismatch | `npm install --legacy-peer-deps` |
| `실행할 수 있는 모드를 찾을 수 없습니다` | start/watch 시 entry 없음 | `npm run build` 만 사용 |
| path alias 미해소 | 빌드 미완료 | `npm run build` end-to-end 실행 (tsc-alias 자동 실행) |
