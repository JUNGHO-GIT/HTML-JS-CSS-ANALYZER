# Html-Js-Css-Analyzer (CSS-ANALYZER) 🚀

Unified analysis of class / id usage across HTML / JS / TS / CSS / SCSS:

- Autocomplete (class, id)
- Go to Definition
- Undefined reference warnings
- Unused selector highlighting (grayed with Unnecessary)
- HTMLHint diagnostics + Quick Fix for HTML files
- JSHint diagnostics + Quick Fix for JavaScript/TypeScript files

Lightweight, fast, no extra runtime baggage.

---

## Feature Summary

| Feature | Description |
|---------|-------------|
| Autocomplete | Context aware in `class`, `id`, `#`, `.`, `classList.*`, `querySelector*` |
| Go to Definition | Jump token → declaration (local workspace + linked, excludes remote) |
| Undefined diagnostics | Warn when referenced class/id is not defined |
| Unused diagnostics | Unused selectors in CSS/SCSS shown as Hint + gray |
| Remote + Local CSS | `<link rel="stylesheet">`, http/https, workspace *.css/*.scss scan |
| HTMLHint | HTML validation with subset rules + CodeAction |
| JSHint | JavaScript/TypeScript validation + CodeAction for common issues |

---

## Installation

1. In VS Code marketplace: Html-Js-Css-Analyzer
2. Or build VSIX (`npm run vsce`) and install manually

Requires Node 18+, VS Code 1.104.0+.

---

## Basic Usage

1. Open your project
2. Edit HTML / CSS / JS / TS → validation runs after 250ms debounce
3. Undefined class/id → Warning in Problems panel
4. Unused selectors → grayed in CSS/SCSS editors
5. Use F12 (definition) / Ctrl+Space (completion)

Commands (Command Palette):

- Html-Js-Css-Analyzer: Validate Current Document
- Html-Js-Css-Analyzer: Clear Style Cache

---

## Settings

`Html-Js-Css-Analyzer.logLevel` : off | error | info | debug

`Html-Js-Css-Analyzer.exclude` : glob array of files/folders to ignore in scanning

`Html-Js-Css-Analyzer.additionalExtensions` : glob array of additional file extensions to include in scanning

## Advanced JavaScript/TypeScript Analysis

The extension provides comprehensive code analysis with built-in intelligent configuration (no external config files needed):

### Core JSHint Integration
- **Standard JSHint Rules**: All standard JSHint rules with optimized default configuration
- **TypeScript Support**: Automatic TypeScript syntax preprocessing for JSHint compatibility
- **ES2022 Support**: Modern JavaScript features and syntax

### Advanced Code Analysis Features

#### 🔍 **Complexity Analysis**
- **Deep Nesting Detection**: Warns when code nesting exceeds 6 levels
- **Long Line Detection**: Identifies lines longer than 120 characters
- **Complex Regex Detection**: Flags overly complex regular expressions
- **Function Parameter Count**: Warns when functions have more than 6 parameters

#### 🐛 **Potential Bug Detection**
- **Assignment in Conditions**: Detects accidental assignment (=) instead of comparison (===)
- **Null Reference Risks**: Identifies potential null/undefined access patterns
- **Empty Catch Blocks**: Flags catch blocks without error handling
- **Console Usage**: Highlights console statements for production cleanup
- **Eval Usage**: Warns about security risks with eval()
- **With Statements**: Detects deprecated 'with' statements

#### 📝 **Code Quality Improvements**
- **var → let/const**: Recommends modern variable declarations
- **Strict Mode**: Suggests 'use strict' when missing
- **Semicolon Consistency**: Automatic semicolon insertion and formatting
- **Equality Operators**: Converts == to === and != to !==

### Intelligent Quick Fixes

All issues come with context-aware quick fixes:

#### Standard JSHint Fixes
- **W033 (Missing semicolon)**: Add semicolon + cleanup formatting
- **W116 (Equality operators)**: Convert to strict equality operators
- **W117 (Undefined variables)**: Add variable declarations or global comments
- **W030 (Assignment/function call)**: Convert expressions to function calls
- **W098 (Unused variables)**: Remove unused variable declarations

#### Advanced Analysis Fixes
- **Complexity Issues**: Automated refactoring suggestions with TODO comments
- **var Usage**: Convert var to let/const with smart type inference
- **Console Cleanup**: Remove or comment out console statements
- **Assignment Confusion**: Fix assignment operators in conditions
- **Function Parameters**: Suggest object parameter refactoring

### TypeScript-Specific Features
- **Type Annotation Removal**: Intelligent preprocessing for JSHint compatibility
- **Interface/Type Cleanup**: Removes TypeScript-specific declarations
- **Generic Type Handling**: Processes generic syntax for analysis
- **Module System Detection**: Automatic ES6+ module configuration

### Built-in Configuration

The extension uses an optimized built-in configuration (no config files needed):

```javascript
// Automatically configured based on file type and content
{
  esversion: 2022,           // Latest ES features
  bitwise: true,             // Prevent bitwise operators
  curly: true,               // Require braces
  eqeqeq: true,             // Require === and !==
  undef: true,               // Catch undefined variables
  unused: true,              // Catch unused variables
  strict: true,              // Require strict mode
  indent: 2,                 // 2-space indentation
  maxlen: 120,              // Line length limit
  maxcomplexity: 12,        // Complexity limit
  // ... and 50+ other optimized rules
}
```

### Real-time Analysis
- **Live Error Detection**: Instant feedback as you type
- **Contextual Severity**: Errors, warnings, and info based on issue severity
- **Performance Optimized**: Efficient parsing and analysis algorithms
- **Message Consistency**: All messages prefixed with `[Html-Css-Js-Analyzer]`

---

## How It Works (Simplified)

1. Events (open/save/change) → 250ms debounce → validate
2. Collect selectors from:
   - Current document (or embedded style tags)
   - Linked `<link rel="stylesheet">` (local + remote)
   - Workspace `*.css` / `*.scss` (cap: 500 files)
3. Collect usage tokens (class/id/classList/querySelector) from open docs
4. Compare → produce undefined / unused diagnostics → store in DiagnosticCollection

Cache uses doc version / file mtime keyed entries with simple reinsertion policy.

---
