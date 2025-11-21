/**
 * @file js.ts
 * @since 2025-11-22
 */

export { runJSHint } from "./jsRunner";
export { JSHintCodeActionProvider } from "./jsCodeActions";
export { analyzeSourceCode } from "./jsAnalyzer";
export type {
	JSHintError,
	JSHintResult,
	JSHintInstance,
	SourceAnalysis,
	FunctionInfo,
	VariableInfo,
	ImportInfo,
	ExportInfo,
	ComplexityIssue,
	PotentialBug,
	AnalyzeResult,
} from "./jsTypes";
export {
	loadJSHint,
	loadJSHintConfig,
} from "./jsConfig";
