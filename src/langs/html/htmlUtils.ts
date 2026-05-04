/**
 * @file htmlUtils.ts
 * @since 2025-11-26
 * @description HTML 유틸리티 함수
 */

import { CodeAction, CodeActionKind, type Diagnostic, vscode } from "@exportLibs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const HEAD_TAG_REGEX = /<head(?:\s[^>]*)?>[\S\s]*?<\/head>/i;

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const clamp = (value: number, min: number, max: number): number => (
    value < min ? min : value > max ? max : value
  );

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const getRuleId = (diagnostic: Diagnostic): string | undefined => {
  try {
    const diagnosticData = (diagnostic as any).data;
    return diagnosticData?.ruleId ?? diagnostic.code?.toString();
  }
  catch {
    return undefined;
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const getDocumentLine = (document: vscode.TextDocument, oneBasedLineNumber: number): string => document.lineCount <= 0 ? `` : (() => {
  const zeroBasedLineIndex = clamp(oneBasedLineNumber - 1, 0, document.lineCount - 1);
  return document.lineAt(zeroBasedLineIndex).text;
})();

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const getHeadMatch = (htmlText: string): RegExpMatchArray | null => HEAD_TAG_REGEX.exec(htmlText);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const makeQuickFix = (title: string, editBuilder: (we: vscode.WorkspaceEdit) => void, diagnostic: Diagnostic): CodeAction => {
  const ca = new CodeAction(title, CodeActionKind.QuickFix);
  const we = new vscode.WorkspaceEdit();
  editBuilder(we);
  ca.edit = we;
  ca.diagnostics = [diagnostic];
  return ca;
};
