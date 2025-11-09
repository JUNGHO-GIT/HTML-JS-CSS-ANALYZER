// exports/ExportsScripts.ts

// -------------------------------------------------------------------------------
export {
	logger
} from "@scripts/logger";
export {
	notify
} from "@scripts/notify";

// -------------------------------------------------------------------------------
export {
	validateDocument
} from "@scripts/validate";

// -------------------------------------------------------------------------------
export {
	lineIndexMapper
} from "@scripts/lineIndex";

// -------------------------------------------------------------------------------
export {
	withPerformanceMonitoring,
	performanceMonitor,
	resourceLimiter
} from "@scripts/performance";

// -------------------------------------------------------------------------------
export {
	isUriExcludedByGlob
} from "@scripts/glob";

// -------------------------------------------------------------------------------
export {
	isAnalyzable
} from "@scripts/filter";

// -------------------------------------------------------------------------------
export {
	getConfiguration,
	getAdditionalExtensions,
	getAnalyzableExtensions,
	getCssExcludePatterns,
	getLogLevel
} from "@scripts/getter";

// -------------------------------------------------------------------------------
export {
	scheduleValidate,
	bindCssSupport,
	updateDiagnostics,
	clearAll,
	onClosed,
} from "@scripts/diagnostic";