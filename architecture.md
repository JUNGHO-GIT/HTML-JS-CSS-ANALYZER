# Architecture Overview

## 1. Project Structure

```
src/
├── extension.ts                    # Entry Point (VSCode Extension Activation)
├── assets/
│   ├── scripts/                    # Core Utilities
│   │   ├── diagnostic.ts           # Diagnostic Manager (validation orchestration)
│   │   ├── filter.ts               # Document Filtering (analyzable check)
│   │   ├── glob.ts                 # Glob Pattern Utilities
│   │   ├── lineIndex.ts            # Line/Column Index Mapper
│   │   ├── logger.ts               # Logging System
│   │   ├── notify.ts               # User Notifications
│   │   ├── performance.ts          # Performance Monitoring & Resource Limiting
│   │   └── validate.ts             # Document Validation Logic
│   └── types/
│       ├── alias.d.ts              # Module Path Aliases
│       └── common.ts               # Shared Type Definitions
├── consts/
│   └── ConstsConfig.ts             # Extension Configuration
├── exports/                        # Centralized Exports (Barrel Pattern)
│   ├── ExportConsts.ts             # Configuration Exports
│   ├── ExportLangs.ts              # Language Module Exports
│   ├── ExportLibs.ts               # External Library Exports
│   ├── ExportScripts.ts            # Utility Script Exports
│   └── ExportTypes.ts              # Type Definition Exports
└── langs/                          # Language-Specific Modules
    ├── css/
    │   ├── cssCache.ts             # CSS Selector Cache (LRU)
    │   ├── cssParser.ts            # CSS Selector Parser
    │   ├── cssType.ts              # CSS Type Definitions
    │   ├── cssUtils.ts             # CSS Utilities (fetch, file read, validation helpers)
    │   └── cssValidator.ts         # CSS Provider (Completion, Definition, Validation)
    ├── html/
    │   ├── htmlCodeActions.ts      # HTML Quick Fixes
    │   ├── htmlConfig.ts           # HTMLHint Configuration
    │   ├── htmlType.ts             # HTML Type Definitions
    │   ├── htmlUtils.ts            # HTML Utilities (clamp, makeQuickFix 등)
    │   └── htmlValidator.ts        # HTMLHint Execution & Diagnostic
    └── js/
        ├── jsAnalyzer.ts           # JS Code Analysis
        ├── jsCodeActions.ts        # JS Quick Fixes
        ├── jsConfig.ts             # JSHint Configuration
        ├── jsType.ts               # JS Type Definitions
        ├── jsUtils.ts              # JS Utilities (clamp, error range 등)
        └── jsValidator.ts          # JSHint Execution & Diagnostic
```

## 2. Module Responsibilities

### 2.1 Core Layer (`assets/scripts/`)

| Module | Responsibility |
|--------|---------------|
| `diagnostic.ts` | DiagnosticCollection 관리, 디바운스 스케줄링, 문서 변경 추적 |
| `filter.ts` | 문서 분석 가능 여부 판단 (scheme, extension, exclusion) |
| `glob.ts` | Glob 패턴 → RegExp 변환, URI 제외 판단 |
| `lineIndex.ts` | 문자열 인덱스 ↔ 줄/열 좌표 변환 |
| `logger.ts` | OutputChannel 기반 로깅, 로그 레벨 관리 |
| `notify.ts` | 사용자 알림 (Progress, Message) |
| `performance.ts` | 성능 모니터링, 리소스 제한, throttle/debounce |
| `validate.ts` | 문서 유효성 검사 조율 (CSS, HTML, JS 통합) |

### 2.2 Language Layer (`langs/`)

| Language | Components | Purpose |
|----------|------------|---------|
| **CSS** | `cssCache`, `cssParser`, `cssUtils`, `cssValidator` | 셀렉터 파싱, 캐싱, 자동완성/정의 제공, 원격/로컬 CSS 파일 처리 |
| **HTML** | `htmlConfig`, `htmlValidator`, `htmlUtils`, `htmlCodeActions` | HTMLHint 실행, Quick Fix 제공, 유틸리티 함수 |
| **JS** | `jsConfig`, `jsValidator`, `jsUtils`, `jsAnalyzer`, `jsCodeActions` | JSHint 실행, 코드 분석, 유틸리티 함수 |

### 2.3 Configuration Layer (`consts/`)

| Module | Responsibility |
|--------|---------------|
| `ConstsConfig.ts` | 확장 설정 읽기 (logLevel, exclude, additionalExtensions 등) |

## 3. Data Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                        VSCode Extension                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      extension.ts (Entry)                        │
│  - registerProviders()                                           │
│  - registerEventHandlers()                                       │
│  - registerCommands()                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  DiagnosticMgr  │  │   CssSupport    │  │  CodeActions    │
│  (diagnostic.ts)│  │(cssValidator.ts)│  │ (htmlCodeAct..) │
│                 │  │                 │  │                 │
│ - scheduleValid │  │ - Completion    │  │ - Quick Fixes   │
│ - updateDiags   │  │ - Definition    │  │                 │
│ - onClosed      │  │ - validate()    │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │
          ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     validate.ts (Orchestrator)                   │
│  - collectKnownSelectors()                                       │
│  - scanDocumentUsages()                                          │
│  - scanLocalUnused() / scanEmbeddedUnused()                      │
└─────────────────────────────────────────────────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    CSS Layer    │  │   HTML Layer    │  │    JS Layer     │
│  - cssParser    │  │ - htmlValidator │  │  - jsValidator  │
│  - cssCache     │  │  - htmlConfig   │  │  - jsAnalyzer   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## 4. Key Design Patterns

### 4.1 Barrel Pattern (Exports)

- 모든 공개 API는 `exports/` 폴더의 배럴 파일을 통해 노출
- 내부 모듈 간 의존성 단순화
- Path alias (`@exportLibs`, `@exportScripts` 등) 사용

### 4.2 Singleton Pattern

- `DiagnosticManager` (diagnostic.ts)
- `performanceMonitor` (performance.ts)
- `resourceLimiter` (performance.ts)

### 4.3 LRU Cache Pattern

- `cssCache.ts`: 셀렉터 캐시 (300개 제한, 30분 TTL)

### 4.4 Debounce/Throttle

- 문서 변경 시 유효성 검사 스케줄링 (250ms ~ 1000ms 동적 조정)

## 5. Import Rules

```typescript
// ✅ 올바른 import (배럴 파일 사용)
import { vscode } from "@exportLibs";
import { logger, isAnalyzable } from "@exportScripts";
import { CssSupport, runHtmlHint } from "@exportLangs";
import { SelectorType, AutoValidationMode } from "@exportTypes";
import { getLogLevel, isCssHintEnabled } from "@exportConsts";

// ❌ 피해야 할 import (직접 경로)
import { logger } from "../assets/scripts/logger";
```

## 6. Extension Points

| Provider | Language | Registration |
|----------|----------|--------------|
| CompletionItemProvider | HTML, CSS, JS | `CssSupport` |
| DefinitionProvider | HTML, CSS, JS | `CssSupport` |
| CodeActionProvider | HTML | `HtmlHintCodeActionProvider` |
| DiagnosticCollection | All | `DiagnosticManager` |
