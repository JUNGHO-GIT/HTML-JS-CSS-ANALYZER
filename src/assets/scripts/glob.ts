/**
 * @file glob.ts
 * @since 2025-11-22
 * @description Glob 패턴 매칭 유틸리티
 */

import type { vscode } from "@exportLibs";

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const globToRegExp = (glob: string): RegExp => {
  let s = glob.replaceAll(`\\`, `/`);
  s = s.replaceAll(/[$()+.[\\\]^{|}]/g, `\\$&`);
  s = s.replaceAll(`**`, `§§DS§§`);
  s = s.replaceAll(`*`, `[^/]*`);
  s = s.replaceAll(`§§DS§§`, `.*`);
  s = s.replaceAll(`?`, `[^/]`);
  return new RegExp(`^${s}$`);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isUriExcludedByGlob = (uri: vscode.Uri, patterns: string[]) => {
  const rel = uri.fsPath.replaceAll(`\\`, `/`);
  return patterns.some((p) => globToRegExp(p).test(rel));
};
