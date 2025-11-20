import { vscode, CodeAction, CodeActionKind, Diagnostic, Position } from "@exportLibs";
import { logger } from "@exportScripts";
import type { HtmlHintError, HtmlHintInstance } from "@exportLangs";
import { loadHtmlHint, loadConfig, clamp } from "@exportLangs";

// HTMLHint 인스턴스 ---------------------------------------------------------------------------
const htmlhint: HtmlHintInstance | null = loadHtmlHint();

// 유틸리티 함수 --------------------------------------------------------------------------------
export const getRuleId = (diagnostic: Diagnostic): string | undefined => {
  try {
    const diagnosticData = (diagnostic as any).data;
    return diagnosticData?.ruleId ?? diagnostic.code?.toString();
  }
  catch {
    return undefined;
  }
};

export const getDocumentLine = (document: vscode.TextDocument, oneBasedLineNumber: number): string => {
  return document.lineCount <= 0 ? "" : (() => {
    const zeroBasedLineIndex = clamp(oneBasedLineNumber - 1, 0, document.lineCount - 1);
    return document.lineAt(zeroBasedLineIndex).text;
  })();
};

export const getHeadMatch = (htmlText: string): RegExpMatchArray | null => {
  const HEAD_TAG_REGEX = /<head(\s[^>]*)?>([\s\S]*?)<\/head>/i;
  return htmlText.match(HEAD_TAG_REGEX);
};

export const makeQuickFix = (
  title: string,
  editBuilder: (we: vscode.WorkspaceEdit) => void,
  diagnostic: Diagnostic
) => {
  const ca = new CodeAction(title, CodeActionKind.QuickFix);
  const we = new vscode.WorkspaceEdit();
  editBuilder(we);
  ca.edit = we;
  ca.diagnostics = [diagnostic];
  return ca;
};

// HTMLHint 실행 -------------------------------------------------------------------------------
export const runHtmlHint = (doc: vscode.TextDocument): vscode.Diagnostic[] => {
  return !htmlhint ? [] : (() => {
    try {
      const config = loadConfig(doc.uri.fsPath);
      const text = doc.getText();
      const errors: HtmlHintError[] = htmlhint.verify(text, config) || [];
      const maxLine = doc.lineCount - 1;
      const diags: vscode.Diagnostic[] = [];

      for (const err of errors) {
        const line = clamp(err.line - 1, 0, maxLine);
        const col = Math.max(err.col - 1, 0);
        const lineText = doc.lineAt(line).text;
        const len = Math.max((err.raw?.length || 1), 1);
        const endCol = Math.min(col + len, lineText.length || col + len);
        const range = new vscode.Range(
          new vscode.Position(line, col),
          new vscode.Position(line, endCol)
        );
        const diagnostic = new vscode.Diagnostic(range, err.message, vscode.DiagnosticSeverity.Warning);
        diagnostic.source = "Html-Js-Css-Analyzer";
        diagnostic.code = err.rule?.id;
        (diagnostic as any).data = {
          ruleId: err.rule?.id,
          line: err.line,
          col: err.col,
          raw: err.raw
        };
        diags.push(diagnostic);
      }
      return diags;
    }
    catch (e: any) {
      logger(`error`, `HTMLHint`, `execution error: ${e?.message || e}`);
      return [];
    }
  })();
};
