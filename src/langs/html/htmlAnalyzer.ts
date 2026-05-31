/**
 * @file htmlAnalyzer.ts
 * @since 2025-11-26
 * @description HTML 코드 분석 및 품질 검사
 */

import { vscode } from "@exportLibs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const MX_NSTN_LVL = 10;
const MX_LN_LEN = 200;
const MX_ATT_PR_TG = 15;

// REGEX PATTERNS (non-global for .test(), global for .exec() loops)
const HTML_TG_RE = /<([A-Za-z][\dA-Za-z-]*)\s*([^>]*)>/g;
const INLN_STYL_RE = /\bstyle\s*=\s*["'][^"']*["']/gi;
const INLN_EVT_RE = /\bon[a-z]+\s*=\s*["'][^"']*["']/gi;
const DPRC_TGS_RE = /<(center|font|marquee|blink|strike|big|tt|frameset|frame|noframes)\b/gi;
const DPLC_ID_RE = /\bid\s*=\s*["']([^"']+)["']/gi;
const ATTR_RE = /([A-Za-z][\w-]*)\s*(?:=\s*["'][^"']*["'])?/g;

// Non-global versions for .test() (avoids lastIndex issues)
const IWAT = /<img\b(?![^/>]*\balt\s*=)[^>]*>/i;
const AWHT = /<a\b(?![^>]*\bhref\s*=)[^>]*>/i;
const BWTT = /<button\b(?![^>]*\btype\s*=)[^>]*>/i;
const TGT_BLNK_TST = /target\s*=\s*["']_blank["'](?![^>]*\brel\s*=\s*["'](?:[^"']*\s)?noopener(?:[^"']*)?["'])/i;

// Script/Style content removal
const SSCR = /<(script|style)[^>]*>[\S\s]*?<\/\1>/gi;

// TYPE DEFINITIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
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

// ANALYSIS FUNCTIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const anlyNstn = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
  // Remove script and style content to avoid false positives
  const clndSrc = sourceCode.replaceAll(SSCR, (_match, tag) => `<${tag}></${tag}>`);
  const lines = clndSrc.split(`\n`);
  let curNstn = 0;
  let maxNesting = 0;
  const slfClsnTgs = new Set([`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`]);

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    const openTags = line.match(/<[A-Za-z][\dA-Za-z-]*[^/>]*>/g) ?? [];
    const closeTags = line.match(/<\/[A-Za-z][\dA-Za-z-]*>/g) ?? [];

    for (const tag of openTags) {
      const tagName = tag.match(/<([A-Za-z][\dA-Za-z-]*)/)?.[1]?.toLowerCase();
      typeof tagName === `string` && tagName.length > 0 && !slfClsnTgs.has(tagName) && !tag.endsWith(`/>`) && curNstn++;
    }
    curNstn > maxNesting && (maxNesting = curNstn);

    curNstn > MX_NSTN_LVL && issues.push({
        type: `deep-nesting`,
        line: lineNum,
        message: `Excessive HTML nesting (${curNstn} levels): consider refactoring`,
        severity: `warning`,
      });

    closeTags.forEach(() => {
      curNstn > 0 && curNstn--;
    });
  }
  return maxNesting;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyInlnStyl = (lines: string[], issues: HtmlAnalysisIssue[]): number => {
  let inlnStylCnt = 0;

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    const matches = line.match(INLN_STYL_RE);

    matches?.forEach(() => {
      inlnStylCnt++;
      issues.push({
        type: `inline-style`,
        line: lineNum,
        message: `Inline style detected: consider using external CSS`,
        severity: `info`,
      });
    });
  }
  return inlnStylCnt;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyInlnEvts = (lines: string[], issues: HtmlAnalysisIssue[]): number => {
  let inlnEvtCnt = 0;

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    const matches = line.match(INLN_EVT_RE);

    matches?.forEach(() => {
      inlnEvtCnt++;
      issues.push({
        type: `inline-event`,
        line: lineNum,
        message: `Inline event handler detected: consider using addEventListener`,
        severity: `info`,
      });
    });
  }
  return inlnEvtCnt;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyDprcTgs = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    let match: RegExpExecArray | null;

    DPRC_TGS_RE.lastIndex = 0;
    while ((match = DPRC_TGS_RE.exec(line))) {
      issues.push({
        type: `deprecated-tag`,
        line: lineNum,
        message: `Deprecated tag <${match[1]}>: use modern alternatives`,
        severity: `warning`,
      });
    }
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyDplcIds = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  const idMap = new Map<string, number[]>();

  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    let match: RegExpExecArray | null;

    DPLC_ID_RE.lastIndex = 0;
    while ((match = DPLC_ID_RE.exec(line))) {
      const id = match[1];
      const existing = idMap.get(id) ?? [];
      existing.push(lineNum);
      idMap.set(id, existing);
    }
  }
  idMap.forEach((lineNumbers, id) => {
    lineNumbers.length > 1 && issues.push({
        type: `duplicate-id`,
        line: lineNumbers[0],
        message: `Duplicate ID '${id}' found on lines: ${lineNumbers.join(`, `)}`,
        severity: `error`,
      });
  });
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyLnLen = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    line.length > MX_LN_LEN && issues.push({
        type: `long-line`,
        line: lineNum,
        message: `Long line (${line.length} chars): consider breaking for readability`,
        severity: `info`,
      });
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyAttrCnt = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;
    let tagMatch: RegExpExecArray | null;

    HTML_TG_RE.lastIndex = 0;
    while ((tagMatch = HTML_TG_RE.exec(line))) {
      const attributes = tagMatch[2];
      const attrCount = (attributes.match(ATTR_RE) ?? []).length;

      attrCount > MX_ATT_PR_TG && issues.push({
          type: `too-many-attributes`,
          line: lineNum,
          message: `Tag has ${attrCount} attributes: consider using data attributes or simplifying`,
          severity: `warning`,
        });
    }
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyDocStrc = (sourceCode: string): Pick<HtmlAnalysisResult, `hasDoctype` | `hasHtmlLang` | `hasMetaCharset` | `hasMetaViewport`> => {
  const hasDoctype = /<!doctype\s+html>/i.test(sourceCode);
  const hasHtmlLang = /<html[^>]*\slang\s*=/i.test(sourceCode);
  const hsMtChrs = /<meta[^/>]*charset\s*=/i.test(sourceCode);
  const hsMtVwpr = /<meta[^/>]*name\s*=\s*["']viewport["']/i.test(sourceCode);

  return { hasDoctype, hasHtmlLang, hasMetaCharset: hsMtChrs, hasMetaViewport: hsMtVwpr };
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const countTags = (sourceCode: string): number => {
  const matches = sourceCode.match(/<[A-Za-z][\dA-Za-z-]*[^>]*>/g);
  return matches ? matches.length : 0;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyAccs = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    // Image without alt (using non-global regex)
    IWAT.test(line) && issues.push({
        type: `a11y-img-alt`,
        line: lineNum,
        message: `Image tag missing 'alt' attribute (accessibility)`,
        severity: `warning`,
      });

    // Anchor without href (using non-global regex)
    AWHT.test(line) && issues.push({
        type: `a11y-anchor-href`,
        line: lineNum,
        message: `Anchor tag missing 'href' attribute (accessibility)`,
        severity: `warning`,
      });

    // Button without type (using non-global regex)
    BWTT.test(line) && issues.push({
        type: `best-practice-button-type`,
        line: lineNum,
        message: `Button tag missing 'type' attribute (default is 'submit')`,
        severity: `info`,
      });
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const anlyScrt = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [i, line] of lines.entries()) {
    const lineNum = i + 1;

    // target="_blank" security risk (using non-global regex)
    TGT_BLNK_TST.test(line) && issues.push({
        type: `security-target-blank`,
        line: lineNum,
        message: `Using target="_blank" without rel="noopener noreferrer" is a security risk`,
        severity: `warning`,
      });
  }
};

// MAIN ANALYSIS FUNCTION ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export const anlyHtmlCd = (sourceCode: string): HtmlAnalysisResult => {
  const issues: HtmlAnalysisIssue[] = [];
  const lines = sourceCode.split(`\n`);

  const mxNstnLvl = anlyNstn(sourceCode, issues);
  const inlnStylCnt = anlyInlnStyl(lines, issues);
  const inlnEvtCnt = anlyInlnEvts(lines, issues);
  anlyDprcTgs(lines, issues);
  anlyDplcIds(lines, issues);
  anlyLnLen(lines, issues);
  anlyAttrCnt(lines, issues);
  anlyAccs(lines, issues);
  anlyScrt(lines, issues);

  const structure = anlyDocStrc(sourceCode);
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

// DIAGNOSTIC GENERATION ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const gnrHtAnDi = (document: vscode.TextDocument, analysis: HtmlAnalysisResult): vscode.Diagnostic[] => {
  const diagnostics: vscode.Diagnostic[] = [];

  analysis.issues.forEach((issue) => {
    const line = Math.max(issue.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lineText.length));

    const severity = issue.severity === `error` ? vscode.DiagnosticSeverity.Error : issue.severity === `warning` ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;

    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
    diagnostic.source = `HTML-Analyzer`;
    diagnostic.code = issue.type;
    (diagnostic as vscode.Diagnostic & { data: unknown }).data = {
      ruleId: issue.type,
      line: issue.line,
      analysisType: `html-quality`,
    };

    diagnostics.push(diagnostic);
  });

  return diagnostics;
};

// EXPORT TYPES ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export type { HtmlAnalysisIssue, HtmlAnalysisResult };
