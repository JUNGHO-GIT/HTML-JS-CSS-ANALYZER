/**
 * @file jsUtils.ts
 * @since 2025-11-26
 * @description JS 유틸리티 함수
 */

import { Position, vscode } from "@exportLibs";
import type { JSHintError } from "@langs/js/jsType";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const ERR_W033_CDS = new Set([`W033`]);
const EWWC = new Set([`W116`, `W117`]);
const ERR_W030_CDS = new Set([`W030`]);
const ERROR_CODES = new Set([`E001`, `E002`, `E003`, `E004`, `E005`, `E006`, `E007`, `E008`, `E009`, `E010`]);
const WRNN_CDS = new Set([`W033`, `W116`, `W117`, `W098`, `W097`]);
const JS_LANGUAGES = new Set([`javascript`]);
const JS_EXTS = [`.js`, `.mjs`, `.cjs`];

// REGEX PATTERNS
const W116_W117_RE = /^(?:\w+|==|!=)/;
const W030_REGEX = /^[^;]+/;
const DEF_TOK_RE = /^\S+/;

// UTILITY FUNCTIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clamp = (value: number, min: number, max: number): number => (
  value < min ? min : value > max ? max : value
);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clclErrRng = (document: vscode.TextDocument, error: JSHintError): vscode.Range => {
  const lineNumber = Math.max((error.line || 1) - 1, 0);
  const columnNumber = Math.max((error.character || 1) - 1, 0);
  const sfLnNmbr = clamp(lineNumber, 0, document.lineCount - 1);
  const lineText = document.lineAt(sfLnNmbr).text;

  let startColumn = columnNumber;
  let endColumn = columnNumber + 1;

  if (error.code) {
    let match: RegExpExecArray | null = null;
    if (ERR_W033_CDS.has(error.code)) {
      endColumn = lineText.trimEnd().length;
      startColumn = Math.max(endColumn - 1, 0);
    }
    else if (EWWC.has(error.code)) {
      match = W116_W117_RE.exec(lineText.slice(columnNumber));
    }
    else if (ERR_W030_CDS.has(error.code)) {
      match = W030_REGEX.exec(lineText.slice(columnNumber));
    }
    else {
      match = DEF_TOK_RE.exec(lineText.slice(columnNumber));
    }
    if (match) {
      startColumn = columnNumber;
      endColumn = columnNumber + match[0].length;
    }
  }

  startColumn = clamp(startColumn, 0, lineText.length);
  endColumn = clamp(endColumn, startColumn + 1, lineText.length);

  return new vscode.Range(new Position(sfLnNmbr, startColumn), new Position(sfLnNmbr, endColumn));
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clclSvrt = (error: JSHintError): vscode.DiagnosticSeverity => {
  if (!error.code) {
    return vscode.DiagnosticSeverity.Warning;
  }
  if (error.code.startsWith(`E`) && ERROR_CODES.has(error.code)) {
    return vscode.DiagnosticSeverity.Error;
  }
  if (WRNN_CDS.has(error.code)) {
    return vscode.DiagnosticSeverity.Warning;
  }
  return vscode.DiagnosticSeverity.Information;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isJsLkDoc = (doc: vscode.TextDocument): boolean => {
  const id = doc.languageId;
  const f = doc.fileName.toLowerCase();
  return JS_LANGUAGES.has(id) || JS_EXTS.some((ext) => f.endsWith(ext));
};
