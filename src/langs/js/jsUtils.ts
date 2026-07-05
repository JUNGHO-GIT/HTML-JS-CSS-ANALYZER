/**
 * @file jsUtils.ts
 * @since 2025-11-26
 * @description JS 유틸리티 함수
 */

import { Position, vscode } from "@exportLibs";
import type { JSHintError } from "@langs/js/jsType";

// CONSTANTS ---------------------------------------------------------------------------------------
const MISSING_SEMICOLON_CODES = new Set([`W033`]);
const WORD_OR_OPERATOR_CODES = new Set([`W116`, `W117`]);
const EXPRESSION_STMT_CODES = new Set([`W030`]);
const WARNING_CODES = new Set([`W033`, `W116`, `W117`, `W098`, `W097`]);
const JS_LANGUAGES = new Set([`javascript`]);
const JS_EXTENSIONS = [`.js`, `.mjs`, `.cjs`];

// REGEX PATTERNS ----------------------------------------------------------------------------------
const WORD_OR_OPERATOR_REGEX = /^(?:\w+|==|!=)/;
const EXPRESSION_STMT_REGEX = /^[^;]+/;
const DEFAULT_TOKEN_REGEX = /^\S+/;

// UTILITY FUNCTIONS -------------------------------------------------------------------------------
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
export const calculateErrorRange = (document: vscode.TextDocument, error: JSHintError): vscode.Range => {
  const lineNumber = Math.max((error.line || 1) - 1, 0);
  const columnNumber = Math.max((error.character || 1) - 1, 0);
  const safeLineNumber = clamp(lineNumber, 0, document.lineCount - 1);
  const lineText = document.lineAt(safeLineNumber).text;

  let startColumn = columnNumber;
  let endColumn = columnNumber + 1;

  if (error.code) {
    if (MISSING_SEMICOLON_CODES.has(error.code)) {
      endColumn = lineText.trimEnd().length;
      startColumn = Math.max(endColumn - 1, 0);
    }
    else {
      let match: RegExpExecArray | null = null;
      if (WORD_OR_OPERATOR_CODES.has(error.code)) {
        match = WORD_OR_OPERATOR_REGEX.exec(lineText.slice(columnNumber));
      }
      else if (EXPRESSION_STMT_CODES.has(error.code)) {
        match = EXPRESSION_STMT_REGEX.exec(lineText.slice(columnNumber));
      }
      else {
        match = DEFAULT_TOKEN_REGEX.exec(lineText.slice(columnNumber));
      }
      if (match) {
        startColumn = columnNumber;
        endColumn = columnNumber + match[0].length;
      }
    }
  }

  startColumn = clamp(startColumn, 0, lineText.length);
  endColumn = clamp(endColumn, startColumn + 1, lineText.length);

  return new vscode.Range(new Position(safeLineNumber, startColumn), new Position(safeLineNumber, endColumn));
};

// -------------------------------------------------------------------------------------------------
// JSHint 코드 접두문자 기반 심각도 매핑: E* -> Error (E011+ 포함), 지정 W* -> Warning, 그 외 -> Information
export const calculateSeverity = (error: JSHintError): vscode.DiagnosticSeverity => {
  const code = error.code;

  if (!code) {
    return vscode.DiagnosticSeverity.Warning;
  }
  if (code.startsWith(`E`)) {
    return vscode.DiagnosticSeverity.Error;
  }
  if (WARNING_CODES.has(code)) {
    return vscode.DiagnosticSeverity.Warning;
  }
  return vscode.DiagnosticSeverity.Information;
};

// -------------------------------------------------------------------------------------------------
export const isJsLikeDocument = (doc: vscode.TextDocument): boolean => {
  const languageId = doc.languageId;
  const fileName = doc.fileName.toLowerCase();

  if (JS_LANGUAGES.has(languageId)) {
    return true;
  }
  return JS_EXTENSIONS.some((extension) => fileName.endsWith(extension));
};
