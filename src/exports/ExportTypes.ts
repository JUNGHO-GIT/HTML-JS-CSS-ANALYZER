// exports/ExportTypes.ts

// 0. Performance ----------------------------------------------------------------
export type PerformanceMetricsType = {
	startTime: number;
	operationName: string;
};

// 1. Common ---------------------------------------------------------------------
export {
	AutoValidationMode,
	SelectorType,
	type SelectorPos
} from "@langs/types/common";

// 2. Line Index -----------------------------------------------------------------
export type {
	LineIndex
} from "@scripts/lineIndex";
