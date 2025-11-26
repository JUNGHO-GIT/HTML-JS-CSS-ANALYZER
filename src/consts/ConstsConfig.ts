/**
 * @file ConstsConfig.ts
 * @since 2025-11-21
 */

import { vscode } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
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

// -------------------------------------------------------------------------------------------------
export type LogLevel = `off` | `error` | `info` | `debug`;
export type UnusedSeverity = never;

// -------------------------------------------------------------------------------------------------
const EXTENSION_CONFIG_SECTION = `Html-Js-Css-Analyzer`;
const DEFAULT_ANALYZABLE_EXTENSIONS = [ `html`, `htm`, `js`, `mjs`, `css` ];
const EXTENSION_VALIDATION_REGEX = /^[a-z0-9_-]{1,16}$/;

// -------------------------------------------------------------------------------------------------
const getConfiguration = (resource?: vscode.Uri): vscode.WorkspaceConfiguration => {
	return vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTION, resource);
};

// -------------------------------------------------------------------------------------------------
export const getLogLevel = (resource?: vscode.Uri): LogLevel => {
	return getConfiguration(resource).get<LogLevel>(`logLevel`, `off`);
};

// -------------------------------------------------------------------------------------------------
export const getCssExcludePatterns = (resource?: vscode.Uri): string[] => {
	const patterns = getConfiguration(resource).get<string[]>(`exclude`, DEFAULT_CSS_EXCLUDE);
	return Array.isArray(patterns) ? patterns : DEFAULT_CSS_EXCLUDE;
};

// -------------------------------------------------------------------------------------------------
export const getAnalyzableExtensions = (resource?: vscode.Uri): string[] => {
	const additionalExtensions = getAdditionalExtensions(resource);
	const rs = additionalExtensions.length > 0 ? additionalExtensions : DEFAULT_ANALYZABLE_EXTENSIONS;
	return rs;
};

// -------------------------------------------------------------------------------------------------
export const getAdditionalExtensions = (resource?: vscode.Uri): string[] => {
	const extensions = getConfiguration(resource).get<string[]>(`additionalExtensions`, []) || [];
	const rs = extensions
		.filter((ext: string): ext is string => typeof ext === `string`)
		.map((ext: string) => ext.trim().replace(/^\./, ``).toLowerCase())
		.filter((ext: string) => EXTENSION_VALIDATION_REGEX.test(ext))
		.filter((ext: string, index: number, array: string[]) => array.indexOf(ext) === index);
	return rs;
};

// -------------------------------------------------------------------------------------------------
export const isHtmlHintEnabled = (resource?: vscode.Uri): boolean => {
	return getConfiguration(resource).get<boolean>(`htmlHint.enabled`, true);
};

// -------------------------------------------------------------------------------------------------
export const isCssHintEnabled = (resource?: vscode.Uri): boolean => {
	return getConfiguration(resource).get<boolean>(`cssHint.enabled`, true);
};

// -------------------------------------------------------------------------------------------------
export const isJsHintEnabled = (resource?: vscode.Uri): boolean => {
	return getConfiguration(resource).get<boolean>(`jsHint.enabled`, true);
};
