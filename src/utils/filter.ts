// src/utils/filter.ts

import * as vscode from "vscode";
import {getCssExcludePatterns} from "../configs/setting.js";
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
	return /(\.html?|\.jsx?|\.tsx?|\.css|\.scss)$/.test(file) && !isUriExcludedByGlob(doc.uri, getCssExcludePatterns(doc.uri));
};
