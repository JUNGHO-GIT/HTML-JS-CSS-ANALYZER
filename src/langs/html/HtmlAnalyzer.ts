// langs/html/HtmlAnalyzer.ts

import { vscode } from "@exportLibs";
import { regexHeadTag } from "@exportConsts";
import type { HtmlHintErrorType } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
export const clamp = (value: number, min: number, max: number): number => { return value < min ? min : value > max ? max : value; };

// -------------------------------------------------------------------------------------------------
export const getDocumentLine = (document: vscode.TextDocument, oneBasedLineNumber: number): string => {
  const hasNoLines = document.lineCount <= 0; if (hasNoLines) { return ""; }
  const zeroBasedLineIndex = clamp(oneBasedLineNumber - 1, 0, document.lineCount - 1);
  return document.lineAt(zeroBasedLineIndex).text;
};

// -------------------------------------------------------------------------------------------------
export const getHeadMatch = (htmlText: string): RegExpMatchArray | null => { return htmlText.match(regexHeadTag); };

// -------------------------------------------------------------------------------------------------
export const getRuleId = (diagnostic: vscode.Diagnostic): string | undefined => {
  try { const diagnosticData = (diagnostic as any).data; return diagnosticData?.ruleId ?? diagnostic.code?.toString(); } catch { return undefined; }
};
