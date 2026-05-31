/**
 * @file validate.ts
 * @since 2026-01-04
 * @description 문서 유효성 검사 통합 실행
 */

import { isCssHintEnabled as isCssHntOn, isHtmlHintEnabled as isHtmlHntOn, isJsHintEnabled as isJsHntOn } from "@exportConsts";
import { analyzeCssCode as anlyCssCd, generateCssAnalysisDiagnostics as gnrCsAnDi, runHtmlHint, runJSHint } from "@exportLangs";
import type { vscode } from "@exportLibs";
import { isAnalyzable, logger } from "@exportScripts";
import type { SelectorPos } from "@exportTypes";
import type { CssSupportLike as CssSupLk } from "@langs/css/cssType";
import { cllcKnwnSels, scnDocUsgs, scnEmbdUnsd } from "@langs/css/cssUtils";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const HTML_FL_RE = /\.html?$/i;
const CSS_LANGS = new Set([`css`]);
const CSS_EXTS = [`.css`];
const JS_LANGUAGES = new Set([`javascript`]);
const JS_EXTS = [`.js`, `.mjs`, `.cjs`];

// DOCUMENT TYPE CHECKERS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const isHtmlDoc = (doc: vscode.TextDocument) => HTML_FL_RE.test(doc.fileName) || doc.languageId === `html`;

const isCssLikeDoc = (doc: vscode.TextDocument) => {
  const id = doc.languageId;
  const f = doc.fileName.toLowerCase();
  return CSS_LANGS.has(id) || CSS_EXTS.some((ext) => f.endsWith(ext));
};

const isJsLikeDoc = (doc: vscode.TextDocument) => {
  const id = doc.languageId;
  const f = doc.fileName.toLowerCase();
  return JS_LANGUAGES.has(id) || JS_EXTS.some((ext) => f.endsWith(ext));
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// Re-export CssSupportLike for backward compatibility
export type { CssSupportLike } from "@langs/css/cssType";

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const valDoc = async (doc: vscode.TextDocument, support: CssSupLk, text?: string): Promise<vscode.Diagnostic[]> => {
  if (!isAnalyzable(doc)) {
  	return [];
  }
  logger(`debug`, `started: ${doc.fileName}`);
  const fullText = text ?? doc.getText();
  const isHtml = isHtmlDoc(doc);
  const isJs = isJsLikeDoc(doc);

  const shlChCsUs = isCssHntOn(doc.uri) && (isHtml || isJs);
  let allStyles = shlChCsUs ? await support.getStyles(doc, { fullText, includeWorkspace: false }) : new Map<string, SelectorPos[]>();
  let { knownClasses, knownIds } = cllcKnwnSels(allStyles);
  let usageResult = shlChCsUs ? scnDocUsgs(fullText, doc, knownClasses, knownIds) : {
        diagnostics: [],
        usedClassesFromMarkup: new Set<string>(),
        usedIdsFromMarkup: new Set<string>(),
      };

  if (shlChCsUs && usageResult.diagnostics.length > 0) {
    allStyles = await support.getStyles(doc, { fullText, includeWorkspace: true });
    ({ knownClasses, knownIds } = cllcKnwnSels(allStyles));
    usageResult = scnDocUsgs(fullText, doc, knownClasses, knownIds);
  }
  const {
    diagnostics: usgDiags,
    usedClassesFromMarkup: usdClFrMr,
    usedIdsFromMarkup: usdIdFrMr,
  } = usageResult;

  let unsdDiags: vscode.Diagnostic[] = [];
  const lntDiags: vscode.Diagnostic[] = [];

  // CSS 파일 검사 (unused 검사 제외 - CSS 파일 내부에서 선택자 사용 여부 검사는 의미 없음)
  if (isCssLikeDoc(doc) && isCssHntOn(doc.uri)) {
    try {
      const analysis = anlyCssCd(fullText);
      const anlyDiags = gnrCsAnDi(doc, analysis);
      lntDiags.push(...anlyDiags);
    }
    catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger(`error`, `CSS Analysis error: ${errMsg} in ${doc.fileName}`);
    }
  }
  // HTML 파일 검사
  if (isHtml) {
    if (shlChCsUs) {
      unsdDiags = await scnEmbdUnsd(doc, support, usdClFrMr, usdIdFrMr, fullText);
    }
    if (isHtmlHntOn(doc.uri)) {
      try {
        const htmlHntDiags = runHtmlHint(doc);
        lntDiags.push(...htmlHntDiags);
      }
      catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger(`error`, `merge error: ${errMsg} in ${doc.fileName}`);
      }
    }
  }
  // JS/TS 파일 검사
  if (isJs && isJsHntOn(doc.uri)) {
    try {
      const jsHntDiags = runJSHint(doc);
      lntDiags.push(...jsHntDiags);
    }
    catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger(`error`, `JSHint error: ${errMsg} in ${doc.fileName}`);
    }
  }
  return [...usgDiags, ...unsdDiags, ...lntDiags];
};
