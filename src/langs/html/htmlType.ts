/**
 * @file htmlType.ts
 * @since 2025-11-22
 * @description HTML 분석 관련 타입 정의
 */

import type { CodeAction, Diagnostic, vscode } from "@exportLibs";

// TYPE DEFINITIONS --------------------------------------------------------------------------------
export declare type HtmlHintRule = {
  id: string;
  description?: string;
};

// -------------------------------------------------------------------------------------------------
export declare type HtmlHintError = {
  line: number;
  col: number;
  message: string;
  rule?: HtmlHintRule;
  raw?: string;
  type?: string;
};

// -------------------------------------------------------------------------------------------------
export declare type HtmlHintInstance = {
  verify: (html: string, rules?: Record<string, unknown>) => HtmlHintError[];
  [key: string]: unknown;
};

// -------------------------------------------------------------------------------------------------
export declare type FixFactory = (doc: vscode.TextDocument, diagnostic: Diagnostic) => CodeAction | null;

// -------------------------------------------------------------------------------------------------
// 진단(diagnostic)에 부착되는 data 필드의 공용 타입. broad `as any` 접근을 대체한다.
export declare type HtmlDiagData = {
  ruleId?: string;
  line?: number;
  col?: number;
  raw?: string;
  analysisType?: string;
};
