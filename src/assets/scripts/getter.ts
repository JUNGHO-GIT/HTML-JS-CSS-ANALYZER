// assets/scripts/getter.ts

import { vscode } from "@exportLibs";
import {
  extensionConfigSection,
  defaultAnalyzableExtensions,
  regexExtensionValidation,
  defaultCssExclude
} from "@exportConsts";
import type { LogLevelType } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
export const getConfiguration = (resource?: vscode.Uri): vscode.WorkspaceConfiguration => {
  return vscode.workspace.getConfiguration(extensionConfigSection, resource);
};

// -------------------------------------------------------------------------------------------------
export const getLogLevel = (resource?: vscode.Uri): LogLevelType => {
  return getConfiguration(resource).get<LogLevelType>("logLevel", "info");
};

// -------------------------------------------------------------------------------------------------
export const getCssExcludePatterns = (resource?: vscode.Uri): string[] => {
  const patterns = getConfiguration(resource).get<string[]>("exclude", defaultCssExclude);
  return (Array.isArray(patterns)) ? (patterns) : (defaultCssExclude);
};

// -------------------------------------------------------------------------------------------------
export const getAnalyzableExtensions = (resource?: vscode.Uri): string[] => {
  const additionalExtensions = getAdditionalExtensions(resource);
  return (additionalExtensions.length > 0) ? (
    additionalExtensions
  ) : (
    defaultAnalyzableExtensions
  );
};

// -------------------------------------------------------------------------------------------------
export const getAdditionalExtensions = (resource?: vscode.Uri): string[] => {
  const extensions = getConfiguration(resource).get<string[]>("additionalExtensions", []) || [];
  return extensions
    .filter((ext): ext is string => typeof ext === "string")
    .map((ext: string) => ext.trim().replace(/^\./, "").toLowerCase())
    .filter((ext: string) => regexExtensionValidation.test(ext))
    .filter((ext: string, index: number, array: string[]) => array.indexOf(ext) === index);
};