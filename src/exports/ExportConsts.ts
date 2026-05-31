/**
 * @file ExportConsts.ts
 * @since 2025-11-22
 * @description 설정 상수 통합 내보내기
 */

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	clrCfgCch as clearConfigurationCache,
	DEF_CSS_EXCL as DEFAULT_CSS_EXCLUDE,
	gtAddExts as getAdditionalExtensions,
	gtAnlyExts as getAnalyzableExtensions,
	gtCsExPa as getCssExcludePatterns,
	getLogLevel,
	isCssHntOn as isCssHintEnabled,
	isHtmlHntOn as isHtmlHintEnabled,
	isJsHntOn as isJsHintEnabled,
	type LogLevel,
	type UnusedSeverity,
} from "@consts/ConstsConfig";
