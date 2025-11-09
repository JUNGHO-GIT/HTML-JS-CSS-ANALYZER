// langs/types/TypesJs.ts

// -------------------------------------------------------------------------------
export declare type JsHintErrorType = {
	line: number;
	character: number;
	reason: string;
	evidence: string;
	code: string;
	scope: string;
}

// -------------------------------------------------------------------------------
export declare type JsHintResultType = {
	errors: JsHintErrorType[];
	functions: any[];
	globals: any[];
	unused: any[];
}

// -------------------------------------------------------------------------------
export declare type JsHintInstanceType = {
	JsHINT(source: string, options?: Record<string, any>, globals?: Record<string, any>): boolean;
	data(): JsHintResultType;
}

// -------------------------------------------------------------------------------
export declare type FunctionInfoType = {
	name: string;
	line: number;
	parameters: number;
};

// -------------------------------------------------------------------------------
export declare type VariableInfoType = {
	name: string;
	type: "let" | "const" | "var";
	line: number;
};

// -------------------------------------------------------------------------------
export declare type ImportInfoType = {
	module: string;
	line: number;
};

// -------------------------------------------------------------------------------
export declare type ExportInfoType = {
	declaration: string;
	line: number;
};

// -------------------------------------------------------------------------------
export declare type ComplexityIssueType = {
	type: "deep-nesting" | "long-line" | "complex-regex";
	line: number;
	message: string;
};

// -------------------------------------------------------------------------------
export declare type PotentialBugType = {
	type: "assignment-in-condition" | "potential-null-reference" | "empty-catch" | "console-usage" | "eval-usage" | "with-statement";
	line: number;
	message: string;
};

// -------------------------------------------------------------------------------
export declare type SourceAnalysisType = {
	isModule: boolean;
	isTypeScript: boolean;
	hasStrictMode: boolean;
	functions: FunctionInfoType[];
	variables: VariableInfoType[];
	imports: ImportInfoType[];
	exports: ExportInfoType[];
	complexityIssues: ComplexityIssueType[];
	potentialBugs: PotentialBugType[];
};