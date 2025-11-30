/**
 * @file cssValidator.ts
 * @since 2025-11-22
 * @description CSS 검증 및 Provider 클래스
 */

import {getCssExcludePatterns} from "@exportConsts";
import {cacheGet, cacheSet, clearWorkspaceCssFilesCache, ensureWorkspaceCssFiles, fetchCssContent, getWorkspaceCssFiles, parseSelectors, processCssFilesInBatches, readSelectorsFromFsPath} from "@exportLangs";
import {fs, path, vscode} from "@exportLibs";
import {isAnalyzable, logger, validateDocument, withPerformanceMonitoring} from "@exportScripts";
import {type SelectorPos, SelectorType} from "@exportTypes";
import type {CssSupportLike} from "@langs/css/cssType";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const REMOTE_URL_REGEX = /^https?:\/\//i;
const WORD_RANGE_REGEX = /[_a-zA-Z0-9-]+/;
const LINK_STYLESHEET_REGEX = /<link\s+[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
const HREF_ATTRIBUTE_REGEX = /\bhref\s*=\s*(["'])([^"']+)\1/i;

// -------------------------------------------------------------------------------------------------
// CSS PROVIDER CLASS
// -------------------------------------------------------------------------------------------------
export class CssSupport implements vscode.CompletionItemProvider, vscode.DefinitionProvider, CssSupportLike {
	// 정규식 패턴 접근자들
	private get isRemoteUrl(): RegExp { return REMOTE_URL_REGEX; }
	private get wordRange(): RegExp { return WORD_RANGE_REGEX; }

	// -------------------------------------------------------------------------------------------------
	// Ongoing style collection promises to deduplicate concurrent requests
	private pendingStyles: Map<string, Promise<Map<string, SelectorPos[]>>> = new Map();

	// -------------------------------------------------------------------------------------------------
	// Remote stylesheet parsing
	getRemote = async (url: string): Promise<SelectorPos[]> => {
		const cached = cacheGet(url);
		return cached ? cached.data : (async () => {
			try {
				const cssText = await fetchCssContent(url);
				const data = parseSelectors(cssText);
				cacheSet(url, {version: -1, data});
				return data;
			}
			catch (error) {
				logger(`error`, `Remote CSS fetch failed: ${url}`);
				return [];
			}
		})();
	};

	// -------------------------------------------------------------------------------------------------
	// Local (file / embedded <style>) parsing
	getLocalDoc = async (doc: vscode.TextDocument): Promise<SelectorPos[]> => {
		const key = doc.uri.toString();
		const ver = doc.version;
		const cached = cacheGet(key);
		return (cached?.version === ver) ? cached.data : (async () => {
			const txt = doc.getText();
			let data: SelectorPos[] = [];
			const isHtml = /\.html?$/i.test(doc.fileName) || doc.languageId === `html`;
			if (isHtml) {
				const styleTagRegex = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi;
				let m: RegExpExecArray | null;

				while ((m = styleTagRegex.exec(txt))) {
					const fullMatch = m[0];
					const cssContent = m[1] || ``;

					if (cssContent.trim().length === 0) {
						continue;
					}

					const local = parseSelectors(cssContent);
					const openingTagEnd = fullMatch.indexOf(`>`) + 1;
					const bodyStartIdx = m.index + openingTagEnd;

					for (const sel of local) {
						const absIndex = bodyStartIdx + sel.index;
						const pos = doc.positionAt(absIndex);
						data.push({
							index: absIndex,
							line: pos.line,
							col: pos.character,
							type: sel.type,
							selector: sel.selector,
						});
					}
				}

				logger(`debug`, `style selectors: ${data.length} found`);
			}
			else {
				data = parseSelectors(txt);
			}
			cacheSet(key, {version: ver, data});
			return data;
		})();
	};

	// -------------------------------------------------------------------------------------------------
	// Linked stylesheet (<link rel="stylesheet" href="...">) 수집
	private fnGetLinkedStyles = async (doc: vscode.TextDocument): Promise<Map<string, SelectorPos[]>> => {
		const map = new Map<string, SelectorPos[]>();
		if (!/\.html?$/i.test(doc.fileName) && doc.languageId !== `html`) {
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
						if (workspaceFolder && (targetPath.startsWith(path.sep) || targetPath.startsWith(`/`))) {
							const candidate = path.join(workspaceFolder.uri.fsPath, targetPath.replace(/^[/\\]+/, ``));
							if (fs.existsSync(candidate)) {
								targetPath = path.normalize(candidate);
							}
						}
					}
					if (fs.existsSync(targetPath)) {
						try {
							const sels = await readSelectorsFromFsPath(targetPath);
							map.set(vscode.Uri.file(targetPath).toString(), sels);
						}
						catch (e: any) {
							logger(`error`, `read failed: ${href} -> ${e?.message || e}`);
						}
					}
				}
			}
			catch (e: any) {
				logger(`error`, `parsing error: ${href} -> ${e?.message || e}`);
			}
		}
		logger(`debug`, `parsing: ${map.size} entries found for ${doc.fileName}`);
		return map;
	};

	// -------------------------------------------------------------------------------------------------
	// Aggregate all configured styles
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
			for (const [ k, v ] of linked) {
				if (!styleMap.has(k)) {
					styleMap.set(k, v);
				}
			}

			if (workspaceFolder) {
				await ensureWorkspaceCssFiles(workspaceFolder, excludePatterns);
				const files = getWorkspaceCssFiles();
				if (files) {
					await processCssFilesInBatches(files, styleMap);
				}
			}

			logger(`debug`, `collected: ${styleMap.size} entries (workspace files: ${getWorkspaceCssFiles()?.length ?? 0}) for ${doc.fileName}`);

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
	// Build completion list
	private fnGetCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, kind: SelectorType): Promise<vscode.CompletionItem[]> => {
		const range = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
		const allStyles = await this.getStyles(doc);
		const map = new Map<string, vscode.CompletionItem>();

		for (const selectors of allStyles.values()) {
			for (const sel of selectors) {
				if (sel.type === kind && !map.has(sel.selector)) {
					const itemKind = sel.type === SelectorType.ID
						? vscode.CompletionItemKind.Value
						: vscode.CompletionItemKind.Enum;

					const item = new vscode.CompletionItem(sel.selector, itemKind);
					item.range = range;
					item.detail = kind === SelectorType.ID ? `CSS ID Selector` : `CSS Class Selector`;
					map.set(sel.selector, item);
				}
			}
		}

		return [ ...map.values() ];
	};

	// -------------------------------------------------------------------------------------------------
	// VS Code CompletionItemProvider
	provideCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[] | undefined> => {
		if (!isAnalyzable(doc) || token.isCancellationRequested) {
			return undefined;
		}

		const line = doc.lineAt(position.line).text;
		const prefix = line.slice(0, position.character);

		// 1. Check for ID context
		// id="...", id='...', id=...
		// getElementById('...')
		// #...
		const isIdContext =
			/id\s*=\s*["'][^"']*$/.test(prefix) ||
			/getElementById\s*\(\s*["'][^"']*$/.test(prefix) ||
			/#[\w-]*$/.test(prefix);

		// 2. Check for Class context
		// class="...", class='...', class=...
		// className="...", className='...'
		// classList.add('...'), .remove('...'), .toggle('...'), .contains('...')
		// getElementsByClassName('...')
		// .class...
		const isClassContext =
			/(?:class|className)\s*=\s*["'][^"']*$/.test(prefix) ||
			/classList\.(?:add|remove|toggle|contains|replace)\s*\(\s*["'][^"']*$/.test(prefix) ||
			/getElementsByClassName\s*\(\s*["'][^"']*$/.test(prefix) ||
			/\.[\w-]*$/.test(prefix);

		// 3. Check for QuerySelector context (can be both)
		// querySelector('...'), querySelectorAll('...')
		// $ ('...') (jQuery)
		const isQuerySelectorContext =
			/(?:querySelector(?:All)?|\$)\s*\(\s*["'][^"']*$/.test(prefix);

		if (!isIdContext && !isClassContext && !isQuerySelectorContext) {
			return undefined;
		}

		let kind = SelectorType.CLASS;
		if (isIdContext) {
			kind = SelectorType.ID;
		}
		else if (isQuerySelectorContext) {
			// If querySelector, check the last character before cursor
			// If it's #, then ID. If ., then Class. Default to both?
			// For now, let's try to infer from the last char.
			if (prefix.endsWith(`#`)) {
				kind = SelectorType.ID;
			}
			else {
				kind = SelectorType.CLASS;
			}
		}

		return await this.fnGetCompletionItems(doc, position, kind);
	};

	// -------------------------------------------------------------------------------------------------
	// VS Code DefinitionProvider
	provideDefinition = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition> => {
		if (!isAnalyzable(doc) || token.isCancellationRequested) {
			return [];
		}

		const wordRange = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
		if (!wordRange) {
			return [];
		}

		const allStyles = await this.getStyles(doc);
		const target = doc.getText(wordRange);
		const locations: vscode.Location[] = [];

		for (const [ uriString, selectors ] of allStyles) {
			if (REMOTE_URL_REGEX.test(uriString)) {
				continue;
			}

			for (const s of selectors) {
				if (s.selector === target) {
					try {
						const uri = vscode.Uri.parse(uriString);
						const location = new vscode.Location(uri, new vscode.Position(s.line, s.col));
						locations.push(location);
					}
					catch (error) {
						const errorMessage = error instanceof Error ? error.message : String(error);
						logger(`error`, `location parse failed: ${uriString} -> ${errorMessage}`);
					}
				}
			}
		}

		return locations;
	};

	// -------------------------------------------------------------------------------------------------
	// Delegate validation
	validate = async (doc: vscode.TextDocument): Promise<vscode.Diagnostic[]> => {
		return withPerformanceMonitoring(
			`Document validation: ${path.basename(doc.fileName)}`,
			() => validateDocument(doc, this)
		);
	};

	// -------------------------------------------------------------------------------------------------
	// 워크스페이스 CSS 파일 목록 캐시 초기화
	clearWorkspaceIndex = (): void => {
		clearWorkspaceCssFilesCache();
	};
}
