// src/utils/filter.ts

import * as vscode from "vscode";
import {getCssExcludePatterns} from "../configs/setting.js";
import {isUriExcludedByGlob} from "./glob.js";

// 단순화: 스킴/언어 설정 제거, exclude 글롭만 사용 (설정 섹션: Html-Js-Css-Analyzer)
export const isAnalyzable = (doc: vscode.TextDocument): boolean => {
	// 스킴 필터
	const scheme = doc.uri.scheme;
	if (scheme !== "file" && scheme !== "vscode-file") {
		return false;
	}
	const file = doc.fileName.replace(/\\/g, "/").toLowerCase();
	// VS Code 사용자 설정, 확장 출력 등 제외
	if (file.includes("/appdata/roaming/code/user/") || file.endsWith("settings.json") || file.endsWith("mcp.json")) {
		return false;
	}
	// 확장자 필터 (분석 대상: html, js, ts, css, scss)
	if (!/(\.html?|\.jsx?|\.tsx?|\.css|\.scss)$/.test(file)) {
		return false;
	}
	if (isUriExcludedByGlob(doc.uri, getCssExcludePatterns(doc.uri))) {
		return false;
	}
	return true;
};
