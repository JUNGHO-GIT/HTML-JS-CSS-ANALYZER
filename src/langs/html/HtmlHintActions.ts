// langs/html/HtmlHintActions.ts

import { vscode } from "@exportLibs";
import { CodeAction, CodeActionKind, Diagnostic, Position, Range } from "@exportLibs";
import { voidTags, obsoleteTags, regexAttrValueSingleQuotes, regexTagnameUppercase, regexAttrnameUppercase, regexAttrValueWhitespaceSimplify, regexAttrWhitespace, regexVoidTagOpen, regexVoidTagBadClose, regexAnyTag } from "@exportConsts";
import type { FixFactoryType } from "@exportTypes";
import { logger } from "@exportScripts";
import { getRuleId, getDocumentLine, getHeadMatch } from "./HtmlAnalyzer";
const makeQuickFix = (title: string, editBuilder: (we: vscode.WorkspaceEdit) => void, diagnostic: Diagnostic) => {
  const ca = new CodeAction(title, CodeActionKind.QuickFix);
  const we = new vscode.WorkspaceEdit();
  editBuilder(we);
  ca.edit = we;
  ca.diagnostics = [diagnostic];
  return ca;
};

// -------------------------------------------------------------------------------------------------
const createAttrValueDoubleQuotesFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-value-double-quotes") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const singleQuotePattern = regexAttrValueSingleQuotes;
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

// -------------------------------------------------------------------------------------------------
const createTagnameLowercaseFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "tagname-lowercase") {
    return null;
  }
  const info = (diagnostic as any).data;
  const lineStr = getDocumentLine(doc, info?.line);
  if (!lineStr) {
    return null;
  }
  const tagPattern = regexTagnameUppercase;
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

// -------------------------------------------------------------------------------------------------
const createAttrLowercaseFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-lowercase") {
    return null;
  }
  const info = (diagnostic as any).data;
  const lineStr = getDocumentLine(doc, info?.line);
  if (!lineStr) {
    return null;
  }
  const attrPattern = regexAttrnameUppercase;
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

// -------------------------------------------------------------------------------------------------
const createAttrNoUnnecessaryWhitespaceFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-no-unnecessary-whitespace") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const simpler = regexAttrValueWhitespaceSimplify;
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

// -------------------------------------------------------------------------------------------------
const createAttrWhitespaceFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "attr-whitespace") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const pattern = regexAttrWhitespace;
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

// -------------------------------------------------------------------------------------------------
const createTagSelfCloseFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "tag-self-close") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const voidOpen = regexVoidTagOpen;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = voidOpen.exec(lineStr))) {
    const tag = m[1].toLowerCase();
    if (!voidTags.has(tag)) {
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
  const badClose = regexVoidTagBadClose;
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

// -------------------------------------------------------------------------------------------------
const createTagNoObsoleteFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "tag-no-obsolete") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const pattern = regexAnyTag;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = pattern.exec(lineStr))) {
    const tagName = m[0].replace(/<\/\?\s*([a-zA-Z0-9-]+).*/, "$1").toLowerCase();
    if (obsoleteTags.includes(tagName)) {
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

// -------------------------------------------------------------------------------------------------
const createSpecCharEscapeFix: FixFactoryType = (doc: vscode.TextDocument, diagnostic: Diagnostic) => {
  if (getRuleId(diagnostic) !== "spec-char-escape") {
    return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== "number") {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
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

// -------------------------------------------------------------------------------------------------
const factories: FixFactoryType[] = [
  createAttrValueDoubleQuotesFix,
  createTagnameLowercaseFix,
  createAttrLowercaseFix,
  createAttrNoUnnecessaryWhitespaceFix,
  createAttrWhitespaceFix,
  createTagSelfCloseFix,
  createTagNoObsoleteFix,
  createSpecCharEscapeFix
];

// -------------------------------------------------------------------------------------------------
export const htmlHintCodeActionProvider: vscode.CodeActionProvider & { metadata: vscode.CodeActionProviderMetadata } = {
  provideCodeActions: (doc: vscode.TextDocument, range: Range, context: vscode.CodeActionContext): (vscode.CodeAction | vscode.Command)[] => {
    const list: CodeAction[] = [];
    for (const d of context.diagnostics) {
      if (d.source !== "htmlhint") {
        continue;
      }
      for (const f of factories) {
        try {
          const act = f(doc, d as Diagnostic);
          act && list.push(act);
        }
        catch (e: any) {
          logger(`error`, `HtmlHint`, `code action error: ${e?.message || e}`);
        }
      }
    }
    return list;
  },
  metadata: { providedCodeActionKinds: [CodeActionKind.QuickFix] }
};
