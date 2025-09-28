// src/configs/validate.ts

import * as vscode from "vscode";
import {SelectorType, type SelectorPos} from "../langs/types/common.js";
import {log} from "../utils/logger.js";
import {runHtmlHint} from "../langs/html/htmlHint.js";
import {runJSHint} from "../langs/js/jsHint.js";
import {isAnalyzable} from "../utils/filter.js";
import {isHtmlHintEnabled, isCssHintEnabled, isJsHintEnabled, isTsHintEnabled} from "./setting.js";

// -------------------------------------------------------------------------------------------------
export interface CssSupportLike {
	getStyles(doc: vscode.TextDocument): Promise<Map<string, SelectorPos[]>>;
	getLocalDoc(doc: vscode.TextDocument): Promise<SelectorPos[]>;
}

// isHtmlDoc -------------------------------------------------------------------------------------
const isHtmlDoc = (doc: vscode.TextDocument) => /\.html?$/i.test(doc.fileName) || doc.languageId === "html";

// isCssLikeDoc ----------------------------------------------------------------------------------
const isCssLikeDoc = (doc: vscode.TextDocument) => {
	const id = doc.languageId;
	const f = doc.fileName.toLowerCase();
	return id === "css" || id === "scss" || id === "less" || id === "sass" ||
		f.endsWith(".css") || f.endsWith(".scss") || f.endsWith(".less") || f.endsWith(".sass");
};

// isJsLikeDoc -----------------------------------------------------------------------------------
const isJsLikeDoc = (doc: vscode.TextDocument) => {
	const id = doc.languageId;
	const f = doc.fileName.toLowerCase();
	return id === "javascript" || id === "typescript" || id === "javascriptreact" || id === "typescriptreact" ||
		f.endsWith(".js") || f.endsWith(".jsx") || f.endsWith(".ts") || f.endsWith(".tsx") || f.endsWith(".mjs");
};

// -------------------------------------------------------------------------------------------------
const TEMPLATE_LITERAL_REGEX = /\$\{[^}]*\}/g;
const VALID_CSS_IDENTIFIER_REGEX = /^[_a-zA-Z][-_a-zA-Z0-9]*$/;
const QUOTE_CHARS = ["'", '"', '`'] as const;

// -------------------------------------------------------------------------------------------------
const normalizeToken = (token: string): string => {
	if (!token) {
		return "";
	}

	// 템플릿 리터럴의 표현식 제거
	let normalized = token.replace(TEMPLATE_LITERAL_REGEX, " ");

	// 따옴표로 둘러싸인 경우 제거
	const isQuoted = QUOTE_CHARS.some(quote =>
		normalized.startsWith(quote) && normalized.endsWith(quote)
	);

	return isQuoted ? normalized.slice(1, -1) : normalized;
};

// makeRange -------------------------------------------------------------------------------------
const makeRange = (doc: vscode.TextDocument, startIdx: number, length: number) => {
	const endIdx = startIdx + length;
	return new vscode.Range(doc.positionAt(startIdx), doc.positionAt(endIdx));
};

// collectKnownSelectors -------------------------------------------------------------------------
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

// -------------------------------------------------------------------------------------------------
const CLASS_ATTRIBUTE_REGEX = /(class|className)\s*[=:]\s*(["'`])([\s\S]*?)\2/gis;
const CLASSLIST_METHOD_REGEX = /classList\.(add|remove|toggle|contains)\s*\(([^)]*)\)/gis;
const STRING_LITERAL_REGEX = /(['"`])([^'"`]*?)\1/g;

// -------------------------------------------------------------------------------------------------
const processClassAttribute = (
	match: RegExpMatchArray,
	document: vscode.TextDocument,
	knownClasses: Set<string>,
	diagnostics: vscode.Diagnostic[],
	usedClasses: Set<string>
): void => {
	const rawClasses = match[3];
	let cursor = 0;
	const tokens = rawClasses.split(/\s+/);

	for (const token of tokens) {
		const normalizedValue = normalizeToken(token).trim();

		if (normalizedValue && VALID_CSS_IDENTIFIER_REGEX.test(normalizedValue)) {
			const isClassKnown = knownClasses.has(normalizedValue);

			if (!isClassKnown) {
				const baseOffset = match.index! + match[0].indexOf(rawClasses);
				const tokenStart = baseOffset + rawClasses.indexOf(token, cursor);
				const diagnostic = new vscode.Diagnostic(
					makeRange(document, tokenStart, token.length),
					`CSS class '${normalizedValue}' not found`,
					vscode.DiagnosticSeverity.Warning
				);
				diagnostics.push(diagnostic);
			}
			else {
				usedClasses.add(normalizedValue);
			}
		}

		cursor += token.length + 1;
	}
};

// -------------------------------------------------------------------------------------------------
const processClassListCall = (
	match: RegExpMatchArray,
	document: vscode.TextDocument,
	knownClasses: Set<string>,
	diagnostics: vscode.Diagnostic[],
	usedClasses: Set<string>
): void => {
	const argumentsString = match[2];
	let literalMatch: RegExpExecArray | null;

	while ((literalMatch = STRING_LITERAL_REGEX.exec(argumentsString))) {
		const normalizedValue = normalizeToken(literalMatch[2]).trim();

		if (normalizedValue && VALID_CSS_IDENTIFIER_REGEX.test(normalizedValue)) {
			const isClassKnown = knownClasses.has(normalizedValue);

			if (!isClassKnown) {
				const tokenStart = match.index! + match[0].indexOf(literalMatch[0]);
				const diagnostic = new vscode.Diagnostic(
					makeRange(document, tokenStart, literalMatch[0].length),
					`CSS class '${normalizedValue}' not found`,
					vscode.DiagnosticSeverity.Warning
				);
				diagnostics.push(diagnostic);
			}
			else {
				usedClasses.add(normalizedValue);
			}
		}
	}
};

// -------------------------------------------------------------------------------------------------
const scanDocumentUsages = (
	fullText: string,
	document: vscode.TextDocument,
	knownClasses: Set<string>,
	knownIds: Set<string>
) => {
	const diagnostics: vscode.Diagnostic[] = [];
	const usedClassesFromMarkup = new Set<string>();
	const usedIdsFromMarkup = new Set<string>();

	// class / className 속성 처리
	let classAttributeMatch: RegExpExecArray | null;
	while ((classAttributeMatch = CLASS_ATTRIBUTE_REGEX.exec(fullText))) {
		processClassAttribute(classAttributeMatch, document, knownClasses, diagnostics, usedClassesFromMarkup);
	}

	// classList 메서드 호출 처리
	let classListMatch: RegExpExecArray | null;
	while ((classListMatch = CLASSLIST_METHOD_REGEX.exec(fullText))) {
		processClassListCall(classListMatch, document, knownClasses, diagnostics, usedClassesFromMarkup);
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
					diagnostics.push(new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning));
				}
				knownClasses.has(val) && usedClassesFromMarkup.add(val);
			}
		}
		while ((m = idTok.exec(q))) {
			const val = m[2].replace(/\\/g, "");
			if (val) {
				if (!knownIds.has(val)) {
					const start = base + m.index + (m[1] ? 1 : 0) + 1;
					diagnostics.push(new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS id '#${val}' not found`, vscode.DiagnosticSeverity.Warning));
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
				diagnostics.push(new vscode.Diagnostic(makeRange(document, start, litLen), `CSS id '#${id}' not found`, vscode.DiagnosticSeverity.Warning));
			} else {
				usedIdsFromMarkup.add(id);
			}
		}
	}

	return {diagnostics, usedClassesFromMarkup, usedIdsFromMarkup};
};

// scanLocalUnused -------------------------------------------------------------------------------
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
					i++;
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
				i++;
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

// scanEmbeddedUnused ----------------------------------------------------------------------------
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

// validateDocument ------------------------------------------------------------------------------
export const validateDocument = async (doc: vscode.TextDocument, support: CssSupportLike): Promise<vscode.Diagnostic[]> => {
	if (!isAnalyzable(doc)) {
		return [];
	}
	log("debug", `[Html-Css-Js-Analyzer] Validation started: ${doc.fileName}`);
	const allStyles = await support.getStyles(doc);
	const {knownClasses, knownIds} = collectKnownSelectors(allStyles);
	const fullText = doc.getText();
	const isHtml = isHtmlDoc(doc);

	const {diagnostics: usageDiagnostics, usedClassesFromMarkup, usedIdsFromMarkup} = scanDocumentUsages(fullText, doc, knownClasses, knownIds);
	let unusedDiagnostics: vscode.Diagnostic[] = [];
	let lintDiagnostics: vscode.Diagnostic[] = [];

	if (isCssLikeDoc(doc) && isCssHintEnabled(doc.uri)) {
		unusedDiagnostics = await scanLocalUnused(doc, support, fullText);
	}
	else if (isHtml) {
		if (isCssHintEnabled(doc.uri)) {
			unusedDiagnostics = await scanEmbeddedUnused(doc, support, usedClassesFromMarkup, usedIdsFromMarkup);
		}
		if (isHtmlHintEnabled(doc.uri)) {
			try {
				const htmlHintDiagnostics = runHtmlHint(doc);
				lintDiagnostics.push(...htmlHintDiagnostics);
			} catch (e: any) {
				log("error", `[Html-Css-Js-Analyzer] HTMLHint merge error: ${e?.message || e} in ${doc.fileName}`);
			}
		}
	}
	else if (isJsLikeDoc(doc)) {
		const isTypeScript = doc.fileName.endsWith('.ts') || doc.fileName.endsWith('.tsx');
		const shouldLint = isTypeScript ? isTsHintEnabled(doc.uri) : isJsHintEnabled(doc.uri);

		if (shouldLint) {
			try {
				const jsHintDiagnostics = runJSHint(doc);
				lintDiagnostics.push(...jsHintDiagnostics);
			} catch (e: any) {
				log("error", `[Html-Css-Js-Analyzer] JSHint merge error: ${e?.message || e} in ${doc.fileName}`);
			}
		}
	}

	return [...usageDiagnostics, ...unusedDiagnostics, ...lintDiagnostics];
};
