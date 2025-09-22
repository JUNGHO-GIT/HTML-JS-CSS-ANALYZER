// src/utils/glob.ts

import * as vscode from "vscode";

// -------------------------------------------------------------------------------------------------
export const globToRegExp = (glob: string): RegExp => {
	let s = glob.replace(/\\/g, "/");
	s = s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	s = s.replace(/\*\*/g, "§§DS§§");
	s = s.replace(/\*/g, "[^/]*");
	s = s.replace(/§§DS§§/g, ".*");
	s = s.replace(/\?/g, "[^/]");
	return new RegExp("^" + s + "$");
};

// -------------------------------------------------------------------------------------------------
export const isUriExcludedByGlob = (uri: vscode.Uri, patterns: string[]) => {
	const rel = uri.fsPath.replace(/\\/g, "/");
	for (const p of patterns) {
		const re = globToRegExp(p);
		if (re.test(rel)) {
			return true;
		}
	}
	return false;
};