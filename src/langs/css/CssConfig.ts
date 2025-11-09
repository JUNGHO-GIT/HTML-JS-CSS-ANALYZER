// langs/css/CssConfig.ts

import { vscode, path, fs } from "@exportLibs";
import { getAnalyzableExtensions, getCssExcludePatterns, getConfiguration, logger } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
export const isCssLikeFile = (fileName: string, languageId?: string): boolean => {
  const id = (languageId || "").toLowerCase();
  const f = fileName.toLowerCase();
  return ["css", "scss", "less", "sass"].includes(id) || [".css", ".scss", ".less", ".sass"].some(ext => f.endsWith(ext));
};

// -------------------------------------------------------------------------------------------------
export const getWorkspaceStyleGlobs = async (folder: vscode.WorkspaceFolder): Promise<string[]> => {
  const styleExts = ["css", "scss", "less", "sass"];
  const configured = getAnalyzableExtensions(folder.uri).filter(e => styleExts.includes(e));
  const unique = Array.from(new Set(configured.length ? configured : styleExts));
  return unique.map(e => `**/*.${e}`);
};

// -------------------------------------------------------------------------------------------------
export const getCssExcludeGlobs = (uri?: vscode.Uri): string[] => {
  return getCssExcludePatterns(uri);
};

// -------------------------------------------------------------------------------------------------
export const getWorkspaceFolderFor = (uri: vscode.Uri): vscode.WorkspaceFolder | undefined => {
  return vscode.workspace.getWorkspaceFolder(uri);
};

// -------------------------------------------------------------------------------------------------
export const ensureFileExists = (filePath: string): boolean => {
  try { return fs.existsSync(filePath); } catch { return false; }
};
