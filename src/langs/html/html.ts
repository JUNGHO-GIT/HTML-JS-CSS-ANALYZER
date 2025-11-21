/**
 * @file html.ts
 * @since 2025-11-22
 */

export {
	HtmlHintCodeActionProvider,
} from "./htmlCodeActions";

export {
	runHtmlHint,
	getRuleId,
	getDocumentLine,
	getHeadMatch,
	makeQuickFix,
} from "./htmlRunner";

export type {
	HtmlHintRule,
	HtmlHintError,
	HtmlHintInstance,
	FixFactory,
} from "./htmlTypes";

export {
	loadHtmlHint,
	loadConfig,
	clamp,
	HEAD_TAG_REGEX,
} from "./htmlConfig";
