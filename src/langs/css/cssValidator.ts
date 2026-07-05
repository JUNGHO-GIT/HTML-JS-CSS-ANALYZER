/**
 * @file cssValidator.ts
 * @since 2025-11-22
 * @description CSS 검증 및 Provider 클래스
 */

import { getCssExcludePatterns } from "@exportConsts";
import { cacheGet, cacheSet, clearWorkspaceCssFilesCache, ensureWorkspaceCssFiles, fetchCssContent, getWorkspaceCssFiles, parseSelectors, processCssFilesInBatches, readSelectorsFromFsPath } from "@exportLangs";
import { fs, path, vscode } from "@exportLibs";
import { isAnalyzable, logger, validateDocument, withPerformanceMonitoring } from "@exportScripts";
import { type SelectorPos, SelectorType } from "@exportTypes";
import type { CssStyleLoadOptions, CssSupportLike } from "@langs/css/cssType";

// CONSTANTS ---------------------------------------------------------------------------------------
const REMOTE_URL_RE = /^https?:\/\//i;
// 완성(completion) 단어 범위: 접두 기호 없이 식별자 본문만.
const WORD_RANGE_RE = /[\w-]+/;
// 정의(definition) 단어 범위: 반드시 . 또는 # 접두를 포함해야 오탐을 방지한다.
const DEFINITION_WORD_RE = /[.#][\w-]+/;
const HTML_FILE_RE = /\.html?$/i;
const STYLE_TAG_RE = /<style(?:\s[^>]*)?>([\S\s]*?)<\/style>/gi;
// href 경로의 / 를 허용([^>]*)하고, rel 이 href 앞/뒤 어느 순서든 매칭되도록 한다.
const LINK_STYLESHEET_RE = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
const HREF_ATTR_RE = /\bhref\s*=\s*(["'])([^"']+)\1/i;
const LEADING_SEP_RE = /^[/\\]+/;
const ID_ATTR_CTX_RE = /id\s*=\s*["'][^"']*$/;
const GET_ELEMENT_BY_ID_CTX_RE = /getElementById\s*\(\s*["'][^"']*$/;
const ID_SELECTOR_CTX_RE = /#[\w-]*$/;
const CLASS_ATTR_CTX_RE = /(?:class|className)\s*=\s*["'][^"']*$/;
const CLASS_LIST_CTX_RE = /classList\.(?:add|remove|toggle|contains|replace)\s*\(\s*["'][^"']*$/;
const GET_ELEMENTS_BY_CLASS_CTX_RE = /getElementsByClassName\s*\(\s*["'][^"']*$/;
const CLASS_SELECTOR_CTX_RE = /\.[\w-]*$/;
const QUERY_SELECTOR_CTX_RE = /(?:querySelector(?:All)?|\$)\s*\(\s*["'][^"']*$/;

// CSS PROVIDER CLASS ------------------------------------------------------------------------------
export class CssSupport implements vscode.CompletionItemProvider, vscode.DefinitionProvider, CssSupportLike {
  // 정규식 패턴 접근자들
  private get isRemoteUrl(): RegExp {
    return REMOTE_URL_RE;
  }
  private get wordRange(): RegExp {
    return WORD_RANGE_RE;
  }
  // -------------------------------------------------------------------------------------------------
  private readonly pendingStyles: Map<string, Promise<Map<string, SelectorPos[]>>> = new Map();
  private readonly pendingRemote: Map<string, Promise<SelectorPos[]>> = new Map();

  // -------------------------------------------------------------------------------------------------
  getRemote = async (url: string): Promise<SelectorPos[]> => {
    const cached = cacheGet(url);
    if (cached) {
      return cached.data;
    }
    // 동시 중복 fetch 를 막기 위해 URL 별 pending promise 를 재사용한다.
    const inflight = this.pendingRemote.get(url);
    if (inflight) {
      return inflight;
    }
    const promise = (async (): Promise<SelectorPos[]> => {
      try {
        const cssText = await fetchCssContent(url);
        const data = parseSelectors(cssText);
        cacheSet(url, { version: -1, data });
        return data;
      }
      catch {
        logger(`error`, `Remote CSS fetch failed: ${url}`);
        return [];
      }
    })();

    this.pendingRemote.set(url, promise);
    try {
      return await promise;
    }
    finally {
      this.pendingRemote.delete(url);
    }
  };

  // -------------------------------------------------------------------------------------------------
  getLocalDoc = async (doc: vscode.TextDocument, fullText?: string): Promise<SelectorPos[]> => {
    const key = doc.uri.toString();
    const ver = doc.version;
    const cached = cacheGet(key);
    const data: SelectorPos[] = cached?.version === ver ? cached.data : [];
    if (cached?.version === ver) {
      return data;
    }
    const txt = fullText ?? doc.getText();
    const isHtml = HTML_FILE_RE.test(doc.fileName) || doc.languageId === `html`;
    if (!isHtml) {
      const parsed = parseSelectors(txt);
      cacheSet(key, { version: ver, data: parsed });
      return parsed;
    }
    STYLE_TAG_RE.lastIndex = 0;
    let m = STYLE_TAG_RE.exec(txt);
    while (m) {
      const fullMatch = m[0];
      const cssContent = m[1] || ``;

      if (cssContent.trim().length > 0) {
        const local = parseSelectors(cssContent);
        const openTagEnd = fullMatch.indexOf(`>`) + 1;
        const bodyStartIdx = m.index + openTagEnd;

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
      m = STYLE_TAG_RE.exec(txt);
    }
    logger(`debug`, `style selectors: ${data.length} found`);
    cacheSet(key, { version: ver, data });
    return data;
  };

  // -------------------------------------------------------------------------------------------------
  private readonly fnGetLinkedStyles = async (doc: vscode.TextDocument, fullText?: string): Promise<Map<string, SelectorPos[]>> => {
    const map = new Map<string, SelectorPos[]>();
    if (!HTML_FILE_RE.test(doc.fileName) && doc.languageId !== `html`) {
      return map;
    }
    const text = fullText ?? doc.getText();
    LINK_STYLESHEET_RE.lastIndex = 0;
    let m = LINK_STYLESHEET_RE.exec(text);
    while (m) {
      const tag = m[0];
      const hrefMatch = HREF_ATTR_RE.exec(tag);
      const href = hrefMatch?.[2]?.trim() ?? ``;
      if (!href) {
        m = LINK_STYLESHEET_RE.exec(text);
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
              const candidate = path.join(workspaceFolder.uri.fsPath, targetPath.replace(LEADING_SEP_RE, ``));
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
            catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger(`error`, `read failed: ${href} -> ${errorMessage}`);
            }
          }
        }
      }
      catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger(`error`, `parsing error: ${href} -> ${errorMessage}`);
      }
      m = LINK_STYLESHEET_RE.exec(text);
    }
    logger(`debug`, `parsing: ${map.size} entries found for ${doc.fileName}`);
    return map;
  };

  // -------------------------------------------------------------------------------------------------
  getStyles = async (doc: vscode.TextDocument, options?: CssStyleLoadOptions): Promise<Map<string, SelectorPos[]>> => {
    const includeWorkspace = options?.includeWorkspace ?? true;
    const key = `${doc.uri.toString()}::${includeWorkspace ? `workspace` : `local`}`;
    const pending = this.pendingStyles.get(key);
    if (pending) {
      return pending;
    }
    const styleMap: Map<string, SelectorPos[]> = new Map();
    if (!isAnalyzable(doc)) {
      return styleMap;
    }
    const promise = (async () => {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
      const excludePatterns = getCssExcludePatterns(doc.uri);

      styleMap.set(doc.uri.toString(), await this.getLocalDoc(doc, options?.fullText));

      const linked = await this.fnGetLinkedStyles(doc, options?.fullText);
      for (const [k, v] of linked) {
        if (!styleMap.has(k)) {
          styleMap.set(k, v);
        }
      }
      if (includeWorkspace && workspaceFolder) {
        const files = await ensureWorkspaceCssFiles(workspaceFolder, excludePatterns);
        if (files.length > 0) {
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
  private readonly fnGetCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, kind: SelectorType): Promise<vscode.CompletionItem[]> => {
    const range = doc.getWordRangeAtPosition(position, this.wordRange);
    const allStyles = await this.getStyles(doc);
    const map = new Map<string, vscode.CompletionItem>();

    for (const selectors of allStyles.values()) {
      for (const sel of selectors) {
        if (sel.type === kind && !map.has(sel.selector)) {
          const itemKind = sel.type === SelectorType.ID ? vscode.CompletionItemKind.Value : vscode.CompletionItemKind.Enum;

          const item = new vscode.CompletionItem(sel.selector, itemKind);
          item.range = range;
          item.detail = kind === SelectorType.ID ? `CSS ID Selector` : `CSS Class Selector`;
          map.set(sel.selector, item);
        }
      }
    }
    return [...map.values()];
  };

  // -------------------------------------------------------------------------------------------------
  provideCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[] | undefined> => {
    if (!isAnalyzable(doc) || token.isCancellationRequested) {
      return undefined;
    }
    const line = doc.lineAt(position.line).text;
    const prefix = line.slice(0, position.character);

    // 1. ID 컨텍스트: id="...", getElementById('...'), #...
    const isIdContext = ID_ATTR_CTX_RE.test(prefix) || GET_ELEMENT_BY_ID_CTX_RE.test(prefix) || ID_SELECTOR_CTX_RE.test(prefix);

    // 2. Class 컨텍스트: class/className=, classList.*, getElementsByClassName, .class
    const isClassContext = CLASS_ATTR_CTX_RE.test(prefix) || CLASS_LIST_CTX_RE.test(prefix) || GET_ELEMENTS_BY_CLASS_CTX_RE.test(prefix) || CLASS_SELECTOR_CTX_RE.test(prefix);

    // 3. querySelector 컨텍스트 (class/id 모두 가능)
    const isQuerySelectorContext = QUERY_SELECTOR_CTX_RE.test(prefix);

    if (!isIdContext && !isClassContext && !isQuerySelectorContext) {
      return undefined;
    }
    let kind = SelectorType.CLASS;
    if (isIdContext) {
      kind = SelectorType.ID;
    }
    else if (isQuerySelectorContext) {
      // querySelector 는 커서 직전 문자로 판별: # → ID, 그 외 → Class
      kind = prefix.endsWith(`#`) ? SelectorType.ID : SelectorType.CLASS;
    }
    return this.fnGetCompletionItems(doc, position, kind);
  };

  // -------------------------------------------------------------------------------------------------
  provideDefinition = async (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition> => {
    if (!isAnalyzable(doc) || token.isCancellationRequested) {
      return [];
    }
    // 접두 기호(. 또는 #)를 포함한 범위만 인식하여 일반 단어에 대한 오탐 정의를 방지한다.
    const wordRange = doc.getWordRangeAtPosition(position, DEFINITION_WORD_RE);
    if (!wordRange) {
      return [];
    }
    const rawWord = doc.getText(wordRange);
    const prefix = rawWord.charAt(0);
    const target = rawWord.slice(1);
    if (!target) {
      return [];
    }
    const wantType = prefix === `#` ? SelectorType.ID : SelectorType.CLASS;
    const allStyles = await this.getStyles(doc);
    const locations: vscode.Location[] = [];

    for (const [uriString, selectors] of allStyles) {
      if (REMOTE_URL_RE.test(uriString)) {
        continue;
      }
      for (const s of selectors) {
        if (s.type !== wantType || s.selector !== target) {
          continue;
        }
        try {
          const uri = vscode.Uri.parse(uriString);
          locations.push(new vscode.Location(uri, new vscode.Position(s.line, s.col)));
        }
        catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger(`error`, `location parse failed: ${uriString} -> ${errorMessage}`);
        }
      }
    }
    return locations;
  };

  // -------------------------------------------------------------------------------------------------
  validate = async (doc: vscode.TextDocument, fullText?: string): Promise<vscode.Diagnostic[]> => withPerformanceMonitoring(`Document validation: ${path.basename(doc.fileName)}`, () => validateDocument(doc, this, fullText));

  // -------------------------------------------------------------------------------------------------
  clearWorkspaceIndex = (): void => {
    clearWorkspaceCssFilesCache();
  };
}
