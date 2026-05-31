/**
 * @file htmlCodeActions.ts
 * @since 2025-11-22
 * @description HTML 코드 액션 및 Quick Fix 제공
 */

import type { FixFactory } from "@exportLangs";
import { getDocumentLine as gtDocLn, getHeadMatch, getRuleId, makeQuickFix } from "@exportLangs";
import { type CodeAction, CodeActionKind as CdActnKnd, Position, Range, type vscode } from "@exportLibs";
import { logger } from "@exportScripts";

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// CONSTANTS
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const VOID_TAGS = new Set([`br`, `hr`, `img`, `meta`, `link`, `input`, `source`, `embed`, `param`, `track`, `area`, `col`, `base`]);
const OBSL_TGS = new Set([`center`, `font`, `big`, `strike`, `tt`, `acronym`, `applet`, `basefont`, `bgsound`, `blink`, `marquee`]);

// REGEX PATTERNS
const HTML_TG_PAT = /<html(\s[^>]*)?>/i;
const HD_TTL_PAT = /<title(\s[^>]*)?>/i;
const DCTY_PAT = /<!doctype/i;
const SQAP = /(\w[\w:-]*)='([^']*)'/g;
const UPPR_TG_PAT = /<\/?([A-Z][\dA-Za-z]*)\b/g;
const UPP_ATT_PAT = /\s([A-Z][\w-]*)\s*=/g;
const MT_CHRS_PAT = /<meta\s+charset\s*=\s*["'][^"']*["'][^/>]*>/i;
const MT_VWPR_PAT = /<meta\s+name\s*=\s*["']viewport["'][^/>]*>/i;
const MT_DSCR_PAT = /<meta\s+name\s*=\s*["']description["'][^/>]*>/i;
const IATP = /<(img|area)([^>]*)>/gi;
const BTTN_TG_PAT = /<button([^>]*)>/gi;
const ATT_WHT_PAT = /(\w[\w:-]*)\s*=\s*(["'])(\s+)([^"']*?)(\s+)(\2)/g;
const ATT_SPC_PAT = /(\w[\w:-]*)\s*=\s*(["'][^"']*["'])/g;
const VTOP = /<([A-Za-z][\dA-Za-z-]*)([^>]*)>/g;
const BD_CLS_PAT = /<\/(br|hr|img|meta|link|input|source|embed|param|track|area|col|base)\s*>/gi;
const ALL_TG_PAT = /<\/?.+?>/g;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtLngFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `html-lang-require`) {
  	return null;
  }
  const text = doc.getText();
  const match = text.match(/<html(\s[^>]*)?>/i);
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtTtlFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `title-require`) {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtDctyFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `doctype-first`) {
  	return null;
  }
  const text = doc.getText();
  if (/<!doctype/i.test(text.slice(0, 50))) {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtAtVaDbQtF: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-value-double-quotes`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
  if (!lineStr) {
  	return null;
  }
  const snglQtPat = /(\w[\w:-]*)='([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = snglQtPat.exec(lineStr))) {
    const startCol = m.index;
    const endCol = startCol + m[0].length;
    const col = info.col ? info.col - 1 : 0;
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtTgLwFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `tagname-lowercase`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  const lineStr = gtDocLn(doc, info?.line);
  if (!lineStr) {
  	return null;
  }
  const tagPattern = /<\/?([A-Z][\dA-Za-z]*)\b/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = tagPattern.exec(lineStr))) {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtAtLwFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-lowercase`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  const lineStr = gtDocLn(doc, info?.line);
  if (!lineStr) {
  	return null;
  }
  const attrPattern = /\s([A-Z][\w-]*)\s*=/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = attrPattern.exec(lineStr))) {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtMtChRqFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `meta-charset-require`) {
  	return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
  	return null;
  }
  if (/<meta\s+charset\s*=\s*["'][^"']*["'][^/>]*>/i.test(head[2])) {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtMtVwRqFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `meta-viewport-require`) {
  	return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
  	return null;
  }
  if (/<meta\s+name\s*=\s*["']viewport["'][^/>]*>/i.test(head[2])) {
  	return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(`>`) + 1;
  const metaCharset = head[2].match(/<meta\s+charset\s*=\s*["'][^"']*["'][^/>]*>/i);
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtMtDsRqFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `meta-description-require`) {
  	return null;
  }
  const text = doc.getText();
  const head = getHeadMatch(text);
  if (!head) {
  	return null;
  }
  if (/<meta\s+name\s*=\s*["']description["'][^/>]*>/i.test(head[2])) {
  	return null;
  }
  const headStart = (head.index as number) + head[0].indexOf(`>`) + 1;
  const metaViewport = head[2].match(/<meta\s+name\s*=\s*["']viewport["'][^/>]*>/i);
  const metaCharset = head[2].match(/<meta\s+charset\s*=\s*["'][^"']*["'][^/>]*>/i);
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtAltRqrFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `alt-require`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
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
  }
  return null;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtBtTyRqFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `button-type-require`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
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
  }
  return null;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtAtNUnWhFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-no-unnecessary-whitespace`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtAtWhFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `attr-whitespace`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtTgSlClFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `tag-self-close`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
  if (!lineStr) {
  	return null;
  }
  const voidOpen = /<([A-Za-z][\dA-Za-z-]*)([^>]*)>/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = voidOpen.exec(lineStr))) {
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
  const badClose = /<\/(br|hr|img|meta|link|input|source|embed|param|track|area|col|base)\s*>/gi;
  let c: RegExpExecArray | null;
  while ((c = badClose.exec(lineStr))) {
    const startCol = c.index;
    const colNear = info.col ? info.col - 1 : 0;
    if (Math.abs(startCol - colNear) <= 20) {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtTgNObslFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `tag-no-obsolete`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
  if (!lineStr) {
  	return null;
  }
  const pattern = /<\/?.+?>/g;
  let m: RegExpExecArray | null;
  const col = info.col ? info.col - 1 : 0;
  while ((m = pattern.exec(lineStr))) {
    const tagName = m[0].replace(/<\/?\s*([\dA-Za-z-]+).*/, `$1`).toLowerCase();
    if (OBSL_TGS.has(tagName)) {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const crtSpChEsFx: FixFactory = (doc, diagnostic) => {
  if (getRuleId(diagnostic) !== `spec-char-escape`) {
  	return null;
  }
  const info = (diagnostic as any).data;
  if (typeof info?.line !== `number`) {
  	return null;
  }
  const lineStr = gtDocLn(doc, info.line);
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const factories: FixFactory[] = [crtLngFx, crtTtlFx, crtDctyFx, crtAtVaDbQtF, crtTgLwFx, crtAtLwFx, crtMtChRqFx, crtMtVwRqFx, crtMtDsRqFx, crtAltRqrFx, crtBtTyRqFx, crtAtNUnWhFx, crtAtWhFx, crtTgSlClFx, crtTgNObslFx, crtSpChEsFx];

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export class HtmlHintCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(doc: vscode.TextDocument, _range: Range, context: vscode.CodeActionContext): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
    const list: CodeAction[] = [];
    for (const d of context.diagnostics) {
      if (d.source !== `htmlhint`) {
      	continue;
      }
      for (const f of factories) {
        try {
          const act = f(doc, d);
          act && list.push(act);
        }
        catch (error: any) {
          logger(`error`, `code action error: ${error?.message || error}`);
        }
      }
    }
    return list;
  }
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [CdActnKnd.QuickFix],
  };
}
