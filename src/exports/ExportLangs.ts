/**
 * @file ExportLangs.ts
 * @since 2025-11-22
 * @description 언어별 모듈 통합 내보내기
 */

// 1. CSS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
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

export { prsSels as parseSelectors } from "@langs/css/cssParser";

export {
	ftchCssCont as fetchCssContent,
	rdSeFrFsPt as readSelectorsFromFsPath,
	proCsFlInBt as processCssFilesInBatches,
	ensrWsCssFls as ensureWorkspaceCssFiles,
	gtWsCssFls as getWorkspaceCssFiles,
	clrWsCsFlCc as clearWorkspaceCssFilesCache,
	nrmlTok as normalizeToken,
	makeRange,
	cllcKnwnSels as collectKnownSelectors,
	isVldCssId as isValidCssIdentifier,
	isRemoteUrl,
	extrCssBds as extractCssBodies,
} from "@langs/css/cssUtils";

export { CssSupport } from "@langs/css/cssValidator";

export {
	anlyCssCd as analyzeCssCode,
	gnrCsAnDi as generateCssAnalysisDiagnostics,
} from "@langs/css/cssAnalyzer";

// 2. HTML ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
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
	HD_TG_RE as HEAD_TAG_REGEX,
	getRuleId,
	gtDocLn as getDocumentLine,
	getHeadMatch,
	makeQuickFix,
} from "@langs/html/htmlUtils";

export {
	runHtmlHint,
	isHtmlDoc2 as isHtmlDocument,
} from "@langs/html/htmlValidator";

export { HtmlHintCodeActionProvider } from "@langs/html/htmlCodeActions";

export type {
	HtmlAnalysisIssue,
	HtmlAnalysisResult,
} from "@langs/html/htmlAnalyzer";

export {
	anlyHtmlCd as analyzeHtmlCode,
	gnrHtAnDi as generateHtmlAnalysisDiagnostics,
} from "@langs/html/htmlAnalyzer";

// 3. JS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
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
	ldJsHntCfg as loadJSHintConfig,
} from "@langs/js/jsConfig";

export {
	clamp as jsClamp,
	clclErrRng as calculateErrorRange,
	clclSvrt as calculateSeverity,
	isJsLkDoc as isJsLikeDocument,
} from "@langs/js/jsUtils";

export {
	runJSHint,
	getJSHint,
	gnrtAddDiags as generateAdditionalDiagnostics,
} from "@langs/js/jsValidator";

export { anlySrcCd as analyzeSourceCode } from "@langs/js/jsAnalyzer";

export { JSHintCodeActionProvider } from "@langs/js/jsCodeActions";
