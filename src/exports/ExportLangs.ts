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
	HtmlHintCodeActionProvider,
	runHtmlHint
} from "@langs/html/htmlHint";

// 3. Js -------------------------------------------------------------------------
export {
	JSHintCodeActionProvider,
	runJSHint
} from "@langs/js/jsHint";