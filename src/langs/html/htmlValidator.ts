/**
 * @file htmlValidator.ts
 * @since 2025-11-26
 * @description HTML 문서 유효성 검사 로직
 */

import { analyzeHtmlCode, generateHtmlAnalysisDiagnostics } from "@exportLangs";
import { Diagnostic, DiagnosticSeverity as DiagSvrt, Position, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { loadConfig, loadHtmlHint } from "@langs/html/htmlConfig";
import type { HtmlHintError as HtmlHntErr, HtmlHintInstance as HtmlHntInst } from "@langs/html/htmlType";
import { clamp, setDiagData } from "@langs/html/htmlUtils";

// CONSTANTS ---------------------------------------------------------------------------------------
const HTML_FILE_RE = /\.html?$/i;
// Quick Fix 필터(htmlCodeActions)와 반드시 동일해야 한다.
const DIAGNOSTIC_SOURCE = `HTMLHint`;

// MODULE STATE -----------------------------------------------------------------------------------
let htmlHintCache: HtmlHntInst | null | undefined;

// -------------------------------------------------------------------------------------------------
const getHtmlHint = (): HtmlHntInst | null => {
  if (htmlHintCache === undefined) {
    htmlHintCache = loadHtmlHint();
  }
  return htmlHintCache;
};

// -------------------------------------------------------------------------------------------------
export const runHtmlHint = (doc: vscode.TextDocument): Diagnostic[] => {
  const htmlhint = getHtmlHint();
  if (!htmlhint) {
    return [];
  }

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
      diagnostic.source = DIAGNOSTIC_SOURCE;
      diagnostic.code = err.rule?.id;
      setDiagData(diagnostic, {
        ruleId: err.rule?.id,
        line: err.line,
        col: err.col,
        raw: err.raw,
      });
      diags.push(diagnostic);
    }

    // 커스텀 품질 분석 진단을 추가한다.
    const analysis = analyzeHtmlCode(text);
    const anlyDiags = generateHtmlAnalysisDiagnostics(doc, analysis);
    diags.push(...anlyDiags);

    return diags;
  }
  catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger(`error`, `execution error: ${msg}`);
    return [];
  }
};

// -------------------------------------------------------------------------------------------------
export const isHtmlDocument = (doc: vscode.TextDocument): boolean => HTML_FILE_RE.test(doc.fileName) || doc.languageId === `html`;
