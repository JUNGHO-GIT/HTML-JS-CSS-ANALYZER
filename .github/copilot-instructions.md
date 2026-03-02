# Html-Js-Css-Analyzer — Copilot Instructions

## 1. 핵심 원칙

- **Readability > Performance > Cleverness**
- **SRP**: one function = one task
- **Fail-fast**: contextual error messages at the earliest point of failure
- Clear descriptive names (`request` not `req`, `document` not `doc`)
- Audience: senior developers — skip tutorials, state assumptions before writing code

---

## 2. 포매팅

- NEVER single-line `if`/`else`/`try`/`catch`/loop. ALWAYS braces `{}` + line breaks
- `else` and `catch` MUST start on a **NEW LINE** after closing `}`
- ONE SPACE around `=` and `:` — NEVER pad spaces to vertically align `=`
- Exception: no space in arrow param defaults `(a=1) => {}`
- Max 4-level nesting; extract helpers if deeper
- Comments: `// 1. name ----` (pad dashes to column 90)

```typescript
// ✅ DO
if (condition) {
  doSomething();
}
else {
  doOther();
}

// ❌ DON'T
if (x) return; else doOther();
```

---

## 3. 네이밍 컨벤션

| 대상 | 규칙 | 예시 |
|------|------|------|
| Source files | camelCase.ts | `cssCache.ts`, `jsValidator.ts` |
| Barrel exports | PascalCase.ts | `ExportLangs.ts`, `ExportConsts.ts` |
| Build scripts | camelCase.mjs | `swc.mjs`, `fix.mjs` |
| Constants | UPPER_SNAKE_CASE | `MAX_CACHE_SIZE`, `DIAGNOSTIC_SOURCE` |
| Functions | camelCase | `validateDocument`, `parseSelector` |
| Interfaces / Types | PascalCase | `CssSelector`, `HtmlDiagnostic` |

Import 순서: Node built-ins → External packages → Internal path aliases (`@assets/*`, `@langs/*`)

---

## 4. Java 규칙

- Java 11
- NEVER return `null` — use `Optional<T>` or `Collections.emptyList()`
- `Objects.requireNonNull()` for required parameters
- ALWAYS `try-with-resources` for `AutoCloseable`
- Prefer `final` for fields and local variables; return defensive copies
- Catch **SPECIFIC** exceptions, never `Exception`/`Throwable`
- NEVER empty catch — log or rethrow with context
- Declare by interface: `List<T>` not `ArrayList<T>`
- Prefer Stream API over traditional loops
- `StringBuilder` in loops; `String.format()` for complex concat
- No magic values — extract to `private static final` constants

---

## 5. TypeScript 규칙

### Single Exit Point

- NO early/mid-function returns
- Assign result to ONE descriptively-named variable, return at end

```typescript
// ✅ DO
const calculateResult = (value: number): number => {
  let result: number = 0;
  if (value > 0) {
    result = value * 2;
  }
  else {
    result = 0;
  }
  return result;
};

// ❌ DON'T — early return
const getValue = (flag: boolean): number => {
  if (flag) {
    return 1;
  }
  return 0;
};
```

### Ternary Chains — ALWAYS parentheses + newlines

```typescript
const level = isError ? (
  "error"
) : isWarning ? (
  "warning"
) : (
  "info"
);
```

### Preferences

- NEVER use `any` — use `unknown` or define interfaces
- Object keys: ALWAYS double-quoted `{ "key": value }` (no shorthand)
- Prefer arrow functions for callbacks
- Use nullish coalescing `??` instead of `||` for null/undefined checks
- IIFE: extract variables first; minimize usage

```typescript
// ✅ DO
const config = { "enabled": enabled, "timeout": timeout };

// ❌ DON'T — shorthand
const config = { enabled, timeout };
```

---

## 6. SQL / MyBatis 규칙

- 파라미터 바인딩: `#{}` 강제, `${}` 사용 금지 (SQL Injection 방지)
- SQL 키워드는 대문자: `SELECT`, `FROM`, `WHERE`, `INSERT`, `UPDATE`
- 테이블/컬럼 별칭은 소문자 snake_case

---

## 7. 테스트 규칙

- Given-When-Then 패턴 사용
- 한글 메서드명 허용 (`정상적으로_등록된다()`)
- 현재 이 프로젝트에는 테스트 스위트가 없음 — 빌드 + 패키징으로 검증

---

## 8. 에러 핸들링

- **NEVER** empty catch — always log or rethrow with context
- Fail fast with contextual error messages
- Catch **specific** exceptions, not generic ones
- Use `logger` utility for error logging in this project

```typescript
// ✅ DO
try {
  riskyOperation();
}
catch (error: unknown) {
  logger.error("riskyOperation failed", error);
  throw error;
}

// ❌ DON'T
try { parse(); } catch (e) { /* silent */ }
```

---

## 9. Commit 메시지

Conventional Commits 형식:

```
<type>: <description>

feat: add JSHint option passthrough for custom rules
fix: resolve undefined-class false-positive for dynamic class bindings
chore: bump css-tree to 3.1.0
refactor: extract selector parser into separate module
```

---

## 10. 에이전트 행동 규칙

- **Surgical edit**: change ONLY the requested parts
- NEVER refactor, reformat, rename unrelated code
- NEVER convert if-else to ternary/IIFE unless asked
- Preserve original style for untouched code
- **ESLint `--fix` 자동 실행 금지** — `npm run fix`는 `ts-prune` + `ts-morph`로 파일을 덮어쓸 수 있음. 반드시 개발자 승인 후 실행
- **빌드 자동 실행**: `npm run build` 전에 반드시 `npm install --legacy-peer-deps` 선행
- `out/` 디렉토리 수정 금지 — 빌드 산출물이며 매 빌드시 재생성
- NEVER fabricate APIs or libraries
- If a command fails, report the failure and exact error message — do NOT silently try alternatives

---

## 11. Changes 섹션 필수

작업 완료 후 PR 본문에 반드시 아래 형식으로 변경 요약 포함:

```markdown
## Changes
- **파일명**: 한 줄 변경 요약
- **파일명**: 한 줄 변경 요약
```
