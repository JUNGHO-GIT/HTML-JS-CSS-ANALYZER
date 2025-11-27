/**
 * @file exportLangs.ts
 * @description Mock for language exports
 */

import { SelectorType } from "../../src/assets/types/common";

// CSS exports
export { SelectorType } from "../../src/assets/types/common";

export type CssSupportLike = {
	getStyles: (doc: unknown) => Promise<Map<string, unknown[]>>;
	getLocalDoc: (doc: unknown) => Promise<unknown[]>;
};

export type CacheValue = {
	version: number;
	data: unknown[];
	timestamp: number;
	accessCount: number;
};

export type FetchResponse = {
	ok: boolean;
	status: number;
	statusText?: string;
	text: () => Promise<string>;
};

// Re-export from actual implementations
export { parseSelectors } from "../../src/langs/css/cssParser";
export { cacheGet, cacheSet, cacheDelete, cacheClear, cacheSize, cacheStats } from "../../src/langs/css/cssCache";
export { analyzeCssCode, generateCssAnalysisDiagnostics, type CssAnalysisIssue, type CssAnalysisResult } from "../../src/langs/css/cssAnalyzer";
export { analyzeHtmlCode, generateHtmlAnalysisDiagnostics, type HtmlAnalysisIssue, type HtmlAnalysisResult } from "../../src/langs/html/htmlAnalyzer";

// JS types and exports
export type JSHintError = {
	line: number;
	character: number;
	reason: string;
	evidence?: string;
	code?: string;
};

export type JSHintResult = {
	errors: JSHintError[];
};

export type JSHintInstance = {
	JSHINT: (source: string, options?: Record<string, unknown>) => boolean;
	data?: () => JSHintResult;
};

export type SourceAnalysis = {
	isModule: boolean;
	hasStrictMode: boolean;
	functions: FunctionInfo[];
	variables: VariableInfo[];
	imports: ImportInfo[];
	exports: ExportInfo[];
	complexityIssues: ComplexityIssue[];
	potentialBugs: PotentialBug[];
};

export type FunctionInfo = {
	name: string;
	line: number;
	parameters: number;
};

export type VariableInfo = {
	name: string;
	type: `let` | `const` | `var`;
	line: number;
};

export type ImportInfo = {
	module: string;
	line: number;
};

export type ExportInfo = {
	declaration: string;
	line: number;
};

export type ComplexityIssue = {
	type: string;
	line: number;
	message: string;
};

export type PotentialBug = {
	type: string;
	line: number;
	message: string;
};

export type AnalyzeResult = {
	processedCode: string;
	analysis: SourceAnalysis;
};

export { analyzeSourceCode } from "../../src/langs/js/jsAnalyzer";

// HTML types
export type HtmlHintRule = {
	id: string;
	description: string;
};

export type HtmlHintError = {
	line: number;
	col: number;
	message: string;
	raw?: string;
	rule?: HtmlHintRule;
};

export type HtmlHintInstance = {
	verify: (text: string, config?: Record<string, unknown>) => HtmlHintError[];
};

export type FixFactory = () => void;

// HTML mock functions
export const loadHtmlHint = (): HtmlHintInstance | null => null;
export const loadConfig = (): Record<string, unknown> => ({});
export const clamp = (val: number, min: number, max: number): number => Math.min(Math.max(val, min), max);
export const HEAD_TAG_REGEX = /<head[^>]*>/i;
export const getRuleId = (): string => ``;
export const getDocumentLine = (): string => ``;
export const getHeadMatch = (): RegExpExecArray | null => null;
export const makeQuickFix = (): void => {};
export const runHtmlHint = (): unknown[] => [];
export const isHtmlDocument = (): boolean => false;
export class HtmlHintCodeActionProvider {}

// CSS mock classes and functions
export const fetchCssContent = async (): Promise<string> => ``;
export const readSelectorsFromFsPath = async (): Promise<unknown[]> => [];
export const processCssFilesInBatches = async (): Promise<void> => {};
export const ensureWorkspaceCssFiles = async (): Promise<string[]> => [];
export const getWorkspaceCssFiles = (): string[] | null => null;
export const clearWorkspaceCssFilesCache = (): void => {};
export const normalizeToken = (token: string): string => token;
export const makeRange = (): unknown => ({});
export const collectKnownSelectors = (): { knownClasses: Set<string>; knownIds: Set<string> } => ({
	knownClasses: new Set(),
	knownIds: new Set(),
});
export const isValidCssIdentifier = (value: string): boolean => /^[_a-zA-Z][-_a-zA-Z0-9]*$/.test(value);
export const isRemoteUrl = (url: string): boolean => /^https?:\/\//i.test(url);
export const extractCssBodies = (): string => ``;
export const extractHtmlFromInnerHtml = (): unknown[] => [];

export class CssSupport {}

// JS mock functions
export const loadJSHint = (): JSHintInstance | null => null;
export const loadJSHintConfig = (): Record<string, unknown> => ({});
export const jsClamp = clamp;
export const calculateErrorRange = (): unknown => ({});
export const calculateSeverity = (): number => 1;
export const isJsLikeDocument = (): boolean => false;
export const runJSHint = (): unknown[] => [];
export const getJSHint = (): JSHintInstance | null => null;
export const generateAdditionalDiagnostics = (): unknown[] => [];
export class JSHintCodeActionProvider {}
