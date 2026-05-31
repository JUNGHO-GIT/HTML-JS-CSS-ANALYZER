/**
 * @file cssValidator.ts
 * @since 2025-11-22
 * @description CSS 검증 및 Provider 클래스
 */

import { getCssExcludePatterns as gtCsExPa } from "@exportConsts";
import { cacheGet, cacheSet, clearWorkspaceCssFilesCache as clrWsCsFlCc, ensureWorkspaceCssFiles as ensrWsCssFls, fetchCssContent as ftchCssCont, getWorkspaceCssFiles as gtWsCssFls, parseSelectors as prsSels, processCssFilesInBatches as proCsFlInBt, readSelectorsFromFsPath as rdSeFrFsPt } from "@exportLangs";
import { fs, path, vscode } from "@exportLibs";
import { isAnalyzable, logger, validateDocument as valDoc, withPerformanceMonitoring as wthPerfMon } from "@exportScripts";
import { type SelectorPos, SelectorType } from "@exportTypes";
import type { CssStyleLoadOptions as CssStLdOp, CssSupportLike as CssSupLk } from "@langs/css/cssType";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const RMT_URL_RE = /^https?:\/\//i;
const WRD_RNG_RE = /[\w-]+/;
const HTML_FL_RE = /\.html?$/i;
const STYL_TG_RE = /<style(?:\s[^>]*)?>([\S\s]*?)<\/style>/gi;
const LNK_STYL_RE = /<link\s+[^/>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
const HRF_ATTR_RE = /\bhref\s*=\s*(["'])([^"']+)\1/i;
const RRPR = /^[/\\]+/;
const IACR = /id\s*=\s*["'][^"']*$/;
const GEBICR = /getElementById\s*\(\s*["'][^"']*$/;
const ISCR = /#[\w-]*$/;
const CACR = /(?:class|className)\s*=\s*["'][^"']*$/;
const CLCR = /classList\.(?:add|remove|toggle|contains|replace)\s*\(\s*["'][^"']*$/;
const GEBCCR = /getElementsByClassName\s*\(\s*["'][^"']*$/;
const CSCR = /\.[\w-]*$/;
const QSCR = /(?:querySelector(?:All)?|\$)\s*\(\s*["'][^"']*$/;

// CSS PROVIDER CLASS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export class CssSupport implements vscode.CompletionItemProvider, vscode.DefinitionProvider, CssSupLk {
  // 정규식 패턴 접근자들
  private get isRemoteUrl(): RegExp {
    return RMT_URL_RE;
  }
  private get wordRange(): RegExp {
    return WRD_RNG_RE;
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private readonly pendingStyles: Map<string, Promise<Map<string, SelectorPos[]>>> = new Map();

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  getRemote = async (url: string): Promise<SelectorPos[]> => {
    const cached = cacheGet(url);
    return cached ? cached.data : (async () => {
          try {
            const cssText = await ftchCssCont(url);
            const data = prsSels(cssText);
            cacheSet(url, { version: -1, data });
            return data;
          }
          catch {
            logger(`error`, `Remote CSS fetch failed: ${url}`);
            return [];
          }
        })();
  };

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  getLocalDoc = async (doc: vscode.TextDocument, fullText?: string): Promise<SelectorPos[]> => {
    const key = doc.uri.toString();
    const ver = doc.version;
    const cached = cacheGet(key);
    let data: SelectorPos[] = cached?.version === ver ? cached.data : [];
    if (cached?.version !== ver) {
      const txt = fullText ?? doc.getText();
      const isHtml = HTML_FL_RE.test(doc.fileName) || doc.languageId === `html`;
      if (isHtml) {
        STYL_TG_RE.lastIndex = 0;
        let m = STYL_TG_RE.exec(txt);
        while (m) {
          const fullMatch = m[0];
          const cssContent = m[1] || ``;

          if (cssContent.trim().length > 0) {
            const local = prsSels(cssContent);
            const opnnTgEnd = fullMatch.indexOf(`>`) + 1;
            const bodyStartIdx = m.index + opnnTgEnd;

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
          m = STYL_TG_RE.exec(txt);
        }
        logger(`debug`, `style selectors: ${data.length} found`);
      }
      else {
        data = prsSels(txt);
      }
      cacheSet(key, { version: ver, data });
    }
    return data;
  };

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private readonly fnGetLinkedStyles = async (doc: vscode.TextDocument, fullText?: string): Promise<Map<string, SelectorPos[]>> => {
    const map = new Map<string, SelectorPos[]>();
    if (!HTML_FL_RE.test(doc.fileName) && doc.languageId !== `html`) {
    	return map;
    }
    const text = fullText ?? doc.getText();
    LNK_STYL_RE.lastIndex = 0;
    let m = LNK_STYL_RE.exec(text);
    while (m) {
      const tag = m[0];
      const hrefMatch = HRF_ATTR_RE.exec(tag);
      const href = hrefMatch?.[2]?.trim() ?? ``;
      if (href) {
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
              const wsFldr = vscode.workspace.getWorkspaceFolder(doc.uri);
              if (wsFldr && (targetPath.startsWith(path.sep) || targetPath.startsWith(`/`))) {
                const candidate = path.join(wsFldr.uri.fsPath, targetPath.replace(RRPR, ``));
                if (fs.existsSync(candidate)) {
                  targetPath = path.normalize(candidate);
                }
              }
            }
            if (fs.existsSync(targetPath)) {
              try {
                const sels = await rdSeFrFsPt(targetPath);
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
      }
      m = LNK_STYL_RE.exec(text);
    }
    logger(`debug`, `parsing: ${map.size} entries found for ${doc.fileName}`);
    return map;
  };

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  getStyles = async (doc: vscode.TextDocument, options?: CssStLdOp): Promise<Map<string, SelectorPos[]>> => {
    const incWs = options?.includeWorkspace ?? true;
    const key = `${doc.uri.toString()}::${incWs ? `workspace` : `local`}`;
    const pending = this.pendingStyles.get(key);
    if (pending) {
      return pending;
    }
    const styleMap: Map<string, SelectorPos[]> = new Map();
    if (!isAnalyzable(doc)) {
    	return styleMap;
    }
    const promise = (async () => {
      const wsFldr = vscode.workspace.getWorkspaceFolder(doc.uri);
      const exclPats = gtCsExPa(doc.uri);

      styleMap.set(doc.uri.toString(), await this.getLocalDoc(doc, options?.fullText));

      const linked = await this.fnGetLinkedStyles(doc, options?.fullText);
      for (const [k, v] of linked) {
        if (!styleMap.has(k)) {
        	styleMap.set(k, v);
        }
      }
      if (incWs && wsFldr) {
        const files = await ensrWsCssFls(wsFldr, exclPats);
        if (files.length > 0) {
        	await proCsFlInBt(files, styleMap);
        }
      }
      logger(`debug`, `collected: ${styleMap.size} entries (workspace files: ${gtWsCssFls()?.length ?? 0}) for ${doc.fileName}`);

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

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private readonly fnGetCompletionItems = async (doc: vscode.TextDocument, position: vscode.Position, kind: SelectorType): Promise<vscode.CompletionItem[]> => {
    const range = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
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

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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
    const isIdContext = IACR.test(prefix) || GEBICR.test(prefix) || ISCR.test(prefix);

    // 2. Check for Class context
    // class="...", class='...', class=...
    // className="...", className='...'
    // classList.add('...'), .remove('...'), .toggle('...'), .contains('...')
    // getElementsByClassName('...')
    // .class...
    const isClssCtx = CACR.test(prefix) || CLCR.test(prefix) || GEBCCR.test(prefix) || CSCR.test(prefix);

    // 3. Check for QuerySelector context (can be both)
    // querySelector('...'), querySelectorAll('...')
    // $ ('...') (jQuery)
    const isQrySelCtx = QSCR.test(prefix);

    if (!isIdContext && !isClssCtx && !isQrySelCtx) {
      return undefined;
    }
    let kind = SelectorType.CLASS;
    if (isIdContext) {
    	kind = SelectorType.ID;
    }
    else if (isQrySelCtx) {
    	// If querySelector, check the last character before cursor
      // If it's #, then ID. If ., then Class. Default to both? // For now, let's try to infer from the last char.
      kind = prefix.endsWith(`#`) ? SelectorType.ID : SelectorType.CLASS;
    }
    return this.fnGetCompletionItems(doc, position, kind);
  };

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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

    for (const [uriString, selectors] of allStyles) {
      if (RMT_URL_RE.test(uriString)) {
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

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  validate = async (doc: vscode.TextDocument, fullText?: string): Promise<vscode.Diagnostic[]> => wthPerfMon(`Document validation: ${path.basename(doc.fileName)}`, () => valDoc(doc, this, fullText));

  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  clearWorkspaceIndex = (): void => {
    clrWsCsFlCc();
  };
}
