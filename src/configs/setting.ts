// src/configs/setting.ts

import * as vscode from "vscode";
import {DEFAULT_CSS_EXCLUDE} from "./default.js";

// -------------------------------------------------------------------------------------------------
export type LogLevel = "off" | "error" | "info" | "debug";
export type UnusedSeverity = never;

// -------------------------------------------------------------------------------------------------
export const getLogLevel = (resource?: vscode.Uri): LogLevel => {
	const cfg = vscode.workspace.getConfiguration("Html-Js-Css-Analyzer", resource);
	return cfg.get<LogLevel>("logLevel", "off");
};

// -------------------------------------------------------------------------------------------------
export const getCssExcludePatterns = (resource?: vscode.Uri): string[] => {
	const arr = vscode.workspace.getConfiguration("Html-Js-Css-Analyzer", resource).get<string[]>("exclude", DEFAULT_CSS_EXCLUDE);
	return Array.isArray(arr) ? arr : DEFAULT_CSS_EXCLUDE;
};

// -------------------------------------------------------------------------------------------------
export const getAnalyzableExtensions = (resource?: vscode.Uri): string[] => {
	const extras = getAdditionalExtensions(resource);
	// 사용자가 지정했으면 전면 대체
	if (extras.length > 0) {
		return extras;
	}
	return ["html", "htm", "js", "jsx", "ts", "tsx", "css", "scss"];
};

// -------------------------------------------------------------------------------------------------
export const getAdditionalExtensions = (resource?: vscode.Uri): string[] => {
	const cfg = vscode.workspace.getConfiguration("Html-Js-Css-Analyzer", resource);
	const arr = cfg.get<string[]>("additionalExtensions", []) || [];
	return arr
		.filter(v => typeof v === "string")
		.map(v => v.trim().replace(/^\./, "").toLowerCase())
		.filter(v => /^[a-z0-9_-]{1,16}$/.test(v))
		.filter((v, i, a) => a.indexOf(v) === i);
};