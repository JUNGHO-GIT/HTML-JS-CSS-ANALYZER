/**
 * @file jsAnalyzer.ts
 * @since 2025-11-22
 * @description JS 소스코드 분석 및 품질 검사
 */

import type { AnalyzeResult as AnlyRes, SourceAnalysis as SrcAnly } from "@exportLangs";
import type { vscode } from "@exportLibs";

// CONSTANTS ---------------------------------------------------------------------------------------
const MAX_NESTING = 8;
const MAX_LINE_LEN = 200;
const MAX_REGEX_LEN = 80;
const MAX_REGEX_COMPLEXITY = 15;

// REGEX PATTERNS ----------------------------------------------------------------------------------
const INDENT_REGEX = /^\s*/;
const REGEX_LITERAL_RE = /\/(?![*/])(?:[^\n/\\]|\\.)+\/[gimsuvy]*/g;
const COMPLEXITY_CHARS_RE = /[()*+?[\]{|}]/g;
const COMMENT_LINE_RE = /^\s*\/\//;
const STRING_CONTENT_RE = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const ASSIGN_IN_IF_RE = /\bif\s*\([^)]*[^!<=>]=(?!=)[^=]/;
const EMPTY_CATCH_RE = /\bcatch\s*\([^)]*\)\s*{\s*}/;
const EVAL_USAGE_RE = /\beval\s*\(/;
const WITH_STATEMENT_RE = /\bwith\s*\(/;
const LOOP_START_RE = /\b(for|while)\s*\(/;
const INNER_HTML_RE = /\.innerHTML\s*=/;

// HELPERS -----------------------------------------------------------------------------------------
// 문자열/주석을 제거해 오탐을 줄인다
const stripStringsAndComments = (line: string): string => line
  .replaceAll(STRING_CONTENT_RE, `""`)
  .replace(/\/\/.*$/, ``)
  .replaceAll(/\/\*.*?\*\//g, ``);

// -------------------------------------------------------------------------------------------------
// 라인 오프셋 인덱스 생성: match.index(UTF-16 코드유닛)와 정합되도록 코드유닛 기준으로 순회
const buildLineOffsets = (text: string): number[] => {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === `\n`) {
      offsets.push(i + 1);
    }
  }
  return offsets;
};

// -------------------------------------------------------------------------------------------------
// 오프셋으로부터 1-based 라인 번호를 이진 탐색
const lineAtOffset = (offsets: number[], offset: number): number => {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= offset) {
      lo = mid;
    }
    else {
      hi = mid - 1;
    }
  }
  return lo + 1;
};

// -------------------------------------------------------------------------------------------------
// 라인별 블록 주석 상태를 미리 계산
const processBlockCommentState = (lines: string[]): boolean[] => {
  const state = Array.from<boolean>({ length: lines.length });
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`/*`) && !line.includes(`*/`)) {
      inBlock = true;
    }
    if (inBlock && line.includes(`*/`)) {
      inBlock = false;
    }
    state[i] = inBlock;
  }
  return state;
};

// ANALYSIS FUNCTIONS ------------------------------------------------------------------------------
const analyzeComplexity = (lines: string[], analysis: SrcAnly): void => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }
    const indentMatch = INDENT_REGEX.exec(line);
    const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;

    if (indentLevel > MAX_NESTING) {
      analysis.complexityIssues.push({
        type: `deep-nesting`,
        line: lineNum,
        message: `Excessive nesting (${indentLevel} levels): consider refactoring`,
      });
    }
    if (line.length > MAX_LINE_LEN) {
      analysis.complexityIssues.push({
        type: `long-line`,
        line: lineNum,
        message: `Long line (${line.length} chars): consider line break for readability`,
      });
    }
    const regexMatches = line.match(REGEX_LITERAL_RE);
    if (regexMatches) {
      for (const regex of regexMatches) {
        const complexity = (regex.match(COMPLEXITY_CHARS_RE) ?? []).length;
        if (regex.length > MAX_REGEX_LEN || complexity > MAX_REGEX_COMPLEXITY) {
          analysis.complexityIssues.push({
            type: `complex-regex`,
            line: lineNum,
            message: `Complex regex: consider splitting or adding comments for readability`,
          });
        }
      }
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzePotentialBugs = (lines: string[], blckCmtSt: boolean[], analysis: SrcAnly): void => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }
    if (blckCmtSt[i] || COMMENT_LINE_RE.test(trimmed)) {
      continue;
    }
    const strippedLine = stripStringsAndComments(line);

    if (ASSIGN_IN_IF_RE.test(strippedLine)) {
      analysis.potentialBugs.push({
        type: `assignment-in-condition`,
        line: lineNum,
        message: `Assignment in condition: did you mean comparison operator (===)?`,
      });
    }
    if (EMPTY_CATCH_RE.test(strippedLine)) {
      analysis.potentialBugs.push({
        type: `empty-catch`,
        line: lineNum,
        message: `Empty catch block: error handling required`,
      });
    }
    if (EVAL_USAGE_RE.test(strippedLine)) {
      analysis.potentialBugs.push({
        type: `eval-usage`,
        line: lineNum,
        message: `Use of eval: security risk`,
      });
    }
    if (WITH_STATEMENT_RE.test(strippedLine)) {
      analysis.potentialBugs.push({
        type: `with-statement`,
        line: lineNum,
        message: `Use of with statement: forbidden in strict mode and has performance issues`,
      });
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeSecurity = (lines: string[], blckCmtSt: boolean[], analysis: SrcAnly): void => {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (blckCmtSt[i] || COMMENT_LINE_RE.test(line.trim())) {
      continue;
    }
    const strippedLine = stripStringsAndComments(line);

    if (strippedLine.includes(`.innerHTML`) && INNER_HTML_RE.test(strippedLine)) {
      analysis.potentialBugs.push({
        type: `innerhtml-usage`,
        line: lineNum,
        message: `Assignment to innerHTML can be an XSS vulnerability`,
      });
    }
    if (strippedLine.includes(`document.write(`)) {
      analysis.potentialBugs.push({
        type: `document-write`,
        line: lineNum,
        message: `Avoid using document.write()`,
      });
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzePerformance = (lines: string[], blckCmtSt: boolean[], analysis: SrcAnly): void => {
  const loopStack: number[] = [];
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (blckCmtSt[i] || COMMENT_LINE_RE.test(line.trim())) {
      continue;
    }
    const strippedLine = stripStringsAndComments(line);

    if (LOOP_START_RE.test(strippedLine)) {
      loopStack.push(braceDepth);
      if (loopStack.length > 2) {
        analysis.potentialBugs.push({
          type: `large-loop`,
          line: lineNum,
          message: `Deeply nested loop detected (depth: ${loopStack.length}). This might affect performance.`,
        });
      }
    }

    const openBraces = (strippedLine.match(/{/g) ?? []).length;
    const closeBraces = (strippedLine.match(/}/g) ?? []).length;
    braceDepth += openBraces - closeBraces;

    while (loopStack.length > 0) {
      const lstLpDpth = loopStack[loopStack.length - 1];
      if (lstLpDpth === undefined || braceDepth > lstLpDpth) {
        break;
      }
      loopStack.pop();
    }
  }
};

// -------------------------------------------------------------------------------------------------
export const analyzeSourceCode = (sourceCode: string, document: vscode.TextDocument): AnlyRes => {
  const analysis: SrcAnly = {
    isModule: false,
    hasStrictMode: false,
    functions: [],
    variables: [],
    imports: [],
    exports: [],
    complexityIssues: [],
    potentialBugs: [],
  };

  analysis.isModule = sourceCode.includes(`import `) || sourceCode.includes(`export `) || document.fileName.endsWith(`.mjs`);
  analysis.hasStrictMode = sourceCode.includes(`"use strict"`) || sourceCode.includes(`'use strict'`);

  const lineOffsets = buildLineOffsets(sourceCode);

  // 함수 선언 분석
  for (const match of sourceCode.matchAll(/\bfunction\s+(\w+)\s*\([^)]*\)\s*{/g)) {
    const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] ?? ``;
    analysis.functions.push({
      name: match[1],
      line: lineAtOffset(lineOffsets, match.index ?? 0),
      parameters: paramsText.split(`,`).filter((p) => p.trim()).length,
    });
  }

  // 화살표 함수 분석
  for (const match of sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g)) {
    const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] ?? ``;
    analysis.functions.push({
      name: match[1],
      line: lineAtOffset(lineOffsets, match.index ?? 0),
      parameters: paramsText.split(`,`).filter((p) => p.trim()).length,
    });
  }

  // 변수 선언 분석
  for (const match of sourceCode.matchAll(/\b(let|const|var)\s+(\w+)/g)) {
    analysis.variables.push({
      name: match[2],
      type: match[1] as `let` | `const` | `var`,
      line: lineAtOffset(lineOffsets, match.index ?? 0),
    });
  }

  // import 문 분석
  for (const match of sourceCode.matchAll(/\bimport\s+.*?from\s+["'`]([^"'`]+)["'`]/g)) {
    analysis.imports.push({
      module: match[1],
      line: lineAtOffset(lineOffsets, match.index ?? 0),
    });
  }

  // export 문 분석
  for (const match of sourceCode.matchAll(/\bexport\s+(.*?)(?=\n|$)/g)) {
    analysis.exports.push({
      declaration: match[1],
      line: lineAtOffset(lineOffsets, match.index ?? 0),
    });
  }

  const lines = sourceCode.split(`\n`);
  const blckCmtSt = processBlockCommentState(lines);
  analyzeComplexity(lines, analysis);
  analyzePotentialBugs(lines, blckCmtSt, analysis);
  analyzeSecurity(lines, blckCmtSt, analysis);
  analyzePerformance(lines, blckCmtSt, analysis);

  const procdCd = sourceCode;

  return { processedCode: procdCd, analysis };
};
