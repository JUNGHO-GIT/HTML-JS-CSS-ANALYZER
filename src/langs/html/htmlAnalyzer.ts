/**
 * @file htmlAnalyzer.ts
 * @since 2025-11-26
 * @description HTML 코드 분석 및 품질 검사
 */

import { vscode } from "@exportLibs";
import type { HtmlDiagData } from "@langs/html/htmlType";
import { setDiagData } from "@langs/html/htmlUtils";

// CONSTANTS ---------------------------------------------------------------------------------------
const MAX_NESTING_LEVEL = 10;
const MAX_LINE_LEN = 200;
const MAX_ATTRS_PER_TAG = 15;
const DIAGNOSTIC_SOURCE = `HTML-Analyzer`;

// REGEX PATTERNS ----------------------------------------------------------------------------------
// matchAll/exec 은 사본 이터레이터를 쓰므로 lastIndex 공유 문제가 없다.
const INLINE_STYLE_RE = /\bstyle\s*=\s*["'][^"']*["']/gi;
const INLINE_EVENT_RE = /\bon[a-z]+\s*=\s*["'][^"']*["']/gi;
const DEPRECATED_TAGS_RE = /<(center|font|marquee|blink|strike|big|tt|frameset|frame|noframes)\b/gi;
const DUPLICATE_ID_RE = /\bid\s*=\s*["']([^"']+)["']/gi;
const HTML_TAG_RE = /<([A-Za-z][\dA-Za-z-]*)\s*([^>]*)>/g;
const ATTR_RE = /([A-Za-z][\w-]*)\s*(?:=\s*["'][^"']*["'])?/g;

// 여는 태그 / 닫는 태그 (속성값에 `/` 가 있어도 매칭되도록 [^>]* 사용)
const OPEN_TAG_RE = /<([A-Za-z][\dA-Za-z-]*)([^>]*)>/g;
const CLOSE_TAG_RE = /<\/([A-Za-z][\dA-Za-z-]*)\s*>/g;

// 접근성 / 보안 (전체 텍스트 global 매칭)
const IMG_NO_ALT = /<img\b(?![^>]*\balt\s*=)[^>]*>/gi;
const ANCHOR_NO_HREF_RE = /<a\b(?![^>]*\bhref\s*=)[^>]*>/gi;
const BUTTON_NO_TYPE_RE = /<button\b(?![^>]*\btype\s*=)[^>]*>/gi;
const TARGET_BLANK_RE = /target\s*=\s*["']_blank["'](?![^>]*\brel\s*=\s*["'](?:[^"']*\s)?noopener(?:[^"']*)?["'])/gi;

// 문서 구조 검사
const DOCTYPE_RE = /<!doctype\s+html>/i;
const HTML_LANG_RE = /<html[^>]*\slang\s*=/i;
const META_CHRS_RE = /<meta[^/>]*charset\s*=/i;
const META_VWPR_RE = /<meta[^/>]*name\s*=\s*["']viewport["']/i;
const TAG_COUNT_RE = /<[A-Za-z][\dA-Za-z-]*[^>]*>/g;

// script/style 콘텐츠 마스킹 (오탐 방지 + 오프셋/줄번호 보존)
const SCRIPT_STYLE_RE = /<(script|style)[^>]*>[\S\s]*?<\/\1>/gi;

// void(자기완결) 요소 집합
const VOID_TAGS = new Set([`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`]);

// TYPE DEFINITIONS ------------------------------------------------------------------------------
declare type HtmlAnalysisIssue = {
  type: string;
  line: number;
  message: string;
  severity: `error` | `warning` | `info`;
};

declare type HtmlAnalysisResult = {
  issues: HtmlAnalysisIssue[];
  tagCount: number;
  maxNestingLevel: number;
  hasDoctype: boolean;
  hasHtmlLang: boolean;
  hasMetaCharset: boolean;
  hasMetaViewport: boolean;
  inlineStyleCount: number;
  inlineEventCount: number;
};

// HELPERS ---------------------------------------------------------------------------------------
// script/style 블록의 비개행 문자를 공백으로 치환한다. 길이·개행이 보존되어
// 오프셋과 줄번호가 원본과 정확히 일치한다.
const maskScriptStyle = (source: string): string => (
  source.replaceAll(SCRIPT_STYLE_RE, (block) => block.replace(/[^\n]/g, ` `))
);

// -------------------------------------------------------------------------------------------------
// 각 줄의 시작 오프셋 목록을 구성한다.
const buildLineStarts = (text: string): number[] => {
  const starts = [0];
  let idx = text.indexOf(`\n`);
  while (idx !== -1) {
    starts.push(idx + 1);
    idx = text.indexOf(`\n`, idx + 1);
  }
  return starts;
};

// -------------------------------------------------------------------------------------------------
// 오프셋으로 1-기반 줄번호를 이진 탐색한다.
const lineAtOffset = (starts: number[], offset: number): number => {
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= offset) {
      lo = mid;
    }
    else {
      hi = mid - 1;
    }
  }
  return lo + 1;
};

// ANALYSIS FUNCTIONS ------------------------------------------------------------------------------
const analyzeNesting = (maskedSrc: string, issues: HtmlAnalysisIssue[]): number => {
  const lines = maskedSrc.split(`\n`);
  let curNstn = 0;
  let maxNesting = 0;

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    for (const m of line.matchAll(OPEN_TAG_RE)) {
      const tagName = m[1].toLowerCase();
      const isSelfClose = m[2].trimEnd().endsWith(`/`);
      if (VOID_TAGS.has(tagName) || isSelfClose) {
        continue;
      }
      curNstn++;
    }

    if (curNstn > maxNesting) {
      maxNesting = curNstn;
    }

    if (curNstn > MAX_NESTING_LEVEL) {
      issues.push({
        type: `deep-nesting`,
        line: lineNum,
        message: `Excessive HTML nesting (${curNstn} levels): consider refactoring`,
        severity: `warning`,
      });
    }

    const closeTags = line.match(CLOSE_TAG_RE) ?? [];
    for (let k = 0; k < closeTags.length; k++) {
      if (curNstn > 0) {
        curNstn--;
      }
    }
  }
  return maxNesting;
};

// -------------------------------------------------------------------------------------------------
const analyzeInlineStyles = (lines: string[], issues: HtmlAnalysisIssue[]): number => {
  let inlnStylCnt = 0;

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    const matches = line.match(INLINE_STYLE_RE);
    if (!matches) {
      continue;
    }
    for (let k = 0; k < matches.length; k++) {
      inlnStylCnt++;
      issues.push({
        type: `inline-style`,
        line: lineNum,
        message: `Inline style detected: consider using external CSS`,
        severity: `info`,
      });
    }
  }
  return inlnStylCnt;
};

// -------------------------------------------------------------------------------------------------
const analyzeInlineEvents = (lines: string[], issues: HtmlAnalysisIssue[]): number => {
  let inlnEvtCnt = 0;

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    const matches = line.match(INLINE_EVENT_RE);
    if (!matches) {
      continue;
    }
    for (let k = 0; k < matches.length; k++) {
      inlnEvtCnt++;
      issues.push({
        type: `inline-event`,
        line: lineNum,
        message: `Inline event handler detected: consider using addEventListener`,
        severity: `info`,
      });
    }
  }
  return inlnEvtCnt;
};

// -------------------------------------------------------------------------------------------------
const analyzeDeprecatedTags = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    for (const m of line.matchAll(DEPRECATED_TAGS_RE)) {
      issues.push({
        type: `deprecated-tag`,
        line: lineNum,
        message: `Deprecated tag <${m[1]}>: use modern alternatives`,
        severity: `warning`,
      });
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeDuplicateIds = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  const idMap = new Map<string, number[]>();

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    for (const m of line.matchAll(DUPLICATE_ID_RE)) {
      const id = m[1];
      const existing = idMap.get(id) ?? [];
      existing.push(lineNum);
      idMap.set(id, existing);
    }
  }

  for (const [id, lineNumbers] of idMap) {
    if (lineNumbers.length > 1) {
      issues.push({
        type: `duplicate-id`,
        line: lineNumbers[0],
        message: `Duplicate ID '${id}' found on lines: ${lineNumbers.join(`, `)}`,
        severity: `error`,
      });
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeLineLength = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    if (line.length > MAX_LINE_LEN) {
      issues.push({
        type: `long-line`,
        line: lineNum,
        message: `Long line (${line.length} chars): consider breaking for readability`,
        severity: `info`,
      });
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeAttrCount = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    for (const tagMatch of line.matchAll(HTML_TAG_RE)) {
      const attributes = tagMatch[2];
      const attrCount = (attributes.match(ATTR_RE) ?? []).length;
      if (attrCount > MAX_ATTRS_PER_TAG) {
        issues.push({
          type: `too-many-attributes`,
          line: lineNum,
          message: `Tag has ${attrCount} attributes: consider using data attributes or simplifying`,
          severity: `warning`,
        });
      }
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeDocStructure = (sourceCode: string): Pick<HtmlAnalysisResult, `hasDoctype` | `hasHtmlLang` | `hasMetaCharset` | `hasMetaViewport`> => {
  const hasDoctype = DOCTYPE_RE.test(sourceCode);
  const hasHtmlLang = HTML_LANG_RE.test(sourceCode);
  const hasMetaCharset = META_CHRS_RE.test(sourceCode);
  const hasMetaViewport = META_VWPR_RE.test(sourceCode);

  return { hasDoctype, hasHtmlLang, hasMetaCharset, hasMetaViewport };
};

// -------------------------------------------------------------------------------------------------
const countTags = (sourceCode: string): number => {
  const matches = sourceCode.match(TAG_COUNT_RE);
  return matches ? matches.length : 0;
};

// -------------------------------------------------------------------------------------------------
// 전체 텍스트(script/style 마스킹 후)에 global 매칭하여 같은 줄 다중 태그와
// 다중행 태그까지 모두 잡는다.
const analyzeAccessibility = (maskedSrc: string, lnStarts: number[], issues: HtmlAnalysisIssue[]): void => {
  for (const m of maskedSrc.matchAll(IMG_NO_ALT)) {
    issues.push({
      type: `a11y-img-alt`,
      line: lineAtOffset(lnStarts, m.index ?? 0),
      message: `Image tag missing 'alt' attribute (accessibility)`,
      severity: `warning`,
    });
  }

  for (const m of maskedSrc.matchAll(ANCHOR_NO_HREF_RE)) {
    issues.push({
      type: `a11y-anchor-href`,
      line: lineAtOffset(lnStarts, m.index ?? 0),
      message: `Anchor tag missing 'href' attribute (accessibility)`,
      severity: `warning`,
    });
  }

  for (const m of maskedSrc.matchAll(BUTTON_NO_TYPE_RE)) {
    issues.push({
      type: `best-practice-button-type`,
      line: lineAtOffset(lnStarts, m.index ?? 0),
      message: `Button tag missing 'type' attribute (default is 'submit')`,
      severity: `info`,
    });
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeSecurity = (maskedSrc: string, lnStarts: number[], issues: HtmlAnalysisIssue[]): void => {
  for (const m of maskedSrc.matchAll(TARGET_BLANK_RE)) {
    issues.push({
      type: `security-target-blank`,
      line: lineAtOffset(lnStarts, m.index ?? 0),
      message: `Using target="_blank" without rel="noopener noreferrer" is a security risk`,
      severity: `warning`,
    });
  }
};

// MAIN ANALYSIS FUNCTION --------------------------------------------------------------------------
export const analyzeHtmlCode = (sourceCode: string): HtmlAnalysisResult => {
  const issues: HtmlAnalysisIssue[] = [];
  const lines = sourceCode.split(`\n`);
  const maskedSrc = maskScriptStyle(sourceCode);
  const lnStarts = buildLineStarts(maskedSrc);

  const mxNstnLvl = analyzeNesting(maskedSrc, issues);
  const inlnStylCnt = analyzeInlineStyles(lines, issues);
  const inlnEvtCnt = analyzeInlineEvents(lines, issues);
  analyzeDeprecatedTags(lines, issues);
  analyzeDuplicateIds(lines, issues);
  analyzeLineLength(lines, issues);
  analyzeAttrCount(lines, issues);
  analyzeAccessibility(maskedSrc, lnStarts, issues);
  analyzeSecurity(maskedSrc, lnStarts, issues);

  const structure = analyzeDocStructure(sourceCode);
  const tagCount = countTags(sourceCode);

  return {
    issues,
    tagCount,
    maxNestingLevel: mxNstnLvl,
    inlineStyleCount: inlnStylCnt,
    inlineEventCount: inlnEvtCnt,
    ...structure,
  };
};

// DIAGNOSTIC GENERATION ---------------------------------------------------------------------------
export const generateHtmlAnalysisDiagnostics = (document: vscode.TextDocument, analysis: HtmlAnalysisResult): vscode.Diagnostic[] => {
  const diagnostics: vscode.Diagnostic[] = [];

  for (const issue of analysis.issues) {
    const line = Math.max(issue.line - 1, 0);
    const clampedLine = Math.min(line, document.lineCount - 1);
    const lineText = document.lineAt(clampedLine).text;
    const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lineText.length));

    let severity: vscode.DiagnosticSeverity;
    if (issue.severity === `error`) {
      severity = vscode.DiagnosticSeverity.Error;
    }
    else if (issue.severity === `warning`) {
      severity = vscode.DiagnosticSeverity.Warning;
    }
    else {
      severity = vscode.DiagnosticSeverity.Information;
    }

    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = DIAGNOSTIC_SOURCE;
    diagnostic.code = issue.type;

    const data: HtmlDiagData = {
      ruleId: issue.type,
      line: issue.line,
      analysisType: `html-quality`,
    };
    setDiagData(diagnostic, data);

    diagnostics.push(diagnostic);
  }

  return diagnostics;
};

// EXPORT TYPES ------------------------------------------------------------------------------------
export type { HtmlAnalysisIssue, HtmlAnalysisResult };
