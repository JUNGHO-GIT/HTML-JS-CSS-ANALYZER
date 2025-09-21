// src/langs/html/htmlHint.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {createRequire} from "module"; // ESM 환경에서 CJS 모듈(htmlhint) 로드를 위해 사용
import {log} from "../../utils/logger.js";
import {CodeAction, CodeActionKind, Diagnostic, Position, Range, TextEdit} from "vscode";

// htmlhint 로더 (ESM + "type":"module" 패키지에서 기존 require 직접 호출 시 ReferenceError 발생)
// createRequire 를 통해 CommonJS 패키지(htmlhint)를 안전하게 로드. 실패 시 null 유지하여 기능 비활성화.
let htmlhint: any | null = null;
(() => {
  try {
    // 일부 타입 환경에서 import.meta.url 선언이 없을 수 있으므로 any 캐스트
    const meta: any = import.meta as any;
    const metaUrl: string = meta && meta.url ? meta.url : path.join("/", "index.js"); // fallback path (static)
    const req = createRequire(metaUrl);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    htmlhint = req("htmlhint");
  } catch (e: any) {
    htmlhint = null;
    log("debug", `htmlhint not loaded (optional): ${e?.message || e}`);
  }
})();

interface HtmlHintError { line: number; col: number; rule: {id: string}; message: string; raw?: string; }

// ---------------------------------- small helpers ----------------------------------
const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

const getRuleId = (d: Diagnostic): string | undefined => {
  try {
    return (d as any).data?.ruleId ?? d.code?.toString();
  } catch {
    return undefined;
  }
};

const getDocLine = (doc: vscode.TextDocument, oneBasedLine: number): string => {
  if (doc.lineCount <= 0) {
    return "";
  }
  const idx = clamp(oneBasedLine - 1, 0, doc.lineCount - 1);
  return doc.lineAt(idx).text;
};

const getHeadMatch = (text: string) => {
  return text.match(/<head(\s[^>]*)?>([\s\S]*?)<\/head>/i);
};

const makeQuickFix = (title: string, editBuilder: (we: vscode.WorkspaceEdit) => void, diagnostic: Diagnostic) => {
  const ca = new CodeAction(title, CodeActionKind.QuickFix);
  const we = new vscode.WorkspaceEdit();
  editBuilder(we);
  ca.edit = we;
  ca.diagnostics = [diagnostic];
  return ca;
};

// 간단 설정 탐색 (.htmlhintrc 또는 .htmlhintrc.json) - 상위 디렉토리로 올라가며 최초 발견 사용
const loadConfig = (filePath: string): any => {
  try {
    let base = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    const root = path.parse(base).root;
    while (true) {
      for (const name of [".htmlhintrc", ".htmlhintrc.json"]) {
        const f = path.join(base, name);
        if (fs.existsSync(f)) {
          try {
            const txt = fs.readFileSync(f, "utf8");
            return JSON.parse(txt);
          } catch (e: any) {
            log("error", `htmlhint config parse error: ${f} -> ${e?.message || e}`);
            return {};
          }
        }
      }
      if (base === root) {
        break;
      }
      const parent = path.dirname(base);
      if (parent === base) {
        break;
      }
      base = parent;
    }
  } catch {
    // ignore
  }
  return {};
};

// HTMLHint 실행 (htmlhint 없으면 빈 배열)
export const runHtmlHint = (doc: vscode.TextDocument): vscode.Diagnostic[] => {
  // Regression note: if htmlhint fails to load (null), simply return []; Extension still functions (CSS diagnostics).
  // To verify manually: create an HTML missing <!DOCTYPE html> and run command 'Html-Js-Css-Analyzer: Validate Current Document'.
  if (!htmlhint) {
    return [];
  }
  try {
    const engine = (htmlhint.default || htmlhint.HTMLHint || htmlhint);
    const config = loadConfig(doc.uri.fsPath);
    const text = doc.getText();
    const errors: HtmlHintError[] = engine.verify(text, config) || [];
    const diags: vscode.Diagnostic[] = [];
    for (const err of errors) {
      const line = Math.max(err.line - 1, 0);
      const col = Math.max(err.col - 1, 0);
      const start = new vscode.Position(line, col);
      const len = Math.max((err.raw?.length || 1), 1);
      // 라인 길이 초과 방지 (VS Code Position 범위 안전)
      const lineText = doc.lineAt(Math.min(line, doc.lineCount - 1)).text;
      const endCol = Math.min(col + len, lineText.length > 0 ? lineText.length : col + len);
      const end = new vscode.Position(line, endCol);
      const range = new vscode.Range(start, end);
      const d = new vscode.Diagnostic(range, err.message, vscode.DiagnosticSeverity.Warning);
      d.source = "htmlhint";
      d.code = err.rule?.id;
      (d as any).data = {ruleId: err.rule?.id, line: err.line, col: err.col, raw: err.raw};
      diags.push(d);
    }
    return diags;
  } catch (e: any) {
    log("error", `runHtmlHint error: ${e?.message || e}`);
    return [];
  }
};

// ---------------- Code Actions (간소화된 일부 rule) -----------------------------------------
type FixFactory = (doc: vscode.TextDocument, d: Diagnostic) => CodeAction | null;

const createLangFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "html-lang-require") {
    return null;
  }
  const text = doc.getText();
  const match = text.match(/<html(\s[^>]*)?>/i);
  if (!match || match[0].includes("lang=")) {
    return null;
  }
  const start = doc.positionAt((match.index as number) + 5);
  return makeQuickFix('Add lang="en"', (we) => {
    we.insert(doc.uri, start, ' lang="en"');
  }, diagnostic);
};

const createTitleFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "title-require") {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (/<title(\s[^>]*)?>/i.test(head[2])) {
    return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(">") + 1;
  const insertPos = doc.positionAt(headStart);
  return makeQuickFix("Add <title>", (we) => {
    we.insert(doc.uri, insertPos, "\n    <title>Document</title>");
  }, diagnostic);
};

const createDoctypeFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "doctype-first") {
    return null;
  }
  const text = doc.getText();
  if (/<!doctype/i.test(text.substring(0, 50))) {
    return null;
  }
  const pos = new Position(0, 0);
  return makeQuickFix("Add <!DOCTYPE html>", (we) => {
    we.insert(doc.uri, pos, "<!DOCTYPE html>\n");
  }, diagnostic);
};

// attr-value-double-quotes ------------------------------------------------------
const createAttrValueDoubleQuotesFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-value-double-quotes") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const singleQuotePattern = /(\w[\w:-]*)='([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = singleQuotePattern.exec(lineStr))) {
    const startCol = m.index;
    const endCol = startCol + m[0].length;
    const col = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - col) <= 10) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      const newText = `${m[1]}="${m[2]}"`;
      return makeQuickFix("Change attribute quotes to double quotes", (we) => {
        we.replace(doc.uri, new Range(start, end), newText);
      }, diagnostic);
    }
  }
  return null;
};

// tagname-lowercase --------------------------------------------------------------
const createTagnameLowercaseFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "tagname-lowercase") {
    return null;
  }
  const info = (diagnostic as any).data;
  const lineStr = getDocLine(doc, info?.line);
  if (!lineStr) {
    return null;
  }
  const tagPattern = /<\/?([A-Z][A-Za-z0-9]*)\b/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = tagPattern.exec(lineStr))) {
    const startCol = m.index + 1 + (m[0].startsWith("</") ? 1 : 0);
    const endCol = startCol + m[1].length;
    if (Math.abs(m.index - col) <= 5) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      return makeQuickFix("Convert tag to lowercase", (we) => {
        we.replace(doc.uri, new Range(start, end), m![1].toLowerCase());
      }, diagnostic);
    }
  }
  return null;
};

// attr-lowercase ---------------------------------------------------------------
const createAttrLowercaseFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-lowercase") {
    return null;
  }
  const info = (diagnostic as any).data;
  const lineStr = getDocLine(doc, info?.line);
  if (!lineStr) {
    return null;
  }
  const attrPattern = /\s([A-Z][A-Za-z0-9-_]*)\s*=/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = attrPattern.exec(lineStr))) {
    const startCol = m.index + 1;
    const endCol = startCol + m[1].length;
    if (Math.abs(startCol - col) <= 5) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      return makeQuickFix("Convert attribute to lowercase", (we) => {
        we.replace(doc.uri, new Range(start, end), m![1].toLowerCase());
      }, diagnostic);
    }
  }
  return null;
};

// meta-charset-require ---------------------------------------------------------
const createMetaCharsetRequireFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "meta-charset-require") {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (/<meta\s+charset\s*=\s*["'][^"']*["'][^>]*>/i.test(head[2])) {
    return null;
  }
  const insert = (head.index as number) + head[0].indexOf(">") + 1;
  const pos = doc.positionAt(insert);
  return makeQuickFix('Add <meta charset="UTF-8">', (we) => {
    we.insert(doc.uri, pos, '\n    <meta charset="UTF-8">');
  }, diagnostic);
};

// meta-viewport-require --------------------------------------------------------
const createMetaViewportRequireFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "meta-viewport-require") {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (/<meta\s+name\s*=\s*["']viewport["'][^>]*>/i.test(head[2])) {
    return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(">") + 1;
  const metaCharset = head[2].match(/<meta\s+charset\s*=\s*["'][^"']*["'][^>]*>/i);
  const insert = metaCharset ? headStart + (metaCharset.index as number) + metaCharset[0].length : headStart;
  const pos = doc.positionAt(insert);
  return makeQuickFix('Add <meta name="viewport">', (we) => {
    we.insert(doc.uri, pos, '\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  }, diagnostic);
};

// meta-description-require -----------------------------------------------------
const createMetaDescriptionRequireFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "meta-description-require") {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (/<meta\s+name\s*=\s*["']description["'][^>]*>/i.test(head[2])) {
    return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(">") + 1;
  const metaViewport = head[2].match(/<meta\s+name\s*=\s*["']viewport["'][^>]*>/i);
  const metaCharset = head[2].match(/<meta\s+charset\s*=\s*["'][^"']*["'][^>]*>/i);
  let insert = headStart;
  if (metaViewport) {
    insert = headStart + (metaViewport.index as number) + metaViewport[0].length;
  }
  else if (metaCharset) {
    insert = headStart + (metaCharset.index as number) + metaCharset[0].length;
  }
  const pos = doc.positionAt(insert);
  return makeQuickFix('Add <meta name="description">', (we) => {
    we.insert(doc.uri, pos, '\n    <meta name="description" content="">');
  }, diagnostic);
};

// alt-require -----------------------------------------------------------------
const createAltRequireFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "alt-require") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const tagPattern = /<(img|area)([^>]*)>/gi;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = tagPattern.exec(lineStr))) {
    if (!/\balt\s*=/.test(m[0])) {
      const startCol = m.index;
      if (Math.abs(startCol - col) <= 40) {
        // 태그명 직후 위치로 삽입
        const insertCol = m.index + 1 + m[1].length;
        const hasSpace = /\s/.test(lineStr.charAt(insertCol));
        const pos = new Position(info.line - 1, insertCol);
        return makeQuickFix('Add alt=""', (we) => {
          we.insert(doc.uri, pos, (hasSpace ? "" : " ") + 'alt="" ');
        }, diagnostic);
      }
    }
  }
  return null;
};

// button-type-require ---------------------------------------------------------
const createButtonTypeRequireFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "button-type-require") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const tagPattern = /<button([^>]*)>/gi;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = tagPattern.exec(lineStr))) {
    if (!/\btype\s*=/.test(m[0])) {
      const startCol = m.index;
      if (Math.abs(startCol - col) <= 40) {
        const insertCol = m.index + "<button".length;
        const hasSpace = /\s/.test(lineStr.charAt(insertCol));
        const pos = new Position(info.line - 1, insertCol);
        return makeQuickFix('Add type="button"', (we) => {
          we.insert(doc.uri, pos, (hasSpace ? "" : " ") + 'type="button" ');
        }, diagnostic);
      }
    }
  }
  return null;
};

// attr-no-unnecessary-whitespace ----------------------------------------------
const createAttrNoUnnecessaryWhitespaceFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-no-unnecessary-whitespace") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const simpler = /(\w[\w:-]*)\s*=\s*(["'])(\s+)([^"']*?)(\s+)(\2)/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = simpler.exec(lineStr))) {
    const startCol = m.index;
    if (Math.abs(startCol - col) <= 50) {
      const cleaned = `${m[1]}=${m[2]}${m[4].trim()}${m[2]}`;
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + m[0].length);
      return makeQuickFix("Trim attribute value whitespace", (we) => {
        we.replace(doc.uri, new Range(start, end), cleaned);
      }, diagnostic);
    }
  }
  return null;
};

// attr-whitespace -------------------------------------------------------------
const createAttrWhitespaceFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-whitespace") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const pattern = /(\w[\w:-]*)\s*=\s*(["'][^"']*["'])/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = pattern.exec(lineStr))) {
    const raw = m[0];
    if (/\s=\s|\s=|=\s/.test(raw)) {
      const startCol = m.index;
      if (Math.abs(startCol - col) <= 40) {
        const fixed = `${m[1]}=${m[2]}`;
        const start = new Position(info.line - 1, startCol);
        const end = new Position(info.line - 1, startCol + raw.length);
        return makeQuickFix("Normalize attribute spacing", (we) => {
          we.replace(doc.uri, new Range(start, end), fixed);
        }, diagnostic);
      }
    }
  }
  return null;
};

// tag-self-close --------------------------------------------------------------
const VOID_TAGS = new Set(["br", "hr", "img", "meta", "link", "input", "source", "embed", "param", "track", "area", "col", "base"]);
const createTagSelfCloseFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "tag-self-close") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  // <img ...> -> <img ... /> 및 </br> 제거
  const voidOpen = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = voidOpen.exec(lineStr))) {
    const tag = m[1].toLowerCase();
    if (!VOID_TAGS.has(tag)) {
      continue;
    }
    if (/\/>$/.test(m[0])) {
      continue;
    }
    const startCol = m.index;
    if (Math.abs(startCol - col) <= 50) {
      const attrs = m[2].trim();
      const fixed = attrs.length > 0 ? `<${m[1]} ${attrs} />` : `<${m[1]} />`;
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + m[0].length);
      return makeQuickFix("Self-close void element", (we) => {
        we.replace(doc.uri, new Range(start, end), fixed);
      }, diagnostic);
    }
  }
  const badClose = /<\/(br|hr|img|meta|link|input|source|embed|param|track|area|col|base)\s*>/ig;
  let c: RegExpExecArray | null;
  while ((c = badClose.exec(lineStr))) {
    const startCol = c.index;
    const colNear = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - colNear) <= 20) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + c[0].length);
      return makeQuickFix("Remove invalid closing tag", (we) => {
        we.delete(doc.uri, new Range(start, end));
      }, diagnostic);
    }
  }
  return null;
};

// tag-no-obsolete -------------------------------------------------------------
const OBSOLETE_TAGS = ["center", "font", "big", "strike", "tt", "acronym", "applet", "basefont", "bgsound", "blink", "marquee"];
const createTagNoObsoleteFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "tag-no-obsolete") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const pattern = /<\/?.+?>/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = pattern.exec(lineStr))) {
    const tagName = m[0].replace(/<\/?\s*([a-zA-Z0-9-]+).*/, "$1").toLowerCase();
    if (OBSOLETE_TAGS.includes(tagName)) {
      const startCol = m.index;
      if (Math.abs(startCol - col) <= 30) {
        const start = new Position(info.line - 1, startCol);
        const end = new Position(info.line - 1, startCol + m[0].length);
        return makeQuickFix("Remove obsolete tag", (we) => {
          we.delete(doc.uri, new Range(start, end));
        }, diagnostic);
      }
    }
  }
  return null;
};

// spec-char-escape ------------------------------------------------------------
const createSpecCharEscapeFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== "spec-char-escape") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  if (col < 0 || col >= lineStr.length) {
    return null;
  }
  const ch = lineStr[col];
  if (ch !== "&" && ch !== "<" && ch !== ">") {
    return null;
  }
  // 태그 내부(<...>)는 제외 (간단 판단)
  const openCount = (lineStr.slice(0, col).match(/</g) || []).length;
  const closeCount = (lineStr.slice(0, col).match(/>/g) || []).length;
  if (openCount > closeCount) {
    return null;
  }
  let replacement = "";
  if (ch === "&") {
    if (/^&[a-zA-Z]+;/.test(lineStr.slice(col))) {
      return null;
    }
    replacement = "&amp;";
  }
  else if (ch === "<") {
    replacement = "&lt;";
  }
  else if (ch === ">") {
    replacement = "&gt;";
  }
  if (!replacement) {
    return null;
  }
  const start = new Position(info.line - 1, col);
  const end = new Position(info.line - 1, col + 1);
  return makeQuickFix("Escape special character", (we) => {
    we.replace(doc.uri, new Range(start, end), replacement);
  }, diagnostic);
};

// factories 확장
const factories: FixFactory[] = [
  createLangFix,
  createTitleFix,
  createDoctypeFix,
  createAttrValueDoubleQuotesFix,
  createTagnameLowercaseFix,
  createAttrLowercaseFix,
  createMetaCharsetRequireFix,
  createMetaViewportRequireFix,
  createMetaDescriptionRequireFix,
  createAltRequireFix,
  createButtonTypeRequireFix,
  createAttrNoUnnecessaryWhitespaceFix,
  createAttrWhitespaceFix,
  createTagSelfCloseFix,
  createTagNoObsoleteFix,
  createSpecCharEscapeFix
];

// ------------------------------------------------------------------------------------------------------------
export class HtmlHintCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(doc: vscode.TextDocument, range: Range, context: vscode.CodeActionContext): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const list: CodeAction[] = [];
    for (const d of context.diagnostics) {
      if (d.source !== "htmlhint") {
        continue;
      }
      for (const f of factories) {
        try {
          const act = f(doc, d as Diagnostic);
          if (act) {
            list.push(act);
          }
        } catch (e: any) {
          log("error", `htmlhint codeAction error: ${e?.message || e}`);
        }
      }
    }
    return list;
  }
  static readonly metadata: vscode.CodeActionProviderMetadata = {providedCodeActionKinds: [CodeActionKind.QuickFix]};
}
