// src/langs/css/cssSupport.ts

import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import {type SelectorPos, SelectorType} from "../types/common.js";
import {parseSelectors} from "./cssParser.js";
import {cacheGet, cacheSet} from "./cssCache.js";
import {getCssExcludePatterns, getAnalyzableExtensions} from "../../configs/setting.js";
import {isUriExcludedByGlob} from "../../utils/glob.js";
import {isAnalyzable} from "../../utils/filter.js";
import {log} from "../../utils/logger.js";
import {validateDocument} from "../../configs/validate.js";
import {withPerformanceMonitoring, ResourceLimiter} from "../../utils/performance.js";

// -------------------------------------------------------------------------------------------------
const ZERO_POSITION = new vscode.Position(0, 0);
const REMOTE_URL_REGEX = /^https?:\/\//i;
const WORD_RANGE_REGEX = /[_a-zA-Z0-9-]+/;

// 성능 최적화된 정규식 (캡처 그룹 최소화, 백트래킹 방지, 강화된 패턴)
const COMPLETION_CONTEXT_REGEX = /(?:(?:id|class|className|[.#])\s*[=:]?\s*["'`]?[^\n]*|classList\.(?:add|remove|toggle|contains|replace)\s*\([^)]*|querySelector(?:All)?\s*\(\s*["'`][^)]*|getElementById\s*\(\s*["'][^)]*)$/i;
const STYLE_TAG_REGEX = /<style(?:\s[^>]*)?>[\s\S]*?<\/style>/gi;
const LINK_STYLESHEET_REGEX = /<link\s+[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
const HREF_ATTRIBUTE_REGEX = /\bhref\s*=\s*(["'])([^"']+)\1/i;

// -------------------------------------------------------------------------------------------------
interface FetchResponse {
	ok: boolean;
	status?: number;
	statusText?: string;
	text(): Promise<string>;
}

// -------------------------------------------------------------------------------------------------
export class CssSupport implements vscode.CompletionItemProvider, vscode.DefinitionProvider {
	// 정규식 패턴 접근자들
	private get isRemoteUrl(): RegExp { return REMOTE_URL_REGEX; }
	private get wordRange(): RegExp { return WORD_RANGE_REGEX; }
	private get canComplete(): RegExp { return COMPLETION_CONTEXT_REGEX; }

	// -------------------------------------------------------------------------------------------------
	// Ongoing style collection promises to deduplicate concurrent requests
	private pendingStyles: Map<string, Promise<Map<string, SelectorPos[]>>> = new Map();

	private fnFetchWithNativeFetch = async (url: string): Promise<string> => {
		const response = await (globalThis as any).fetch(url) as FetchResponse;

		if (!response?.ok) {
			const statusInfo = response?.statusText || `HTTP ${response?.status || 'unknown'}`;
			throw new Error(statusInfo);
		}

		return await response.text();
	};

	// -------------------------------------------------------------------------------------------------
	private fnFetchWithNodeHttp = async (url: string, redirectsRemaining = 5): Promise<string> => {
		const REQUEST_TIMEOUT_MS = 10000; // 10s
		return new Promise<string>((resolve, reject) => {
			const httpLib = url.startsWith("https") ? https : http;

			const request = httpLib.get(url, (response) => {
				const status = response.statusCode || 0;

				// follow redirects
				if (status >= 300 && status < 400 && response.headers && response.headers.location) {
					const location = response.headers.location as string;
					if (redirectsRemaining > 0) {
						try {
							// resolve relative locations against original url
							const newUrl = location.startsWith('http') ? location : new URL(location, url).toString();
							response.resume();
							resolve(this.fnFetchWithNodeHttp(newUrl, redirectsRemaining - 1));
							return;
						}
						catch (e: any) {
							response.resume();
							reject(new Error(`Invalid redirect location: ${location}`));
							return;
						}
					}
					response.resume();
					reject(new Error('Too many redirects'));
					return;
				}

				let data = "";
				response.setEncoding && response.setEncoding('utf8');

				response.on("data", (chunk: string) => {
					data += chunk;
				});

				response.on("end", () => {
					const isSuccessStatus = status >= 200 && status < 300;
					isSuccessStatus ? resolve(data) : reject(new Error(`HTTP ${status}`));
				});
			});

			request.on("error", (err: Error) => reject(err));
			request.setTimeout && request.setTimeout(REQUEST_TIMEOUT_MS, () => {
				try {
					request.abort();
				}
				catch (_e) {
					// ignore
				}
				reject(new Error('Request timeout'));
			});
		});
	};

	// -------------------------------------------------------------------------------------------------
	fnFetch = async (url: string): Promise<string> => {
		try {
			// 네이티브 fetch가 사용 가능한 경우
			if (typeof (globalThis as any).fetch === "function") {
				return await this.fnFetchWithNativeFetch(url);
			}

			// Node.js HTTP 모듈 사용
			return await this.fnFetchWithNodeHttp(url);
		}
		catch (error: any) {
			const errorMessage = error?.message || String(error);
			log("error", `[Html-Css-Js-Analyzer] CSS file fetch failed (${url}): ${errorMessage}`);
			return "";
		}
	};

	// -------------------------------------------------------------------------------------------------
	// Remote stylesheet parsing (성능 최적화)
	getRemote = async (url: string): Promise<SelectorPos[]> => {
		const cached = cacheGet(url);
		return cached ? cached.data : (async () => {
			const data = parseSelectors(await this.fnFetch(url));
			cacheSet(url, {version: -1, data});
			return data;
		})();
	};

	// -------------------------------------------------------------------------------------------------
	// Local (file / embedded <style>) parsing (성능 최적화)
	getLocalDoc = async (doc: vscode.TextDocument): Promise<SelectorPos[]> => {
		const key = doc.uri.toString();
		const ver = doc.version;
		const cached = cacheGet(key);
		return (cached && cached.version === ver) ? cached.data : (async () => {
			const txt = doc.getText();
			let data: SelectorPos[] = [];
			const isHtml = /\.html?$/i.test(doc.fileName) || doc.languageId === "html";
			isHtml ? (() => {
				let m: RegExpExecArray | null;
				while ((m = STYLE_TAG_REGEX.exec(txt))) {
					const cssBody = m[0].match(/<style(?:\s[^>]*)?>[\s\S]*?<\/style>/i)?.[0].replace(/<\/?style[^>]*>/gi, '') || '';
					const local = parseSelectors(cssBody);
					const bodyStartIdx = m.index + m[0].indexOf(cssBody);
					for (const sel of local) {
						const absIndex = bodyStartIdx + sel.index;
						const pos = doc.positionAt(absIndex);
						data.push({index: absIndex, line: pos.line, col: pos.character, type: sel.type, selector: sel.selector});
					}
				}
				log("debug", `[Html-Css-Js-Analyzer] Embedded style selectors: ${data.length} found`);
			})() : (data = parseSelectors(txt));
			cacheSet(key, {version: ver, data});
			return data;
		})();
	};

	// -------------------------------------------------------------------------------------------------
	// Linked stylesheet (<link rel="stylesheet" href="...">) 수집 (성능 최적화)
	private fnGetLinkedStyles = async (doc: vscode.TextDocument): Promise<Map<string, SelectorPos[]>> => {
		const map = new Map<string, SelectorPos[]>();
		if (!/\.html?$/i.test(doc.fileName) && doc.languageId !== "html") {
			return map;
		}
		const text = doc.getText();
		let m: RegExpExecArray | null;
		while ((m = LINK_STYLESHEET_REGEX.exec(text))) {
			const tag = m[0];
			const hrefMatch = HREF_ATTRIBUTE_REGEX.exec(tag);
			if (!hrefMatch) {
				continue;
			}
			const href = hrefMatch[2].trim();
			if (!href) {
				continue;
			}
			try {
				if (this.isRemoteUrl.test(href)) {
					if (!map.has(href)) {
						const sels = await this.getRemote(href);
						map.set(href, sels);
					}
				}
				else {
					let targetPath = href;
					if (!path.isAbsolute(targetPath)) {
						targetPath = path.join(path.dirname(doc.uri.fsPath), targetPath);
					}
					targetPath = path.normalize(targetPath);
					if (!fs.existsSync(targetPath)) {
						const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
						if (workspaceFolder && (targetPath.startsWith(path.sep) || targetPath.startsWith('/'))) {
							const candidate = path.join(workspaceFolder.uri.fsPath, targetPath.replace(/^[/\\]+/, ''));
							if (fs.existsSync(candidate)) {
								targetPath = path.normalize(candidate);
							}
						}
					}
					if (fs.existsSync(targetPath)) {
						try {
							const sels = await this.fnReadSelectorsFromFsPath(targetPath);
							map.set(vscode.Uri.file(targetPath).toString(), sels);
						}
						catch (e: any) {
							log("error", `[Html-Css-Js-Analyzer] Linked stylesheet read failed: ${href} -> ${e?.message || e}`);
						}
					}
				}
			}
			catch (e: any) {
				log("error", `[Html-Css-Js-Analyzer] Linked stylesheet parsing error: ${href} -> ${e?.message || e}`);
			}
		}
		log("debug", `[Html-Css-Js-Analyzer] Linked stylesheet parsing: ${map.size} entries found for ${doc.fileName}`);
		return map;
	};

	// -------------------------------------------------------------------------------------------------
	// Aggregate all configured styles (성능 최적화)
	getStyles = async (doc: vscode.TextDocument): Promise<Map<string, SelectorPos[]>> => {
		const key = doc.uri.toString();
		if (this.pendingStyles.has(key)) {
			return await this.pendingStyles.get(key)!;
		}

		const styleMap: Map<string, SelectorPos[]> = new Map();
		if (!isAnalyzable(doc)) {
			return styleMap;
		}

		const promise = (async () => {
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
		const excludePatterns = getCssExcludePatterns(doc.uri);

			styleMap.set(doc.uri.toString(), await this.getLocalDoc(doc));

			const linked = await this.fnGetLinkedStyles(doc);
			for (const [k, v] of linked) {
				if (!styleMap.has(k)) {
					styleMap.set(k, v);
				}
			}

			if (workspaceFolder) {
				await this.fnEnsureWorkspaceCssFiles(workspaceFolder, excludePatterns);
				if (workspaceCssFiles) {
					await this.fnProcessCssFilesInBatches(workspaceCssFiles, styleMap);
				}
			}

			log("debug", `[Html-Css-Js-Analyzer] Styles collected: ${styleMap.size} entries (workspace files: ${workspaceCssFiles ? workspaceCssFiles.length : 0}) for ${doc.fileName}`);

			return styleMap;
		})();

		this.pendingStyles.set(key, promise);
		try {
			return await promise;
		}
		finally {
			this.pendingStyles.delete(key);
		}
	};

	// -------------------------------------------------------------------------------------------------
	// 파일 시스템에서 직접 읽어 파싱 (대용량 파일 최적화)
	private fnReadSelectorsFromFsPath = async (fsPath: string): Promise<SelectorPos[]> => {
		try {
			const stat = await fs.promises.stat(fsPath);
			const key = `fs://${fsPath}`;
			const cached = cacheGet(key);
			return (cached && cached.version === stat.mtimeMs) ? cached.data : (async () => {
				const MAX_FILE_SIZE = 2 * 1024 * 1024;
				return stat.size > MAX_FILE_SIZE ? (
					log("info", `[Html-Css-Js-Analyzer] Large CSS file skipped for performance: ${fsPath} (${Math.round(stat.size / 1024 / 1024 * 100) / 100}MB)`),
					[]
				) : (async () => {
					const content = await fs.promises.readFile(fsPath, "utf8");
					const MAX_CONTENT_LENGTH = 500000;
					return content.length > MAX_CONTENT_LENGTH ? (
						log("info", `[Html-Css-Js-Analyzer] Large CSS content sampled: ${fsPath}`),
						(() => {
							const parsed = parseSelectors(content.substring(0, MAX_CONTENT_LENGTH));
							cacheSet(key, {version: stat.mtimeMs, data: parsed});
							return parsed;
						})()
					) : (() => {
						const parsed = parseSelectors(content);
						cacheSet(key, {version: stat.mtimeMs, data: parsed});
						return parsed;
					})();
				})();
			})();
		}
		catch (e: any) {
			return (e?.code === 'ENOMEM' || e?.message?.includes('out of memory')) ? (
				log("error", `[Html-Css-Js-Analyzer] Memory limit reached processing: ${fsPath}`),
				[]
			) : (
				log("error", `[Html-Css-Js-Analyzer] Selector read from file failed: ${fsPath} -> ${e?.message || e}`),
				[]
			);
		}
	};	// -------------------------------------------------------------------------------------------------
	// 배치 단위로 CSS 파일들을 병렬 처리 (성능 최적화)
	private fnProcessCssFilesInBatches = async (filePaths: string[], styleMap: Map<string, SelectorPos[]>): Promise<void> => {
		const BATCH_SIZE = 10;
		const uncachedFiles = filePaths.filter(filePath => !styleMap.has(vscode.Uri.file(filePath).toString()));

		for (let i = 0; i < uncachedFiles.length; i += BATCH_SIZE) {
			const batch = uncachedFiles.slice(i, i + BATCH_SIZE);
			const batchPromises = batch.map(filePath => ResourceLimiter.execute(async () => this.fnProcessSingleCssFile(filePath, styleMap)));
			await Promise.allSettled(batchPromises);
		}
	};

	// -------------------------------------------------------------------------------------------------
	// 단일 CSS 파일 처리 (성능 모니터링 및 에러 핸들링 포함)
	private fnProcessSingleCssFile = async (filePath: string, styleMap: Map<string, SelectorPos[]>): Promise<void> => {
		return withPerformanceMonitoring(
			`CSS file processing: ${path.basename(filePath)}`,
			async () => {
				try {
					const uri = vscode.Uri.file(filePath);
					const k = uri.toString();
					!styleMap.has(k) && styleMap.set(k, await this.fnReadSelectorsFromFsPath(filePath));
				}
				catch (e: any) {
					log("error", `[Html-Css-Js-Analyzer] CSS file read failed: ${filePath} -> ${e?.message || e}`);
				}
			}
		);
	};

	// -------------------------------------------------------------------------------------------------
	// Build completion list (성능 최적화)
	private fnGetCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, kind: SelectorType): Promise<vscode.CompletionItem[]> => {
		const range = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
		const allStyles = await this.getStyles(doc);
		const map = new Map<string, vscode.CompletionItem>();
		for (const selectors of allStyles.values()) {
			for (const sel of selectors) {
				sel.type === kind && !map.has(sel.selector) && (() => {
					const item = new vscode.CompletionItem(sel.selector, sel.type === SelectorType.ID ? vscode.CompletionItemKind.Value : vscode.CompletionItemKind.Enum);
					item.range = range;
					map.set(sel.selector, item);
				})();
			}
		}
		return [...map.values()];
	};

	// -------------------------------------------------------------------------------------------------
	// VS Code CompletionItemProvider (성능 최적화)
	provideCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[] | undefined> => {
		return (!isAnalyzable(doc) || token.isCancellationRequested) ? undefined : (() => {
			const prefixText = doc.getText(new vscode.Range(ZERO_POSITION, position));
			return this.canComplete.test(prefixText) ? (async () => {
				const isIdCtx = /(?:\bid\s*[=:]|[#])\s*["'`]?[^]*$/.test(prefixText);
				const kind = isIdCtx ? SelectorType.ID : SelectorType.CLASS;
				return await this.fnGetCompletionItems(doc, position, kind);
			})() : undefined;
		})();
	};

	// -------------------------------------------------------------------------------------------------
	// VS Code DefinitionProvider (성능 최적화)
	provideDefinition = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition> => {
		return (!isAnalyzable(doc) || token.isCancellationRequested) ? [] : (async () => {
			const wordRange = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
			return !wordRange ? [] : (async () => {
				const allStyles = await this.getStyles(doc);
				const target = doc.getText(wordRange);
				const locations: vscode.Location[] = [];
				for (const entry of allStyles) {
					!REMOTE_URL_REGEX.test(entry[0]) && entry[1].forEach(s => s.selector === target && locations.push(new vscode.Location(vscode.Uri.parse(entry[0]), new vscode.Position(s.line, s.col))));
				}
				return locations;
			})();
		})();
	};

	// -------------------------------------------------------------------------------------------------
	// Delegate validation (성능 최적화)
	validate = async (doc: vscode.TextDocument): Promise<vscode.Diagnostic[]> => {
		return withPerformanceMonitoring(
			`Document validation: ${path.basename(doc.fileName)}`,
			() => validateDocument(doc, this)
		);
	};

	// -------------------------------------------------------------------------------------------------
	// 워크스페이스 CSS 파일 목록 캐시 초기화
	clearWorkspaceIndex = (): void => {
		workspaceCssFiles = null;
	};

	// -------------------------------------------------------------------------------------------------
	// 내부: 워크스페이스 CSS/SCSS 파일 목록 1회 수집 (성능 최적화)
	private fnEnsureWorkspaceCssFiles = async (folder: vscode.WorkspaceFolder, excludePatterns: string[]): Promise<void> => {
		if (workspaceCssFiles) {
			return;
		}
		const MAX = 500;
		const collected: string[] = [];
		try {
			const styleExts = ["css", "scss", "less", "sass"];
			const configured = getAnalyzableExtensions(folder.uri).filter(e => styleExts.includes(e));
			const unique = Array.from(new Set(configured.length ? configured : styleExts));
			const patterns = unique.map(e => `**/*.${e}`);
			for (const glob of patterns) {
				if (collected.length >= MAX) {
					log("info", `[Html-Css-Js-Analyzer] Workspace CSS file limit reached (${MAX} files), remaining files ignored`);
					break;
				}
				const include = new vscode.RelativePattern(folder, glob);
				const uris = await vscode.workspace.findFiles(include);
				for (const uri of uris) {
					if (collected.length >= MAX) {
						break;
					}
					if (!isUriExcludedByGlob(uri, excludePatterns)) {
						collected.push(uri.fsPath);
					}
					if (collected.length >= MAX) {
						log("info", `[Html-Css-Js-Analyzer] Workspace CSS file limit reached (${MAX} files), remaining files ignored`);
						break;
					}
				}
			}
		}
		catch (e: any) {
			log("error", `[Html-Css-Js-Analyzer] Workspace CSS file check error: ${e?.message || e}`);
		}
		log("info", `[Html-Css-Js-Analyzer] Workspace CSS files collected: ${collected.length} items`);
		workspaceCssFiles = collected;
	};
}

// 모듈 레벨 캐시 (파일 경로 목록)
let workspaceCssFiles: string[] | null = null;
