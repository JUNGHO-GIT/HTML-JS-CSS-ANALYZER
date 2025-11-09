// assets/scripts/filter.ts

import { vscode } from "@exportLibs";
import { getCssExcludePatterns, getAnalyzableExtensions, isUriExcludedByGlob } from "@exportScripts";
import { supportedSchemes, excludedPathPatterns } from "@exportConsts";

// -------------------------------------------------------------------------------------------------
const isValidScheme = (scheme: string): boolean => {
	return supportedSchemes.includes(scheme);
};

// -------------------------------------------------------------------------------------------------
const isExcludedPath = (fileName: string): boolean => {
	const normalizedPath = fileName.replace(/\\/g, "/").toLowerCase();
	return excludedPathPatterns.some((pattern: string) =>
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
	const isSchemeSupported = isValidScheme(document.uri.scheme);
	const isPathExcluded = isExcludedPath(document.fileName);
	const fileExtension = getFileExtension(document.fileName);
	const analyzableExtensions = getAnalyzableExtensions(document.uri);
	const isExtensionSupported = fileExtension && analyzableExtensions.includes(fileExtension);
	const excludePatterns = getCssExcludePatterns(document.uri);

	return !(!isSchemeSupported || isPathExcluded || !fileExtension || !isExtensionSupported || isUriExcludedByGlob(document.uri, excludePatterns));
};
