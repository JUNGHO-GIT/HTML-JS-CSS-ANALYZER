// filter.ts

import { vscode } from "@exportLibs";
import { getCssExcludePatterns, getAnalyzableExtensions } from "@exportConsts";
import { isUriExcludedByGlob } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
const SUPPORTED_SCHEMES = [ `file`, `vscode-file`, `vscode-remote` ] as const;
const EXCLUDED_PATH_PATTERNS = [
	`/appdata/roaming/code/user/`,
	`settings.json`,
	`mcp.json`,
] as const;

// -------------------------------------------------------------------------------------------------
const isValidScheme = (scheme: string): boolean => {
	return SUPPORTED_SCHEMES.includes(scheme as any);
};

// -------------------------------------------------------------------------------------------------
const isExcludedPath = (fileName: string): boolean => {
	const normalizedPath = fileName.replace(/\\/g, `/`).toLowerCase();

	return EXCLUDED_PATH_PATTERNS.some(pattern => pattern.startsWith(`/`) ? normalizedPath.includes(pattern) : normalizedPath.endsWith(pattern)
	);
};

// -------------------------------------------------------------------------------------------------
const getFileExtension = (fileName: string): string | null => {
	const normalizedPath = fileName.replace(/\\/g, `/`).toLowerCase();
	const lastDotIndex = normalizedPath.lastIndexOf(`.`);

	return lastDotIndex > 0 && lastDotIndex < normalizedPath.length - 1
		? normalizedPath.slice(lastDotIndex + 1)
		: null;
};

// -------------------------------------------------------------------------------------------------
export const isAnalyzable = (document: vscode.TextDocument): boolean => {
	if (!isValidScheme(document.uri.scheme)) {
		return false;
	}

	if (isExcludedPath(document.fileName)) {
		return false;
	}

	const fileExtension = getFileExtension(document.fileName);
	if (!fileExtension) {
		return false;
	}

	const analyzableExtensions = getAnalyzableExtensions(document.uri);
	if (!analyzableExtensions.includes(fileExtension)) {
		return false;
	}

	const excludePatterns = getCssExcludePatterns(document.uri);
	return !isUriExcludedByGlob(document.uri, excludePatterns);
};
