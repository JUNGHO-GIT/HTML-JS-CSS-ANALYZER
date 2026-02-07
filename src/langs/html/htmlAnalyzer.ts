/**
 * @file htmlAnalyzer.ts
 * @since 2025-11-26
 * @description HTML 코드 분석 및 품질 검사
 */

import { vscode } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const MAX_NESTING_LEVEL = 10;
const MAX_LINE_LENGTH = 200;
const MAX_ATTRIBUTES_PER_TAG = 15;

// REGEX PATTERNS (non-global for .test(), global for .exec() loops)
const HTML_TAG_REGEX = /<([A-Za-z][\dA-Za-z-]*)\s*([^>]*)>/g;
const INLINE_STYLE_REGEX = /\bstyle\s*=\s*["'][^"']*["']/gi;
const INLINE_EVENT_REGEX = /\bon[a-z]+\s*=\s*["'][^"']*["']/gi;
const DEPRECATED_TAGS_REGEX = /<(center|font|marquee|blink|strike|big|tt|frameset|frame|noframes)\b/gi;
const DUPLICATE_ID_REGEX = /\bid\s*=\s*["']([^"']+)["']/gi;
const ATTRIBUTE_REGEX = /([A-Za-z][\w-]*)\s*(?:=\s*["'][^"']*["'])?/g;

// Non-global versions for .test() (avoids lastIndex issues)
const IMG_WITHOUT_ALT_TEST = /<img\b(?![^/>]*\balt\s*=)[^>]*>/i;
const A_WITHOUT_HREF_TEST = /<a\b(?![^>]*\bhref\s*=)[^>]*>/i;
const BUTTON_WITHOUT_TYPE_TEST = /<button\b(?![^>]*\btype\s*=)[^>]*>/i;
const TARGET_BLANK_TEST = /target\s*=\s*["']_blank["'](?![^>]*\brel\s*=\s*["'](?:[^"']*\s)?noopener(?:[^"']*)?["'])/i;

// Script/Style content removal
const SCRIPT_STYLE_CONTENT_REGEX = /<(script|style)[^>]*>[\S\s]*?<\/\1>/gi;

// -------------------------------------------------------------------------------------------------
// TYPE DEFINITIONS
// -------------------------------------------------------------------------------------------------
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

// -------------------------------------------------------------------------------------------------
// ANALYSIS FUNCTIONS
// -------------------------------------------------------------------------------------------------
const analyzeNesting = (sourceCode: string, issues: HtmlAnalysisIssue[]): number => {
  // Remove script and style content to avoid false positives
  const cleanedSource = sourceCode.replaceAll(SCRIPT_STYLE_CONTENT_REGEX, (match, tag) => `<${tag}></${tag}>`);
  const lines = cleanedSource.split(`\n`);
  let currentNesting = 0;
  let maxNesting = 0;
  const selfClosingTags = new Set([
    `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`,
  ]);

  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;

    const openTags = line.match(/<[A-Za-z][\dA-Za-z-]*[^/>]*>/g) ?? [];
    const closeTags = line.match(/<\/[A-Za-z][\dA-Za-z-]*>/g) ?? [];

    for (const tag of openTags) {
      const tagName = tag.match(/<([A-Za-z][\dA-Za-z-]*)/)?.[1]?.toLowerCase();
      typeof tagName === `string` && tagName.length > 0 && !selfClosingTags.has(tagName) && !tag.endsWith(`/>`) && currentNesting++;
    }

    currentNesting > maxNesting && (maxNesting = currentNesting);

    currentNesting > MAX_NESTING_LEVEL &&
      issues.push({
        type: `deep-nesting`,
        line: lineNum,
        message: `Excessive HTML nesting (${currentNesting} levels): consider refactoring`,
        severity: `warning`,
      });

    closeTags.forEach(() => {
      currentNesting > 0 && currentNesting--;
    });
  }

  return maxNesting;
};

// -------------------------------------------------------------------------------------------------
const analyzeInlineStyles = (lines: string[], issues: HtmlAnalysisIssue[]): number => {
  let inlineStyleCount = 0;

  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;
    const matches = line.match(INLINE_STYLE_REGEX);

    matches?.forEach(() => {
      inlineStyleCount++;
      issues.push({
        type: `inline-style`,
        line: lineNum,
        message: `Inline style detected: consider using external CSS`,
        severity: `info`,
      });
    });
  }

  return inlineStyleCount;
};

// -------------------------------------------------------------------------------------------------
const analyzeInlineEvents = (lines: string[], issues: HtmlAnalysisIssue[]): number => {
  let inlineEventCount = 0;

  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;
    const matches = line.match(INLINE_EVENT_REGEX);

    matches?.forEach(() => {
      inlineEventCount++;
      issues.push({
        type: `inline-event`,
        line: lineNum,
        message: `Inline event handler detected: consider using addEventListener`,
        severity: `info`,
      });
    });
  }

  return inlineEventCount;
};

// -------------------------------------------------------------------------------------------------
const analyzeDeprecatedTags = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;
    let match: RegExpExecArray | null;

    DEPRECATED_TAGS_REGEX.lastIndex = 0;
    while ((match = DEPRECATED_TAGS_REGEX.exec(line))) {
      issues.push({
        type: `deprecated-tag`,
        line: lineNum,
        message: `Deprecated tag <${match[1]}>: use modern alternatives`,
        severity: `warning`,
      });
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeDuplicateIds = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  const idMap = new Map<string, number[]>();

  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;
    let match: RegExpExecArray | null;

    DUPLICATE_ID_REGEX.lastIndex = 0;
    while ((match = DUPLICATE_ID_REGEX.exec(line))) {
      const id = match[1];
      const existing = idMap.get(id) ?? [];
      existing.push(lineNum);
      idMap.set(id, existing);
    }
  }

  idMap.forEach((lineNumbers, id) => {
    lineNumbers.length > 1 &&
      issues.push({
        type: `duplicate-id`,
        line: lineNumbers[0],
        message: `Duplicate ID '${id}' found on lines: ${lineNumbers.join(`, `)}`,
        severity: `error`,
      });
  });
};

// -------------------------------------------------------------------------------------------------
const analyzeLineLength = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;

    line.length > MAX_LINE_LENGTH &&
      issues.push({
        type: `long-line`,
        line: lineNum,
        message: `Long line (${line.length} chars): consider breaking for readability`,
        severity: `info`,
      });
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeAttributeCount = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;
    let tagMatch: RegExpExecArray | null;

    HTML_TAG_REGEX.lastIndex = 0;
    while ((tagMatch = HTML_TAG_REGEX.exec(line))) {
      const attributes = tagMatch[2];
      const attrCount = (attributes.match(ATTRIBUTE_REGEX) ?? []).length;

      attrCount > MAX_ATTRIBUTES_PER_TAG &&
        issues.push({
          type: `too-many-attributes`,
          line: lineNum,
          message: `Tag has ${attrCount} attributes: consider using data attributes or simplifying`,
          severity: `warning`,
        });
    }
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeDocumentStructure = (sourceCode: string): Pick<HtmlAnalysisResult, `hasDoctype` | `hasHtmlLang` | `hasMetaCharset` | `hasMetaViewport`> => {
  const hasDoctype = /<!doctype\s+html>/i.test(sourceCode);
  const hasHtmlLang = /<html[^>]*\slang\s*=/i.test(sourceCode);
  const hasMetaCharset = /<meta[^/>]*charset\s*=/i.test(sourceCode);
  const hasMetaViewport = /<meta[^/>]*name\s*=\s*["']viewport["']/i.test(sourceCode);

  return { hasDoctype, hasHtmlLang, hasMetaCharset, hasMetaViewport };
};

// -------------------------------------------------------------------------------------------------
const countTags = (sourceCode: string): number => {
  const matches = sourceCode.match(/<[A-Za-z][\dA-Za-z-]*[^>]*>/g);
  return matches ? matches.length : 0;
};

// -------------------------------------------------------------------------------------------------
const analyzeAccessibility = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;

    // Image without alt (using non-global regex)
    IMG_WITHOUT_ALT_TEST.test(line) &&
      issues.push({
        type: `a11y-img-alt`,
        line: lineNum,
        message: `Image tag missing 'alt' attribute (accessibility)`,
        severity: `warning`,
      });

    // Anchor without href (using non-global regex)
    A_WITHOUT_HREF_TEST.test(line) &&
      issues.push({
        type: `a11y-anchor-href`,
        line: lineNum,
        message: `Anchor tag missing 'href' attribute (accessibility)`,
        severity: `warning`,
      });

    // Button without type (using non-global regex)
    BUTTON_WITHOUT_TYPE_TEST.test(line) &&
      issues.push({
        type: `best-practice-button-type`,
        line: lineNum,
        message: `Button tag missing 'type' attribute (default is 'submit')`,
        severity: `info`,
      });
  }
};

// -------------------------------------------------------------------------------------------------
const analyzeSecurity = (lines: string[], issues: HtmlAnalysisIssue[]): void => {
  for (const [ i, line ] of lines.entries()) {
    const lineNum = i + 1;

    // target="_blank" security risk (using non-global regex)
    TARGET_BLANK_TEST.test(line) &&
      issues.push({
        type: `security-target-blank`,
        line: lineNum,
        message: `Using target="_blank" without rel="noopener noreferrer" is a security risk`,
        severity: `warning`,
      });
  }
};

// -------------------------------------------------------------------------------------------------
// MAIN ANALYSIS FUNCTION
// -------------------------------------------------------------------------------------------------
export const analyzeHtmlCode = (sourceCode: string): HtmlAnalysisResult => {
  const issues: HtmlAnalysisIssue[] = [];
  const lines = sourceCode.split(`\n`);

  const maxNestingLevel = analyzeNesting(sourceCode, issues);
  const inlineStyleCount = analyzeInlineStyles(lines, issues);
  const inlineEventCount = analyzeInlineEvents(lines, issues);
  analyzeDeprecatedTags(lines, issues);
  analyzeDuplicateIds(lines, issues);
  analyzeLineLength(lines, issues);
  analyzeAttributeCount(lines, issues);
  analyzeAccessibility(lines, issues);
  analyzeSecurity(lines, issues);

  const structure = analyzeDocumentStructure(sourceCode);
  const tagCount = countTags(sourceCode);

  return {
    issues,
    tagCount,
    maxNestingLevel,
    inlineStyleCount,
    inlineEventCount,
    ...structure,
  };
};

// -------------------------------------------------------------------------------------------------
// DIAGNOSTIC GENERATION
// -------------------------------------------------------------------------------------------------
export const generateHtmlAnalysisDiagnostics = (document: vscode.TextDocument, analysis: HtmlAnalysisResult): vscode.Diagnostic[] => {
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

// -------------------------------------------------------------------------------------------------
// EXPORT TYPES
// -------------------------------------------------------------------------------------------------
export type { HtmlAnalysisIssue, HtmlAnalysisResult };
