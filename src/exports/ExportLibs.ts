/**
 * @file ExportLibs.ts
 * @since 2025-11-22
 */

// -------------------------------------------------------------------------------------------------
export { default as vscode, CodeAction, CodeActionKind, Diagnostic, Position, Range, DiagnosticSeverity } from "vscode";
export { default as fs } from "node:fs";
export { default as path } from "node:path";
export { default as http } from "node:http";
export { default as https } from "node:https";
export { createRequire } from "node:module";
export { TextEncoder, TextDecoder } from "node:util";
