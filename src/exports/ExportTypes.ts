/**
 * @file ExportTypes.ts
 * @since 2025-11-22
 */

// -------------------------------------------------------------------------------------------------
export type PerformanceMetricsType = {
	startTime: number;
	operationName: string;
};

// 1. Common ---------------------------------------------------------------------
export {
	AutoValidationMode,
	SelectorType,
	type SelectorPos,
} from "@assets/types/common";

// 2. Line Index -----------------------------------------------------------------
export type {
	LineIndex,
} from "@scripts/lineIndex";
