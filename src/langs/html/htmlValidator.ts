/**
 * @file htmlValidator.ts
 * @since 2025-11-26
 * @description HTML 문서 유효성 검사 로직
 */

import { analyzeHtmlCode, generateHtmlAnalysisDiagnostics } from "@exportLangs";
import { Diagnostic, DiagnosticSeverity, Position, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { loadConfig, loadHtmlHint } from "@langs/html/htmlConfig";
import type { HtmlHintError, HtmlHintInstance } from "@langs/html/htmlType";
import { clamp } from "@langs/html/htmlUtils";

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// CONSTANTS
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const HTML_FILE_REGEX = /\.html?$/i;
const DIAGNOSTIC_SOURCE = `HTMLHint`;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// MODULE STATE
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
let htmlhintCache: HtmlHintInstance | null | undefined;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const getHtmlHint = (): HtmlHintInstance | null => {
  let result: HtmlHintInstance | null;

  htmlhintCache === undefined ? (
    (htmlhintCache = loadHtmlHint()),
    (result = htmlhintCache)
  ) : (
    result = htmlhintCache
  );

  return result;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const runHtmlHint = (doc: vscode.TextDocument): Diagnostic[] => {
  const htmlhint = getHtmlHint();

  return !htmlhint ? [] : (() => {
        try {
          const config = loadConfig(doc.uri.fsPath);
          const text = doc.getText();
          const errors: HtmlHintError[] = htmlhint.verify(text, config) || [];
          const maxLine = doc.lineCount - 1;
          const diags: Diagnostic[] = [];

          for (const err of errors) {
            const line = clamp(err.line - 1, 0, maxLine);
            const col = Math.max(err.col - 1, 0);
            const lineText = doc.lineAt(line).text;
            const len = Math.max(err.raw?.length || 1, 1);
            const endCol = Math.min(
              col + len,
              lineText.length > 0 ? lineText.length : col + len,
            );
            const range = new vscode.Range(new Position(line, col), new Position(line, endCol));
            const diagnostic = new Diagnostic(range, err.message, DiagnosticSeverity.Warning);
            diagnostic.source = DIAGNOSTIC_SOURCE;
            diagnostic.code = err.rule?.id;
            (diagnostic as any).data = {
              ruleId: err.rule?.id,
              line: err.line,
              col: err.col,
              raw: err.raw,
            };
            diags.push(diagnostic);
          }
          // Add custom analysis diagnostics
          const analysis = analyzeHtmlCode(text);
          const analysisDiagnostics = generateHtmlAnalysisDiagnostics(doc, analysis);
          diags.push(...analysisDiagnostics);

          return diags;
        }
        catch (error: any) {
          logger(`error`, `execution error: ${error?.message || error}`);
          return [];
        }
      })();
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isHtmlDocument = (doc: vscode.TextDocument): boolean => HTML_FILE_REGEX.test(doc.fileName) || doc.languageId === `html`;
