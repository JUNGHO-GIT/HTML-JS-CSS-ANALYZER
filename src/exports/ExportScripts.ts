/**
 * @file ExportScripts.ts
 * @since 2025-11-22
 * @description 스크립트 유틸리티 통합 내보내기
 */

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	bndCssSup as bindCssSupport,
	clearAll,
	clrValSt as clearValidationState,
	onClosed,
	schedVal as scheduleValidate,
	updtDiags as updateDiagnostics,
} from "@scripts/diagnostic";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export { isAnalyzable } from "@scripts/filter";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	globToRegExp,
	isUrExByGl as isUriExcludedByGlob,
} from "@scripts/glob";

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	type LineIndex,
	LineIndex as LineIndexMapper,
} from "@scripts/lineIndex";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	initLogger,
	logger,
} from "@scripts/logger";
export { notify } from "@scripts/notify";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export {
	perfMntr as performanceMonitor,
	resLmtr as resourceLimiter,
	wthPerfMon as withPerformanceMonitoring,
} from "@scripts/performance";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export { valDoc as validateDocument } from "@scripts/validate";
