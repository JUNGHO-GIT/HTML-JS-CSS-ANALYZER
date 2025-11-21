/**
 * @file ExportLangs.ts
 * @since 2025-11-22
 */

// -------------------------------------------------------------------------------------------------
// 1. CSS ------------------------------------------------------------------------
export {
	CssSupport,
	parseSelectors,
	cacheGet,
	cacheSet,
	cacheDelete,
	cacheClear,
	cacheSize,
	cacheStats,
} from "@langs/css/css";

// 2. HTML -----------------------------------------------------------------------
export {
	HtmlHintCodeActionProvider,
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

export type {
	HtmlHintRule,
	HtmlHintError,
	HtmlHintInstance,
	FixFactory,
} from "@langs/html/html";

// 3. JS -------------------------------------------------------------------------
export {
	JSHintCodeActionProvider,
	runJSHint,
	analyzeSourceCode,
	loadJSHint,
	loadJSHintConfig,
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
