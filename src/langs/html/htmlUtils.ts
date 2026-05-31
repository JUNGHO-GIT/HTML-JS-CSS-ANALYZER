/**
 * @file htmlUtils.ts
 * @since 2025-11-26
 * @description HTML 유틸리티 함수
 */

import { CodeAction, CodeActionKind as CdActnKnd, type Diagnostic, vscode } from "@exportLibs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const HD_TG_RE = /<head(?:\s[^>]*)?>[\S\s]*?<\/head>/i;

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const clamp = (value: number, min: number, max: number): number => (
    value < min ? min : value > max ? max : value
  );

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const getRuleId = (diagnostic: Diagnostic): string | undefined => {
  try {
    const diagDt = (diagnostic as any).data;
    return diagDt?.ruleId ?? diagnostic.code?.toString();
  }
  catch {
    return undefined;
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const gtDocLn = (document: vscode.TextDocument, onBsdLnNmbr: number): string => document.lineCount <= 0 ? `` : (() => {
  const zrBsdLnIdx = clamp(onBsdLnNmbr - 1, 0, document.lineCount - 1);
  return document.lineAt(zrBsdLnIdx).text;
})();

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const getHeadMatch = (htmlText: string): RegExpMatchArray | null => HD_TG_RE.exec(htmlText);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const makeQuickFix = (title: string, editBuilder: (we: vscode.WorkspaceEdit) => void, diagnostic: Diagnostic): CodeAction => {
  const ca = new CodeAction(title, CdActnKnd.QuickFix);
  const we = new vscode.WorkspaceEdit();
  editBuilder(we);
  ca.edit = we;
  ca.diagnostics = [diagnostic];
  return ca;
};
