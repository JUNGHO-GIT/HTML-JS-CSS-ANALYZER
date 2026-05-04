/**
 * @file ExportLibs.ts
 * @since 2025-11-22
 * @description 외부 라이브러리 통합 내보내기
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import { createRequire } from "node:module";
import * as path from "node:path";
import { TextDecoder, TextEncoder } from "node:util";
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
import * as vscode from "vscode";

const { CodeAction, CodeActionKind, Diagnostic, DiagnosticSeverity, Position, Range } = vscode;

type CodeAction = vscode.CodeAction;
type Diagnostic = vscode.Diagnostic;
type Position = vscode.Position;
type Range = vscode.Range;

export { CodeAction, CodeActionKind, createRequire, Diagnostic, DiagnosticSeverity, fs, http, https, Position, path, Range, TextDecoder, TextEncoder, vscode };
