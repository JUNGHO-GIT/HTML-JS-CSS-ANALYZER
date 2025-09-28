// src/utils/filter.ts

import * as vscode from "vscode";
import {getCssExcludePatterns, getAnalyzableExtensions} from "../configs/setting.js";
import {isUriExcludedByGlob} from "./glob.js";

// -------------------------------------------------------------------------------------------------
const SUPPORTED_SCHEMES = ["file", "vscode-file"] as const;
const EXCLUDED_PATH_PATTERNS = [
	"/appdata/roaming/code/user/",
	"settings.json",
	"mcp.json"
] as const;

// -------------------------------------------------------------------------------------------------
const isValidScheme = (scheme: string): boolean => {
	return SUPPORTED_SCHEMES.includes(scheme as any);
};

// -------------------------------------------------------------------------------------------------
const isExcludedPath = (fileName: string): boolean => {
	const normalizedPath = fileName.replace(/\\/g, "/").toLowerCase();

	return EXCLUDED_PATH_PATTERNS.some(pattern =>
		pattern.startsWith("/") ? normalizedPath.includes(pattern) : normalizedPath.endsWith(pattern)
	);
};

// -------------------------------------------------------------------------------------------------
const getFileExtension = (fileName: string): string | null => {
	const normalizedPath = fileName.replace(/\\/g, "/").toLowerCase();
	const lastDotIndex = normalizedPath.lastIndexOf('.');

	return lastDotIndex > 0 && lastDotIndex < normalizedPath.length - 1
		? normalizedPath.slice(lastDotIndex + 1)
		: null;
};

// -------------------------------------------------------------------------------------------------
export const isAnalyzable = (document: vscode.TextDocument): boolean => {
	// 스키마 검증
	const isSchemeSupported = isValidScheme(document.uri.scheme);
	if (!isSchemeSupported) {
		return false;
	}

	// 제외 경로 검증
	const isPathExcluded = isExcludedPath(document.fileName);
	if (isPathExcluded) {
		return false;
	}

	// 파일 확장자 검증
	const fileExtension = getFileExtension(document.fileName);
	if (!fileExtension) {
		return false;
	}

	const analyzableExtensions = getAnalyzableExtensions(document.uri);
	const isExtensionSupported = analyzableExtensions.includes(fileExtension);
	if (!isExtensionSupported) {
		return false;
	}

	// Glob 패턴 제외 검증
	const excludePatterns = getCssExcludePatterns(document.uri);
	return !isUriExcludedByGlob(document.uri, excludePatterns);
};
