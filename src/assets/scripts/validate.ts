// src/configs/validate.ts

import { vscode } from "@exportLibs";
import { SelectorType, type SelectorPos } from "@exportTypes";
import { logger } from "@exportScripts";
import { runHtmlHint, runJSHint } from "@exportLangs";
import { isAnalyzable } from "@exportScripts";
import { isHtmlHintEnabled, isCssHintEnabled, isJsHintEnabled, isTsHintEnabled } from "@exportConsts";

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
	return ["css", "scss", "less", "sass"].includes(id) || [".css", ".scss", ".less", ".sass"].some(ext => f.endsWith(ext));
};

// isJsLikeDoc -----------------------------------------------------------------------------------
const isJsLikeDoc = (doc: vscode.TextDocument) => {
	const id = doc.languageId;
	const f = doc.fileName.toLowerCase();
	return ["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(id) || [".js", ".jsx", ".ts", ".tsx", ".mjs"].some(ext => f.endsWith(ext));
};

// -------------------------------------------------------------------------------------------------
// 최적화된 정규표현식 (성능 개선 및 백트래킹 방지)
const TEMPLATE_LITERAL_REGEX = /\$\{[^}]*\}/g;
const VALID_CSS_IDENTIFIER_REGEX = /^[_a-zA-Z][-_a-zA-Z0-9]*$/;
const QUOTE_CHARS = ["'", '"', '`'] as const;
const BACKSLASH_REGEX = /\\/g;

// -------------------------------------------------------------------------------------------------
const normalizeToken = (token: string): string => {
	const normalized = !token ? "" : token.replace(TEMPLATE_LITERAL_REGEX, " ");
	const isQuoted = normalized && QUOTE_CHARS.some(quote => normalized.startsWith(quote) && normalized.endsWith(quote));
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
	[...all.values()].forEach(arr => arr.forEach(s => (s.type === SelectorType.CLASS ? knownClasses : knownIds).add(s.selector)));
	return {knownClasses, knownIds};
};

// -------------------------------------------------------------------------------------------------
// 강화된 정규표현식 패턴 (더 정확한 매칭 및 성능 개선)
const CLASS_ATTRIBUTE_REGEX = /(?:class|className)\s*[=:]\s*(["'`])((?:(?!\1).)*?)\1/gis;
const CLASSLIST_METHOD_REGEX = /classList\.(?:add|remove|toggle|contains)\s*\(([^)]+)\)/gis;
const STRING_LITERAL_REGEX = /(['"`])((?:(?!\1).)*?)\1/g;
const INNERHTML_REGEX = /\.(?:innerHTML|outerHTML)\s*[=:]\s*(["'`])((?:(?!\1)[\s\S])*?)\1/gis;
const INSERTADJACENTHTML_REGEX = /\.insertAdjacentHTML\s*\(\s*["'`][^"'`]*["'`]\s*,\s*(["'`])((?:(?!\1)[\s\S])*?)\1\s*\)/gis;
const TEMPLATE_LITERAL_HTML_REGEX = /(?:innerHTML|outerHTML)\s*[=:]\s*`((?:[^`\\]|\\.)*?)`/gis;
const QUERYSELECTOR_REGEX = /querySelector(?:All)?\s*\(\s*(["'`])((?:(?!\1)[\s\S])*?)\1\s*\)/gis;
const GETELEMENTBYID_REGEX = /getElementById\s*\(\s*(["'])((?:(?!\1)[^"'`])+)\1\s*\)/gis;

// -------------------------------------------------------------------------------------------------
const processClassAttribute = (
	match: RegExpMatchArray,
	document: vscode.TextDocument,
	knownClasses: Set<string>,
	diagnostics: vscode.Diagnostic[],
	usedClasses: Set<string>
): void => {
	const rawClasses = match[2];
	let searchOffset = 0;
	const tokens = rawClasses.split(/\s+/);

	for (const token of tokens) {
		const normalizedValue = normalizeToken(token).trim();
		if (!normalizedValue || !VALID_CSS_IDENTIFIER_REGEX.test(normalizedValue)) {
			searchOffset += token.length + 1;
			continue;
		}

		const baseOffset = match.index! + match[0].indexOf(rawClasses);
		const relativeIdx = rawClasses.indexOf(token, searchOffset);
		if (relativeIdx < 0) {
			searchOffset += token.length + 1;
			continue;
		}

		const tokenStart = baseOffset + relativeIdx;
		const innerIdx = token.indexOf(normalizedValue);
		const highlightStart = innerIdx >= 0 ? tokenStart + innerIdx : tokenStart;
		const highlightLen = normalizedValue.length;

		if (knownClasses.has(normalizedValue)) {
			usedClasses.add(normalizedValue);
		}
		else {
			diagnostics.push(new vscode.Diagnostic(makeRange(document, highlightStart, highlightLen), `CSS class '${normalizedValue}' not found`, vscode.DiagnosticSeverity.Warning));
		}

		searchOffset = relativeIdx + token.length;
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
	const argumentsString = match[1];
	let literalMatch: RegExpExecArray | null;

	while ((literalMatch = STRING_LITERAL_REGEX.exec(argumentsString))) {
		const normalizedValue = normalizeToken(literalMatch[2]).trim();

		if (!normalizedValue || !VALID_CSS_IDENTIFIER_REGEX.test(normalizedValue)) {
			continue;
		}

		if (knownClasses.has(normalizedValue)) {
			usedClasses.add(normalizedValue);
			continue;
		}

		const baseOffset = match.index! + match[0].indexOf(literalMatch[0]);
		const innerIdx = literalMatch[0].indexOf(literalMatch[2]);
		const tokenStart = baseOffset + (innerIdx >= 0 ? innerIdx : 0);
		diagnostics.push(new vscode.Diagnostic(makeRange(document, tokenStart, literalMatch[2].length), `CSS class '${normalizedValue}' not found`, vscode.DiagnosticSeverity.Warning));
	}
};

// -------------------------------------------------------------------------------------------------
const extractHtmlFromInnerHtml = (fullText: string): Array<{html: string, offset: number}> => {
	const results: Array<{html: string, offset: number}> = [];
	let match: RegExpExecArray | null;

	// innerHTML/outerHTML with quotes
	while ((match = INNERHTML_REGEX.exec(fullText))) {
		const htmlContent = match[2];
		const offset = match.index + match[0].indexOf(htmlContent);
		results.push({html: htmlContent, offset});
	}

	// insertAdjacentHTML
	while ((match = INSERTADJACENTHTML_REGEX.exec(fullText))) {
		const htmlContent = match[2];
		const offset = match.index + match[0].lastIndexOf(htmlContent);
		results.push({html: htmlContent, offset});
	}

	// Template literals with innerHTML/outerHTML
	while ((match = TEMPLATE_LITERAL_HTML_REGEX.exec(fullText))) {
		const htmlContent = match[1];
		const offset = match.index + match[0].indexOf(htmlContent);
		results.push({html: htmlContent, offset});
	}

	return results;
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

	// JS/TS 파일의 innerHTML 등에서 HTML 추출 및 처리
	const isJsTs = isJsLikeDoc(document);
	isJsTs && extractHtmlFromInnerHtml(fullText).forEach(({html, offset}) => {
		// 추출된 HTML에서 class 속성 검색
		const classRegex = /class\s*=\s*(["'])([^"']*)\1/gis;
		let classMatch: RegExpExecArray | null;
		while ((classMatch = classRegex.exec(html))) {
			const matchCopy = classMatch;
			const classes = matchCopy[2].split(/\s+/).filter(c => c.trim());
			classes.forEach(className => {
				const normalized = normalizeToken(className).trim();
				normalized && VALID_CSS_IDENTIFIER_REGEX.test(normalized) && (
					knownClasses.has(normalized) ? usedClassesFromMarkup.add(normalized) : diagnostics.push(
						new vscode.Diagnostic(
							makeRange(document, offset + matchCopy.index + matchCopy[0].indexOf(className), className.length),
							`CSS class '${normalized}' not found`,
							vscode.DiagnosticSeverity.Warning
						)
					)
				);
			});
		}

		// 추출된 HTML에서 id 속성 검색
		const idRegex = /\bid\s*=\s*(["'])([^"']*)\1/gis;
		let idMatch: RegExpExecArray | null;
		while ((idMatch = idRegex.exec(html))) {
			const matchCopy = idMatch;
			const idValue = normalizeToken(matchCopy[2]).trim();
			idValue && VALID_CSS_IDENTIFIER_REGEX.test(idValue) && (
				knownIds.has(idValue) ? usedIdsFromMarkup.add(idValue) : diagnostics.push(
					new vscode.Diagnostic(
						makeRange(document, offset + matchCopy.index + matchCopy[0].indexOf(idValue), idValue.length),
						`CSS id '#${idValue}' not found`,
						vscode.DiagnosticSeverity.Warning
					)
				)
			);
		}
	});

	// querySelector* selectors (개선된 정규표현식 사용)
	let qsMatch: RegExpExecArray | null;
	while ((qsMatch = QUERYSELECTOR_REGEX.exec(fullText))) {
		const q = qsMatch[2];
		const base = qsMatch.index + qsMatch[0].indexOf(q);
		const clsTok = /(^|[^\\])\.((?:\\.|[-_a-zA-Z0-9])+)/g;
		const idTok = /(^|[^\\])#((?:\\.|[-_a-zA-Z0-9])+)/g;
		let m: RegExpExecArray | null;
		while ((m = clsTok.exec(q))) {
			const val = m[2].replace(BACKSLASH_REGEX, "");
			val && (
				knownClasses.has(val) ? usedClassesFromMarkup.add(val) : (() => {
					const start = base + m.index + (m[1] ? 1 : 0) + 1;
					diagnostics.push(new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning));
				})()
			);
		}
		while ((m = idTok.exec(q))) {
			const val = m[2].replace(BACKSLASH_REGEX, "");
			val && (
				knownIds.has(val) ? usedIdsFromMarkup.add(val) : (() => {
					const start = base + m.index + (m[1] ? 1 : 0) + 1;
					diagnostics.push(new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS id '#${val}' not found`, vscode.DiagnosticSeverity.Warning));
				})()
			);
		}
	}

	// getElementById (개선된 정규표현식 사용)
	let gebi: RegExpExecArray | null;
	while ((gebi = GETELEMENTBYID_REGEX.exec(fullText))) {
		const id = gebi[2];
		id && (
			knownIds.has(id) ? usedIdsFromMarkup.add(id) : (() => {
				const m = gebi[0].match(/(["'])((?:(?!\1)[^"'`])+)\1/);
				const litLen = m ? m[0].length : id.length + 2;
				const start = gebi.index + (m ? gebi[0].indexOf(m[0]) : 0);
				diagnostics.push(new vscode.Diagnostic(makeRange(document, start, litLen), `CSS id '#${id}' not found`, vscode.DiagnosticSeverity.Warning));
			})()
		);
	}

	return {diagnostics, usedClassesFromMarkup, usedIdsFromMarkup};
};

// -------------------------------------------------------------------------------------------------
// CSS 본문 추출 (성능 최적화 및 메모리 효율 개선)
const fnExtractCssBodies = (fullText: string): string => {
	let depth = 0;
	let start = -1;
	let inBlockComment = false;
	let inLineComment = false;
	let inString = false;
	let stringChar = '';
	const bodies: string[] = [];

	for (let i = 0; i < fullText.length; i++) {
		const ch = fullText[i];
		const prev = i > 0 ? fullText[i - 1] : '';
		const next = fullText[i + 1] || '';

		if (inBlockComment) {
			if (prev === '*' && ch === '/') {
				inBlockComment = false;
			}
			continue;
		}

		if (inLineComment) {
			if (ch === '\n') {
				inLineComment = false;
			}
			continue;
		}

		if (inString) {
			if (ch === stringChar && prev !== '\\') {
				inString = false;
			}
			continue;
		}

		if (prev === '/' && ch === '*') {
			inBlockComment = true;
			continue;
		}

		if (prev === '/' && ch === '/') {
			inLineComment = true;
			continue;
		}

		if (ch === '"' || ch === "'" || ch === '`') {
			inString = true;
			stringChar = ch;
			continue;
		}

		if (!inBlockComment && !inString && !inLineComment) {
			if (ch === '{') {
				if (depth === 0) {
					start = i + 1;
				}
				depth++;
			}
			else if (ch === '}') {
				depth--;
				if (depth === 0 && start >= 0) {
					bodies.push(fullText.slice(start, i));
					start = -1;
				}
			}
		}
	}

	return bodies.join('\n');
};

// scanLocalUnused (성능 최적화) -----------------------------------------------------------------
const scanLocalUnused = async (doc: vscode.TextDocument, support: CssSupportLike, fullText: string) => {
	const diagnostics: vscode.Diagnostic[] = [];
	const sels = await support.getLocalDoc(doc);
	const bodyOnly = fnExtractCssBodies(fullText);
	const usedClasses = new Set<string>();
	const usedIds = new Set<string>();
	let m: RegExpExecArray | null;
	const clsUse = /(^|[^\\])\.((?:\\.|[-_a-zA-Z0-9])+)/g;
	while ((m = clsUse.exec(bodyOnly))) {
		usedClasses.add(m[2].replace(BACKSLASH_REGEX, ""));
	}
	const idUse = /(^|[^\\])#((?:\\.|[-_a-zA-Z0-9])+)/g;
	while ((m = idUse.exec(bodyOnly))) {
		usedIds.add(m[2].replace(BACKSLASH_REGEX, ""));
	}
	for (const s of sels) {
		const used = s.type === SelectorType.CLASS ? usedClasses.has(s.selector) : usedIds.has(s.selector);
		!used && (() => {
			const symbolOffset = 1;
			const base = doc.positionAt(s.index);
			const start = base.translate(0, symbolOffset);
			const end = start.translate(0, s.selector.length);
			const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? "." : "#") + s.selector}'`, vscode.DiagnosticSeverity.Warning);
			d.tags = [vscode.DiagnosticTag.Unnecessary];
			diagnostics.push(d);
		})();
	}
	return diagnostics;
};

// scanEmbeddedUnused (성능 최적화) --------------------------------------------------------------
const scanEmbeddedUnused = async (doc: vscode.TextDocument, support: CssSupportLike, usedClassesFromMarkup: Set<string>, usedIdsFromMarkup: Set<string>) => {
	const diagnostics: vscode.Diagnostic[] = [];
	const localDefs = await support.getLocalDoc(doc);
	for (const s of localDefs) {
		const used = s.type === SelectorType.CLASS ? usedClassesFromMarkup.has(s.selector) : usedIdsFromMarkup.has(s.selector);
		!used && (() => {
			const symbolOffset = 1;
			const base = doc.positionAt(s.index);
			const start = base.translate(0, symbolOffset);
			const end = start.translate(0, s.selector.length);
			const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? "." : "#") + s.selector}'`, vscode.DiagnosticSeverity.Warning);
			d.tags = [vscode.DiagnosticTag.Unnecessary];
			diagnostics.push(d);
		})();
	}
	return diagnostics;
};

// validateDocument (성능 최적화 및 메모리 효율 개선) -------------------------------------------
export const validateDocument = async (doc: vscode.TextDocument, support: CssSupportLike): Promise<vscode.Diagnostic[]> => {
	return !isAnalyzable(doc) ? [] : (async () => {
		logger(`debug`, `Validation`, `started: ${doc.fileName}`);
		const allStyles = await support.getStyles(doc);
		const {knownClasses, knownIds} = collectKnownSelectors(allStyles);
		const fullText = doc.getText();
		const isHtml = isHtmlDoc(doc);

		const {diagnostics: usageDiagnostics, usedClassesFromMarkup, usedIdsFromMarkup} = scanDocumentUsages(fullText, doc, knownClasses, knownIds);
		let unusedDiagnostics: vscode.Diagnostic[] = [];
		let lintDiagnostics: vscode.Diagnostic[] = [];

		isCssLikeDoc(doc) && isCssHintEnabled(doc.uri) && (unusedDiagnostics = await scanLocalUnused(doc, support, fullText));

		isHtml && (
			isCssHintEnabled(doc.uri) && (unusedDiagnostics = await scanEmbeddedUnused(doc, support, usedClassesFromMarkup, usedIdsFromMarkup)),
			isHtmlHintEnabled(doc.uri) && (() => {
				try {
					const htmlHintDiagnostics = runHtmlHint(doc);
					lintDiagnostics.push(...htmlHintDiagnostics);
				}
				catch (e: any) {
					logger(`error`, `HTMLHint`, `merge error: ${e?.message || e} in ${doc.fileName}`);
				}
			})()
		);

		isJsLikeDoc(doc) && (() => {
			const isTypeScript = doc.fileName.endsWith('.ts') || doc.fileName.endsWith('.tsx');
			const shouldLint = isTypeScript ? isTsHintEnabled(doc.uri) : isJsHintEnabled(doc.uri);

			shouldLint && (() => {
				try {
					const jsHintDiagnostics = runJSHint(doc);
					lintDiagnostics.push(...jsHintDiagnostics);
				}
				catch (e: any) {
					logger(`error`, `JSHint`, `merge error: ${e?.message || e} in ${doc.fileName}`);
				}
			})();
		})();

		return [...usageDiagnostics, ...unusedDiagnostics, ...lintDiagnostics];
	})();
};
