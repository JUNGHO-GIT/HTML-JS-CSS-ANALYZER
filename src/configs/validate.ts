// src/configs/validate.ts

import * as vscode from "vscode";
import {SelectorType, type SelectorPos} from "../langs/types/common.js";
import {log} from "../utils/logger.js";
import {runHtmlHint} from "../langs/html/htmlHint.js";
import {isAnalyzable} from "../utils/filter.js";

// -------------------------------------------------------------------------------------------------
export interface CssSupportLike {
	getStyles(doc: vscode.TextDocument): Promise<Map<string, SelectorPos[]>>;
	getLocalDoc(doc: vscode.TextDocument): Promise<SelectorPos[]>;
}

// isHtmlDoc ---------------------------------------------------------------
const isHtmlDoc = (doc: vscode.TextDocument) => /\.html?$/i.test(doc.fileName) || doc.languageId === "html";

// isCssLikeDoc ------------------------------------------------------------
const isCssLikeDoc = (doc: vscode.TextDocument) => {
	const id = doc.languageId;
	const f = doc.fileName.toLowerCase();
	return id === "css" || id === "scss" || id === "less" || id === "sass" ||
		f.endsWith(".css") || f.endsWith(".scss") || f.endsWith(".less") || f.endsWith(".sass");
};

// normalizeToken ----------------------------------------------------------
const normalizeToken = (t: string) => {
	if (!t) {
		return "";
	}
	let s = t.replace(/\$\{[^}]*\}/g, " ");
	if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith("\"") && s.endsWith("\"")) || (s.startsWith("`") && s.endsWith("`"))) {
		s = s.slice(1, -1);
	}
	return s;
};

// makeRange ---------------------------------------------------------------
const makeRange = (doc: vscode.TextDocument, startIdx: number, length: number) => {
	const endIdx = startIdx + length;
	return new vscode.Range(doc.positionAt(startIdx), doc.positionAt(endIdx));
};

// collectKnownSelectors ---------------------------------------------------
const collectKnownSelectors = (all: Map<string, SelectorPos[]>) => {
	const knownClasses = new Set<string>();
	const knownIds = new Set<string>();
	for (const arr of all.values()) {
		for (const s of arr) {
			(s.type === SelectorType.CLASS ? knownClasses : knownIds).add(s.selector);
		}
	}
	return {knownClasses, knownIds};
};

// scanDocumentUsages ------------------------------------------------------
const scanDocumentUsages = (fullText: string, doc: vscode.TextDocument, knownClasses: Set<string>, knownIds: Set<string>) => {
	const diagnostics: vscode.Diagnostic[] = [];
	const usedClassesFromMarkup = new Set<string>();
	const usedIdsFromMarkup = new Set<string>();

	// class / className attributes
	const classAttrRegex = /(class|className)\s*[=:]\s*(["'`])([\s\S]*?)\2/gis;
	let classAttrMatch: RegExpExecArray | null;
	while ((classAttrMatch = classAttrRegex.exec(fullText))) {
		const raw = classAttrMatch[3];
		let cursor = 0;
		const tokens = raw.split(/\s+/);
		for (const t of tokens) {
			const val = normalizeToken(t).trim();
			if (val) {
				if (/^[_a-zA-Z][-_a-zA-Z0-9]*$/.test(val) && !knownClasses.has(val)) {
					const baseOffset = classAttrMatch.index + classAttrMatch[0].indexOf(raw);
					const start = baseOffset + raw.indexOf(t, cursor);
					diagnostics.push(new vscode.Diagnostic(makeRange(doc, start, t.length), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning));
				}
				knownClasses.has(val) && usedClassesFromMarkup.add(val);
			}
			cursor += t.length + 1;
		}
	}

	// classList.* calls
	const classListRegex = /classList\.(add|remove|toggle|contains)\s*\(([^)]*)\)/gis;
	let clMatch: RegExpExecArray | null;
	while ((clMatch = classListRegex.exec(fullText))) {
		const args = clMatch[2];
		const litRegex = /(['"`])([^'"`]*?)\1/g;
		let lit: RegExpExecArray | null;
		while ((lit = litRegex.exec(args))) {
			const val = normalizeToken(lit[2]).trim();
			if (val) {
				if (/^[_a-zA-Z][-_a-zA-Z0-9]*$/.test(val) && !knownClasses.has(val)) {
					const start = clMatch.index + clMatch[0].indexOf(lit[0]);
					diagnostics.push(new vscode.Diagnostic(makeRange(doc, start, lit[0].length), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning));
				}
				knownClasses.has(val) && usedClassesFromMarkup.add(val);
			}
		}
	}

	// querySelector* selectors
	const qsRegex = /querySelector(All)?\s*\(\s*(["'`])([\s\S]*?)\2\s*\)/gis;
	let qsMatch: RegExpExecArray | null;
	while ((qsMatch = qsRegex.exec(fullText))) {
		const q = qsMatch[3];
		const base = qsMatch.index + qsMatch[0].indexOf(q);
		const clsTok = /(^|[^\\])\.((?:\\.|[-_a-zA-Z0-9])+)/g;
		const idTok = /(^|[^\\])#((?:\\.|[-_a-zA-Z0-9])+)/g;
		let m: RegExpExecArray | null;
		while ((m = clsTok.exec(q))) {
			const val = m[2].replace(/\\/g, "");
			if (val) {
				if (!knownClasses.has(val)) {
					const start = base + m.index + (m[1] ? 1 : 0) + 1;
					diagnostics.push(new vscode.Diagnostic(makeRange(doc, start, val.length + 1), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning));
				}
				knownClasses.has(val) && usedClassesFromMarkup.add(val);
			}
		}
		while ((m = idTok.exec(q))) {
			const val = m[2].replace(/\\/g, "");
			if (val) {
				if (!knownIds.has(val)) {
					const start = base + m.index + (m[1] ? 1 : 0) + 1;
					diagnostics.push(new vscode.Diagnostic(makeRange(doc, start, val.length + 1), `CSS id '#${val}' not found`, vscode.DiagnosticSeverity.Warning));
				}
				knownIds.has(val) && usedIdsFromMarkup.add(val);
			}
		}
	}

	// getElementById
	const gebiRegex = /getElementById\s*\(\s*(["'])([^"'`]+)\1\s*\)/gis;
	let gebi: RegExpExecArray | null;
	while ((gebi = gebiRegex.exec(fullText))) {
		const id = gebi[2];
		if (id) {
			if (!knownIds.has(id)) {
				const m = gebi[0].match(/(["'])([^"'`]+)\1/);
				const litLen = m ? m[0].length : id.length + 2;
				const start = gebi.index + (m ? gebi[0].indexOf(m[0]) : 0);
				diagnostics.push(new vscode.Diagnostic(makeRange(doc, start, litLen), `CSS id '#${id}' not found`, vscode.DiagnosticSeverity.Warning));
			} else {
				usedIdsFromMarkup.add(id);
			}
		}
	}

	return {diagnostics, usedClassesFromMarkup, usedIdsFromMarkup};
};

// scanLocalUnused ---------------------------------------------------------
const scanLocalUnused = async (doc: vscode.TextDocument, support: CssSupportLike, fullText: string) => {
	const diagnostics: vscode.Diagnostic[] = [];
	const sels = await support.getLocalDoc(doc);
	// 룰 본문(body)만 추출하여 사용 토큰을 찾기 (선언 prelude 영역 중복 제거)
	const bodyOnly = (() => {
		let depth = 0;
		let start = -1;
		let inComment = false;
		let inString = false;
		let stringChar = '';
		const bodies: string[] = [];
		for (let i = 0; i < fullText.length; i++) {
			const ch = fullText[i];
			const nextCh = fullText[i + 1] || '';
			if (inComment) {
				if (ch === '*' && nextCh === '/') {
					inComment = false;
					i++; // skip '/'
				}
				continue;
			}
			if (inString) {
				if (ch === stringChar && fullText[i - 1] !== '\\') {
					inString = false;
				}
				continue;
			}
			if (ch === '/' && nextCh === '*') {
				inComment = true;
				i++; // skip '*'
				continue;
			}
			if ((ch === '"' || ch === "'") && fullText[i - 1] !== '\\') {
				inString = true;
				stringChar = ch;
				continue;
			}
			if (ch === '{') {
				if (depth === 0) {
					start = i + 1;
				}
				depth++;
			} else if (ch === '}') {
				depth--;
				if (depth === 0 && start >= 0) {
					bodies.push(fullText.slice(start, i));
					start = -1;
				}
			}
		}
		return bodies.join('\n');
	})();
	const usedClasses = new Set<string>();
	const usedIds = new Set<string>();
	let m: RegExpExecArray | null;
	const clsUse = /(^|[^\\])\.((?:\\.|[-_a-zA-Z0-9])+)/g;
	while ((m = clsUse.exec(bodyOnly))) {
		usedClasses.add(m[2].replace(/\\/g, ""));
	}
	const idUse = /(^|[^\\])#((?:\\.|[-_a-zA-Z0-9])+)/g;
	while ((m = idUse.exec(bodyOnly))) {
		usedIds.add(m[2].replace(/\\/g, ""));
	}
	for (const s of sels) {
		const used = s.type === SelectorType.CLASS ? usedClasses.has(s.selector) : usedIds.has(s.selector);
		if (!used) {
			const symbolOffset = 1;
			const base = doc.positionAt(s.index);
			const start = base.translate(0, symbolOffset);
			const end = start.translate(0, s.selector.length);
			const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? "." : "#") + s.selector}'`, vscode.DiagnosticSeverity.Warning);
			d.tags = [vscode.DiagnosticTag.Unnecessary];
			diagnostics.push(d);
		}
	}
	return diagnostics;
};

// scanEmbeddedUnused ------------------------------------------------------
const scanEmbeddedUnused = async (doc: vscode.TextDocument, support: CssSupportLike, usedClassesFromMarkup: Set<string>, usedIdsFromMarkup: Set<string>) => {
	const diagnostics: vscode.Diagnostic[] = [];
	const localDefs = await support.getLocalDoc(doc);
	for (const s of localDefs) {
		const used = s.type === SelectorType.CLASS ? usedClassesFromMarkup.has(s.selector) : usedIdsFromMarkup.has(s.selector);
		if (!used) {
			const symbolOffset = 1;
			const base = doc.positionAt(s.index);
			const start = base.translate(0, symbolOffset);
			const end = start.translate(0, s.selector.length);
			const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? "." : "#") + s.selector}'`, vscode.DiagnosticSeverity.Warning);
			d.tags = [vscode.DiagnosticTag.Unnecessary];
			diagnostics.push(d);
		}
	}
	return diagnostics;
};

// validateDocument --------------------------------------------------------
export const validateDocument = async (doc: vscode.TextDocument, support: CssSupportLike): Promise<vscode.Diagnostic[]> => {
	if (!isAnalyzable(doc)) {
		return [];
	}
	log("debug", `validate start: ${doc.fileName}`);
	const allStyles = await support.getStyles(doc);
	const {knownClasses, knownIds} = collectKnownSelectors(allStyles);
	const fullText = doc.getText();
	const isHtml = isHtmlDoc(doc);

	const {diagnostics: usageDiagnostics, usedClassesFromMarkup, usedIdsFromMarkup} = scanDocumentUsages(fullText, doc, knownClasses, knownIds);
	let unusedDiagnostics: vscode.Diagnostic[] = [];
	if (isCssLikeDoc(doc)) {
		unusedDiagnostics = await scanLocalUnused(doc, support, fullText);
	}
	else if (isHtml) {
		unusedDiagnostics = await scanEmbeddedUnused(doc, support, usedClassesFromMarkup, usedIdsFromMarkup);
		try {
			const htmlHintDiagnostics = runHtmlHint(doc);
			unusedDiagnostics.push(...htmlHintDiagnostics);
		} catch (e: any) {
			log("error", `htmlhint merge error: ${e?.message || e} in ${doc.fileName}`);
		}
	}
	return [...usageDiagnostics, ...unusedDiagnostics];
};
