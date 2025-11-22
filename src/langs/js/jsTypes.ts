/**
 * @file jsTypes.ts
 * @since 2025-11-22
 */

// -------------------------------------------------------------------------------------------------
export interface JSHintError {
	line: number;
	character: number;
	reason: string;
	evidence: string;
	code: string;
	scope: string;
}

// -------------------------------------------------------------------------------------------------
export interface JSHintResult {
	errors: JSHintError[];
	functions: any[];
	globals: any[];
	unused: any[];
}

// -------------------------------------------------------------------------------------------------
export interface JSHintInstance {
	JSHINT: (source: string, options?: Record<string, any>, globals?: Record<string, any>) => boolean;
	data: () => JSHintResult;
}

// -------------------------------------------------------------------------------------------------
export interface SourceAnalysis {
	isModule: boolean;
	isTypeScript: boolean;
	hasStrictMode: boolean;
	functions: FunctionInfo[];
	variables: VariableInfo[];
	imports: ImportInfo[];
	exports: ExportInfo[];
	complexityIssues: ComplexityIssue[];
	potentialBugs: PotentialBug[];
}

// -------------------------------------------------------------------------------------------------
export interface FunctionInfo {
	name: string;
	line: number;
	parameters: number;
}

// -------------------------------------------------------------------------------------------------
export interface VariableInfo {
	name: string;
	type: `let` | `const` | `var`;
	line: number;
}

// -------------------------------------------------------------------------------------------------
export interface ImportInfo {
	module: string;
	line: number;
}

// -------------------------------------------------------------------------------------------------
export interface ExportInfo {
	declaration: string;
	line: number;
}

// -------------------------------------------------------------------------------------------------
export interface ComplexityIssue {
	type: `deep-nesting` | `long-line` | `complex-regex`;
	line: number;
	message: string;
}

// -------------------------------------------------------------------------------------------------
export interface PotentialBug {
	type: `assignment-in-condition` | `potential-null-reference` | `empty-catch` | `console-usage` | `eval-usage` | `with-statement`;
	line: number;
	message: string;
}

// -------------------------------------------------------------------------------------------------
export interface AnalyzeResult {
	processedCode: string;
	analysis: SourceAnalysis;
}
