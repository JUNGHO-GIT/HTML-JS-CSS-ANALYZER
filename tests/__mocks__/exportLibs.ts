/**
 * @file exportLibs.ts
 * @description Mock for VSCode and external libraries
 */

// Mock URI class
export class MockUri {
	readonly scheme: string;
	readonly authority: string;
	readonly path: string;
	readonly query: string;
	readonly fragment: string;
	readonly fsPath: string;

	constructor(components: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string }) {
		this.scheme = components.scheme ?? `file`;
		this.authority = components.authority ?? ``;
		this.path = components.path ?? ``;
		this.query = components.query ?? ``;
		this.fragment = components.fragment ?? ``;
		this.fsPath = this.path;
	}

	toString(): string {
		return `${this.scheme}://${this.authority}${this.path}`;
	}

	static file(path: string): MockUri {
		return new MockUri({ scheme: `file`, path });
	}

	static parse(value: string): MockUri {
		const match = value.match(/^(\w+):\/\/([^/]*)(.*)$/);
		return match ? (
			new MockUri({ scheme: match[1], authority: match[2], path: match[3] })
		) : (
			new MockUri({ path: value })
		);
	}
}

// Mock Range class
export class MockRange {
	readonly start: MockPosition;
	readonly end: MockPosition;

	constructor(startLine: number | MockPosition, startChar: number | MockPosition, endLine?: number, endChar?: number) {
		this.start = typeof startLine === `number` ? (
			new MockPosition(startLine, startChar as number)
		) : (
			startLine
		);
		this.end = typeof endLine === `number` ? (
			new MockPosition(endLine, endChar as number)
		) : (
			startChar as MockPosition
		);
	}
}

// Mock Position class
export class MockPosition {
	readonly line: number;
	readonly character: number;

	constructor(line: number, character: number) {
		this.line = line;
		this.character = character;
	}

	translate(lineDelta?: number, characterDelta?: number): MockPosition {
		return new MockPosition(
			this.line + (lineDelta ?? 0),
			this.character + (characterDelta ?? 0)
		);
	}
}

// Mock Diagnostic class
export class MockDiagnostic {
	range: MockRange;
	message: string;
	severity: MockDiagnosticSeverity;
	source?: string;
	code?: string | number;
	tags?: MockDiagnosticTag[];
	data?: unknown;

	constructor(range: MockRange, message: string, severity?: MockDiagnosticSeverity) {
		this.range = range;
		this.message = message;
		this.severity = severity ?? MockDiagnosticSeverity.Error;
	}
}

// Mock DiagnosticSeverity enum
export enum MockDiagnosticSeverity {
	Error = 0,
	Warning = 1,
	Information = 2,
	Hint = 3,
}

// Mock DiagnosticTag enum
export enum MockDiagnosticTag {
	Unnecessary = 1,
	Deprecated = 2,
}

// Mock TextDocument interface
export interface MockTextDocument {
	uri: MockUri;
	fileName: string;
	languageId: string;
	version: number;
	lineCount: number;
	getText(range?: MockRange): string;
	positionAt(offset: number): MockPosition;
	lineAt(line: number): { text: string; range: MockRange };
}

// Create mock TextDocument
export const createMockDocument = (content: string, options: {
	fileName?: string;
	languageId?: string;
	uri?: MockUri;
} = {}): MockTextDocument => {
	const lines = content.split(`\n`);
	return {
		uri: options.uri ?? MockUri.file(options.fileName ?? `/test/file.html`),
		fileName: options.fileName ?? `/test/file.html`,
		languageId: options.languageId ?? `html`,
		version: 1,
		lineCount: lines.length,
		getText: (range?: MockRange) => {
			if (!range) {
				return content;
			}
			const startOffset = lines.slice(0, range.start.line).join(`\n`).length + (range.start.line > 0 ? 1 : 0) + range.start.character;
			const endOffset = lines.slice(0, range.end.line).join(`\n`).length + (range.end.line > 0 ? 1 : 0) + range.end.character;
			return content.substring(startOffset, endOffset);
		},
		positionAt: (offset: number) => {
			let remaining = offset;
			for (let i = 0; i < lines.length; i++) {
				if (remaining <= lines[i].length) {
					return new MockPosition(i, remaining);
				}
				remaining -= lines[i].length + 1; // +1 for newline
			}
			return new MockPosition(lines.length - 1, lines[lines.length - 1]?.length ?? 0);
		},
		lineAt: (line: number) => ({
			text: lines[line] ?? ``,
			range: new MockRange(line, 0, line, (lines[line]?.length ?? 0)),
		}),
	};
};

// Mock vscode namespace
export const vscode = {
	Uri: MockUri,
	Range: MockRange,
	Position: MockPosition,
	Diagnostic: MockDiagnostic,
	DiagnosticSeverity: MockDiagnosticSeverity,
	DiagnosticTag: MockDiagnosticTag,
	workspace: {
		getConfiguration: () => ({
			get: <T>(key: string, defaultValue?: T): T | undefined => defaultValue,
		}),
		workspaceFolders: [],
		findFiles: async () => [],
		getWorkspaceFolder: () => undefined,
	},
	extensions: {
		getExtension: () => undefined,
	},
	window: {
		activeTextEditor: undefined,
		showInformationMessage: async () => undefined,
		showErrorMessage: async () => undefined,
		showWarningMessage: async () => undefined,
	},
	languages: {
		createDiagnosticCollection: () => ({
			set: () => {},
			delete: () => {},
			clear: () => {},
			dispose: () => {},
		}),
	},
	CompletionItemKind: {
		Value: 1,
		Enum: 13,
	},
	CompletionItem: class {
		label: string;
		kind?: number;
		range?: MockRange;
		detail?: string;
		constructor(label: string, kind?: number) {
			this.label = label;
			this.kind = kind;
		}
	},
	Location: class {
		uri: MockUri;
		range: MockRange;
		constructor(uri: MockUri, rangeOrPosition: MockRange | MockPosition) {
			this.uri = uri;
			this.range = rangeOrPosition instanceof MockRange ? (
				rangeOrPosition
			) : (
				new MockRange(rangeOrPosition, rangeOrPosition)
			);
		}
	},
};

// Re-export for compatibility
export const Diagnostic = MockDiagnostic;
export const DiagnosticSeverity = MockDiagnosticSeverity;
export const Position = MockPosition;
export const Range = MockRange;
export const Uri = MockUri;

// Mock external libraries
export const fs = {
	existsSync: () => false,
	readFileSync: () => ``,
	statSync: () => ({ isDirectory: () => false, mtimeMs: Date.now(), size: 0 }),
	promises: {
		stat: async () => ({ mtimeMs: Date.now(), size: 0 }),
		readFile: async () => ``,
	},
};

export const path = {
	join: (...args: string[]) => args.join(`/`),
	dirname: (p: string) => p.split(`/`).slice(0, -1).join(`/`),
	basename: (p: string) => p.split(`/`).pop() ?? ``,
	normalize: (p: string) => p,
	isAbsolute: (p: string) => p.startsWith(`/`),
	parse: (p: string) => ({ root: `/`, dir: p.split(`/`).slice(0, -1).join(`/`), base: p.split(`/`).pop() ?? `` }),
	sep: `/`,
};

export const https = {
	get: () => ({ on: () => {}, setTimeout: () => {} }),
};

export const http = {
	get: () => ({ on: () => {}, setTimeout: () => {} }),
};

export const createRequire = () => () => ({});
