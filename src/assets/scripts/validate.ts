/**
 * @file validate.ts
 * @since 2025-11-22
 * @description 문서 유효성 검사 오케스트레이터 (CSS, HTML, JS 통합)
 */

import { vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { runHtmlHint, runJSHint } from "@exportLangs";
import { isAnalyzable } from "@exportScripts";
import { isHtmlHintEnabled, isCssHintEnabled, isJsHintEnabled } from "@exportConsts";
import type { CssSupportLike } from "@langs/css/cssType";
import {
	collectKnownSelectors,
	scanDocumentUsages,
	scanLocalUnused,
	scanEmbeddedUnused,
} from "@langs/css/cssUtils";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const HTML_FILE_REGEX = /\.html?$/i;
const CSS_LANGUAGES = [ `css`, `scss`, `less`, `sass` ];
const CSS_EXTENSIONS = [ `.css`, `.scss`, `.less`, `.sass` ];
const JS_LANGUAGES = [ `javascript`, `typescript`, `javascriptreact`, `typescriptreact` ];
const JS_EXTENSIONS = [ `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` ];

// -------------------------------------------------------------------------------------------------
// DOCUMENT TYPE CHECKERS
// -------------------------------------------------------------------------------------------------
const isHtmlDoc = (doc: vscode.TextDocument) => HTML_FILE_REGEX.test(doc.fileName) || doc.languageId === `html`;

const isCssLikeDoc = (doc: vscode.TextDocument) => {
	const id = doc.languageId;
	const f = doc.fileName.toLowerCase();
	return CSS_LANGUAGES.includes(id) || CSS_EXTENSIONS.some(ext => f.endsWith(ext));
};

const isJsLikeDoc = (doc: vscode.TextDocument) => {
	const id = doc.languageId;
	const f = doc.fileName.toLowerCase();
	return JS_LANGUAGES.includes(id) || JS_EXTENSIONS.some(ext => f.endsWith(ext));
};

// -------------------------------------------------------------------------------------------------
// Re-export CssSupportLike for backward compatibility
export type { CssSupportLike } from "@langs/css/cssType";

// -------------------------------------------------------------------------------------------------
export const validateDocument = async (doc: vscode.TextDocument, support: CssSupportLike): Promise<vscode.Diagnostic[]> => {
	if (!isAnalyzable(doc)) {
		return [];
	}

	logger(`debug`, `started: ${doc.fileName}`);
	const allStyles = await support.getStyles(doc);
	const {knownClasses, knownIds} = collectKnownSelectors(allStyles);
	const fullText = doc.getText();
	const isHtml = isHtmlDoc(doc);
	const isJsTs = isJsLikeDoc(doc);

	const shouldCheckCssUsage = isCssHintEnabled(doc.uri);
	const {diagnostics: usageDiagnostics, usedClassesFromMarkup, usedIdsFromMarkup} = shouldCheckCssUsage ? (
		scanDocumentUsages(fullText, doc, knownClasses, knownIds, isJsTs)
	) : (
		{diagnostics: [], usedClassesFromMarkup: new Set<string>(), usedIdsFromMarkup: new Set<string>()}
	);

	let unusedDiagnostics: vscode.Diagnostic[] = [];
	const lintDiagnostics: vscode.Diagnostic[] = [];

	// CSS 파일 검사
	isCssLikeDoc(doc) && isCssHintEnabled(doc.uri) && (unusedDiagnostics = await scanLocalUnused(doc, support, fullText));

	// HTML 파일 검사
	if (isHtml) {
		isCssHintEnabled(doc.uri) && (unusedDiagnostics = await scanEmbeddedUnused(doc, support, usedClassesFromMarkup, usedIdsFromMarkup));
		if (isHtmlHintEnabled(doc.uri)) {
			try {
				const htmlHintDiagnostics = runHtmlHint(doc);
				lintDiagnostics.push(...htmlHintDiagnostics);
			}
			catch (e: unknown) {
				const errMsg = e instanceof Error ? e.message : String(e);
				logger(`error`, `merge error: ${errMsg} in ${doc.fileName}`);
			}
		}
	}

	// JS/TS 파일 검사
	if (isJsTs && isJsHintEnabled(doc.uri)) {
		try {
			const jsHintDiagnostics = runJSHint(doc);
			lintDiagnostics.push(...jsHintDiagnostics);
		}
		catch (e: unknown) {
			const errMsg = e instanceof Error ? e.message : String(e);
			logger(`error`, `JSHint error: ${errMsg} in ${doc.fileName}`);
		}
	}

	return [ ...usageDiagnostics, ...unusedDiagnostics, ...lintDiagnostics ];
};
