/**
 * @file ExportLibs.ts
 * @since 2025-11-22
 */

// -------------------------------------------------------------------------------------------------
import _vscode from "vscode";
import _fs from "fs";
import _path from "path";
import _http from "http";
import _https from "https";
import { createRequire as _createRequire } from "module";
import { Minimatch as _Minimatch } from "minimatch";
import { TextEncoder as _TextEncoder, TextDecoder as _TextDecoder } from "util";
import { CodeAction as _CodeAction } from "vscode";
import { CodeActionKind as _CodeActionKind } from "vscode";
import { Diagnostic as _Diagnostic } from "vscode";
import { Position as _Position } from "vscode";
import { Range as _Range } from "vscode";
import { DiagnosticSeverity as _DiagnosticSeverity } from "vscode";

// 2. export --------------------------------------------------------------------------------
export { _vscode as vscode };
export { _fs as fs };
export { _path as path };
export { _http as http };
export { _https as https };
export { _createRequire as createRequire };
export { _Minimatch as Minimatch };
export { _TextEncoder as TextEncoder };
export { _TextDecoder as TextDecoder };
export { _CodeAction as CodeAction };
export { _CodeActionKind as CodeActionKind };
export { _Diagnostic as Diagnostic };
export { _Position as Position };
export { _Range as Range };
export { _DiagnosticSeverity as DiagnosticSeverity };
