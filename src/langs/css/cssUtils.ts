/**
 * @file cssUtils.ts
 * @since 2025-11-26
 * @description CSS 유틸리티 함수 (파일 읽기, 원격 가져오기, 헬퍼 함수)
 */

import { vscode, fs, path, https, http } from "@exportLibs";
import { type SelectorPos, SelectorType } from "@exportTypes";
import { parseSelectors, cacheGet, cacheSet } from "@exportLangs";
import { logger, isUriExcludedByGlob, withPerformanceMonitoring, resourceLimiter } from "@exportScripts";
import { getAnalyzableExtensions } from "@exportConsts";
import type { FetchResponse, CssSupportLike } from "@langs/css/cssType";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 500000;
const MAX_WORKSPACE_FILES = 500;
const BATCH_SIZE = 10;
const REQUEST_TIMEOUT_MS = 10000;
const TEMPLATE_LITERAL_REGEX = /\$\{[^}]*\}/g;
const VALID_CSS_IDENTIFIER_REGEX = /^[_a-zA-Z][-_a-zA-Z0-9]*$/;
const QUOTE_CHARS = [ `'`, `"`, `\`` ] as const;
const BACKSLASH_REGEX = /\\/g;
const CLASS_ATTRIBUTE_REGEX = /(?:class|className)\s*[=:]\s*(["'`])((?:(?!\1).)*?)\1/gis;
const CLASSLIST_METHOD_REGEX = /classList\.(?:add|remove|toggle|contains)\s*\(([^)]+)\)/gis;
const STRING_LITERAL_REGEX = /(['"`])((?:(?!\1).)*?)\1/g;
const QUERYSELECTOR_REGEX = /querySelector(?:All)?\s*\(\s*(["'`])((?:(?!\1)[\s\S])*?)\1\s*\)/gis;
const GETELEMENTBYID_REGEX = /getElementById\s*\(\s*(["'])((?:(?!\1)[^"'`])+)\1\s*\)/gis;
const REMOTE_URL_REGEX = /^https?:\/\//i;

// -------------------------------------------------------------------------------------------------
// MODULE STATE
// -------------------------------------------------------------------------------------------------
let workspaceCssFiles: string[] | null = null;

// -------------------------------------------------------------------------------------------------
// FETCH UTILITIES
// -------------------------------------------------------------------------------------------------
const fnFetchWithNativeFetch = async (url: string): Promise<string> => {
	const response = await (globalThis as any).fetch(url) as FetchResponse;

	!response.ok && (() => {
		const statusInfo = response?.statusText ?? `HTTP ${response?.status ?? `unknown`}`;
		throw new Error(statusInfo);
	})();

	return await response.text();
};

// -------------------------------------------------------------------------------------------------
const fnFetchWithNodeHttp = async (url: string, redirectsRemaining = 5): Promise<string> => {
	return new Promise<string>((resolve, reject) => {
		const httpLib = url.startsWith(`https`) ? https : http;

		const request = httpLib.get(url, (response) => {
			const status = response.statusCode ?? 0;

			status >= 300 && status < 400 && response.headers?.location && (
				redirectsRemaining > 0 ? (() => {
					try {
						const location = response.headers.location!;
						const newUrl = location.startsWith(`http`) ? location : new URL(location, url).toString();
						response.resume();
						resolve(fnFetchWithNodeHttp(newUrl, redirectsRemaining - 1));
					}
					catch (e: unknown) {
						response.resume();
						reject(new Error(`Invalid redirect location: ${response.headers.location}`));
					}
				})() : (
					response.resume(),
					reject(new Error(`Too many redirects`))
				),
				void 0
			);

			let data = ``;
			response.setEncoding && response.setEncoding(`utf8`);

			response.on(`data`, (chunk: string) => { data += chunk; });

			response.on(`end`, () => {
				const isSuccessStatus = status >= 200 && status < 300;
				isSuccessStatus ? resolve(data) : reject(new Error(`HTTP ${status}`));
			});
		});

		request.on(`error`, (err: Error) => { reject(err); });
		request.setTimeout && request.setTimeout(REQUEST_TIMEOUT_MS, () => {
			try { request.abort(); }
			catch (_e) { /* ignore */ }
			reject(new Error(`Request timeout`));
		});
	});
};

// -------------------------------------------------------------------------------------------------
export const fetchCssContent = async (url: string): Promise<string> => {
	try {
		return typeof (globalThis as any).fetch === `function` ? (
			await fnFetchWithNativeFetch(url)
		) : (
			await fnFetchWithNodeHttp(url)
		);
	}
	catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		logger(`error`, `file fetch failed (${url}): ${errorMessage}`);
		return ``;
	}
};

// -------------------------------------------------------------------------------------------------
// FILE READER UTILITIES
// -------------------------------------------------------------------------------------------------
export const readSelectorsFromFsPath = async (fsPath: string): Promise<SelectorPos[]> => {
	try {
		const stat = await fs.promises.stat(fsPath);
		const key = `fs://${fsPath}`;
		const cached = cacheGet(key);
		return cached && cached.version === stat.mtimeMs ? cached.data : (async () => {
			return stat.size > MAX_FILE_SIZE ? (
				logger(`debug`, `file skipped for performance: ${fsPath} (${Math.round(stat.size / 1024 / 1024 * 100) / 100}MB)`),
				[]
			) : (async () => {
				const content = await fs.promises.readFile(fsPath, `utf8`);
				return content.length > MAX_CONTENT_LENGTH ? (
					logger(`debug`, `content sampled: ${fsPath}`),
					(() => {
						const parsed = parseSelectors(content.substring(0, MAX_CONTENT_LENGTH));
						cacheSet(key, { version: stat.mtimeMs, data: parsed });
						return parsed;
					})()
				) : (() => {
					const parsed = parseSelectors(content);
					cacheSet(key, { version: stat.mtimeMs, data: parsed });
					return parsed;
				})();
			})();
		})();
	}
	catch (e: unknown) {
		const err = e as { code?: string; message?: string };
		return err?.code === `ENOMEM` || err?.message?.includes(`out of memory`) ? (
			logger(`error`, `limit reached processing: ${fsPath}`),
			[]
		) : (
			logger(`error`, `read from file failed: ${fsPath} -> ${err?.message ?? e}`),
			[]
		);
	}
};

// -------------------------------------------------------------------------------------------------
const processSingleCssFile = async (filePath: string, styleMap: Map<string, SelectorPos[]>): Promise<void> => {
	return withPerformanceMonitoring(
		`CSS file processing: ${path.basename(filePath)}`,
		async () => {
			try {
				const uri = vscode.Uri.file(filePath);
				const k = uri.toString();
				!styleMap.has(k) && styleMap.set(k, await readSelectorsFromFsPath(filePath));
			}
			catch (e: unknown) {
				const err = e as { message?: string };
				logger(`error`, `read failed: ${filePath} -> ${err?.message ?? e}`);
			}
		}
	);
};

// -------------------------------------------------------------------------------------------------
export const processCssFilesInBatches = async (filePaths: string[], styleMap: Map<string, SelectorPos[]>): Promise<void> => {
	const uncachedFiles = filePaths.filter(filePath => !styleMap.has(vscode.Uri.file(filePath).toString()));

	for (let i = 0; i < uncachedFiles.length; i += BATCH_SIZE) {
		const batch = uncachedFiles.slice(i, i + BATCH_SIZE);
		const batchPromises = batch.map(filePath => resourceLimiter().execute(async () => processSingleCssFile(filePath, styleMap)));
		await Promise.allSettled(batchPromises);
	}
};

// -------------------------------------------------------------------------------------------------
export const ensureWorkspaceCssFiles = async (folder: vscode.WorkspaceFolder, excludePatterns: string[]): Promise<string[]> => {
	workspaceCssFiles && (void 0);
	const collected: string[] = [];
	try {
		const styleExts = [ `css` ];
		const configured = getAnalyzableExtensions(folder.uri).filter(e => styleExts.includes(e));
		const unique = Array.from(new Set(configured.length ? configured : styleExts));
		const patterns = unique.map(e => `**/*.${e}`);
		for (const glob of patterns) {
			if (collected.length >= MAX_WORKSPACE_FILES) {
				logger(`debug`, `file limit reached (${MAX_WORKSPACE_FILES} files), remaining files ignored`);
				break;
			}
			const include = new vscode.RelativePattern(folder, glob);
			const uris = await vscode.workspace.findFiles(include);
			for (const uri of uris) {
				if (collected.length >= MAX_WORKSPACE_FILES) {
					break;
				}
				!isUriExcludedByGlob(uri, excludePatterns) && collected.push(uri.fsPath);
				collected.length >= MAX_WORKSPACE_FILES && logger(`debug`, `file limit reached (${MAX_WORKSPACE_FILES} files), remaining files ignored`);
			}
		}
	}
	catch (e: unknown) {
		const err = e as { message?: string };
		logger(`error`, `file check error: ${err?.message ?? e}`);
	}
	logger(`debug`, `files collected: ${collected.length} items`);
	workspaceCssFiles = collected;
	return collected;
};

// -------------------------------------------------------------------------------------------------
export const getWorkspaceCssFiles = (): string[] | null => workspaceCssFiles;

// -------------------------------------------------------------------------------------------------
export const clearWorkspaceCssFilesCache = (): void => {
	workspaceCssFiles = null;
};

// -------------------------------------------------------------------------------------------------
// VALIDATION HELPERS
// -------------------------------------------------------------------------------------------------
export const normalizeToken = (token: string): string => {
	const normalized = !token ? `` : token.replace(TEMPLATE_LITERAL_REGEX, ` `);
	const isQuoted = normalized && QUOTE_CHARS.some(quote => normalized.startsWith(quote) && normalized.endsWith(quote));
	return isQuoted ? normalized.slice(1, -1) : normalized;
};

// -------------------------------------------------------------------------------------------------
export const makeRange = (doc: vscode.TextDocument, startIdx: number, length: number): vscode.Range => {
	const endIdx = startIdx + length;
	return new vscode.Range(doc.positionAt(startIdx), doc.positionAt(endIdx));
};

// -------------------------------------------------------------------------------------------------
export const collectKnownSelectors = (all: Map<string, SelectorPos[]>): { knownClasses: Set<string>; knownIds: Set<string> } => {
	const knownClasses = new Set<string>();
	const knownIds = new Set<string>();
	[ ...all.values() ].forEach(arr => arr.forEach(s => (s.type === SelectorType.CLASS ? knownClasses : knownIds).add(s.selector)));
	return { knownClasses, knownIds };
};

// -------------------------------------------------------------------------------------------------
export const isValidCssIdentifier = (value: string): boolean => VALID_CSS_IDENTIFIER_REGEX.test(value);

// -------------------------------------------------------------------------------------------------
export const isRemoteUrl = (url: string): boolean => REMOTE_URL_REGEX.test(url);

// -------------------------------------------------------------------------------------------------
// CSS 본문 추출 (성능 최적화 및 메모리 효율 개선)
export const extractCssBodies = (fullText: string): string => {
	let depth = 0;
	let start = -1;
	let inBlockComment = false;
	let inLineComment = false;
	let inString = false;
	let stringChar = ``;
	const bodies: string[] = [];

	for (let i = 0; i < fullText.length; i++) {
		const ch = fullText[i];
		const prev = i > 0 ? fullText[i - 1] : ``;

		if (inBlockComment) {
			prev === `*` && ch === `/` && (inBlockComment = false);
			continue;
		}

		if (inLineComment) {
			ch === `\n` && (inLineComment = false);
			continue;
		}

		if (inString) {
			ch === stringChar && prev !== `\\` && (inString = false);
			continue;
		}

		prev === `/` && ch === `*` && (inBlockComment = true);
		prev === `/` && ch === `/` && (inLineComment = true);

		(ch === `"` || ch === `'` || ch === `\``) && !inBlockComment && !inLineComment && (
			inString = true,
			stringChar = ch
		);

		!inBlockComment && !inString && !inLineComment && (
			ch === `{` ? (
				depth === 0 && (start = i + 1),
				depth++
			) : ch === `}` ? (
				depth--,
				depth === 0 && start >= 0 && (
					bodies.push(fullText.slice(start, i)),
					start = -1
				)
			) : void 0
		);
	}

	return bodies.join(`\n`);
};

// -------------------------------------------------------------------------------------------------
// REGEX EXPORTS (for use in validator)
// -------------------------------------------------------------------------------------------------
export {
	CLASS_ATTRIBUTE_REGEX,
	CLASSLIST_METHOD_REGEX,
	STRING_LITERAL_REGEX,
	QUERYSELECTOR_REGEX,
	GETELEMENTBYID_REGEX,
	BACKSLASH_REGEX,
	REMOTE_URL_REGEX,
};

// -------------------------------------------------------------------------------------------------
// VALIDATION FUNCTIONS
// -------------------------------------------------------------------------------------------------
const processClassAttribute = (
	match: RegExpExecArray,
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
		if (!normalizedValue || !isValidCssIdentifier(normalizedValue)) {
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

		knownClasses.has(normalizedValue) ? (
			usedClasses.add(normalizedValue)
		) : (() => {
			const d = new vscode.Diagnostic(makeRange(document, highlightStart, highlightLen), `CSS class '${normalizedValue}' not found`, vscode.DiagnosticSeverity.Warning);
			d.source = `CSS-Analyzer`;
			d.code = `CSS001`;
			diagnostics.push(d);
		})();

		searchOffset = relativeIdx + token.length;
	}
};

// -------------------------------------------------------------------------------------------------
const processClassListCall = (
	match: RegExpExecArray,
	document: vscode.TextDocument,
	knownClasses: Set<string>,
	diagnostics: vscode.Diagnostic[],
	usedClasses: Set<string>
): void => {
	const argumentsString = match[1];
	let literalMatch: RegExpExecArray | null;
	const localStringLiteralRegex = /(['"`])((?:(?!\1).)*?)\1/g;

	while ((literalMatch = localStringLiteralRegex.exec(argumentsString))) {
		const normalizedValue = normalizeToken(literalMatch[2]).trim();

		if (!normalizedValue || !isValidCssIdentifier(normalizedValue)) {
			continue;
		}

		knownClasses.has(normalizedValue) ? (
			usedClasses.add(normalizedValue)
		) : (() => {
			const baseOffset = match.index! + match[0].indexOf(literalMatch![0]);
			const innerIdx = literalMatch![0].indexOf(literalMatch![2]);
			const tokenStart = baseOffset + (innerIdx >= 0 ? innerIdx : 0);
			const d = new vscode.Diagnostic(makeRange(document, tokenStart, literalMatch![2].length), `CSS class '${normalizedValue}' not found`, vscode.DiagnosticSeverity.Warning);
			d.source = `CSS-Analyzer`;
			d.code = `CSS001`;
			diagnostics.push(d);
		})();
	}
};

// -------------------------------------------------------------------------------------------------
export const scanDocumentUsages = (
	fullText: string,
	document: vscode.TextDocument,
	knownClasses: Set<string>,
	knownIds: Set<string>
): { diagnostics: vscode.Diagnostic[]; usedClassesFromMarkup: Set<string>; usedIdsFromMarkup: Set<string> } => {
	const diagnostics: vscode.Diagnostic[] = [];
	const usedClassesFromMarkup = new Set<string>();
	const usedIdsFromMarkup = new Set<string>();

	// Reset regex lastIndex
	CLASS_ATTRIBUTE_REGEX.lastIndex = 0;
	CLASSLIST_METHOD_REGEX.lastIndex = 0;
	QUERYSELECTOR_REGEX.lastIndex = 0;
	GETELEMENTBYID_REGEX.lastIndex = 0;

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
	let qsMatch: RegExpExecArray | null;
	while ((qsMatch = QUERYSELECTOR_REGEX.exec(fullText))) {
		const q = qsMatch[2];
		const base = qsMatch.index + qsMatch[0].indexOf(q);
		const clsTok = /(^|[^\\])\.((?:\\.|[-_a-zA-Z0-9])+)/g;
		const idTok = /(^|[^\\])#((?:\\.|[-_a-zA-Z0-9])+)/g;
		let m: RegExpExecArray | null;
		while ((m = clsTok.exec(q))) {
			const val = m[2].replace(BACKSLASH_REGEX, ``);
			val && (
				knownClasses.has(val) ? usedClassesFromMarkup.add(val) : (() => {
					const start = base + m!.index + (m![1] ? 1 : 0) + 1;
					const d = new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning);
					d.source = `CSS-Analyzer`;
					d.code = `CSS001`;
					diagnostics.push(d);
				})()
			);
		}
		while ((m = idTok.exec(q))) {
			const val = m[2].replace(BACKSLASH_REGEX, ``);
			val && (
				knownIds.has(val) ? usedIdsFromMarkup.add(val) : (() => {
					const start = base + m!.index + (m![1] ? 1 : 0) + 1;
					const d = new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS id '#${val}' not found`, vscode.DiagnosticSeverity.Warning);
					d.source = `CSS-Analyzer`;
					d.code = `CSS002`;
					diagnostics.push(d);
				})()
			);
		}
	}

	// getElementById
	let gebi: RegExpExecArray | null;
	while ((gebi = GETELEMENTBYID_REGEX.exec(fullText))) {
		const id = gebi[2];
		id && (
			knownIds.has(id) ? usedIdsFromMarkup.add(id) : (() => {
				const m = gebi![0].match(/(["\''])((?:(?!\1)[^"\'`])+)\1/);
				const litLen = m ? m[0].length : id.length + 2;
				const start = gebi!.index + (m ? gebi![0].indexOf(m[0]) : 0);
				const d = new vscode.Diagnostic(makeRange(document, start, litLen), `CSS id '#${id}' not found`, vscode.DiagnosticSeverity.Warning);
				d.source = `CSS-Analyzer`;
				d.code = `CSS002`;
				diagnostics.push(d);
			})()
		);
	}

	return { diagnostics, usedClassesFromMarkup, usedIdsFromMarkup };
};

// -------------------------------------------------------------------------------------------------
export const scanLocalUnused = async (
	doc: vscode.TextDocument,
	support: CssSupportLike,
	fullText: string
): Promise<vscode.Diagnostic[]> => {
	const diagnostics: vscode.Diagnostic[] = [];
	const sels = await support.getLocalDoc(doc);
	const bodyOnly = extractCssBodies(fullText);
	const usedClasses = new Set<string>();
	const usedIds = new Set<string>();
	let m: RegExpExecArray | null;
	const clsUse = /(^|[^\\])\.((?:\\.|[-_a-zA-Z0-9])+)/g;
	while ((m = clsUse.exec(bodyOnly))) {
		usedClasses.add(m[2].replace(BACKSLASH_REGEX, ``));
	}
	const idUse = /(^|[^\\])#((?:\\.|[-_a-zA-Z0-9])+)/g;
	while ((m = idUse.exec(bodyOnly))) {
		usedIds.add(m[2].replace(BACKSLASH_REGEX, ``));
	}
	for (const s of sels) {
		const used = s.type === SelectorType.CLASS ? usedClasses.has(s.selector) : usedIds.has(s.selector);
		!used && (() => {
			const symbolOffset = 1;
			const base = doc.positionAt(s.index);
			const start = base.translate(0, symbolOffset);
			const end = start.translate(0, s.selector.length);
			const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? `.` : `#`) + s.selector}'`, vscode.DiagnosticSeverity.Warning);
			d.source = `CSS-Analyzer`;
			d.code = `CSS003`;
			d.tags = [ vscode.DiagnosticTag.Unnecessary ];
			diagnostics.push(d);
		})();
	}
	return diagnostics;
};

// -------------------------------------------------------------------------------------------------
export const scanEmbeddedUnused = async (
	doc: vscode.TextDocument,
	support: CssSupportLike,
	usedClassesFromMarkup: Set<string>,
	usedIdsFromMarkup: Set<string>
): Promise<vscode.Diagnostic[]> => {
	const diagnostics: vscode.Diagnostic[] = [];
	const localDefs = await support.getLocalDoc(doc);
	for (const s of localDefs) {
		const used = s.type === SelectorType.CLASS ? usedClassesFromMarkup.has(s.selector) : usedIdsFromMarkup.has(s.selector);
		!used && (() => {
			const symbolOffset = 1;
			const base = doc.positionAt(s.index);
			const start = base.translate(0, symbolOffset);
			const end = start.translate(0, s.selector.length);
			const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? `.` : `#`) + s.selector}'`, vscode.DiagnosticSeverity.Warning);
			d.source = `CSS-Analyzer`;
			d.code = `CSS003`;
			d.tags = [ vscode.DiagnosticTag.Unnecessary ];
			diagnostics.push(d);
		})();
	}
	return diagnostics;
};
