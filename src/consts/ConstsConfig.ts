/**
 * @file ConstsConfig.ts
 * @since 2025-11-21
 * @description 확장 설정 상수 및 구성 관리
 */

import { vscode } from "@exportLibs";

// CONSTANTS ---------------------------------------------------------------------------------------
export const DEFAULT_CSS_EXCLUDE: string[] = [
  `**/node_modules/**`,
  `**/.git/**`,
  `**/dist/**`,
  `**/out/**`,
  `**/.svn/**`,
  `**/.hg/**`,
  `**/CVS/**`,
  `**/.idea/**`,
  `**/.vscode/**`,
  `**/.settings/**`,
  `**/.metadata/**`,
  `**/.history/**`,
  `**/.backup/**`,
  `**/.etc/**`,
  `**/.cache/**`,
  `**/.gradle/**`,
  `**/.mvn/**`,
  `**/bin/**`,
  `**/build/**`,
  `**/target/**`,
  `**/logs/**`,
  `**/.pytest_cache/**`,
  `**/.scannerwork/**`,
  `**/.terraform/**`,
  `**/__pycache__/**`,
  `**/.venv/**`,
  `**/.classpath`,
  `**/.project`,
  `**/.factorypath`,
  `**/.DS_Store`,
  `**/Thumbs.db`,
  `**/desktop.ini`,
  `**/.coverage`,
];

// TYPE DEFINITIONS --------------------------------------------------------------------------------
export type LogLevel = `off` | `error` | `warn` | `info` | `debug`;
export type UnusedSeverity = never;

// -------------------------------------------------------------------------------------------------
const EXT_CONFIG_SECTION = `Html-Js-Css-Analyzer`;
const DEFAULT_ANALYZE_EXTS = [`html`, `htm`, `js`, `mjs`, `css`];
const EXT_VALIDATION_REGEX = /^[\d_a-z-]{1,16}$/;
const EXT_PREFIX_REGEX = /^\./;
const configValueCache = new Map<string, unknown>();

// FUNCTIONS ---------------------------------------------------------------------------------------
const getConfig = (resource?: vscode.Uri): vscode.WorkspaceConfiguration =>
  vscode.workspace.getConfiguration(EXT_CONFIG_SECTION, resource);

// -------------------------------------------------------------------------------------------------
const getConfigCacheKey = (resource: vscode.Uri | undefined, key: string): string =>
  `${resource?.toString() ?? `window`}::${key}`;

// -------------------------------------------------------------------------------------------------
const getCachedConfigValue = <T>(resource: vscode.Uri | undefined, key: string, fallback: T): T => {
  const cacheKey = getConfigCacheKey(resource, key);
  if (configValueCache.has(cacheKey)) {
    return configValueCache.get(cacheKey) as T;
  }
  const rs = getConfig(resource).get<T>(key, fallback);
  configValueCache.set(cacheKey, rs);
  return rs;
};

// -------------------------------------------------------------------------------------------------
export const clearConfigurationCache = (): void => {
  configValueCache.clear();
};

// -------------------------------------------------------------------------------------------------
export const getLogLevel = (resource?: vscode.Uri): LogLevel =>
  getCachedConfigValue<LogLevel>(resource, `logLevel`, `info`);

// -------------------------------------------------------------------------------------------------
export const getCssExcludePatterns = (resource?: vscode.Uri): string[] => {
  const patterns = getCachedConfigValue<string[]>(resource, `exclude`, DEFAULT_CSS_EXCLUDE);
  return Array.isArray(patterns) ? patterns : DEFAULT_CSS_EXCLUDE;
};

// -------------------------------------------------------------------------------------------------
export const getAdditionalExtensions = (resource?: vscode.Uri): string[] => {
  const extensions = getCachedConfigValue<string[]>(resource, `additionalExtensions`, []);
  if (!Array.isArray(extensions)) {
    return [];
  }
  return extensions
    .filter((ext): ext is string => typeof ext === `string`)
    .map((ext) => ext.trim().replace(EXT_PREFIX_REGEX, ``).toLowerCase())
    .filter((ext) => EXT_VALIDATION_REGEX.test(ext))
    .filter((ext, index, array) => array.indexOf(ext) === index);
};

// -------------------------------------------------------------------------------------------------
export const getAnalyzableExtensions = (resource?: vscode.Uri): string[] => {
  const addExts = getAdditionalExtensions(resource);
  if (addExts.length > 0) {
    return addExts;
  }
  return DEFAULT_ANALYZE_EXTS;
};

// -------------------------------------------------------------------------------------------------
export const isHtmlHintEnabled = (resource?: vscode.Uri): boolean =>
  getCachedConfigValue<boolean>(resource, `htmlHint.enabled`, true);

// -------------------------------------------------------------------------------------------------
export const isCssHintEnabled = (resource?: vscode.Uri): boolean =>
  getCachedConfigValue<boolean>(resource, `cssHint.enabled`, true);

// -------------------------------------------------------------------------------------------------
export const isJsHintEnabled = (resource?: vscode.Uri): boolean =>
  getCachedConfigValue<boolean>(resource, `jsHint.enabled`, true);
