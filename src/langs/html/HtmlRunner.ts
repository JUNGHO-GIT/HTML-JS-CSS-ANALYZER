// langs/html/HtmlRunner.ts

import { vscode } from "@exportLibs";
import type { HtmlHintErrorType } from "@exportTypes";
import { htmlhint } from "./HtmlLoader";
import { loadHtmlHintConfig } from "./HtmlConfig";
import { logger } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
export const runHtmlHint = (doc: vscode.TextDocument): vscode.Diagnostic[] => {
  if (!htmlhint) { return []; }
  try {
    const engine = htmlhint; const config = loadHtmlHintConfig(doc.uri.fsPath); const text = doc.getText();
    const errors: HtmlHintErrorType[] = engine.verify(text, config) || []; const diags: vscode.Diagnostic[] = [];
    for (const err of errors) {
      const line = Math.max(err.line - 1, 0); const col = Math.max(err.col - 1, 0);
      const start = new vscode.Position(line, col); const len = Math.max((err.raw?.length || 1), 1);
      const lineText = doc.lineAt(Math.min(line, doc.lineCount - 1)).text; const endCol = Math.min(col + len, lineText.length > 0 ? lineText.length : col + len);
      const end = new vscode.Position(line, endCol); const range = new vscode.Range(start, end);
      const message = `${err.message}`; const d = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Warning);
      d.source = "Html-Css-Js-Analyzer"; d.code = err.rule?.id; (d as any).data = { ruleId: err.rule?.id, line: err.line, col: err.col, raw: err.raw }; diags.push(d);
    }
    return diags;
  }
  catch (e: any) { logger(`error`, `HtmlHint`, `execution error: ${e?.message || e}`); return []; }
};
