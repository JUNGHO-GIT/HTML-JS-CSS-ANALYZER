// src/langs/html/htmlHint.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {createRequire} from "module"; // ESM 환경에서 CJS 모듈(htmlhint) 로드를 위해 사용
import {log} from "../../utils/logger.js";
import {CodeAction, CodeActionKind, Diagnostic, DiagnosticSeverity, Position, Range, TextEdit} from "vscode";

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
      if (base === root) break;
      const parent = path.dirname(base);
      if (parent === base) break;
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
  if ((diagnostic as any).data?.ruleId !== "html-lang-require") return null;
  const text = doc.getText();
  const match = text.match(/<html(\s[^>]*)?>/i);
  if (!match || match[0].includes("lang=")) return null;
  const start = match.index! + 5; // after <html
  const pos = doc.positionAt(start);
  const edit: TextEdit = {range: new Range(pos, pos), newText: ' lang="en"'};
  const ca = new CodeAction('Add lang="en"', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.replace(doc.uri, edit.range, edit.newText);
  ca.diagnostics = [diagnostic];
  return ca;
};

const createTitleFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "title-require") return null;
  const text = doc.getText();
  const head = text.match(/<head(\s[^>]*)?>([\s\S]*?)<\/head>/i);
  if (!head) return null;
  if (/<title(\s[^>]*)?>/i.test(head[2])) return null;
  const headStart = head.index! + head[0].indexOf(">") + 1;
  const insertPos = doc.positionAt(headStart);
  const newText = '\n    <title>Document</title>';
  const ca = new CodeAction('Add <title>', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.insert(doc.uri, insertPos, newText);
  ca.diagnostics = [diagnostic];
  return ca;
};

const createDoctypeFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "doctype-first") return null;
  const text = doc.getText();
  if (/<!doctype/i.test(text.substring(0, 50))) return null;
  const pos = new Position(0, 0);
  const ca = new CodeAction('Add <!DOCTYPE html>', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.insert(doc.uri, pos, '<!DOCTYPE html>\n');
  ca.diagnostics = [diagnostic];
  return ca;
};

// attr-value-double-quotes ------------------------------------------------------
const createAttrValueDoubleQuotesFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "attr-value-double-quotes") return null;
  const info = (diagnostic as any).data;
  if (typeof info.line !== "number") return null;
  const text = doc.getText();
  const lines = text.split(/\n/);
  const lineStr = lines[info.line - 1];
  if (!lineStr) return null;
  const singleQuotePattern = /(\w+)='([^']*)'/g;
  let m: RegExpExecArray | null; let edits: TextEdit[] = [];
  while ((m = singleQuotePattern.exec(lineStr))) {
    const startCol = m.index; const endCol = startCol + m[0].length;
    const attrName = m[1]; const attrValue = m[2];
    const col = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - col) <= 10) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      edits.push(new TextEdit(new Range(start, end), `${attrName}="${attrValue}"`));
      break;
    }
  }
  if (!edits.length) return null;
  const ca = new CodeAction("Change attribute quotes to double quotes", CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  for (const e of edits) ca.edit.replace(doc.uri, e.range, e.newText);
  ca.diagnostics = [diagnostic];
  return ca;
};

// tagname-lowercase --------------------------------------------------------------
const createTagnameLowercaseFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "tagname-lowercase") return null;
  const info = (diagnostic as any).data; const text = doc.getText(); const lines = text.split(/\n/);
  const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  const tagPattern = /<\/?([A-Z][A-Za-z0-9]*)\b/g; let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(lineStr))) {
    const startCol = m.index + 1 + (m[0].startsWith("</") ? 1 : 0); const endCol = startCol + m[1].length;
    const col = info.col ? info.col - 1 : 0;
    if (Math.abs(m.index - col) <= 5) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      const ca = new CodeAction("Convert tag to lowercase", CodeActionKind.QuickFix);
      ca.edit = new vscode.WorkspaceEdit();
      ca.edit.replace(doc.uri, new Range(start, end), m[1].toLowerCase());
      ca.diagnostics = [diagnostic];
      return ca;
    }
  }
  return null;
};

// attr-lowercase ---------------------------------------------------------------
const createAttrLowercaseFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "attr-lowercase") return null;
  const info = (diagnostic as any).data; const text = doc.getText(); const lines = text.split(/\n/);
  const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  const attrPattern = /\s([A-Z][A-Za-z0-9-_]*)\s*=/g; let m: RegExpExecArray | null;
  while ((m = attrPattern.exec(lineStr))) {
    const startCol = m.index + 1; const endCol = startCol + m[1].length; const col = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - col) <= 5) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      const ca = new CodeAction("Convert attribute to lowercase", CodeActionKind.QuickFix);
      ca.edit = new vscode.WorkspaceEdit();
      ca.edit.replace(doc.uri, new Range(start, end), m[1].toLowerCase());
      ca.diagnostics = [diagnostic];
      return ca;
    }
  }
  return null;
};

// meta-charset-require ---------------------------------------------------------
const createMetaCharsetRequireFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "meta-charset-require") return null;
  const text = doc.getText(); const head = text.match(/<head(\s[^>]*)?>([\s\S]*?)<\/head>/i); if (!head) return null;
  if (/<meta\s+charset\s*=\s*["'][^"']*["'][^>]*>/i.test(head[2])) return null;
  const insert = head.index! + head[0].indexOf(">") + 1;
  const pos = doc.positionAt(insert);
  const ca = new CodeAction('Add <meta charset="UTF-8">', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.insert(doc.uri, pos, '\n    <meta charset="UTF-8">');
  ca.diagnostics = [diagnostic];
  return ca;
};

// meta-viewport-require --------------------------------------------------------
const createMetaViewportRequireFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "meta-viewport-require") return null;
  const text = doc.getText(); const head = text.match(/<head(\s[^>]*)?>([\s\S]*?)<\/head>/i); if (!head) return null;
  if (/<meta\s+name\s*=\s*["']viewport["'][^>]*>/i.test(head[2])) return null;
  const headStart = head.index! + head[0].indexOf(">") + 1;
  const metaCharset = head[2].match(/<meta\s+charset\s*=\s*["'][^"']*["'][^>]*>/i);
  const insert = metaCharset ? headStart + metaCharset.index! + metaCharset[0].length : headStart;
  const pos = doc.positionAt(insert);
  const ca = new CodeAction('Add <meta name="viewport">', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.insert(doc.uri, pos, '\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">');
  ca.diagnostics = [diagnostic];
  return ca;
};

// meta-description-require -----------------------------------------------------
const createMetaDescriptionRequireFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "meta-description-require") return null;
  const text = doc.getText(); const head = text.match(/<head(\s[^>]*)?>([\s\S]*?)<\/head>/i); if (!head) return null;
  if (/<meta\s+name\s*=\s*["']description["'][^>]*>/i.test(head[2])) return null;
  const headStart = head.index! + head[0].indexOf(">") + 1;
  const metaViewport = head[2].match(/<meta\s+name\s*=\s*["']viewport["'][^>]*>/i);
  const metaCharset = head[2].match(/<meta\s+charset\s*=\s*["'][^"']*["'][^>]*>/i);
  let insert = headStart;
  if (metaViewport) insert = headStart + metaViewport.index! + metaViewport[0].length;
  else if (metaCharset) insert = headStart + metaCharset.index! + metaCharset[0].length;
  const pos = doc.positionAt(insert);
  const ca = new CodeAction('Add <meta name="description">', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.insert(doc.uri, pos, '\n    <meta name="description" content="">');
  ca.diagnostics = [diagnostic];
  return ca;
};

// alt-require -----------------------------------------------------------------
const createAltRequireFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "alt-require") return null;
  const info = (diagnostic as any).data; if (typeof info.line !== "number") return null;
  const text = doc.getText(); const lines = text.split(/\n/); const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  // 가까운 <img ...> 혹은 <area ...> 태그 탐색 (alt 없는 경우)
  const tagPattern = /<(img|area)([^>]*)>/gi; let m: RegExpExecArray | null; let chosen: RegExpExecArray | null = null;
  while ((m = tagPattern.exec(lineStr))) {
    if (!/\balt\s*=/.test(m[0])) {
      const startCol = m.index; const col = info.col ? info.col - 1 : 0;
      if (Math.abs(startCol - col) <= 40) { chosen = m; break; }
    }
  }
  if (!chosen) return null;
  const insertionOffset = chosen.index + chosen[0].lastIndexOf("<" + chosen[1]) + ("<" + chosen[1]).length;
  // 삽입 위치: 태그명 직후 (공백 없으면 공백 추가)
  const needSpace = chosen[0][("<" + chosen[1]).length] !== ' ' ? ' ' : '';
  const start = new Position(info.line - 1, insertionOffset + (needSpace ? 0 : 0));
  const ca = new CodeAction('Add alt=""', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.insert(doc.uri, start, needSpace + 'alt="" ');
  ca.diagnostics = [diagnostic];
  return ca;
};

// button-type-require ---------------------------------------------------------
const createButtonTypeRequireFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "button-type-require") return null;
  const info = (diagnostic as any).data; if (typeof info.line !== "number") return null;
  const text = doc.getText(); const lines = text.split(/\n/); const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  const tagPattern = /<button([^>]*)>/gi; let m: RegExpExecArray | null; let chosen: RegExpExecArray | null = null;
  while ((m = tagPattern.exec(lineStr))) {
    if (!/\btype\s*=/.test(m[0])) {
      const startCol = m.index; const col = info.col ? info.col - 1 : 0;
      if (Math.abs(startCol - col) <= 40) { chosen = m; break; }
    }
  }
  if (!chosen) return null;
  const insertionOffset = chosen.index + '<button'.length;
  const needSpace = chosen[0]['<button'.length] !== ' ' ? ' ' : '';
  const start = new Position(info.line - 1, insertionOffset);
  const ca = new CodeAction('Add type="button"', CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.insert(doc.uri, start, needSpace + 'type="button" ');
  ca.diagnostics = [diagnostic];
  return ca;
};

// attr-no-unnecessary-whitespace ----------------------------------------------
const createAttrNoUnnecessaryWhitespaceFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "attr-no-unnecessary-whitespace") return null;
  const info = (diagnostic as any).data; if (typeof info.line !== "number") return null;
  const text = doc.getText(); const lines = text.split(/\n/); const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  // value 앞뒤 공백 제거
  const attrValPattern = /(\w[\w:-]*)\s*=\s*(["'])([^"']*?)([\s]+)([^"']*?)(\2)/g; // 복잡: 안전 단순화
  // 더 단순: (name)="  value  "
  const simpler = /(\w[\w:-]*)\s*=\s*(["'])(\s+)([^"']*?)(\s+)(\2)/g; let m: RegExpExecArray | null;
  while ((m = simpler.exec(lineStr))) {
    const startCol = m.index; const col = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - col) <= 50) {
      const cleaned = `${m[1]}=${m[2]}${m[4].trim()}${m[2]}`;
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + m[0].length);
      const ca = new CodeAction("Trim attribute value whitespace", CodeActionKind.QuickFix);
      ca.edit = new vscode.WorkspaceEdit();
      ca.edit.replace(doc.uri, new Range(start, end), cleaned);
      ca.diagnostics = [diagnostic];
      return ca;
    }
  }
  return null;
};

// attr-whitespace -------------------------------------------------------------
const createAttrWhitespaceFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "attr-whitespace") return null;
  const info = (diagnostic as any).data; if (typeof info.line !== "number") return null;
  const text = doc.getText(); const lines = text.split(/\n/); const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  // 패턴: name  =  "value" -> name="value"
  const pattern = /(\w[\w:-]*)\s*=\s*(["'][^"']*["'])/g; let m: RegExpExecArray | null;
  while ((m = pattern.exec(lineStr))) {
    const raw = m[0];
    if (/\s=\s|\s=|=\s/.test(raw)) {
      const startCol = m.index; const col = info.col ? info.col - 1 : 0;
      if (Math.abs(startCol - col) <= 40) {
        const fixed = `${m[1]}=${m[2]}`;
        const start = new Position(info.line - 1, startCol);
        const end = new Position(info.line - 1, startCol + raw.length);
        const ca = new CodeAction("Normalize attribute spacing", CodeActionKind.QuickFix);
        ca.edit = new vscode.WorkspaceEdit();
        ca.edit.replace(doc.uri, new Range(start, end), fixed);
        ca.diagnostics = [diagnostic];
        return ca;
      }
    }
  }
  return null;
};

// tag-self-close --------------------------------------------------------------
const VOID_TAGS = new Set(["br", "hr", "img", "meta", "link", "input", "source", "embed", "param", "track", "area", "col", "base"]);
const createTagSelfCloseFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "tag-self-close") return null;
  const info = (diagnostic as any).data; if (typeof info.line !== "number") return null;
  const text = doc.getText(); const lines = text.split(/\n/); const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  // 전략: <img ...> -> <img ... /> (이미 /> 이면 skip) 및 </br> 같은 잘못된 종료 제거
  const voidOpen = /<([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g; let m: RegExpExecArray | null;
  while ((m = voidOpen.exec(lineStr))) {
    const tag = m[1].toLowerCase(); if (!VOID_TAGS.has(tag)) continue;
    if (/\/>$/.test(m[0])) continue; // already self-closed
    const startCol = m.index; const col = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - col) <= 50) {
      const fixed = `<${m[1]}${m[2].trim()} />`;
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + m[0].length);
      const ca = new CodeAction("Self-close void element", CodeActionKind.QuickFix);
      ca.edit = new vscode.WorkspaceEdit();
      ca.edit.replace(doc.uri, new Range(start, end), fixed);
      ca.diagnostics = [diagnostic];
      return ca;
    }
  }
  // 잘못된 닫는 태그 제거 </br>
  const badClose = /<\/(br|hr|img|meta|link|input|source|embed|param|track|area|col|base)\s*>/ig; let c: RegExpExecArray | null;
  while ((c = badClose.exec(lineStr))) {
    const startCol = c.index; const col = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - col) <= 20) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + c[0].length);
      const ca = new CodeAction("Remove invalid closing tag", CodeActionKind.QuickFix);
      ca.edit = new vscode.WorkspaceEdit();
      ca.edit.delete(doc.uri, new Range(start, end));
      ca.diagnostics = [diagnostic];
      return ca;
    }
  }
  return null;
};

// tag-no-obsolete -------------------------------------------------------------
const OBSOLETE_TAGS = ["center", "font", "big", "strike", "tt", "acronym", "applet", "basefont", "bgsound", "blink", "marquee"];
const createTagNoObsoleteFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "tag-no-obsolete") return null;
  const info = (diagnostic as any).data; if (typeof info.line !== "number") return null;
  const text = doc.getText(); const lines = text.split(/\n/); const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  const pattern = /<\/?.+?>/g; let m: RegExpExecArray | null;
  while ((m = pattern.exec(lineStr))) {
    const tagName = m[0].replace(/<\/?\s*([a-zA-Z0-9-]+).*/, '$1').toLowerCase();
    if (OBSOLETE_TAGS.includes(tagName)) {
      const startCol = m.index; const col = info.col ? info.col - 1 : 0;
      if (Math.abs(startCol - col) <= 30) {
        // 단일 태그 제거 (내용 보존 위해 빈 문자열)
        const start = new Position(info.line - 1, startCol);
        const end = new Position(info.line - 1, startCol + m[0].length);
        const ca = new CodeAction("Remove obsolete tag", CodeActionKind.QuickFix);
        ca.edit = new vscode.WorkspaceEdit();
        ca.edit.delete(doc.uri, new Range(start, end));
        ca.diagnostics = [diagnostic];
        return ca;
      }
    }
  }
  return null;
};

// spec-char-escape ------------------------------------------------------------
const createSpecCharEscapeFix: FixFactory = (doc, diagnostic) => {
  if ((diagnostic as any).data?.ruleId !== "spec-char-escape") return null;
  const info = (diagnostic as any).data; if (typeof info.line !== "number") return null;
  const text = doc.getText(); const lines = text.split(/\n/); const lineStr = lines[info.line - 1]; if (!lineStr) return null;
  const col = info.col ? info.col - 1 : 0;
  if (col < 0 || col >= lineStr.length) return null;
  const ch = lineStr[col];
  if (ch !== '&' && ch !== '<' && ch !== '>') return null;
  // 태그 내부(<...>)는 제외 (간단 판단)
  const openCount = (lineStr.slice(0, col).match(/</g) || []).length;
  const closeCount = (lineStr.slice(0, col).match(/>/g) || []).length;
  if (openCount > closeCount) return null; // 여전히 태그 내부로 간주
  let replacement = '';
  if (ch === '&') {
    // 이미 &amp; 등인 경우 skip
    if (/^&[a-zA-Z]+;/.test(lineStr.slice(col))) return null;
    replacement = '&amp;';
  } else if (ch === '<') {
    replacement = '&lt;';
  } else if (ch === '>') {
    replacement = '&gt;';
  }
  if (!replacement) return null;
  const start = new Position(info.line - 1, col);
  const end = new Position(info.line - 1, col + 1);
  const ca = new CodeAction("Escape special character", CodeActionKind.QuickFix);
  ca.edit = new vscode.WorkspaceEdit();
  ca.edit.replace(doc.uri, new Range(start, end), replacement);
  ca.diagnostics = [diagnostic];
  return ca;
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

export class HtmlHintCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(doc: vscode.TextDocument, range: Range, context: vscode.CodeActionContext): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const list: CodeAction[] = [];
    for (const d of context.diagnostics) {
      if (d.source !== "htmlhint") continue;
      for (const f of factories) {
        try {
          const act = f(doc, d);
          if (act) list.push(act);
        } catch (e: any) {
          log("error", `htmlhint codeAction error: ${e?.message || e}`);
        }
      }
    }
    return list;
  }
  static readonly metadata: vscode.CodeActionProviderMetadata = {providedCodeActionKinds: [CodeActionKind.QuickFix]};
}
