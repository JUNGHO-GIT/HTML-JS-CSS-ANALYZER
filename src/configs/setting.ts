// src/configs/setting.ts

import * as vscode from "vscode";
import {DEFAULT_CSS_EXCLUDE} from "./default.js";

// -------------------------------------------------------------------------------------------------
export type LogLevel = "off" | "error" | "info" | "debug";
export type UnusedSeverity = never; // removed

export const getLogLevel = (resource?: vscode.Uri): LogLevel => {
	const cfg = vscode.workspace.getConfiguration("Html-Js-Css-Analyzer", resource);
	return cfg.get<LogLevel>("logLevel", "off");
};

export const getCssExcludePatterns = (resource?: vscode.Uri): string[] => {
	const arr = vscode.workspace.getConfiguration("Html-Js-Css-Analyzer", resource).get<string[]>("exclude", DEFAULT_CSS_EXCLUDE);
	return Array.isArray(arr) ? arr : DEFAULT_CSS_EXCLUDE;
};