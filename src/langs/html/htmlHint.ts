// src/langs/html/htmlHint.ts

export {
	HtmlHintCodeActionProvider
} from "./htmlHintCodeActions";

export {
	runHtmlHint,
	getRuleId,
	getDocumentLine,
	getHeadMatch,
	makeQuickFix
} from "./htmlHintRunner";

export type {
	HtmlHintRule,
	HtmlHintError,
	HtmlHintInstance,
	FixFactory
} from "./htmlHintTypes";

export {
	loadHtmlHint,
	loadConfig,
	clamp,
	HEAD_TAG_REGEX
} from "./htmlHintConfig";
