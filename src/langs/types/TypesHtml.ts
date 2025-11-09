// langs/types/TypesHtml.ts

// -------------------------------------------------------------------------------
export declare type HtmlHintRuleType = {
	id: string;
}

// -------------------------------------------------------------------------------
export declare type HtmlHintErrorType = {
	line: number;
	col: number;
	rule: HtmlHintRuleType;
	message: string;
	raw?: string;
}

// -------------------------------------------------------------------------------
export declare type HtmlHintInstanceType = {
	verify(html: string, config?: Record<string, any>): HtmlHintErrorType[];
}

// -------------------------------------------------------------------------------
export declare type FixFactoryType = (
	doc: import("vscode").TextDocument,
	d: import("vscode").Diagnostic
) => import("vscode").CodeAction | null;