// consts/ConstsConfig.ts

import { path, vscode } from "@exportLibs";

// 1. Number -----------------------------------------------------------------------------------------------
export const baseValidationDelayMs = 250;
export const maxValidationDelayMs = 1000;
export const rapidChangeThreshold = 5;
export const maxWorkspaceStyleFiles = 500;
export const maxCssFileSizeBytes = 2 * 1024 * 1024;
export const maxCssContentLength = 500000;
export const requestTimeoutMs = 10000;
export const maxRedirects = 5;
export const batchSizeCssProcess = 10;

// 2. String -----------------------------------------------------------------------------------------------
export const fallbackMetaUrl = path.join("/", "index.js");
export const extensionConfigSection = "html-js-css-analyzer";

// 3. Array ------------------------------------------------------------------------------------------------
export const defaultAnalyzableExtensions: string[] = [
	"html", "htm", "js", "jsx", "ts", "tsx", "mjs", "css", "scss", "less", "sass"
];
export const supportedSchemes: string[] = [
	"file", "vscode-file", "vscode-remote"
];
export const excludedPathPatterns: string[] = [
	"/appdata/roaming/code/user/",
	"settings.json",
	"mcp.json"
];
export const supportedLanguages: vscode.DocumentSelector = [
	{language: "html"},
	{language: "css"},
	{language: "scss"},
	{language: "less"},
	{language: "sass"},
	{language: "javascript"},
	{language: "typescript"},
	{language: "javascriptreact"},
	{language: "typescriptreact"}
];

// 4. Regex ------------------------------------------------------------------------------------------------
export const regexExtensionValidation = /^[a-z0-9_-]{1,16}$/i;
export const regexRemoteUrl = /^https?:\/\//i;
export const regexWordRange = /[_a-zA-Z0-9-]+/;
export const regexEscapedChar = /\\(.)/g;