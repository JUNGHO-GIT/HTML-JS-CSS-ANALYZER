/**
 * @file htmlUtils.ts
 * @since 2025-11-26
 * @description HTML 유틸리티 함수
 */

import { CodeAction, CodeActionKind, type Diagnostic, vscode } from "@exportLibs";
import type { HtmlDiagData } from "@langs/html/htmlType";

// CONSTANTS ---------------------------------------------------------------------------------------
// 캡처그룹 3개: [1]=여는 <head> 태그, [2]=head 내부 콘텐츠, [3]=닫는 </head> 태그
export const HEAD_TAG_REGEX = /(<head(?:\s[^>]*)?>)([\S\s]*?)(<\/head>)/i;

// FUNCTIONS ---------------------------------------------------------------------------------------
export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

// -------------------------------------------------------------------------------------------------
// 진단 data 필드를 안전하게 읽는 단일 접근 지점.
export const getDiagData = (diagnostic: Diagnostic): HtmlDiagData | undefined => {
  const data = (diagnostic as Diagnostic & { data?: unknown }).data;
  if (data === null || typeof data !== `object`) {
    return undefined;
  }
  return data as HtmlDiagData;
};

// -------------------------------------------------------------------------------------------------
// 진단 data 필드를 기록하는 단일 진입 지점.
export const setDiagData = (diagnostic: Diagnostic, data: HtmlDiagData): void => {
  (diagnostic as Diagnostic & { data?: HtmlDiagData }).data = data;
};

// -------------------------------------------------------------------------------------------------
export const getRuleId = (diagnostic: Diagnostic): string | undefined => {
  const data = getDiagData(diagnostic);
  if (typeof data?.ruleId === `string`) {
    return data.ruleId;
  }
  return diagnostic.code?.toString();
};

// -------------------------------------------------------------------------------------------------
export const getDocumentLine = (document: vscode.TextDocument, oneBasedLineNumber: number): string => {
  if (document.lineCount <= 0) {
    return ``;
  }
  const zeroBasedLineIndex = clamp(oneBasedLineNumber - 1, 0, document.lineCount - 1);
  return document.lineAt(zeroBasedLineIndex).text;
};

// -------------------------------------------------------------------------------------------------
export const getHeadMatch = (htmlText: string): RegExpMatchArray | null => HEAD_TAG_REGEX.exec(htmlText);

// -------------------------------------------------------------------------------------------------
export const makeQuickFix = (title: string, editBuilder: (workspaceEdit: vscode.WorkspaceEdit) => void, diagnostic: Diagnostic): CodeAction => {
  const codeAction = new CodeAction(title, CodeActionKind.QuickFix);
  const workspaceEdit = new vscode.WorkspaceEdit();
  editBuilder(workspaceEdit);
  codeAction.edit = workspaceEdit;
  codeAction.diagnostics = [diagnostic];
  return codeAction;
};
