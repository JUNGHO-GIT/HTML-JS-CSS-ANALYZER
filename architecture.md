# Architecture Overview

## 1. Core Components

The extension is built around three main analysis engines orchestrated by a central diagnostic manager.

| Component | Description | Key Modules |
| :--- | :--- | :--- |
| **Entry Point** | Extension activation and event registration | `extension.ts` |
| **HTML Engine** | Validates HTML using **HTMLHint** | `htmlValidator.ts`, `htmlConfig.ts` |
| **CSS Engine** | Parses CSS (AST), caches selectors, and provides IntelliSense | `cssValidator.ts`, `cssParser.ts`, `cssCache.ts` |
| **JS Engine** | Validates JavaScript using **JSHint** | `jsValidator.ts`, `jsConfig.ts` |
| **Core Utils** | Handles diagnostics, performance, and file system operations | `diagnostic.ts`, `performance.ts`, `validate.ts` |

## 2. Project Structure

```text
src/
├── extension.ts                    # Entry Point
├── assets/
│   └── scripts/                    # Core Utilities (Diagnostic, Logger, Performance)
├── consts/                         # Configuration Constants
├── langs/                          # Language Specific Logic
│   ├── css/                        # CSS Analysis, Parsing & Caching
│   ├── html/                       # HTML Validation (HTMLHint)
│   └── js/                         # JS Validation (JSHint)
└── exports/                        # Shared Exports
```

## 3. Data Flow

1. **Activation**: `extension.ts` registers providers and event listeners.
2. **Event**: Document open/change triggers `diagnostic.ts`.
3. **Validation**:

* `validate.ts` delegates to specific language validators (`html`, `css`, `js`).
* **CSS** uses `cssParser` to build an AST and `cssCache` to store selectors.
* **HTML/JS** use their respective linters (HTMLHint/JSHint)

4. **Feedback**: Diagnostics are reported back to VS Code via `diagnostic.ts`.
