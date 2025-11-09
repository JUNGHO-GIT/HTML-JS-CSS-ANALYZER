// exports/ExportsConsts.ts

// 0. Config ----------------------------------------------------------------------
export {
	baseValidationDelayMs,
	batchSizeCssProcess,
	extensionConfigSection,
	fallbackMetaUrl,
	maxCssContentLength,
	maxCssFileSizeBytes,
	maxRedirects,
	maxValidationDelayMs,
	maxWorkspaceStyleFiles,
	rapidChangeThreshold,
	requestTimeoutMs,
	supportedSchemes,
	defaultAnalyzableExtensions,
	excludedPathPatterns,
	regexExtensionValidation,
	regexRemoteUrl,
	regexWordRange,
	regexEscapedChar,
	supportedLanguages
} from "@consts/ConstsConfig";

// 1. Css -------------------------------------------------------------------------
export {
	maxCache,
	cacheTTL,
	defaultCssExclude,
	styleCache,
	zeroPosition,
	regexSelectorBoundary,
	regexLeadingWhitespace,
	validCssIdentifierRegex,
	backslashRegex,
	regexSelectorClassToken,
	regexSelectorIdToken
} from "@consts/ConstsCss";

// 2. Html -------------------------------------------------------------------------
export {
	voidTags,
	obsoleteTags,
	regexStyleTag,
	regexLinkStylesheet,
	regexHrefAttribute,
	regexHeadTag,
	htmlLanguages,
	regexAttrValueSingleQuotes,
	regexTagnameUppercase,
	regexAttrnameUppercase,
	regexAttrValueWhitespaceSimplify,
	regexAttrWhitespace,
	regexVoidTagOpen,
	regexVoidTagBadClose,
	regexAnyTag,
	regexHtmlClassAttr,
	regexHtmlIdAttr
} from "@consts/ConstsHtml";

// 3. Js -------------------------------------------------------------------------
export {
	jsConfig,
	regexCompletionContext,
	jsLanguages,
	templateLiteralRegex,
	classAttributeRegex,
	classListMethodRegex,
	stringLiteralRegex,
	innerHtmlRegex,
	insertAdjacentHtmlRegex,
	templateLiteralHtmlRegex,
	querySelectorRegex,
	getElementByIdRegex,
	quoteChars
} from "@consts/ConstsJs";