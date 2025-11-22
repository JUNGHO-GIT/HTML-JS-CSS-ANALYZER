/**
 * @file ExportLangs.ts
 * @since 2025-11-22
 */

// 1. CSS ------------------------------------------------------------------------
export {
	cacheGet,
	cacheSet,
	cacheDelete,
	cacheClear,
	cacheSize,
	cacheStats,
} from "@langs/css/cssCache";

export {
	parseSelectors,
} from "@langs/css/cssParser";

export {
	CssSupport,
} from "@langs/css/cssSupport";

// 2. HTML -----------------------------------------------------------------------
export {
	loadHtmlHint,
	loadConfig,
	clamp,
	HEAD_TAG_REGEX,
} from "@langs/html/htmlConfig";

export {
	runHtmlHint,
	getRuleId,
	getDocumentLine,
	getHeadMatch,
	makeQuickFix,
} from "@langs/html/htmlRunner";

export {
	HtmlHintCodeActionProvider,
} from "@langs/html/htmlCodeActions";

export type {
	HtmlHintRule,
	HtmlHintError,
	HtmlHintInstance,
	FixFactory,
} from "@langs/html/htmlTypes";

// 3. JS -------------------------------------------------------------------------
export {
	loadJSHint,
	loadJSHintConfig,
} from "@langs/js/jsConfig";

export {
	runJSHint,
} from "@langs/js/jsRunner";

export {
	analyzeSourceCode,
} from "@langs/js/jsAnalyzer";

export {
	JSHintCodeActionProvider,
} from "@langs/js/jsCodeActions";

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
} from "@langs/js/jsTypes";