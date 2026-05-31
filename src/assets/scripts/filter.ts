/**
 * @file filter.ts
 * @since 2026-01-04
 * @description 문서 필터링 및 분석 대상 판별
 */

import { getAnalyzableExtensions as gtAnlyExts, getCssExcludePatterns as gtCsExPa } from "@exportConsts";
import type { vscode } from "@exportLibs";
import { isUriExcludedByGlob as isUrExByGl } from "@exportScripts";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const SUP_SCHM = [`file`, `vscode-file`, `vscode-remote`] as const;
const EXC_PTH_PAT = [`/appdata/roaming/code/user/`, `settings.json`, `mcp.json`] as const;

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const isVldSchm = (scheme: string): boolean => SUP_SCHM.includes(scheme as any);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isExclPth = (fileName: string): boolean => {
  const normPth = fileName.replaceAll(`\\`, `/`).toLowerCase();

  return EXC_PTH_PAT.some((pattern) => (pattern.startsWith(`/`) ? normPth.includes(pattern) : normPth.endsWith(pattern)));
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const gtFlExt = (fileName: string): string | null => {
  const normPth = fileName.replaceAll(`\\`, `/`).toLowerCase();
  const lastDotIndex = normPth.lastIndexOf(`.`);

  return lastDotIndex > 0 && lastDotIndex < normPth.length - 1 ? normPth.slice(lastDotIndex + 1) : null;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isAnalyzable = (document: vscode.TextDocument): boolean => {
  if (!isVldSchm(document.uri.scheme)) {
  	return false;
  }
  if (isExclPth(document.fileName)) {
  	return false;
  }
  const flExt = gtFlExt(document.fileName);
  if (!flExt) {
  	return false;
  }
  const anlyExts = gtAnlyExts(document.uri);
  if (!anlyExts.includes(flExt)) {
  	return false;
  }
  const exclPats = gtCsExPa(document.uri);
  return !isUrExByGl(document.uri, exclPats);
};
