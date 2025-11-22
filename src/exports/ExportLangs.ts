/**
 * @file ExportLangs.ts
 * @since 2025-11-22
 */

// 1. CSS ------------------------------------------------------------------------
export {
	parseSelectors,
	cacheGet,
	cacheSet,
	cacheDelete,
	cacheClear,
	cacheSize,
	cacheStats,
} from "@langs/css/css";

export {
	CssSupport,
} from "@langs/css/css";

// 2. HTML -----------------------------------------------------------------------
export {
	runHtmlHint,
	getRuleId,
	getDocumentLine,
	getHeadMatch,
	makeQuickFix,
	loadHtmlHint,
	loadConfig,
	clamp,
	HEAD_TAG_REGEX,
} from "@langs/html/html";

export {
	HtmlHintCodeActionProvider,
} from "@langs/html/html";

export type {
	HtmlHintRule,
	HtmlHintError,
	HtmlHintInstance,
	FixFactory,
} from "@langs/html/html";

// 3. JS -------------------------------------------------------------------------
export {
	runJSHint,
	analyzeSourceCode,
	loadJSHint,
	loadJSHintConfig,
} from "@langs/js/js";

export {
	JSHintCodeActionProvider,
} from "@langs/js/js";

export type {
	JSHintError,
	JSHintResult,
	JSHintInstance,
	SourceAnalysis,
	FunctionInfo,
	VariableInfo,
	ImportInfo,
	ExportInfo,
	ComplexityIssue,
	PotentialBug,
	AnalyzeResult,
} from "@langs/js/js";
