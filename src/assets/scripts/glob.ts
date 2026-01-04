/**
 * @file glob.ts
 * @since 2025-11-22
 */

import { vscode } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
export const globToRegExp = (glob: string): RegExp => {
  let s = glob.replaceAll(`\\`, `/`);
  s = s.replaceAll(/[$()+.[\\\]^{|}]/g, `\\$&`);
  s = s.replaceAll(`**`, `§§DS§§`);
  s = s.replaceAll(`*`, `[^/]*`);
  s = s.replaceAll(`§§DS§§`, `.*`);
  s = s.replaceAll(`?`, `[^/]`);
  return new RegExp(`^${s}$`);
};

// -------------------------------------------------------------------------------------------------
export const isUriExcludedByGlob = (uri: vscode.Uri, patterns: string[]) => {
  const rel = uri.fsPath.replaceAll(`\\`, `/`);
  return patterns.some((p) => globToRegExp(p).test(rel));
};
