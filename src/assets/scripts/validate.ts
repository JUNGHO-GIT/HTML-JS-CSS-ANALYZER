/**
 * @file validate.ts
 * @since 2026-01-04
 * @description 문서 유효성 검사 통합 실행
 */

import { isCssHintEnabled, isHtmlHintEnabled, isJsHintEnabled } from "@exportConsts";
import { analyzeCssCode, generateCssAnalysisDiagnostics, runHtmlHint, runJSHint } from "@exportLangs";
import type { vscode } from "@exportLibs";
import { isAnalyzable, logger } from "@exportScripts";
import type { SelectorPos } from "@exportTypes";
import type { CssSupportLike } from "@langs/css/cssType";
import { collectKnownSelectors, scanDocumentUsages, scanEmbeddedUnused } from "@langs/css/cssUtils";

// CONSTANTS ---------------------------------------------------------------------------------------
const HTML_FILE_REGEX = /\.html?$/i;
const CSS_LANGS = new Set([`css`]);
const CSS_EXTS = [`.css`];
const JS_LANGUAGES = new Set([`javascript`]);
const JS_EXTS = [`.js`, `.mjs`, `.cjs`];

// DOCUMENT TYPE CHECKERS ---------------------------------------------------------------------------
const isHtmlDoc = (doc: vscode.TextDocument): boolean =>
  HTML_FILE_REGEX.test(doc.fileName) || doc.languageId === `html`;

const isCssLikeDoc = (doc: vscode.TextDocument): boolean => {
  const id = doc.languageId;
  const f = doc.fileName.toLowerCase();
  return CSS_LANGS.has(id) || CSS_EXTS.some((ext) => f.endsWith(ext));
};

const isJsLikeDoc = (doc: vscode.TextDocument): boolean => {
  const id = doc.languageId;
  const f = doc.fileName.toLowerCase();
  return JS_LANGUAGES.has(id) || JS_EXTS.some((ext) => f.endsWith(ext));
};

// -------------------------------------------------------------------------------------------------
// Re-export CssSupportLike for backward compatibility
export type { CssSupportLike } from "@langs/css/cssType";

// -------------------------------------------------------------------------------------------------
export const validateDocument = async (doc: vscode.TextDocument, support: CssSupportLike, text?: string): Promise<vscode.Diagnostic[]> => {
  if (!isAnalyzable(doc)) {
    return [];
  }
  logger(`debug`, `started: ${doc.fileName}`);
  const fullText = text ?? doc.getText();
  const isHtml = isHtmlDoc(doc);
  const isJs = isJsLikeDoc(doc);

  const shouldCheckCssUsage = isCssHintEnabled(doc.uri) && (isHtml || isJs);
  let allStyles = shouldCheckCssUsage
    ? await support.getStyles(doc, { fullText, includeWorkspace: false })
    : new Map<string, SelectorPos[]>();
  let { knownClasses, knownIds } = collectKnownSelectors(allStyles);
  let usageResult = shouldCheckCssUsage
    ? scanDocumentUsages(fullText, doc, knownClasses, knownIds)
    : {
        diagnostics: [],
        usedClassesFromMarkup: new Set<string>(),
        usedIdsFromMarkup: new Set<string>(),
      };

  if (shouldCheckCssUsage && usageResult.diagnostics.length > 0) {
    allStyles = await support.getStyles(doc, { fullText, includeWorkspace: true });
    ({ knownClasses, knownIds } = collectKnownSelectors(allStyles));
    usageResult = scanDocumentUsages(fullText, doc, knownClasses, knownIds);
  }
  const {
    diagnostics: usageDiags,
    usedClassesFromMarkup: usedClassesFromMarkup,
    usedIdsFromMarkup: usedIdsFromMarkup,
  } = usageResult;

  let unusedDiags: vscode.Diagnostic[] = [];
  const lintDiags: vscode.Diagnostic[] = [];

  // CSS 파일 검사 (unused 검사 제외 - CSS 파일 내부에서 선택자 사용 여부 검사는 의미 없음)
  if (isCssLikeDoc(doc) && isCssHintEnabled(doc.uri)) {
    try {
      const analysis = analyzeCssCode(fullText);
      const anlyDiags = generateCssAnalysisDiagnostics(doc, analysis);
      lintDiags.push(...anlyDiags);
    }
    catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger(`error`, `CSS Analysis error: ${errMsg} in ${doc.fileName}`);
    }
  }
  // HTML 파일 검사
  if (isHtml) {
    if (shouldCheckCssUsage) {
      unusedDiags = await scanEmbeddedUnused(doc, support, usedClassesFromMarkup, usedIdsFromMarkup, fullText);
    }
    if (isHtmlHintEnabled(doc.uri)) {
      try {
        const htmlHntDiags = runHtmlHint(doc);
        lintDiags.push(...htmlHntDiags);
      }
      catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger(`error`, `merge error: ${errMsg} in ${doc.fileName}`);
      }
    }
  }
  // JS 파일 검사
  if (isJs && isJsHintEnabled(doc.uri)) {
    try {
      const jsHntDiags = runJSHint(doc);
      lintDiags.push(...jsHntDiags);
    }
    catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger(`error`, `JSHint error: ${errMsg} in ${doc.fileName}`);
    }
  }
  return [...usageDiags, ...unusedDiags, ...lintDiags];
};
