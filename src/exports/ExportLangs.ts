// exports/ExportLangs.ts

// 1. Css ------------------------------------------------------------------------
export {
	CssSupport
} from "@langs/css/cssSupport";
export {
	parseSelectors
} from "@langs/css/cssParser";
export {
	cacheGet,
	cacheSet,
	cacheDelete,
	cacheClear,
	cacheSize
} from "@langs/css/cssCache";

// 2. Html -----------------------------------------------------------------------
export {
	HtmlHintCodeActionProvider
} from "@langs/html/htmlHintCodeActions";

export {
	runHtmlHint,
	getRuleId,
	getDocumentLine,
	getHeadMatch,
	makeQuickFix
} from "@langs/html/htmlHintRunner";

export type {
	HtmlHintRule,
	HtmlHintError,
	HtmlHintInstance,
	FixFactory
} from "@langs/html/htmlHintTypes";

export {
	loadHtmlHint,
	loadConfig,
	clamp,
	HEAD_TAG_REGEX
} from "@langs/html/htmlHintConfig";

// 3. Js -------------------------------------------------------------------------
export {
	JSHintCodeActionProvider,
	runJSHint
} from "@langs/js/jsHint";

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
	AnalyzeResult
} from "@langs/js/jsHintTypes";

export {
	loadJSHint,
	loadJSHintConfig,
	DEFAULT_JSHINT_CONFIG
} from "@langs/js/jsHintConfig";

export {
	analyzeSourceCode
} from "@langs/js/jsHintAnalyzer";