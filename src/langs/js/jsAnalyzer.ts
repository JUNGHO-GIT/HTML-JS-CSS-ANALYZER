/**
 * @file jsAnalyzer.ts
 * @since 2025-11-22
 * @description JS 소스코드 분석 및 품질 검사
 */

import type { AnalyzeResult as AnlyRes, SourceAnalysis as SrcAnly } from "@exportLangs";
import type { vscode } from "@exportLibs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const MAX_NESTING = 8;
const MX_LN_LEN = 200;
const MX_RE_LEN = 80;
const MX_RE_CMPL = 15;

// REGEX PATTERNS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const INDENT_REGEX = /^\s*/;
const RE_PAT = /\/(?![*/])(?:[^\n/\\]|\\.)+\/[gimsuvy]*/g;
const CMPL_CHRS_RE = /[()*+?[\]{|}]/g;
const CMT_LN_RE = /^\s*\/\//;
const STR_CONT_RE = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const ASS_IN_IF_RE = /\bif\s*\([^)]*[^!<=>]=(?!=)[^=]/;
const EMPT_CTCH_RE = /\bcatch\s*\([^)]*\)\s*{\s*}/;
const EVL_USG_RE = /\beval\s*\(/;
const WTH_STTM_RE = /\bwith\s*\(/;
const LP_STRT_RE = /\b(for|while)\s*\(/;

// HELPERS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
const strStAnCm = (line: string): string => line
    .replaceAll(STR_CONT_RE, `""`)
    .replace(/\/\/.*$/, ``)
    .replaceAll(/\/\*.*?\*\//g, ``);

// Helper: Build line offset index for O(log n) line lookups ――――――
const bldLnOffs = (text: string): number[] => {
  const offsets = [0];
  for (const [i, ch] of [...text].entries()) {
    ch === `\n` && offsets.push(i + 1);
  }
  return offsets;
};

// Helper: Binary search to find 1-based line number from offset --
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

// Helper: Precompute block comment state per line ―――――――――――――――-
const prcBlCmSt = (lines: string[]): boolean[] => {
  const state = Array.from<boolean>({ length: lines.length });
  let inBlock = false;
  for (const [i, line] of lines.entries()) {
    line.includes(`/*`) && !line.includes(`*/`) && (inBlock = true);
    inBlock && line.includes(`*/`) && (inBlock = false);
    state[i] = inBlock;
  }
  return state;
};

// ANALYSIS FUNCTIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const anlyCmpl = (lines: string[], analysis: SrcAnly): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed.length === 0) {
    	continue;
    }
    const indentMatch = INDENT_REGEX.exec(line);
    const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;

    indentLevel > MAX_NESTING && analysis.complexityIssues.push({
        type: `deep-nesting`,
        line: lineNum,
        message: `Excessive nesting (${indentLevel} levels): consider refactoring`,
      });

    line.length > MX_LN_LEN && analysis.complexityIssues.push({
        type: `long-line`,
        line: lineNum,
        message: `Long line (${line.length} chars): consider line break for readability`,
      });

    const regexMatches = line.match(RE_PAT);
    regexMatches?.forEach((regex) => {
      const complexity = (regex.match(CMPL_CHRS_RE) ?? []).length;
      (regex.length > MX_RE_LEN || complexity > MX_RE_CMPL) && analysis.complexityIssues.push({
          type: `complex-regex`,
          line: lineNum,
          message: `Complex regex: consider splitting or adding comments for readability`,
        });
    });
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyPtntBgs = (lines: string[], blckCmtSt: boolean[], analysis: SrcAnly): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    const trimmed = line.trim();

    if (trimmed.length === 0) {
    	continue;
    }
    // Skip comments (precomputed block comment state)
    if (blckCmtSt[i] || CMT_LN_RE.test(trimmed)) {
    	continue;
    }
    // Strip strings for accurate detection
    const strippedLine = strStAnCm(line);

    ASS_IN_IF_RE.test(strippedLine) && analysis.potentialBugs.push({
        type: `assignment-in-condition`,
        line: lineNum,
        message: `Assignment in condition: did you mean comparison operator (===)?`,
      });

    EMPT_CTCH_RE.test(strippedLine) && analysis.potentialBugs.push({
        type: `empty-catch`,
        line: lineNum,
        message: `Empty catch block: error handling required`,
      });

    EVL_USG_RE.test(strippedLine) && analysis.potentialBugs.push({
        type: `eval-usage`,
        line: lineNum,
        message: `Use of eval: security risk`,
      });

    WTH_STTM_RE.test(strippedLine) && analysis.potentialBugs.push({
        type: `with-statement`,
        line: lineNum,
        message: `Use of with statement: forbidden in strict mode and has performance issues`,
      });
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyMdrnJs = (lines: string[], blckCmtSt: boolean[], analysis: SrcAnly): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    if (blckCmtSt[i] || CMT_LN_RE.test(line.trim())) {
    	continue;
    }
    // Strip strings for accurate detection
    const strippedLine = strStAnCm(line);

    /\bvar\s+/.test(strippedLine) && analysis.potentialBugs.push({
        type: `var-usage`,
        line: lineNum,
        message: `Avoid using 'var', use 'let' or 'const' instead (Modern JS)`,
      });
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyScrt = (lines: string[], blckCmtSt: boolean[], analysis: SrcAnly): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    if (blckCmtSt[i] || CMT_LN_RE.test(line.trim())) {
    	continue;
    }
    // Strip strings for accurate detection
    const strippedLine = strStAnCm(line);

    strippedLine.includes(`.innerHTML`) && /\.innerHTML\s*=/.test(strippedLine) && analysis.potentialBugs.push({
        type: `innerhtml-usage`,
        line: lineNum,
        message: `Assignment to innerHTML can be an XSS vulnerability`,
      });

    strippedLine.includes(`document.write(`) && analysis.potentialBugs.push({
        type: `document-write`,
        line: lineNum,
        message: `Avoid using document.write()`,
      });
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyPerf = (lines: string[], blckCmtSt: boolean[], analysis: SrcAnly): void => {
  const loopStack: number[] = []; // Stack of brace depths where loops started
  let braceDepth = 0;

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    if (blckCmtSt[i] || CMT_LN_RE.test(line.trim())) {
    	continue;
    }
    const strippedLine = strStAnCm(line);

    // Detect loop start
    LP_STRT_RE.test(strippedLine) && (() => {
        loopStack.push(braceDepth);
        loopStack.length > 2 && analysis.potentialBugs.push({
            type: `large-loop`,
            line: lineNum,
            message: `Deeply nested loop detected (depth: ${loopStack.length}). This might affect performance.`,
          });
      })();

    // Count braces
    const openBraces = (strippedLine.match(/{/g) ?? []).length;
    const closeBraces = (strippedLine.match(/}/g) ?? []).length;
    braceDepth += openBraces - closeBraces;

    // Pop loop stack when we exit a loop's brace level
    while (loopStack.length > 0) {
      const lstLpDpth = loopStack[loopStack.length - 1];
      if (lstLpDpth === undefined || braceDepth > lstLpDpth) {
        break;
      }
      loopStack.pop();
    }
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const anlySrcCd = (sourceCode: string, document: vscode.TextDocument): AnlyRes => {
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

  const lineOffsets = bldLnOffs(sourceCode);

  // 함수 선언 분석 (최적화된 정규식)
  const fnMtch = sourceCode.matchAll(/\bfunction\s+(\w+)\s*\([^)]*\)\s*{/g);
  [...fnMtch].forEach((match) => {
    const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] ?? ``;
    analysis.functions.push({
      name: match[1],
      line: lineAtOffset(lineOffsets, match.index),
      parameters: paramsText.split(`,`).filter((p) => p.trim()).length,
    });
  });

  // 화살표 함수 분석
  const arrowMatches = sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g);
  [...arrowMatches].forEach((match) => {
    const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] ?? ``;
    analysis.functions.push({
      name: match[1],
      line: lineAtOffset(lineOffsets, match.index),
      parameters: paramsText.split(`,`).filter((p) => p.trim()).length,
    });
  });

  // 변수 선언 분석
  const varMtch = sourceCode.matchAll(/\b(let|const|var)\s+(\w+)/g);
  [...varMtch].forEach((match) => {
    analysis.variables.push({
      name: match[2],
      type: match[1] as `let` | `const` | `var`,
      line: lineAtOffset(lineOffsets, match.index),
    });
  });

  // import 문 분석
  const imprMtch = sourceCode.matchAll(/\bimport\s+.*?from\s+["'`]([^"'`]+)["'`]/g);
  [...imprMtch].forEach((match) => {
    analysis.imports.push({
      module: match[1],
      line: lineAtOffset(lineOffsets, match.index),
    });
  });

  // export 문 분석
  const exprMtch = sourceCode.matchAll(/\bexport\s+(.*?)(?=\n|$)/g);
  [...exprMtch].forEach((match) => {
    analysis.exports.push({
      declaration: match[1],
      line: lineAtOffset(lineOffsets, match.index),
    });
  });

  const lines = sourceCode.split(`\n`);
  const blckCmtSt = prcBlCmSt(lines);
  anlyCmpl(lines, analysis);
  anlyPtntBgs(lines, blckCmtSt, analysis);
  anlyMdrnJs(lines, blckCmtSt, analysis);
  anlyScrt(lines, blckCmtSt, analysis);
  anlyPerf(lines, blckCmtSt, analysis);

  const procdCd = sourceCode;

  return { processedCode: procdCd, analysis };
};
