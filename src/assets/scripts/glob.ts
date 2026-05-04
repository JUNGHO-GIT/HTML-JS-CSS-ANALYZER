/**
 * @file glob.ts
 * @since 2025-11-22
 * @description Glob 패턴 매칭 유틸리티
 */

import type { vscode } from "@exportLibs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const globRegExpCache = new Map<string, RegExp>();

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const globToRegExp = (glob: string): RegExp => {
  const cachedRegExp = globRegExpCache.get(glob);
  if (cachedRegExp) {
    return cachedRegExp;
  }
  let s = glob.replaceAll(`\\`, `/`);
  s = s.replaceAll(/[$()+.[\\\]^{|}]/g, `\\$&`);
  s = s.replaceAll(`**`, `§§DS§§`);
  s = s.replaceAll(`*`, `[^/]*`);
  s = s.replaceAll(`§§DS§§`, `.*`);
  s = s.replaceAll(`?`, `[^/]`);
  const rs = new RegExp(`^${s}$`);
  globRegExpCache.set(glob, rs);
  return rs;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isUriExcludedByGlob = (uri: vscode.Uri, patterns: string[]) => {
  const rel = uri.fsPath.replaceAll(`\\`, `/`);
  return patterns.some((p) => globToRegExp(p).test(rel));
};
