/**
 * @file cssAnalyzer.ts
 * @since 2025-11-26
 * @description CSS 코드 분석 및 품질 검사 (AST 기반)
 */

import { vscode } from "@exportLibs";
import * as csstree from "css-tree";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const MAX_ID_SELECTORS = 2;
const MAX_SELECTOR_DEPTH = 4;
const VENDOR_PREFIX_REGEX = /^-(?:webkit|moz|ms|o)-/;
const DEPRECATED_PROPERTIES = new Set([ `clip`, `zoom`, `behavior` ]);
const PERFORMANCE_HEAVY_ATTRIBUTES = new Set([ `class`, `id`, `style` ]);

// DUPLICATE SELECTOR TRACKING ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const selectorCache = new Map<string, number>();

const resetSelectorCache = (): void => {
  selectorCache.clear();
};

// TYPE DEFINITIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export type CssSeverity = `error` | `warning` | `info`;

export type CssIssueType = `empty-rule` | `too-many-ids` | `important-usage` | `universal-selector` | `deep-nesting` | `duplicate-selector` | `vendor-prefix` | `deprecated-property` | `syntax-error`;

export type CssAnalysisIssue = {
  type: CssIssueType | string;
  line: number;
  column?: number;
  message: string;
  severity: CssSeverity;
  suggestion?: string;
};

export type CssAnalysisResult = {
  issues: CssAnalysisIssue[];
  stats: {
    ruleCount: number;
    selectorCount: number;
    declarationCount: number;
  };
};

// HELPER FUNCTIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
const getSelectorDepth = (selector: csstree.CssNode): number => {
  let depth = 0;
  csstree.walk(selector, (node) => {
    (node.type === `Combinator` || node.type === `WhiteSpace`) && depth++;
  });
  return depth + 1;
};

const addIssue = (issues: CssAnalysisIssue[], type: CssIssueType | string, line: number, message: string, severity: CssSeverity, column?: number, suggestion?: string): void => {
  issues.push({
    type, line, column, message, severity, suggestion,
  });
};

// ANALYSIS RULES ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const analyzeRule = (node: csstree.Rule, issues: CssAnalysisIssue[]): { rules: number; selectors: number } => {
  const ruleCount = 1;
  let selectorCount = 0;

  // 1. Empty Rules
  node.block.children.isEmpty && node.loc && addIssue(issues, `empty-rule`, node.loc.start.line, `Empty CSS rule detected`, `warning`, node.loc.start.column, `Remove empty rule or add declarations`);

  // 2. Selector Analysis
  node.prelude.type === `SelectorList` &&
    node.prelude.children.forEach((selector) => {
      selectorCount += 1;
      let idCount = 0;
      const depth = getSelectorDepth(selector);

      csstree.walk(selector, (child) => {
        child.type === `IdSelector` && idCount++;
      });

      // Too many IDs
      idCount > MAX_ID_SELECTORS && node.loc && addIssue(issues, `too-many-ids`, node.loc.start.line, `High specificity: ${idCount} ID selectors in one rule`, `warning`, node.loc.start.column, `Use classes instead of IDs for styling`);

      // Deep nesting
      depth > MAX_SELECTOR_DEPTH && node.loc && addIssue(issues, `deep-nesting`, node.loc.start.line, `Selector depth (${depth}) exceeds recommended maximum (${MAX_SELECTOR_DEPTH})`, `info`, node.loc.start.column, `Simplify selector hierarchy`);
    });

  return { rules: ruleCount, selectors: selectorCount };
};

const analyzeDeclaration = (node: csstree.Declaration, issues: CssAnalysisIssue[]): number => {
  const declarationCount = 1;

  // !important usage
  node.important === true && node.loc && addIssue(issues, `important-usage`, node.loc.start.line, `Avoid using !important; it breaks cascading`, `info`, node.loc.start.column, `Use more specific selectors instead`);

  // Vendor prefixes
  VENDOR_PREFIX_REGEX.test(node.property) && node.loc && addIssue(issues, `vendor-prefix`, node.loc.start.line, `Vendor prefix '${node.property}' detected`, `info`, node.loc.start.column, `Consider using autoprefixer`);

  // Deprecated properties
  DEPRECATED_PROPERTIES.has(node.property) && node.loc && addIssue(issues, `deprecated-property`, node.loc.start.line, `Property '${node.property}' is deprecated`, `warning`, node.loc.start.column, `Use modern CSS alternatives`);

  return declarationCount;
};

const analyzeTypeSelector = (node: csstree.TypeSelector, issues: CssAnalysisIssue[]): void => {
  // Universal Selector (*)
  node.name === `*` && node.loc && addIssue(issues, `universal-selector`, node.loc.start.line, `Universal selector (*) can impact performance`, `info`, node.loc.start.column, `Use specific element or class selectors`);
};

const analyzeAttributeSelector = (node: csstree.AttributeSelector, issues: CssAnalysisIssue[]): void => {
  // Performance-heavy attribute selectors like [class], [id], [style]
  const attrName = node.name.name;
  if (typeof attrName !== `string` || attrName.length === 0 || !node.loc) {
    return;
  }
  const isHeavyAttr = PERFORMANCE_HEAVY_ATTRIBUTES.has(attrName);
  // node.matcher is null when selector has no value (e.g., [class] vs [class="foo"])
  isHeavyAttr && node.matcher === null && addIssue(issues, `universal-selector`, node.loc.start.line, `Attribute selector [${attrName}] without value can impact performance`, `info`, node.loc.start.column, `Use specific class or ID selectors`);
};

// MAIN ANALYSIS FUNCTION ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export const analyzeCssCode = (sourceCode: string): CssAnalysisResult => {
  const issues: CssAnalysisIssue[] = [];
  let ruleCount = 0;
  let selectorCount = 0;
  let declarationCount = 0;

  resetSelectorCache();

  try {
    const ast = csstree.parse(sourceCode, {
      positions: true,
      parseAtrulePrelude: false,
      parseRulePrelude: true,
      parseValue: true,
    });

    // 미디어쿼리 컨텍스트 추적을 위한 스택
    const mediaStack: string[] = [];

    csstree.walk(ast, {
      enter: (node: csstree.CssNode) => {
        // @media, @supports 등 at-rule 진입 시 컨텍스트 푸시
        node.type === `Atrule` && node.name && mediaStack.push(`@${node.name}${node.prelude ? csstree.generate(node.prelude) : ``}`);

        if (node.type === `Rule`) {
          const result = analyzeRule(node, issues);
          ruleCount += result.rules;
          selectorCount += result.selectors;

          // Duplicate selector check (미디어쿼리 컨텍스트 포함)
          if (node.prelude.type === `SelectorList`) {
            const selectorText = csstree.generate(node.prelude);
            // 미디어쿼리 컨텍스트를 포함한 고유 키 생성
            const contextKey = mediaStack.length > 0 ? `${mediaStack.join(`|`)}::${selectorText}` : selectorText;
            const existingLine = selectorCache.get(contextKey);
            existingLine !== undefined && node.loc ? addIssue(issues, `duplicate-selector`, node.loc.start.line, `Duplicate selector (first defined at line ${existingLine})`, `warning`, node.loc.start.column, `Merge rules or use more specific selectors`) : node.loc && selectorCache.set(contextKey, node.loc.start.line);
          }
        }
        node.type === `Declaration` && (declarationCount += analyzeDeclaration(node, issues));
        node.type === `TypeSelector` && analyzeTypeSelector(node, issues);
        node.type === `AttributeSelector` && analyzeAttributeSelector(node, issues);
      },
      leave: (node: csstree.CssNode) => {
        // at-rule 이탈 시 컨텍스트 팝
        node.type === `Atrule` && node.name && mediaStack.pop();
      },
    });
  }
  catch (error) {
    error instanceof Error && addIssue(issues, `syntax-error`, 1, `CSS syntax error: ${error.message}`, `error`);
  }

  return { issues, stats: { ruleCount, selectorCount, declarationCount } };
};

// DIAGNOSTIC GENERATION ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const severityMap: Record<CssSeverity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

export const generateCssAnalysisDiagnostics = (document: vscode.TextDocument, analysis: CssAnalysisResult): vscode.Diagnostic[] => analysis.issues.map((issue) => {
  const line = Math.max(issue.line - 1, 0);
  const safeLineIndex = Math.min(line, document.lineCount - 1);
  const lineText = document.lineAt(safeLineIndex).text;

  const startCol = issue.column !== undefined ? Math.max(issue.column - 1, 0) : 0;
  const endCol = lineText.length;

  const range = new vscode.Range(new vscode.Position(safeLineIndex, startCol), new vscode.Position(safeLineIndex, endCol));

  const message = issue.suggestion !== undefined ? `${issue.message}. ${issue.suggestion}` : issue.message;
  const diagnostic = new vscode.Diagnostic(range, message, severityMap[issue.severity]);

  diagnostic.source = `CSS-Analyzer`;
  diagnostic.code = issue.type;
  (diagnostic as vscode.Diagnostic & { data: unknown }).data = {
    ruleId: issue.type,
    line: issue.line,
    column: issue.column,
    analysisType: `css-quality`,
    suggestion: issue.suggestion,
  };

  return diagnostic;
});

// UTILITY EXPORTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const getAnalysisStats = (result: CssAnalysisResult): string => {
  const { stats } = result;
  return `Rules: ${stats.ruleCount}, Selectors: ${stats.selectorCount}, Declarations: ${stats.declarationCount}, Issues: ${result.issues.length}`;
};
