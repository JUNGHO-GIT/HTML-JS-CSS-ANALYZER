/**
 * @file ExportScripts.ts
 * @since 2025-11-22
 * @description 스크립트 유틸리티 통합 내보내기
 */

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	bindCssSupport,
	clearAll,
	clearValidationState,
	disposeAll,
	onClosed,
	scheduleValidate,
	updateDiagnostics,
} from "@scripts/diagnostic";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export { isAnalyzable } from "@scripts/filter";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	globToRegExp,
	isUriExcludedByGlob,
} from "@scripts/glob";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	type LineIndex,
	LineIndexMapper,
} from "@scripts/lineIndex";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	initLogger,
	logger,
} from "@scripts/logger";
export { notify } from "@scripts/notify";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	performanceMonitor,
	resourceLimiter,
	withPerformanceMonitoring,
} from "@scripts/performance";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export { validateDocument } from "@scripts/validate";
