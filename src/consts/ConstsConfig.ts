/**
 * @file ConstsConfig.ts
 * @since 2025-11-21
 * @description 확장 설정 상수 및 구성 관리
 */

import { vscode } from "@exportLibs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const DEF_CSS_EXCL: string[] = [
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

// TYPE DEFINITIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export type LogLevel = `off` | `error` | `info` | `debug`;
export type UnusedSeverity = never;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const EXT_CFG_SEC = `Html-Js-Css-Analyzer`;
const DEF_ANL_EXT = [`html`, `htm`, `js`, `mjs`, `css`];
const EXT_VAL_RE = /^[\d_a-z-]{1,16}$/;
const EXT_PRFX_RE = /^\./;
const cfgValCch = new Map<string, unknown>();

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const gtCfg = (
	resource?: vscode.Uri,
): vscode.WorkspaceConfiguration =>
	vscode.workspace.getConfiguration(EXT_CFG_SEC, resource);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const gtCfgCchKy = (resource: vscode.Uri | undefined, key: string): string =>
	`${resource?.toString() ?? `window`}::${key}`;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const gtCchdCfgVal = <T>(
	resource: vscode.Uri | undefined,
	key: string,
	fallback: T,
): T => {
	const cacheKey = gtCfgCchKy(resource, key);
	if (cfgValCch.has(cacheKey)) {
		return cfgValCch.get(cacheKey) as T;
	}
	const rs = gtCfg(resource).get<T>(key, fallback);
	cfgValCch.set(cacheKey, rs);
	return rs;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clrCfgCch = (): void => {
	cfgValCch.clear();
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const getLogLevel = (resource?: vscode.Uri): LogLevel =>
	gtCchdCfgVal<LogLevel>(resource, `logLevel`, `off`);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const gtCsExPa = (resource?: vscode.Uri): string[] => {
	const patterns = gtCchdCfgVal<string[]>(
		resource,
		`exclude`,
		DEF_CSS_EXCL,
	);
	return Array.isArray(patterns) ? patterns : DEF_CSS_EXCL;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const gtAnlyExts = (resource?: vscode.Uri): string[] => {
	const addExts = gtAddExts(resource);
	const rs =
		addExts.length > 0
			? addExts
			: DEF_ANL_EXT;
	return rs;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const gtAddExts = (resource?: vscode.Uri): string[] => {
	const extensions = gtCchdCfgVal<string[]>(
		resource,
		`additionalExtensions`,
		[],
	);
	const rs = extensions
		.filter((ext: string): ext is string => typeof ext === `string`)
		.map((ext: string) => ext.trim().replace(EXT_PRFX_RE, ``).toLowerCase())
		.filter((ext: string) => EXT_VAL_RE.test(ext))
		.filter(
			(ext: string, index: number, array: string[]) =>
				array.indexOf(ext) === index,
		);
	return rs;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isHtmlHntOn = (resource?: vscode.Uri): boolean =>
	gtCchdCfgVal<boolean>(resource, `htmlHint.enabled`, true);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isCssHntOn = (resource?: vscode.Uri): boolean =>
	gtCchdCfgVal<boolean>(resource, `cssHint.enabled`, true);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isJsHntOn = (resource?: vscode.Uri): boolean =>
	gtCchdCfgVal<boolean>(resource, `jsHint.enabled`, true);
