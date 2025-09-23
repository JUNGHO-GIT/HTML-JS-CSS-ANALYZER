// src/utils/filter.ts

import * as vscode from "vscode";
import {getCssExcludePatterns, getAnalyzableExtensions} from "../configs/setting.js";
import {isUriExcludedByGlob} from "./glob.js";

// -------------------------------------------------------------------------------------------------
// - 분석 가능 여부 확인
export const isAnalyzable = (doc: vscode.TextDocument): boolean => {
	const scheme = doc.uri.scheme;
	if (scheme !== "file" && scheme !== "vscode-file") {
		return false;
	}
	const file = doc.fileName.replace(/\\/g, "/").toLowerCase();
	if (file.includes("/appdata/roaming/code/user/") || file.endsWith("settings.json") || file.endsWith("mcp.json")) {
		return false;
	}
	const exts = getAnalyzableExtensions(doc.uri);
	// 뒤에서부터 '.' 찾고 확장자 추출
	const idx = file.lastIndexOf('.') + 1;
	if (idx <= 0 || idx >= file.length) {
		return false;
	}
	const ext = file.slice(idx);
	return exts.includes(ext) && !isUriExcludedByGlob(doc.uri, getCssExcludePatterns(doc.uri));
};
