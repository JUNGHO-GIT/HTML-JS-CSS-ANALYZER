/**
 * @file jsType.ts
 * @since 2025-11-22
 * @description JS 분석 관련 타입 정의
 */

// -------------------------------------------------------------------------------------------------
export declare type JSHintError = {
	line: number;
	character: number;
	reason: string;
	evidence: string;
	code: string;
	scope: string;
};

// -------------------------------------------------------------------------------------------------
export declare type JSHintResult = {
	errors: JSHintError[];
	functions: unknown[];
	globals: unknown[];
	unused: unknown[];
};

// -------------------------------------------------------------------------------------------------
export declare type JSHintInstance = {
	JSHINT: (source: string, options?: Record<string, unknown>, globals?: Record<string, unknown>) => boolean;
	data: () => JSHintResult;
};

// -------------------------------------------------------------------------------------------------
export declare type FunctionInfo = {
	name: string;
	line: number;
	parameters: number;
};

// -------------------------------------------------------------------------------------------------
export declare type VariableInfo = {
	name: string;
	type: `let` | `const` | `var`;
	line: number;
};

// -------------------------------------------------------------------------------------------------
export declare type ImportInfo = {
	module: string;
	line: number;
};

// -------------------------------------------------------------------------------------------------
export declare type ExportInfo = {
	declaration: string;
	line: number;
};

// -------------------------------------------------------------------------------------------------
export declare type ComplexityIssue = {
	type: `deep-nesting` | `long-line` | `complex-regex`;
	line: number;
	message: string;
};

// -------------------------------------------------------------------------------------------------
export declare type PotentialBug = {
	type: `assignment-in-condition` | `potential-null-reference` | `empty-catch` | `console-usage` | `eval-usage` | `with-statement` | `var-usage` | `innerhtml-usage` | `document-write` | `large-loop`;
	line: number;
	message: string;
};

// -------------------------------------------------------------------------------------------------
export declare type SourceAnalysis = {
	isModule: boolean;
	hasStrictMode: boolean;
	functions: FunctionInfo[];
	variables: VariableInfo[];
	imports: ImportInfo[];
	exports: ExportInfo[];
	complexityIssues: ComplexityIssue[];
	potentialBugs: PotentialBug[];
};

// -------------------------------------------------------------------------------------------------
export declare type AnalyzeResult = {
	processedCode: string;
	analysis: SourceAnalysis;
};
