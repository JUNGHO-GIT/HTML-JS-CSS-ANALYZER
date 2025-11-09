// langs/types/TypesCss.ts

// -------------------------------------------------------------------------------
export declare type SelectorType = "#" | ".";

// -------------------------------------------------------------------------------
export declare type SelectorPosType = {
	index: number;
	line: number;
	col: number;
	type: SelectorType;
	selector: string;
};

// -------------------------------------------------------------------------------
export declare type CacheValType = {
	version: number;
	data: SelectorPosType[];
	timestamp: number;
	accessCount: number;
};

// -------------------------------------------------------------------------------
export declare type FetchResponseType = {
	ok: boolean;
	status?: number;
	statusText?: string;
	text(): Promise<string>;
};

// -------------------------------------------------------------------------------
export type FromIndexPosType = {line: number; col: number} | null;

// -------------------------------------------------------------------------------
export type LineIndexDataType = {
	str: string;
	lineToIndex: number[];
	origin: number;
	fromIndex: (idx: number) => FromIndexPosType;
	toIndex: (line: number | number[] | {line: number; col?: number; column?: number}, col?: number) => number;
};

// -------------------------------------------------------------------------------
export type LineIndexMapperOverloadType = {
	(text: string, options?: {origin?: number}): LineIndexDataType;
	(text: string, index: number): FromIndexPosType;
};

// -------------------------------------------------------------------------------
export declare type CssSupportLikeType = {
	getStyles(doc: import("vscode").TextDocument): Promise<Map<string, SelectorPosType[]>>;
	getLocalDoc(doc: import("vscode").TextDocument): Promise<SelectorPosType[]>;
	provideCompletionItems(doc: import("vscode").TextDocument, position: import("vscode").Position, token: import("vscode").CancellationToken): Promise<import("vscode").CompletionItem[] | undefined>;
	provideDefinition(doc: import("vscode").TextDocument, position: import("vscode").Position, token: import("vscode").CancellationToken): Promise<import("vscode").Definition>;
	validate(doc: import("vscode").TextDocument): Promise<import("vscode").Diagnostic[]>;
	clearWorkspaceIndex(): void;
};
