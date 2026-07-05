/**
 * @file filter.ts
 * @since 2026-01-04
 * @description 문서 필터링 및 분석 대상 판별
 */

import { getAnalyzableExtensions, getCssExcludePatterns } from "@exportConsts";
import type { vscode } from "@exportLibs";
import { isUriExcludedByGlob } from "@exportScripts";

// CONSTANTS ---------------------------------------------------------------------------------------
const SUPPORTED_SCHEMES = [`file`, `vscode-file`, `vscode-remote`] as const;
const EXCLUDED_PATH_PATTERNS = [`/appdata/roaming/code/user/`, `settings.json`, `mcp.json`] as const;

// FUNCTIONS ---------------------------------------------------------------------------------------
const isValidScheme = (scheme: string): boolean => (SUPPORTED_SCHEMES as readonly string[]).includes(scheme);

// -------------------------------------------------------------------------------------------------
const isExcludedPath = (fileName: string): boolean => {
  const normalizedPath = fileName.replaceAll(`\\`, `/`).toLowerCase();
  return EXCLUDED_PATH_PATTERNS.some((pattern) => {
    if (pattern.startsWith(`/`)) {
      return normalizedPath.includes(pattern);
    }
    return normalizedPath.endsWith(pattern);
  });
};

// -------------------------------------------------------------------------------------------------
const getFileExtension = (fileName: string): string | null => {
  const normalizedPath = fileName.replaceAll(`\\`, `/`).toLowerCase();
  const lastDotIndex = normalizedPath.lastIndexOf(`.`);
  if (lastDotIndex > 0 && lastDotIndex < normalizedPath.length - 1) {
    return normalizedPath.slice(lastDotIndex + 1);
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
export const isAnalyzable = (document: vscode.TextDocument): boolean => {
  if (!isValidScheme(document.uri.scheme)) {
    return false;
  }
  if (isExcludedPath(document.fileName)) {
    return false;
  }
  const fileExt = getFileExtension(document.fileName);
  if (!fileExt) {
    return false;
  }
  const analyzableExts = getAnalyzableExtensions(document.uri);
  if (!analyzableExts.includes(fileExt)) {
    return false;
  }
  const excludePatterns = getCssExcludePatterns(document.uri);
  return !isUriExcludedByGlob(document.uri, excludePatterns);
};
