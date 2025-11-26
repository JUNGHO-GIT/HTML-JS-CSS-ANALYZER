/**
 * @file cssType.ts
 * @since 2025-11-26
 * @description CSS 분석 관련 타입 정의
 */

import type { vscode } from "@exportLibs";
import type { SelectorPos } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
export declare type CssSupportLike = {
	getStyles: (doc: vscode.TextDocument) => Promise<Map<string, SelectorPos[]>>;
	getLocalDoc: (doc: vscode.TextDocument) => Promise<SelectorPos[]>;
};

// -------------------------------------------------------------------------------------------------
export declare type CacheValue = {
	version: number;
	data: SelectorPos[];
	timestamp: number;
	accessCount: number;
};

// -------------------------------------------------------------------------------------------------
export declare type FetchResponse = {
	ok: boolean;
	status?: number;
	statusText?: string;
	text: () => Promise<string>;
};
