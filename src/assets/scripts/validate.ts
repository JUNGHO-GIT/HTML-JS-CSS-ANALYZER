/**
 * @file validate.ts
 * @description foo
 * @author Jungho
 * @since 2026-1-4
 */

import { vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { runHtmlHint, runJSHint, analyzeCssCode, generateCssAnalysisDiagnostics } from "@exportLangs";
import { isAnalyzable } from "@exportScripts";
import { isHtmlHintEnabled, isCssHintEnabled, isJsHintEnabled } from "@exportConsts";
import type { CssSupportLike } from "@langs/css/cssType";
import {
  collectKnownSelectors,
  scanDocumentUsages,
  scanEmbeddedUnused,
} from "@langs/css/cssUtils";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const HTML_FILE_REGEX = /\.html?$/i;
const CSS_LANGUAGES = new Set([`css`]);
const CSS_EXTENSIONS = [`.css`];
const JS_LANGUAGES = new Set([`javascript`]);
const JS_EXTENSIONS = [ `.js`, `.mjs`, `.cjs` ];

// -------------------------------------------------------------------------------------------------
// DOCUMENT TYPE CHECKERS
// -------------------------------------------------------------------------------------------------
const isHtmlDoc = (doc: vscode.TextDocument) => HTML_FILE_REGEX.test(doc.fileName) || doc.languageId === `html`;

const isCssLikeDoc = (doc: vscode.TextDocument) => {
  const id = doc.languageId;
  const f = doc.fileName.toLowerCase();
  return CSS_LANGUAGES.has(id) || CSS_EXTENSIONS.some((ext) => f.endsWith(ext));
};

const isJsLikeDoc = (doc: vscode.TextDocument) => {
  const id = doc.languageId;
  const f = doc.fileName.toLowerCase();
  return JS_LANGUAGES.has(id) || JS_EXTENSIONS.some((ext) => f.endsWith(ext));
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
  const { knownClasses, knownIds } = collectKnownSelectors(allStyles);
  const fullText = doc.getText();
  const isHtml = isHtmlDoc(doc);
  const isJs = isJsLikeDoc(doc);

  const shouldCheckCssUsage = isCssHintEnabled(doc.uri) && (isHtml || isJs);
  const { diagnostics: usageDiagnostics, usedClassesFromMarkup, usedIdsFromMarkup } = shouldCheckCssUsage ? (
		scanDocumentUsages(fullText, doc, knownClasses, knownIds)
	) : (
		{ diagnostics: [], usedClassesFromMarkup: new Set<string>(), usedIdsFromMarkup: new Set<string>() }
	);

  let unusedDiagnostics: vscode.Diagnostic[] = [];
  const lintDiagnostics: vscode.Diagnostic[] = [];

  // CSS 파일 검사 (unused 검사 제외 - CSS 파일 내부에서 선택자 사용 여부 검사는 의미 없음)
  if (isCssLikeDoc(doc) && isCssHintEnabled(doc.uri)) {
    try {
      const analysis = analyzeCssCode(fullText);
      const analysisDiagnostics = generateCssAnalysisDiagnostics(doc, analysis);
      lintDiagnostics.push(...analysisDiagnostics);
    }
    catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger(`error`, `CSS Analysis error: ${errMsg} in ${doc.fileName}`);
    }
  }

  // HTML 파일 검사
  if (isHtml) {
    isCssHintEnabled(doc.uri) && (unusedDiagnostics = await scanEmbeddedUnused(doc, support, usedClassesFromMarkup, usedIdsFromMarkup));
    if (isHtmlHintEnabled(doc.uri)) {
      try {
        const htmlHintDiagnostics = runHtmlHint(doc);
        lintDiagnostics.push(...htmlHintDiagnostics);
      }
      catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger(`error`, `merge error: ${errMsg} in ${doc.fileName}`);
      }
    }
  }

  // JS/TS 파일 검사
  if (isJs && isJsHintEnabled(doc.uri)) {
    try {
      const jsHintDiagnostics = runJSHint(doc);
      lintDiagnostics.push(...jsHintDiagnostics);
    }
    catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger(`error`, `JSHint error: ${errMsg} in ${doc.fileName}`);
    }
  }

  return [ ...usageDiagnostics, ...unusedDiagnostics, ...lintDiagnostics ];
};
