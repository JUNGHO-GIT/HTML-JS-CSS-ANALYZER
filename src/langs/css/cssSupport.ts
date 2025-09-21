// src/langs/css/cssSupport.ts

import * as vscode from "vscode";
import * as https from "https";
import * as http from "http";
import * as path from "path";
import * as fs from "fs";
import {type SelectorPos, SelectorType} from "../types/common.js";
import {parseSelectors} from "./cssParser.js";
import {cacheGet, cacheSet} from "./cssCache.js";
import {getCssExcludePatterns} from "../../configs/setting.js";
import {isUriExcludedByGlob} from "../../utils/glob.js";
import {isAnalyzable} from "../../utils/filter.js";
import {log} from "../../utils/logger.js";
import {validateDocument} from "../../configs/validate.js";

const ZERO_POS = new vscode.Position(0, 0);

export class CssSupport implements vscode.CompletionItemProvider, vscode.DefinitionProvider {
  // Simple regex getters -------------------------------------------------
  get isRemote (): RegExp { return /^https?:\/\//i; }
  get wordRange (): RegExp { return /[_a-zA-Z0-9-]+/; }
  get canComplete (): RegExp { return /(id|class|className|[.#])\s*[=:]?\s*["'`]?[^\n]*$|classList\.(add|remove|toggle)\s*\([^)]*$|querySelector(All)?\s*\(\s*["'`][^)]*$/i; }

  // Fetch remote stylesheet ---------------------------------------------
  fetch = async (url: string): Promise<string> => {
    try {
      if (typeof (globalThis as any).fetch === "function") {
        const res = await (globalThis as any).fetch(url);
        if (res && res.ok) return await res.text();
        throw new Error(res ? (res.statusText || `HTTP ${res.status}`) : "fetch failed");
      }
      return await new Promise<string>((resolve, reject) => {
        const lib = url.startsWith("https") ? https : http;
        const req = lib.get(url, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) reject(new Error(`HTTP ${res.statusCode}`)); else resolve(data);
          });
        });
        req.on("error", (e) => reject(e));
      });
    } catch (err: any) {
      log("error", `fetch(${url}) failed: ${err?.message || err}`);
    }
    return "";
  };

  // Remote stylesheet parsing -------------------------------------------
  async getRemote (url: string): Promise<SelectorPos[]> {
    const cached = cacheGet(url);
    if (cached) return cached.data;
    const data = parseSelectors(await this.fetch(url));
    cacheSet(url, {version: -1, data});
    return data;
  }

  // Local (file / embedded <style>) parsing ------------------------------
  async getLocalDoc (doc: vscode.TextDocument): Promise<SelectorPos[]> {
    const key = doc.uri.toString();
    const ver = doc.version;
    const cached = cacheGet(key);
    if (cached && cached.version === ver) return cached.data;
    const txt = doc.getText();
    let data: SelectorPos[] = [];
    const isHtml = /\.html?$/i.test(doc.fileName) || doc.languageId === "html";
    if (isHtml) {
      const styleRegex = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi;
      let m: RegExpExecArray | null;
      while ((m = styleRegex.exec(txt))) {
        const cssBody = m[1];
        const local = parseSelectors(cssBody);
        const bodyStartIdx = m.index + m[0].indexOf(cssBody);
        for (const sel of local) {
          const absIndex = bodyStartIdx + sel.index;
          const pos = doc.positionAt(absIndex);
          data.push({index: absIndex, line: pos.line, col: pos.character, type: sel.type, selector: sel.selector});
        }
      }
      log("debug", `embedded style selectors: ${data.length}`);
    } else {
      data = parseSelectors(txt);
    }
    cacheSet(key, {version: ver, data});
    return data;
  }

  // Linked stylesheet (<link rel="stylesheet" href="...">) 수집 ------------------------------
  private async getLinkedStyles (doc: vscode.TextDocument): Promise<Map<string, SelectorPos[]>> {
    const map = new Map<string, SelectorPos[]>();
    if (!/\.html?$/i.test(doc.fileName) && doc.languageId !== "html") {
      return map;
    }
    const text = doc.getText();
    const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(text))) {
      const tag = m[0];
      const hrefMatch = tag.match(/href\s*=\s*(["'])([^"']+)\1/i);
      if (!hrefMatch) {
        continue;
      }
      const href = hrefMatch[2].trim();
      if (!href) {
        continue;
      }
      try {
        if (this.isRemote.test(href)) {
          if (!map.has(href)) map.set(href, await this.getRemote(href));
        } else {
          let targetPath = href;
          if (!path.isAbsolute(targetPath)) {
            const baseDir = path.dirname(doc.uri.fsPath);
            targetPath = path.join(baseDir, targetPath);
          }
          targetPath = path.normalize(targetPath);
          if (fs.existsSync(targetPath)) {
            try {
              const sels = await this.readSelectorsFromFsPath(targetPath);
              map.set(vscode.Uri.file(targetPath).toString(), sels);
            }
            catch (e: any) {
              log("error", `fs read linked stylesheet failed: ${href} -> ${e?.message || e}`);
            }
          }
        }
      }
      catch (e: any) {
        log("error", `linked stylesheet parse error: ${href} -> ${e?.message || e}`);
      }
    }
    return map;
  }

  // Aggregate all configured styles -------------------------------------
  getStyles = async (doc: vscode.TextDocument): Promise<Map<string, SelectorPos[]>> => {
    const styleMap: Map<string, SelectorPos[]> = new Map();
    if (!isAnalyzable(doc)) {
      return styleMap;
    }
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    const excludePatterns = getCssExcludePatterns(doc.uri);

    // 1) 현재 문서 자체 (HTML 내 embedded 또는 CSS 자체)
    styleMap.set(doc.uri.toString(), await this.getLocalDoc(doc));

    // 2) HTML 문서라면 link rel=stylesheet 처리
    const linked = await this.getLinkedStyles(doc);
    for (const [k, v] of linked) {
      if (!styleMap.has(k)) {
        styleMap.set(k, v);
      }
    }

    // 3) 워크스페이스 전체 *.css / *.scss (최초 1회 파일 목록 캐시 후 재사용)
    if (workspaceFolder) {
      await this.ensureWorkspaceCssFiles(workspaceFolder, excludePatterns);
      if (workspaceCssFiles) {
        for (const filePath of workspaceCssFiles) {
          const uri = vscode.Uri.file(filePath);
            const k = uri.toString();
            if (styleMap.has(k)) {
              continue;
            }
            try {
              const sels = await this.readSelectorsFromFsPath(filePath);
              styleMap.set(k, sels);
            }
            catch (e: any) {
              log("error", `fs read css file failed: ${filePath} -> ${e?.message || e}`);
            }
        }
      }
    }
    return styleMap;
  };

  // 파일 시스템에서 직접 읽어 파싱 (openTextDocument 사용 지양) -------------------------------
  private async readSelectorsFromFsPath (fsPath: string): Promise<SelectorPos[]> {
    try {
      const stat = await fs.promises.stat(fsPath);
      const key = `fs://${fsPath}`;
      const cached = cacheGet(key);
      if (cached && cached.version === stat.mtimeMs) {
        return cached.data;
      }
      const content = await fs.promises.readFile(fsPath, "utf8");
      const parsed = parseSelectors(content);
      cacheSet(key, {version: stat.mtimeMs, data: parsed});
      return parsed;
    }
    catch (e: any) {
      log("error", `readSelectorsFromFsPath failed: ${fsPath} -> ${e?.message || e}`);
      return [];
    }
  }

  // Build completion list ------------------------------------------------
  private async getCompletionItems (doc: vscode.TextDocument, position: vscode.Position, kind: SelectorType): Promise<vscode.CompletionItem[]> {
    const range = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
    const allStyles = await this.getStyles(doc);
    const map = new Map<string, vscode.CompletionItem>();
    for (const selectors of allStyles.values()) {
      for (const sel of selectors) {
        if (sel.type === kind && !map.has(sel.selector)) {
          const item = new vscode.CompletionItem(sel.selector, sel.type === SelectorType.ID ? vscode.CompletionItemKind.Value : vscode.CompletionItemKind.Enum);
          item.range = range;
          map.set(sel.selector, item);
        }
      }
    }
    return [...map.values()];
  }

  // VS Code CompletionItemProvider ---------------------------------------
  async provideCompletionItems (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.CompletionItem[] | undefined> {
  if (!isAnalyzable(doc)) {
    return undefined;
  }
    if (token.isCancellationRequested) return undefined;
    const prefixText = doc.getText(new vscode.Range(ZERO_POS, position));
    if (this.canComplete.test(prefixText)) {
      const isIdCtx = /(?:\bid\s*[=:]|[#])\s*["'`]?[^]*$/.test(prefixText);
      const kind = isIdCtx ? SelectorType.ID : SelectorType.CLASS;
      return await this.getCompletionItems(doc, position, kind);
    }
    return undefined;
  }

  // VS Code DefinitionProvider -------------------------------------------
  async provideDefinition (doc: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition> {
  if (!isAnalyzable(doc) || token.isCancellationRequested) {
    return [];
  }
    const wordRange = doc.getWordRangeAtPosition(position, this.wordRange as unknown as RegExp);
    if (!wordRange) return [];
    const allStyles = await this.getStyles(doc);
    const target = doc.getText(wordRange);
    const locations: vscode.Location[] = [];
    for (const entry of allStyles) {
      if (/^https?:\/\//i.test(entry[0])) continue; // skip remote for definition
      for (const s of entry[1]) if (s.selector === target) locations.push(new vscode.Location(vscode.Uri.parse(entry[0]), new vscode.Position(s.line, s.col)));
    }
    return locations;
  }

  // Delegate validation --------------------------------------------------
  async validate (doc: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    return validateDocument(doc, this);
  }

  // 워크스페이스 CSS 파일 목록 캐시 초기화
  clearWorkspaceIndex () {
    workspaceCssFiles = null;
  }

  // 내부: 워크스페이스 CSS/SCSS 파일 목록 1회 수집
  private async ensureWorkspaceCssFiles (folder: vscode.WorkspaceFolder, excludePatterns: string[]) {
    if (workspaceCssFiles) {
      return;
    }
    const MAX = 500; // 하드 제한 (너무 많을 경우 성능 보호)
    const collected: string[] = [];
    try {
      const patterns = ["**/*.css", "**/*.scss"];
      for (const glob of patterns) {
        if (collected.length >= MAX) {
          break;
        }
        const include = new vscode.RelativePattern(folder, glob);
        const uris = await vscode.workspace.findFiles(include);
        for (const uri of uris) {
          if (collected.length >= MAX) {
            break;
          }
          if (isUriExcludedByGlob(uri, excludePatterns)) {
            continue;
          }
          collected.push(uri.fsPath);
        }
      }
      if (collected.length >= MAX) {
        log("info", `workspace css file limit reached (${MAX}), remaining files ignored.`);
      }
    }
    catch (e: any) {
      log("error", `ensureWorkspaceCssFiles error: ${e?.message || e}`);
    }
    workspaceCssFiles = collected;
  }
}

// 모듈 레벨 캐시 (파일 경로 목록)
let workspaceCssFiles: string[] | null = null;
