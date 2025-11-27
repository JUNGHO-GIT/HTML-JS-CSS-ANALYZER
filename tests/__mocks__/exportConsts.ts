/**
 * @file exportConsts.ts
 * @description Mock for configuration exports
 */

export const DEFAULT_CSS_EXCLUDE: string[] = [
	`**/node_modules/**`,
	`**/.git/**`,
	`**/dist/**`,
	`**/out/**`,
];

export type LogLevel = `off` | `error` | `info` | `debug`;
export type UnusedSeverity = never;

export const getLogLevel = (): LogLevel => `off`;

export const getCssExcludePatterns = (): string[] => DEFAULT_CSS_EXCLUDE;

export const getAnalyzableExtensions = (): string[] => [ `html`, `htm`, `js`, `mjs`, `css` ];

export const getAdditionalExtensions = (): string[] => [];

export const isHtmlHintEnabled = (): boolean => true;

export const isCssHintEnabled = (): boolean => true;

export const isJsHintEnabled = (): boolean => true;
