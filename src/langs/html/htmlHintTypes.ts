import type { vscode, Diagnostic, CodeAction } from "@exportLibs";

// HTMLHint 타입 정의 ---------------------------------------------------------------------------
export interface HtmlHintRule {
  id: string;
  description?: string;
}

export interface HtmlHintError {
  line: number;
  col: number;
  message: string;
  rule?: HtmlHintRule;
  raw?: string;
  type?: string;
}

export interface HtmlHintInstance {
  verify: (html: string, rules?: any) => HtmlHintError[];
  [key: string]: any;
}

export type FixFactory = (doc: vscode.TextDocument, diagnostic: Diagnostic) => CodeAction | null;
