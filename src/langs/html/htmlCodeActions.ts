/**
 * @file htmlCodeActions.ts
 * @since 2025-11-22
 * @description HTML 코드 액션 및 Quick Fix 제공
 */

import type { FixFactory } from "@exportLangs";
import { getDocumentLine, getHeadMatch, getRuleId, makeQuickFix } from "@exportLangs";
import { type CodeAction, CodeActionKind as CdActnKnd, Position, Range, type vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { getDiagData } from "@langs/html/htmlUtils";

// CONSTANTS ---------------------------------------------------------------------------------------
// htmlValidator 의 진단 source 와 반드시 동일해야 Quick Fix 가 매칭된다.
const DIAGNOSTIC_SOURCE = `HTMLHint`;

const VOID_TAGS = new Set([`br`, `hr`, `img`, `meta`, `link`, `input`, `source`, `embed`, `param`, `track`, `area`, `col`, `base`]);
const OBSOLETE_TAGS = new Set([`center`, `font`, `big`, `strike`, `tt`, `acronym`, `applet`, `basefont`, `bgsound`, `blink`, `marquee`]);

// REGEX PATTERNS ----------------------------------------------------------------------------------
// 공용 상수로 일원화. /g 패턴은 exec 루프 진입 전 lastIndex=0 으로 초기화한다.
const HTML_TAG_MATCH_RE = /<html(\s[^>]*)?>/i;
const HEAD_TITLE_RE = /<title(\s[^>]*)?>/i;
const DOCTYPE_MATCH_RE = /<!doctype/i;
const SINGLE_QUOTE_ATTR_RE = /(\w[\w:-]*)='([^']*)'/g;
const UPPER_TAG_RE = /<\/?([A-Z][\dA-Za-z]*)\b/g;
const UPPER_ATTR_RE = /\s([A-Z][\w-]*)\s*=/g;
const META_CHARSET_RE = /<meta\s+charset\s*=\s*["'][^"']*["'][^/>]*>/i;
const META_VIEWPORT_RE = /<meta\s+name\s*=\s*["']viewport["'][^/>]*>/i;
const META_DESC_RE = /<meta\s+name\s*=\s*["']description["'][^/>]*>/i;
const IMG_AREA_TAG_RE = /<(img|area)([^>]*)>/gi;
const BUTTON_TAG_RE = /<button([^>]*)>/gi;
const ATTR_WHITESPACE_RE = /(\w[\w:-]*)\s*=\s*(["'])(\s+)([^"']*?)(\s+)(\2)/g;
const ATTR_SPACING_RE = /(\w[\w:-]*)\s*=\s*(["'][^"']*["'])/g;
const TAG_OPEN_RE = /<([A-Za-z][\dA-Za-z-]*)([^>]*)>/g;
const BODY_CLASS_RE = /<\/(br|hr|img|meta|link|input|source|embed|param|track|area|col|base)\s*>/gi;
const ALL_TAGS_RE = /<\/?.+?>/g;

// FIX FACTORIES ----------------------------------------------------------------------------------
const createLangFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `html-lang-require`) {
    return null;
  }
  const text = doc.getText();
  const match = text.match(HTML_TAG_MATCH_RE);
  if (!match || match[0].includes(`lang=`)) {
    return null;
  }
  const start = doc.positionAt((match.index as number) + 5);
  return makeQuickFix(
    `Add lang="en"`,
    (we) => {
      we.insert(doc.uri, start, ` lang="en"`);
    },
    diagnostic,
  );
};

// -------------------------------------------------------------------------------------------------
const createTitleFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `title-require`) {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (HEAD_TITLE_RE.test(head[2])) {
    return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(`>`) + 1;
  const insertPos = doc.positionAt(headStart);
  return makeQuickFix(
    `Add <title>`,
    (we) => {
      we.insert(doc.uri, insertPos, `\n    <title>Document</title>`);
    },
    diagnostic,
  );
};

// -------------------------------------------------------------------------------------------------
const createDoctypeFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `doctype-first`) {
    return null;
  }
  const text = doc.getText();
  if (DOCTYPE_MATCH_RE.test(text.slice(0, 50))) {
    return null;
  }
  const pos = new Position(0, 0);
  return makeQuickFix(
    `Add <!DOCTYPE html>`,
    (we) => {
      we.insert(doc.uri, pos, `<!DOCTYPE html>\n`);
    },
    diagnostic,
  );
};

// -------------------------------------------------------------------------------------------------
const createAttrValueDblQuoteFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-value-double-quotes`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  SINGLE_QUOTE_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SINGLE_QUOTE_ATTR_RE.exec(lineStr))) {
    const startCol = m.index;
    const endCol = startCol + m[0].length;
    if (Math.abs(startCol - col) <= 10) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      const newText = `${m[1]}="${m[2]}"`;
      return makeQuickFix(
        `Change attribute quotes to double quotes`,
        (we) => {
          we.replace(doc.uri, new Range(start, end), newText);
        },
        diagnostic,
      );
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createTagLowercaseFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `tagname-lowercase`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  UPPER_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UPPER_TAG_RE.exec(lineStr))) {
    const startCol = m.index + 1 + (m[0].startsWith(`</`) ? 1 : 0);
    const endCol = startCol + m[1].length;
    if (Math.abs(m.index - col) <= 5) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      const tagName = m[1];
      return makeQuickFix(
        `Convert tag to lowercase`,
        (we) => {
          we.replace(doc.uri, new Range(start, end), tagName.toLowerCase());
        },
        diagnostic,
      );
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createAttrLowercaseFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-lowercase`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  UPPER_ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UPPER_ATTR_RE.exec(lineStr))) {
    const startCol = m.index + 1;
    const endCol = startCol + m[1].length;
    if (Math.abs(startCol - col) <= 5) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, endCol);
      const attrName = m[1];
      return makeQuickFix(
        `Convert attribute to lowercase`,
        (we) => {
          we.replace(doc.uri, new Range(start, end), attrName.toLowerCase());
        },
        diagnostic,
      );
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createMetaCharsetReqFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `meta-charset-require`) {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (META_CHARSET_RE.test(head[2])) {
    return null;
  }
  const insert = (head.index as number) + head[0].indexOf(`>`) + 1;
  const pos = doc.positionAt(insert);
  return makeQuickFix(
    `Add <meta charset="UTF-8"/>`,
    (we) => {
      we.insert(doc.uri, pos, `\n    <meta charset="UTF-8"/>`);
    },
    diagnostic,
  );
};

// -------------------------------------------------------------------------------------------------
const createMetaViewportReqFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `meta-viewport-require`) {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (META_VIEWPORT_RE.test(head[2])) {
    return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(`>`) + 1;
  const metaCharset = head[2].match(META_CHARSET_RE);
  const insert = metaCharset ? headStart + (metaCharset.index as number) + metaCharset[0].length : headStart;
  const pos = doc.positionAt(insert);
  return makeQuickFix(
    `Add <meta name="viewport"/>`,
    (we) => {
      we.insert(doc.uri, pos, `\n    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>`);
    },
    diagnostic,
  );
};

// -------------------------------------------------------------------------------------------------
const createMetaDescReqFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `meta-description-require`) {
    return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
    return null;
  }
  if (META_DESC_RE.test(head[2])) {
    return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(`>`) + 1;
  const metaViewport = head[2].match(META_VIEWPORT_RE);
  const metaCharset = head[2].match(META_CHARSET_RE);
  let insert = headStart;
  if (metaViewport) {
    insert = headStart + (metaViewport.index as number) + metaViewport[0].length;
  }
  else if (metaCharset) {
    insert = headStart + (metaCharset.index as number) + metaCharset[0].length;
  }
  const pos = doc.positionAt(insert);
  return makeQuickFix(
    `Add <meta name="description"/>`,
    (we) => {
      we.insert(doc.uri, pos, `\n    <meta name="description" content=""/>`);
    },
    diagnostic,
  );
};

// -------------------------------------------------------------------------------------------------
const createAltRequiredFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `alt-require`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  IMG_AREA_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_AREA_TAG_RE.exec(lineStr))) {
    if (/\balt\s*=/.test(m[0])) {
      continue;
    }
    const startCol = m.index;
    if (Math.abs(startCol - col) <= 40) {
      const insertCol = m.index + 1 + m[1].length;
      const hasSpace = /\s/.test(lineStr.charAt(insertCol));
      const pos = new Position(info.line - 1, insertCol);
      return makeQuickFix(
        `Add alt=""`,
        (we) => {
          we.insert(doc.uri, pos, `${hasSpace ? `` : ` `}alt="" `);
        },
        diagnostic,
      );
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createButtonTypeReqFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `button-type-require`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  BUTTON_TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BUTTON_TAG_RE.exec(lineStr))) {
    if (/\btype\s*=/.test(m[0])) {
      continue;
    }
    const startCol = m.index;
    if (Math.abs(startCol - col) <= 40) {
      const insertCol = m.index + `<button`.length;
      const hasSpace = /\s/.test(lineStr.charAt(insertCol));
      const pos = new Position(info.line - 1, insertCol);
      return makeQuickFix(
        `Add type="button"`,
        (we) => {
          we.insert(doc.uri, pos, `${hasSpace ? `` : ` `}type="button" `);
        },
        diagnostic,
      );
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createAttrNoUnneedWsFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-no-unnecessary-whitespace`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  ATTR_WHITESPACE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_WHITESPACE_RE.exec(lineStr))) {
    const startCol = m.index;
    if (Math.abs(startCol - col) <= 50) {
      const cleaned = `${m[1]}=${m[2]}${m[4].trim()}${m[2]}`;
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + m[0].length);
      return makeQuickFix(
        `Trim attribute value whitespace`,
        (we) => {
          we.replace(doc.uri, new Range(start, end), cleaned);
        },
        diagnostic,
      );
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createAttrWhitespaceFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-whitespace`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  ATTR_SPACING_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_SPACING_RE.exec(lineStr))) {
    const raw = m[0];
    if (/\s=\s|\s=|=\s/.test(raw)) {
      const startCol = m.index;
      if (Math.abs(startCol - col) <= 40) {
        const fixed = `${m[1]}=${m[2]}`;
        const start = new Position(info.line - 1, startCol);
        const end = new Position(info.line - 1, startCol + raw.length);
        return makeQuickFix(
          `Normalize attribute spacing`,
          (we) => {
            we.replace(doc.uri, new Range(start, end), fixed);
          },
          diagnostic,
        );
      }
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createTagSelfCloseFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `tag-self-close`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;

  TAG_OPEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TAG_OPEN_RE.exec(lineStr))) {
    const tag = m[1].toLowerCase();
    if (!VOID_TAGS.has(tag)) {
      continue;
    }
    if (m[0].endsWith(`/>`)) {
      continue;
    }
    const startCol = m.index;
    if (Math.abs(startCol - col) <= 50) {
      const attrs = m[2].trim();
      const fixed = attrs.length > 0 ? `<${m[1]} ${attrs} />` : `<${m[1]} />`;
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + m[0].length);
      return makeQuickFix(
        `Self-close void element`,
        (we) => {
          we.replace(doc.uri, new Range(start, end), fixed);
        },
        diagnostic,
      );
    }
  }

  BODY_CLASS_RE.lastIndex = 0;
  let c: RegExpExecArray | null;
  while ((c = BODY_CLASS_RE.exec(lineStr))) {
    const startCol = c.index;
    if (Math.abs(startCol - col) <= 20) {
      const start = new Position(info.line - 1, startCol);
      const end = new Position(info.line - 1, startCol + c[0].length);
      return makeQuickFix(
        `Remove invalid closing tag`,
        (we) => {
          we.delete(doc.uri, new Range(start, end));
        },
        diagnostic,
      );
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createTagNotObsoleteFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `tag-no-obsolete`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
    return null;
  }
  const lineStr = getDocumentLine(doc, info.line);
  if (!lineStr) {
    return null;
  }
  const col = info.col ? info.col - 1 : 0;
  ALL_TAGS_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ALL_TAGS_RE.exec(lineStr))) {
    const tagName = m[0].replace(/<\/?\s*([\dA-Za-z-]+).*/, `$1`).toLowerCase();
    if (OBSOLETE_TAGS.has(tagName)) {
      const startCol = m.index;
      if (Math.abs(startCol - col) <= 30) {
        const start = new Position(info.line - 1, startCol);
        const end = new Position(info.line - 1, startCol + m[0].length);
        return makeQuickFix(
          `Remove obsolete tag`,
          (we) => {
            we.delete(doc.uri, new Range(start, end));
          },
          diagnostic,
        );
      }
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const createSpecialCharEscFix: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `spec-char-escape`) {
    return null;
  }
  const info = getDiagData(diagnostic);
  if (typeof info?.line !== `number`) {
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
  if (ch !== `&` && ch !== `<` && ch !== `>`) {
    return null;
  }
  const openCount = (lineStr.slice(0, col).match(/</g) || []).length;
  const closeCount = (lineStr.slice(0, col).match(/>/g) || []).length;
  if (openCount > closeCount) {
    return null;
  }
  let replacement = ``;
  if (ch === `&`) {
    if (/^&[A-Za-z]+;/.test(lineStr.slice(col))) {
      return null;
    }
    replacement = `&amp;`;
  }
  else if (ch === `<`) {
    replacement = `&lt;`;
  }
  else if (ch === `>`) {
    replacement = `&gt;`;
  }
  if (!replacement) {
    return null;
  }
  const start = new Position(info.line - 1, col);
  const end = new Position(info.line - 1, col + 1);
  return makeQuickFix(
    `Escape special character`,
    (we) => {
      we.replace(doc.uri, new Range(start, end), replacement);
    },
    diagnostic,
  );
};

// FACTORY REGISTRY --------------------------------------------------------------------------------
const factories: FixFactory[] = [createLangFix, createTitleFix, createDoctypeFix, createAttrValueDblQuoteFix, createTagLowercaseFix, createAttrLowercaseFix, createMetaCharsetReqFix, createMetaViewportReqFix, createMetaDescReqFix, createAltRequiredFix, createButtonTypeReqFix, createAttrNoUnneedWsFix, createAttrWhitespaceFix, createTagSelfCloseFix, createTagNotObsoleteFix, createSpecialCharEscFix];

// PROVIDER ----------------------------------------------------------------------------------------
export class HtmlHintCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(doc: vscode.TextDocument, _range: Range, context: vscode.CodeActionContext): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const list: CodeAction[] = [];
    for (const d of context.diagnostics) {
      if (d.source !== DIAGNOSTIC_SOURCE) {
        continue;
      }
      for (const f of factories) {
        try {
          const act = f(doc, d);
          if (act) {
            list.push(act);
          }
        }
        catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          logger(`error`, `code action error: ${msg}`);
        }
      }
    }
    return list;
  }
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [CdActnKnd.QuickFix],
  };
}
