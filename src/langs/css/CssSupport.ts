// langs/css/CssSupport.ts

import { vscode } from "@exportLibs";
import type { SelectorType, SelectorPosType } from "@exportTypes";
import { validateDocument, logger } from "@exportScripts";
import { regexWordRange, regexCompletionContext, zeroPosition } from "@exportConsts";
import { parseSelectors } from "@langs/css/CssParser";
import { cacheGet, cacheSet } from "@langs/css/CssCache";
import { collectAllStyles } from "@langs/css/CssAnalyzer";
import { runCssAnalyzer } from "@langs/css/CssRunner";

// -------------------------------------------------------------------------------------------------
const WORD_RANGE_REGEX = regexWordRange;
const COMPLETION_CONTEXT_REGEX = regexCompletionContext;

// -------------------------------------------------------------------------------------------------
export const cssSupport = new class CssSupport implements vscode.CompletionItemProvider, vscode.DefinitionProvider {
	private get wordRange(): RegExp { return WORD_RANGE_REGEX; }
	private get canComplete(): RegExp { return COMPLETION_CONTEXT_REGEX; }

	// 기존 구조 호환: 로컬 선택자 수집 -------------------------------------------------------------
	getLocalDoc = async (doc: vscode.TextDocument): Promise<SelectorPosType[]> => {
		const key = doc.uri.toString();
		const ver = doc.version;
		const cached = cacheGet(key);
		return (cached && cached.version === ver) ? cached.data : (async () => {
			const txt = doc.getText();
			let data: SelectorPosType[] = [];
			const isHtml = /\.html?$/i.test(doc.fileName) || doc.languageId === "html";
			isHtml ? (() => {
				let m: RegExpExecArray | null;
				const styleTag = /<style[\s\S]*?<\/style>/gi;
				while ((m = styleTag.exec(txt))) {
					const cssBody = m[0].replace(/<\/ ?style[^>]*>/gi, '').replace(/<style(?:\s[^>]*)?>/gi, '');
					const local = parseSelectors(cssBody);
					const bodyStartIdx = m.index + m[0].indexOf(cssBody);
					for (const sel of local) {
						const absIndex = bodyStartIdx + sel.index;
						const pos = doc.positionAt(absIndex);
						data.push({index: absIndex, line: pos.line, col: pos.character, type: sel.type, selector: sel.selector});
					}
				}
				logger(`debug`, `CssSupport`, `Embedded style selectors: ${data.length} found`);
			})() : (data = parseSelectors(txt));
			cacheSet(key, {version: ver, data});
			return data;
		})();
	};

	getStyles = async (doc: vscode.TextDocument): Promise<Map<string, SelectorPosType[]>> => {
		return await collectAllStyles(doc, this as any);
	};

	// Completion -----------------------------------------------------------------
	private buildCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, kind: SelectorType): Promise<vscode.CompletionItem[]> => {
		const range = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
		const allStyles = await this.getStyles(doc);
		const map = new Map<string, vscode.CompletionItem>();
		for (const selectors of allStyles.values()) {
			for (const sel of selectors) {
				sel.type === kind && !map.has(sel.selector) && (() => {
					const item = new vscode.CompletionItem(sel.selector, sel.type === "#" ? vscode.CompletionItemKind.Value : vscode.CompletionItemKind.Enum);
					item.range = range;
					map.set(sel.selector, item);
				})();
			}
		}
		return [...map.values()];
	};

	provideCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[] | undefined> => {
		return token.isCancellationRequested ? undefined : (() => {
			const prefixText = doc.getText(new vscode.Range(zeroPosition, position));
			return this.canComplete.test(prefixText) ? (async () => {
				const isIdCtx = /(?:\bid\s*[=:]|[#])\s*["'`]?[^]*$/.test(prefixText);
				const kind: SelectorType = isIdCtx ? "#" : ".";
				return await this.buildCompletionItems(doc, position, kind);
			})() : undefined;
		})();
	};

	// Definition ------------------------------------------------------------------
	provideDefinition = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition> => {
		return token.isCancellationRequested ? [] : (async () => {
			const wordRange = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
			return !wordRange ? [] : (async () => {
				const allStyles = await this.getStyles(doc);
				const target = doc.getText(wordRange);
				const locations: vscode.Location[] = [];
				for (const entry of allStyles) {
					entry[1].forEach(s => s.selector === target && locations.push(new vscode.Location(vscode.Uri.parse(entry[0]), new vscode.Position(s.line, s.col))));
				}
				return locations;
			})();
		})();
	};

	// Validation ------------------------------------------------------------------
	validate = async (doc: vscode.TextDocument): Promise<vscode.Diagnostic[]> => {
		await runCssAnalyzer(doc, this as any);
		return await validateDocument(doc, this as any);
	};

	clearWorkspaceIndex = (): void => {
		logger(`debug`, `CssSupport`, `clearWorkspaceIndex (noop)`);
	};
};
