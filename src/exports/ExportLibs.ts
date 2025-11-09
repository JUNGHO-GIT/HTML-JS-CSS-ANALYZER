// exports/ExportLibs.ts

// -------------------------------------------------------------------------------
import * as vscode from "vscode";
export { vscode };
export { CodeAction, CodeActionKind, Diagnostic, Position, Range } from "vscode";
export { default as fs } from "fs";
export { default as path } from "path";
export { createRequire } from "module";
export { default as http } from "http";
export { default as https } from "https";
export { Minimatch } from "minimatch";
export { TextEncoder } from "util";