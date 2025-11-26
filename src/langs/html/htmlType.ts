/**
 * @file htmlType.ts
 * @since 2025-11-22
 * @description HTML 분석 관련 타입 정의
 */

import type { vscode, Diagnostic, CodeAction } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
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
export declare type FixFactory = (
	doc: vscode.TextDocument,
	diagnostic: Diagnostic
) => CodeAction | null;
