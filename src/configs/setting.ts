// src/configs/setting.ts

import * as vscode from "vscode";
import {DEFAULT_CSS_EXCLUDE} from "./default.js";

// -------------------------------------------------------------------------------------------------
export type LogLevel = "off" | "error" | "info" | "debug";
export type UnusedSeverity = never;

// -------------------------------------------------------------------------------------------------
const EXTENSION_CONFIG_SECTION = "Html-Js-Css-Analyzer";
const DEFAULT_ANALYZABLE_EXTENSIONS = ["html", "htm", "js", "jsx", "ts", "tsx", "mjs", "css", "scss", "less", "sass"];
const EXTENSION_VALIDATION_REGEX = /^[a-z0-9_-]{1,16}$/;

// -------------------------------------------------------------------------------------------------
const getConfiguration = (resource?: vscode.Uri): vscode.WorkspaceConfiguration => {
	return vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTION, resource);
};

// -------------------------------------------------------------------------------------------------
export const getLogLevel = (resource?: vscode.Uri): LogLevel => {
	return getConfiguration(resource).get<LogLevel>("logLevel", "off");
};

// -------------------------------------------------------------------------------------------------
export const getCssExcludePatterns = (resource?: vscode.Uri): string[] => {
	const patterns = getConfiguration(resource).get<string[]>("exclude", DEFAULT_CSS_EXCLUDE);
	return Array.isArray(patterns) ? patterns : DEFAULT_CSS_EXCLUDE;
};

// -------------------------------------------------------------------------------------------------
export const getAnalyzableExtensions = (resource?: vscode.Uri): string[] => {
	const additionalExtensions = getAdditionalExtensions(resource);
	return additionalExtensions.length > 0 ? additionalExtensions : DEFAULT_ANALYZABLE_EXTENSIONS;
};

// -------------------------------------------------------------------------------------------------
export const getAdditionalExtensions = (resource?: vscode.Uri): string[] => {
	const extensions = getConfiguration(resource).get<string[]>("additionalExtensions", []) || [];

	return extensions
		.filter((ext): ext is string => typeof ext === "string")
		.map(ext => ext.trim().replace(/^\./, "").toLowerCase())
		.filter(ext => EXTENSION_VALIDATION_REGEX.test(ext))
		.filter((ext, index, array) => array.indexOf(ext) === index);
};

// -------------------------------------------------------------------------------------------------
export const isHtmlHintEnabled = (resource?: vscode.Uri): boolean => {
	return getConfiguration(resource).get<boolean>("htmlHint.enabled", true);
};

// -------------------------------------------------------------------------------------------------
export const isCssHintEnabled = (resource?: vscode.Uri): boolean => {
	return getConfiguration(resource).get<boolean>("cssHint.enabled", true);
};

// -------------------------------------------------------------------------------------------------
export const isJsHintEnabled = (resource?: vscode.Uri): boolean => {
	return getConfiguration(resource).get<boolean>("jsHint.enabled", true);
};

// -------------------------------------------------------------------------------------------------
export const isTsHintEnabled = (resource?: vscode.Uri): boolean => {
	return getConfiguration(resource).get<boolean>("tsHint.enabled", true);
};