/**
 * @file ExportScripts.ts
 * @since 2025-11-22
 */

// -------------------------------------------------------------------------------------------------
export {
	logger,
	initLogger,
} from "@scripts/logger";
export {
	notify,
} from "@scripts/notify";

// -------------------------------------------------------------------------------
export {
	validateDocument,
} from "@scripts/validate";

// -------------------------------------------------------------------------------
export {
	LineIndexMapper,
	type LineIndex,
} from "@scripts/lineIndex";

// -------------------------------------------------------------------------------
export {
	withPerformanceMonitoring,
	performanceMonitor,
	resourceLimiter,
} from "@scripts/performance";

// -------------------------------------------------------------------------------
export {
	globToRegExp,
	isUriExcludedByGlob,
} from "@scripts/glob";

// -------------------------------------------------------------------------------
export {
	isAnalyzable,
} from "@scripts/filter";

// -------------------------------------------------------------------------------
export {
	scheduleValidate,
	bindCssSupport,
	updateDiagnostics,
	clearAll,
	onClosed,
} from "@scripts/diagnostic";
