/**
 * @file htmlValidator.ts
 * @since 2025-11-26
 * @description HTML 문서 유효성 검사 로직
 */

import { analyzeHtmlCode as anlyHtmlCd, generateHtmlAnalysisDiagnostics as gnrHtAnDi } from "@exportLangs";
import { Diagnostic, DiagnosticSeverity as DiagSvrt, Position, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { loadConfig, loadHtmlHint } from "@langs/html/htmlConfig";
import type { HtmlHintError as HtmlHntErr, HtmlHintInstance as HtmlHntInst } from "@langs/html/htmlType";
import { clamp } from "@langs/html/htmlUtils";

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// CONSTANTS
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const HTML_FL_RE = /\.html?$/i;
const DIAG_SRC = `HTMLHint`;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// MODULE STATE
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
let htmlCch: HtmlHntInst | null | undefined;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const getHtmlHint = (): HtmlHntInst | null => {
  let result: HtmlHntInst | null;

  htmlCch === undefined ? (
    (htmlCch = loadHtmlHint()),
    (result = htmlCch)
  ) : (
    result = htmlCch
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
          const errors: HtmlHntErr[] = htmlhint.verify(text, config) || [];
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
            const diagnostic = new Diagnostic(range, err.message, DiagSvrt.Warning);
            diagnostic.source = DIAG_SRC;
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
          const analysis = anlyHtmlCd(text);
          const anlyDiags = gnrHtAnDi(doc, analysis);
          diags.push(...anlyDiags);

          return diags;
        }
        catch (error: any) {
          logger(`error`, `execution error: ${error?.message || error}`);
          return [];
        }
      })();
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isHtmlDoc2 = (doc: vscode.TextDocument): boolean => HTML_FL_RE.test(doc.fileName) || doc.languageId === `html`;
