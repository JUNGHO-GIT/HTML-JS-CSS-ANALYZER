/**
 * @file ExportLangs.ts
 * @since 2025-11-22
 * @description 언어별 모듈 통합 내보내기
 */

// 1. CSS ------------------------------------------------------------------------------------------
export type {
	CssSupportLike,
	CacheValue,
	FetchResponse,
} from "@langs/css/cssType";

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
	fetchCssContent,
	readSelectorsFromFsPath,
	processCssFilesInBatches,
	ensureWorkspaceCssFiles,
	getWorkspaceCssFiles,
	clearWorkspaceCssFilesCache,
	normalizeToken,
	makeRange,
	collectKnownSelectors,
	isValidCssIdentifier,
	isRemoteUrl,
	extractCssBodies,
} from "@langs/css/cssUtils";

export {
	CssSupport,
} from "@langs/css/cssValidator";

export {
	analyzeCssCode,
	generateCssAnalysisDiagnostics,
} from "@langs/css/cssAnalyzer";

// 2. HTML ------------------------------------------------------------------------------------------
export type {
	HtmlHintRule,
	HtmlHintError,
	HtmlHintInstance,
	FixFactory,
} from "@langs/html/htmlType";

export {
	loadHtmlHint,
	loadConfig,
} from "@langs/html/htmlConfig";

export {
	clamp,
	HEAD_TAG_REGEX,
	getRuleId,
	getDocumentLine,
	getHeadMatch,
	makeQuickFix,
} from "@langs/html/htmlUtils";

export {
	runHtmlHint,
	isHtmlDocument,
} from "@langs/html/htmlValidator";

export {
	HtmlHintCodeActionProvider,
} from "@langs/html/htmlCodeActions";

export type {
	HtmlAnalysisIssue,
	HtmlAnalysisResult,
} from "@langs/html/htmlAnalyzer";

export {
	analyzeHtmlCode,
	generateHtmlAnalysisDiagnostics,
} from "@langs/html/htmlAnalyzer";

// 3. JS ------------------------------------------------------------------------------------------
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
} from "@langs/js/jsType";

export {
	loadJSHint,
	loadJSHintConfig,
} from "@langs/js/jsConfig";

export {
	clamp as jsClamp,
	calculateErrorRange,
	calculateSeverity,
	isJsLikeDocument,
} from "@langs/js/jsUtils";

export {
	runJSHint,
	getJSHint,
	generateAdditionalDiagnostics,
} from "@langs/js/jsValidator";

export {
	analyzeSourceCode,
} from "@langs/js/jsAnalyzer";

export {
	JSHintCodeActionProvider,
} from "@langs/js/jsCodeActions";
