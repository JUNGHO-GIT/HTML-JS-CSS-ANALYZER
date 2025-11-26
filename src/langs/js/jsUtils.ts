/**
 * @file jsUtils.ts
 * @since 2025-11-26
 * @description JS 유틸리티 함수
 */

import { vscode, Position } from "@exportLibs";
import type { JSHintError } from "@langs/js/jsType";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const ERROR_W033_CODES = [ `W033` ];
const ERROR_W116_W117_CODES = [ `W116`, `W117` ];
const ERROR_W030_CODES = [ `W030` ];
const ERROR_CODES = new Set([ `E001`, `E002`, `E003`, `E004`, `E005`, `E006`, `E007`, `E008`, `E009`, `E010` ]);
const WARNING_CODES = new Set([ `W033`, `W116`, `W117`, `W098`, `W097` ]);
const JS_LANGUAGES = [ `javascript` ];
const JS_EXTENSIONS = [ `.js`, `.mjs`, `.cjs` ];

// REGEX PATTERNS
const W116_W117_REGEX = /^(?:\w+|==|!=)/;
const W030_REGEX = /^[^;]+/;
const DEFAULT_TOKEN_REGEX = /^\S+/;

// -------------------------------------------------------------------------------------------------
// UTILITY FUNCTIONS
// -------------------------------------------------------------------------------------------------
export const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : value > max ? max : value;
};

// -------------------------------------------------------------------------------------------------
export const calculateErrorRange = (document: vscode.TextDocument, error: JSHintError): vscode.Range => {
	const lineNumber = Math.max((error.line || 1) - 1, 0);
	const columnNumber = Math.max((error.character || 1) - 1, 0);
	const safeLineNumber = clamp(lineNumber, 0, document.lineCount - 1);
	const lineText = document.lineAt(safeLineNumber).text;

	let startColumn = columnNumber;
	let endColumn = columnNumber + 1;

	error.code && (() => {
		const match = ERROR_W033_CODES.includes(error.code) ? (
			endColumn = lineText.trimEnd().length,
			startColumn = Math.max(endColumn - 1, 0),
			null
		) : ERROR_W116_W117_CODES.includes(error.code) ? (
			W116_W117_REGEX.exec(lineText.slice(columnNumber))
		) : ERROR_W030_CODES.includes(error.code) ? (
			W030_REGEX.exec(lineText.slice(columnNumber))
		) : (
			DEFAULT_TOKEN_REGEX.exec(lineText.slice(columnNumber))
		);

		match && (
			startColumn = columnNumber,
			endColumn = columnNumber + match[0].length
		);
	})();

	startColumn = clamp(startColumn, 0, lineText.length);
	endColumn = clamp(endColumn, startColumn + 1, lineText.length);

	return new vscode.Range(
		new Position(safeLineNumber, startColumn),
		new Position(safeLineNumber, endColumn)
	);
};

// -------------------------------------------------------------------------------------------------
export const calculateSeverity = (error: JSHintError): vscode.DiagnosticSeverity => {
	return !error.code ? (
		vscode.DiagnosticSeverity.Warning
	) : error.code.startsWith(`E`) && ERROR_CODES.has(error.code) ? (
		vscode.DiagnosticSeverity.Error
	) : WARNING_CODES.has(error.code) ? (
		vscode.DiagnosticSeverity.Warning
	) : (
		vscode.DiagnosticSeverity.Information
	);
};

// -------------------------------------------------------------------------------------------------
export const isJsLikeDocument = (doc: vscode.TextDocument): boolean => {
	const id = doc.languageId;
	const f = doc.fileName.toLowerCase();
	return JS_LANGUAGES.includes(id) || JS_EXTENSIONS.some(ext => f.endsWith(ext));
};
