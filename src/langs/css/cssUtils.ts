/**
 * @file cssUtils.ts
 * @since 2025-11-26
 * @description CSS 유틸리티 함수 (파일 읽기, 원격 가져오기, 헬퍼 함수)
 */

import { getAnalyzableExtensions as gtAnlyExts } from "@exportConsts";
import { cacheGet, cacheSet, parseSelectors as prsSels } from "@exportLangs";
import { fs, http, https, path, vscode } from "@exportLibs";
import { isUriExcludedByGlob as isUrExByGl, logger, resourceLimiter as resLmtr, withPerformanceMonitoring as wthPerfMon } from "@exportScripts";
import { type SelectorPos, SelectorType } from "@exportTypes";
import type { CssSupportLike as CssSupLk, FetchResponse as FtchRes } from "@langs/css/cssType";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const MX_FL_SZ = 2 * 1024 * 1024;
const MX_CONT_LEN = 500_000;
const MX_WS_FLS = 500;
const BATCH_SIZE = 10;
const REQ_TMT_MS = 10_000;
const TMPL_LTRL_RE = /\${[^}]*}/g;
const VCIR = /^[^\s"'`<>/=]+$/;
const QUOTE_CHARS = [`'`, `"`, `\``] as const;
const BCKS_RE = /\\/g;
const CLSS_ATTR_RE = /(?<!:)\b(?:class|classname|ngclass)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const BCAR = /\b(?::class|v-bind:class)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const ID_ATTR_RE = /(?<!:)\bid\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const BIAR = /\b(?::id|v-bind:id)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const TG_ATTR_RE = /<[A-Za-z][^>]*\b(class|className|ngClass|:class|v-bind:class|id|:id|v-bind:id)\b\s*=\s*(["'`])((?:(?!\2)[\S\s])*?)\2/gi;
const CLSS_METH_RE = /classlist\.(?:add|remove|toggle|contains|replace)\s*\(([^)]+)\)/gis;
const STR_LTRL_RE = /(["'`])((?:(?!\1).)*?)\1/g;
const QRYS_RE = /queryselector(?:all)?\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const JQRY_SEL_RE = /(?:\$|jquery)\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const HTML_FL_RE = /\.html?$/i;
const WHTS_RE = /\s+/;
const DTSR = /[:_-]$/;
const ECCR = /[,[\]{}]/;
const QTD_LTRL_RE = /(["'])((?:(?!\1)[^"'`])+)\1/;
const CSTR = /(^|[^\\])\.((?:\\.|[\w-])+)/g;
const ISTR = /(^|[^\\])#((?:\\.|[\w-])+)/g;
const GTLM_RE = /getelementbyid\s*\(\s*(["'])((?:(?!\1)[^"'`])+?)\1\s*\)/gis;
const GTLM_RE2 = /getelementsbyclassname\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const STTT_RE = /setattribute\s*\(\s*(["'`])(class|id)\1\s*,\s*([\S\s]*?)\)/gis;
const CLSS_ASSG_RE = /\.classname\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const ID_ASSG_RE = /\.id\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const RMT_URL_RE = /^https?:\/\//i;

type FetchGlobal = typeof globalThis & {
  fetch?: (url: string) => Promise<FtchRes>;
};

// MODULE STATE ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
let wsCssFls: { files: string[]; key: string } | null = null;

// FETCH UTILITIES ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const fnFtWtNtFt = async (url: string): Promise<string> => {
  const fetchFn = (globalThis as FetchGlobal).fetch;
  if (!fetchFn) {
    throw new Error(`Native fetch is not available`);
  }
  const response = await fetchFn(url);

  if (!response.ok) {
    const statusInfo = response?.statusText ?? `HTTP ${response?.status ?? `unknown`}`;
    throw new Error(statusInfo);
  }

  return response.text();
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const fnFtWtNdHt = async (url: string, rdrcRmnn=5): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const httpLib = url.startsWith(`https`) ? https : http;

    const request = httpLib.get(url, (response) => {
      const status = response.statusCode ?? 0;

      if (status >= 300 && status < 400 && response.headers?.location) {
        if (rdrcRmnn > 0) {
          try {
            const location = response.headers.location;
            const newUrl = location.startsWith(`http`) ? location : new URL(location, url).toString();
            response.resume();
            resolve(fnFtWtNdHt(newUrl, rdrcRmnn - 1));
          }
          catch {
            response.resume();
            reject(new Error(`Invalid redirect location: ${response.headers.location}`));
          }
        }
        else {
          response.resume();
          reject(new Error(`Too many redirects`));
        }
        return;
      }

      let data = ``;
      response.setEncoding?.(`utf8`);

      response.on(`data`, (chunk: string) => {
        data += chunk;
      });

      response.on(`end`, () => {
        const isSccsStat = status >= 200 && status < 300;
        isSccsStat ? resolve(data) : reject(new Error(`HTTP ${status}`));
      });
    });

    request.on(`error`, (err: Error) => {
      reject(err);
    });
    request.setTimeout?.(REQ_TMT_MS, () => {
        try {
          request.abort();
        }
        catch {
          /* ignore */
        }
        reject(new Error(`Request timeout`));
      });
  });
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const ftchCssCont = async (url: string): Promise<string> => {
  try {
    const fetchFn = (globalThis as FetchGlobal).fetch;
    return typeof fetchFn === `function` ? await fnFtWtNtFt(url) : await fnFtWtNdHt(url);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger(`error`, `file fetch failed (${url}): ${errorMessage}`);
    return ``;
  }
};

// FILE READER UTILITIES ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const rdSeFrFsPt = async (fsPath: string): Promise<SelectorPos[]> => {
  try {
    const stat = await fs.promises.stat(fsPath);
    const key = `fs://${fsPath}`;
    const cached = cacheGet(key);
    let selectors: SelectorPos[] = cached?.version === stat.mtimeMs ? cached.data : [];
    if (cached?.version !== stat.mtimeMs) {
      if (stat.size > MX_FL_SZ) {
        logger(`debug`, `file skipped for performance: ${fsPath} (${Math.round((stat.size / 1024 / 1024) * 100) / 100}MB)`);
      }
      else {
        const content = await fs.promises.readFile(fsPath, `utf8`);
        if (content.length > MX_CONT_LEN) {
          logger(`debug`, `content sampled: ${fsPath}`);
          selectors = prsSels(content.slice(0, Math.max(0, MX_CONT_LEN)));
        }
        else {
          selectors = prsSels(content);
        }
        cacheSet(key, { version: stat.mtimeMs, data: selectors });
      }
    }
    return selectors;
  }
  catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err?.code === `ENOMEM` || err?.message?.includes(`out of memory`)) {
      logger(`error`, `limit reached processing: ${fsPath}`);
    }
    else {
      logger(`error`, `read from file failed: ${fsPath} -> ${err?.message ?? error}`);
    }
    return [];
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const proSnCsFl = async (filePath: string, styleMap: Map<string, SelectorPos[]>): Promise<void> => wthPerfMon(`CSS file processing: ${path.basename(filePath)}`, async () => {
    try {
      const uri = vscode.Uri.file(filePath);
      const k = uri.toString();
      if (!styleMap.has(k)) {
        styleMap.set(k, await rdSeFrFsPt(filePath));
      }
    }
    catch (error: unknown) {
      const err = error as { message?: string };
      logger(`error`, `read failed: ${filePath} -> ${err?.message ?? error}`);
    }
  });

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const proCsFlInBt = async (filePaths: string[], styleMap: Map<string, SelectorPos[]>): Promise<void> => {
  const unccFls = filePaths.filter((filePath) => !styleMap.has(vscode.Uri.file(filePath).toString()));

  for (let i = 0; i < unccFls.length; i += BATCH_SIZE) {
    const batch = unccFls.slice(i, i + BATCH_SIZE);
    const btchPrms = batch.map((filePath) => resLmtr().execute(async () => proSnCsFl(filePath, styleMap)));
    await Promise.allSettled(btchPrms);
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const ensrWsCssFls = async (folder: vscode.WorkspaceFolder, exclPats: string[]): Promise<string[]> => {
  const cacheKey = `${folder.uri.toString()}\n${exclPats.join(`\n`)}`;
  if (wsCssFls?.key === cacheKey) {
    return wsCssFls.files;
  }
  const collected: string[] = [];
  try {
    const styleExts = [`css`];
    const configured = gtAnlyExts(folder.uri).filter((e) => styleExts.includes(e));
    const unique = [...new Set(configured.length > 0 ? configured : styleExts)];
    const patterns = unique.map((e) => `**/*.${e}`);
    const exclude = exclPats.length > 0 ? `{${exclPats.join(`,`)}}` : undefined;
    for (const glob of patterns) {
      if (collected.length >= MX_WS_FLS) {
        logger(`debug`, `file limit reached (${MX_WS_FLS} files), remaining files ignored`);
        break;
      }
      const include = new vscode.RelativePattern(folder, glob);
      const remaining = MX_WS_FLS - collected.length;
      const uris = await vscode.workspace.findFiles(include, exclude, remaining);
      for (const uri of uris) {
        if (collected.length >= MX_WS_FLS) {
        	break;
        }
        !isUrExByGl(uri, exclPats) && collected.push(uri.fsPath);
        collected.length >= MX_WS_FLS && logger(`debug`, `file limit reached (${MX_WS_FLS} files), remaining files ignored`);
      }
    }
  }
  catch (error: unknown) {
    const err = error as { message?: string };
    logger(`error`, `file check error: ${err?.message ?? error}`);
  }
  logger(`debug`, `files collected: ${collected.length} items`);
  wsCssFls = { files: collected, key: cacheKey };
  return collected;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const gtWsCssFls = (): string[] | null => wsCssFls?.files ?? null;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clrWsCsFlCc = (): void => {
  wsCssFls = null;
};

// VALIDATION HELPERS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const nrmlTok = (token: string): string => {
  const normalized = !token ? `` : token.replaceAll(TMPL_LTRL_RE, ` `);
  const isQuoted = normalized && QUOTE_CHARS.some((quote) => normalized.startsWith(quote) && normalized.endsWith(quote));
  return isQuoted ? normalized.slice(1, -1) : normalized;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const makeRange = (doc: vscode.TextDocument, startIdx: number, length: number): vscode.Range => {
  const endIdx = startIdx + length;
  return new vscode.Range(doc.positionAt(startIdx), doc.positionAt(endIdx));
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const cllcKnwnSels = (all: Map<string, SelectorPos[]>): { knownClasses: Set<string>; knownIds: Set<string> } => {
  const knownClasses = new Set<string>();
  const knownIds = new Set<string>();
  for (const arr of all.values()) {
    for (const s of arr) {
      (s.type === SelectorType.CLASS ? knownClasses : knownIds).add(s.selector);
    }
  }
  return { knownClasses, knownIds };
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isVldCssId = (value: string): boolean => VCIR.test(value);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isRemoteUrl = (url: string): boolean => RMT_URL_RE.test(url);

// CSS BODY EXTRACTION ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export const extrCssBds = (fullText: string): string => {
  let depth = 0;
  let start = -1;
  let inBlckCmt = false;
  let inLnCmt = false;
  let inString = false;
  let stringChar = ``;
  const bodies: string[] = [];

  for (let i = 0; i < fullText.length; i++) {
    const ch = fullText[i];
    const prev = i > 0 ? fullText[i - 1] : ``;

    if (inBlckCmt) {
      if (prev === `*` && ch === `/`) {
        inBlckCmt = false;
      }
      continue;
    }
    if (inLnCmt) {
      if (ch === `\n`) {
        inLnCmt = false;
      }
      continue;
    }
    if (inString) {
      if (ch === stringChar && prev !== `\\`) {
        inString = false;
      }
      continue;
    }
    if (prev === `/` && ch === `*`) {
      inBlckCmt = true;
    }
    if (prev === `/` && ch === `/`) {
      inLnCmt = true;
    }

    if ((ch === `"` || ch === `'` || ch === `\``) && !inBlckCmt && !inLnCmt) {
      inString = true;
      stringChar = ch;
    }

    if (!inBlckCmt && !inString && !inLnCmt) {
      if (ch === `{`) {
        if (depth === 0) {
          start = i + 1;
        }
        depth++;
      }
      else if (ch === `}`) {
        depth--;
        if (depth === 0 && start >= 0) {
          bodies.push(fullText.slice(start, i));
          start = -1;
        }
      }
    }
  }
  return bodies.join(`\n`);
};

// REGEX EXPORTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export { BCKS_RE as BACKSLASH_REGEX, CLSS_ATTR_RE as CLASS_ATTRIBUTE_REGEX, CLSS_METH_RE as CLASSLIST_METHOD_REGEX, GTLM_RE as GETELEMENTBYID_REGEX, QRYS_RE as QUERYSELECTOR_REGEX, RMT_URL_RE as REMOTE_URL_REGEX, STR_LTRL_RE as STRING_LITERAL_REGEX };

// VALIDATION FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isHtmlLkDoc = (document: vscode.TextDocument): boolean => document.languageId === `html` || HTML_FL_RE.test(document.fileName);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
type BlockRange = { start: number; end: number };

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const cllHtBlRn = (fullText: string, tag: `script` | `style`): BlockRange[] => {
  const ranges: BlockRange[] = [];
  const regex = new RegExp(`<${tag}\\b[^>]*>[\\S\\s]*?<\\/${tag}\\s*>`, `gi`);
  let m = regex.exec(fullText);
  while (m) {
    const start = m.index;
    const end = m.index + m[0].length;
    ranges.push({ start, end });
    m = regex.exec(fullText);
  }
  return ranges;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isIdxInRngs = (index: number, ranges: BlockRange[]): boolean => {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = ranges[mid];
    if (index < r.start) {
    	hi = mid - 1;
    }
    else if (index >= r.end) {
    	lo = mid + 1;
    }
    else {
    	return true;
    }
  }
  return false;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const cllToFrWhLs = (raw: string): string[] => {
  const out = new Set<string>();
  const tokens = raw.split(WHTS_RE);
  for (const token of tokens) {
    const normVal = nrmlTok(token).trim();
    normVal && isVldCssId(normVal) && out.add(normVal);
  }
  const values = [...out.values()];
  const filtered = raw.includes(`\${`) ? values.filter((v) => !DTSR.test(v)) : values;
  return filtered;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const cllToFrEx = (raw: string): string[] => {
  const out = new Set<string>();

  // 1) string literals inside expression: :class="['a', foo]" / :class="{ 'a-b': cond }"
  const lclStrLtrlRe = /(["'`])((?:(?!\1)[\S\s])*?)\1/g;
  let m = lclStrLtrlRe.exec(raw);
  while (m) {
    const normVal = nrmlTok(m[2]).trim();
    if (!normVal) {
      m = lclStrLtrlRe.exec(raw);
      continue;
    }
    const parts = normVal.split(WHTS_RE);
    for (const p of parts) {
      const v = p.trim();
      v && isVldCssId(v) && out.add(v);
    }
    m = lclStrLtrlRe.exec(raw);
  }
  // 2) unquoted object keys: :class="{ active: isActive }"
  const objcKyRe = /(?:^|[,{]\s*)([$A-Z_a-z][\w$-]*)\s*:/g;
  m = objcKyRe.exec(raw);
  while (m) {
    const key = m[1];
    key && isVldCssId(key) && out.add(key);
    m = objcKyRe.exec(raw);
  }
  return [...out.values()];
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const cllcClssToks = (raw: string): string[] => {
  const hsExprChrs = ECCR.test(raw);
  const rs = hsExprChrs ? cllToFrEx(raw) : cllToFrWhLs(raw);
  return rs;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const cllcIdToks = (raw: string): string[] => {
  const tokens = cllToFrWhLs(raw);
  const rs = tokens.length > 0 ? [tokens[0]] : [];
  return rs;
};

const procClssVal = (rawClasses: string, baseOffset: number, trtAsExpr: boolean, document: vscode.TextDocument, knownClasses: Set<string>, diagnostics: vscode.Diagnostic[], usedClasses: Set<string>): void => {
  const tokens = trtAsExpr ? cllToFrEx(rawClasses) : cllcClssToks(rawClasses);

  for (const token of tokens) {
    const normVal = token.trim();
    if (!normVal) {
    	continue;
    }
    const relativeIdx = rawClasses.indexOf(normVal);
    const hiStrt = relativeIdx >= 0 ? baseOffset + relativeIdx : baseOffset;
    const highlightLen = normVal.length;

    knownClasses.has(normVal) ? usedClasses.add(normVal) : (() => {
        const d = new vscode.Diagnostic(makeRange(document, hiStrt, highlightLen), `CSS class '${normVal}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS001`;
        diagnostics.push(d);
      })();
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const procIdVal = (rawId: string, baseOffset: number, trtAsExpr: boolean, document: vscode.TextDocument, knownIds: Set<string>, diagnostics: vscode.Diagnostic[], usedIds: Set<string>): void => {
  const tokens = trtAsExpr ? ((): string[] => {
        const out = new Set<string>();
        const lclStrLtrlRe = /(["'`])((?:(?!\1)[\S\s])*?)\1/g;
        let m = lclStrLtrlRe.exec(rawId);
        while (m) {
          const normVal = nrmlTok(m[2]).trim();
          normVal && isVldCssId(normVal) && out.add(normVal);
          m = lclStrLtrlRe.exec(rawId);
        }
        return [...out.values()];
      })() : cllcIdToks(rawId);

  for (const token of tokens) {
    const normVal = token.trim();
    if (!normVal) {
    	continue;
    }
    const relativeIdx = rawId.indexOf(normVal);
    const hiStrt = relativeIdx >= 0 ? baseOffset + relativeIdx : baseOffset;
    const highlightLen = normVal.length;

    knownIds.has(normVal) ? usedIds.add(normVal) : (() => {
        const d = new vscode.Diagnostic(makeRange(document, hiStrt, highlightLen), `CSS id '#${normVal}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS002`;
        diagnostics.push(d);
      })();
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const proClLsCl = (match: RegExpExecArray, document: vscode.TextDocument, knownClasses: Set<string>, diagnostics: vscode.Diagnostic[], usedClasses: Set<string>): void => {
  const argsStr = match[1];
  let literalMatch: RegExpExecArray | null;
  const lclStrLtrlRe = /(["'`])((?:(?!\1).)*?)\1/g;

  literalMatch = lclStrLtrlRe.exec(argsStr);
  while (literalMatch) {
    const normVal = nrmlTok(literalMatch[2]).trim();

    if (!normVal || !isVldCssId(normVal)) {
      literalMatch = lclStrLtrlRe.exec(argsStr);
    	continue;
    }
    knownClasses.has(normVal) ? usedClasses.add(normVal) : (() => {
        const baseOffset = match.index + match[0].indexOf(literalMatch[0]);
        const innerIdx = literalMatch[0].indexOf(literalMatch[2]);
        const tokenStart = baseOffset + Math.max(innerIdx, 0);
        const d = new vscode.Diagnostic(makeRange(document, tokenStart, literalMatch[2].length), `CSS class '${normVal}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS001`;
        diagnostics.push(d);
      })();
    literalMatch = lclStrLtrlRe.exec(argsStr);
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// 2. HTML 마크업에서 정의된 class/id 사전수집 (JS 셀렉터 오탐 방지) ―――-
const cllcMrkpDfnt = (fullText: string, scriptRanges: BlockRange[], styleRanges: BlockRange[]): { markupClasses: Set<string>; markupIds: Set<string> } => {
  const mrkpClss = new Set<string>();
  const markupIds = new Set<string>();

  const classRe = /(?<!:)\b(?:class|classname|ngclass)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
  let m = classRe.exec(fullText);
  while (m) {
    if (isIdxInRngs(m.index, scriptRanges) || isIdxInRngs(m.index, styleRanges)) {
      m = classRe.exec(fullText);
    	continue;
    }
    for (const t of cllcClssToks(m[2])) {
      mrkpClss.add(t);
    }
    m = classRe.exec(fullText);
  }
  const idRe = /(?<!:)\bid\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
  m = idRe.exec(fullText);
  while (m) {
    if (isIdxInRngs(m.index, scriptRanges) || isIdxInRngs(m.index, styleRanges)) {
      m = idRe.exec(fullText);
    	continue;
    }
    for (const t of cllcIdToks(m[2])) {
      markupIds.add(t);
    }
    m = idRe.exec(fullText);
  }
  return { markupClasses: mrkpClss, markupIds };
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const scnDocUsgs = (
  fullText: string,
  document: vscode.TextDocument,
  knownClasses: Set<string>,
  knownIds: Set<string>,
): {
  diagnostics: vscode.Diagnostic[];
  usedClassesFromMarkup: Set<string>;
  usedIdsFromMarkup: Set<string>;
} => {
  const diagnostics: vscode.Diagnostic[] = [];
  const usdClFrMr = new Set<string>();
  const usdIdFrMr = new Set<string>();
  const isHtml = isHtmlLkDoc(document);
  const htmlScrRngs = isHtml ? cllHtBlRn(fullText, `script`) : [];
  const htmlStylRngs = isHtml ? cllHtBlRn(fullText, `style`) : [];

  // HTML 마크업에 정의된 class/id를 사전수집 → JS 셀렉터에서 참조 시 오탐 방지
  const { markupClasses: mrkpClss, markupIds } = isHtml ? cllcMrkpDfnt(fullText, htmlScrRngs, htmlStylRngs) : { markupClasses: new Set<string>(), markupIds: new Set<string>() };
  const allKnwnClss = mrkpClss.size > 0 ? new Set([...knownClasses, ...mrkpClss]) : knownClasses;
  const allKnownIds = markupIds.size > 0 ? new Set([...knownIds, ...markupIds]) : knownIds;

  // Reset regex lastIndex
  CLSS_ATTR_RE.lastIndex = 0;
  BCAR.lastIndex = 0;
  ID_ATTR_RE.lastIndex = 0;
  BIAR.lastIndex = 0;
  TG_ATTR_RE.lastIndex = 0;
  CLSS_METH_RE.lastIndex = 0;
  QRYS_RE.lastIndex = 0;
  JQRY_SEL_RE.lastIndex = 0;
  GTLM_RE.lastIndex = 0;
  GTLM_RE2.lastIndex = 0;
  STTT_RE.lastIndex = 0;
  CLSS_ASSG_RE.lastIndex = 0;
  ID_ASSG_RE.lastIndex = 0;

  if (isHtml) {
    // class / className / ngClass (정적)
    let clssAttrMtch = CLSS_ATTR_RE.exec(fullText);
    while (clssAttrMtch) {
      if (!isIdxInRngs(clssAttrMtch.index, htmlScrRngs) && !isIdxInRngs(clssAttrMtch.index, htmlStylRngs)) {
        const rawClasses = clssAttrMtch[2];
        const baseOffset = clssAttrMtch.index + clssAttrMtch[0].indexOf(rawClasses);
        procClssVal(rawClasses, baseOffset, false, document, knownClasses, diagnostics, usdClFrMr);
      }
      clssAttrMtch = CLSS_ATTR_RE.exec(fullText);
    }

    // :class / v-bind:class (동적)
    let bndClssMtch = BCAR.exec(fullText);
    while (bndClssMtch) {
      if (!isIdxInRngs(bndClssMtch.index, htmlScrRngs) && !isIdxInRngs(bndClssMtch.index, htmlStylRngs)) {
        const rawClasses = bndClssMtch[2];
        const baseOffset = bndClssMtch.index + bndClssMtch[0].indexOf(rawClasses);
        procClssVal(rawClasses, baseOffset, true, document, knownClasses, diagnostics, usdClFrMr);
      }
      bndClssMtch = BCAR.exec(fullText);
    }

    // id (정적)
    let idAttrMtch = ID_ATTR_RE.exec(fullText);
    while (idAttrMtch) {
      if (!isIdxInRngs(idAttrMtch.index, htmlScrRngs) && !isIdxInRngs(idAttrMtch.index, htmlStylRngs)) {
        const rawId = idAttrMtch[2];
        const baseOffset = idAttrMtch.index + idAttrMtch[0].indexOf(rawId);
        procIdVal(rawId, baseOffset, false, document, knownIds, diagnostics, usdIdFrMr);
      }
      idAttrMtch = ID_ATTR_RE.exec(fullText);
    }

    // :id / v-bind:id (동적)
    let boundIdMatch = BIAR.exec(fullText);
    while (boundIdMatch) {
      if (!isIdxInRngs(boundIdMatch.index, htmlScrRngs) && !isIdxInRngs(boundIdMatch.index, htmlStylRngs)) {
        const rawId = boundIdMatch[2];
        const baseOffset = boundIdMatch.index + boundIdMatch[0].indexOf(rawId);
        procIdVal(rawId, baseOffset, true, document, knownIds, diagnostics, usdIdFrMr);
      }
      boundIdMatch = BIAR.exec(fullText);
    }
  }
  else {
    // JS 문서에서는 <...> 태그 형태에서만 class/id 속성 추출 (JS 객체 class: "..." 오탐 방지)
    let tagAttrMatch = TG_ATTR_RE.exec(fullText);
    while (tagAttrMatch) {
      const attrName = (tagAttrMatch[1] || ``).toLowerCase();
      const raw = tagAttrMatch[3] || ``;
      const baseOffset = tagAttrMatch.index + tagAttrMatch[0].indexOf(raw);
      const isBound = attrName.startsWith(`:`) || attrName.startsWith(`v-bind:`);
      if (attrName.includes(`class`) || attrName === `ngclass`) {
        procClssVal(raw, baseOffset, isBound, document, knownClasses, diagnostics, usdClFrMr);
      }
      if (attrName.includes(`id`)) {
        procIdVal(raw, baseOffset, isBound, document, knownIds, diagnostics, usdIdFrMr);
      }
      tagAttrMatch = TG_ATTR_RE.exec(fullText);
    }
  }

  // classList 메서드 호출 처리
  let clssLstMtch = CLSS_METH_RE.exec(fullText);
  while (clssLstMtch) {
    if (isHtml && !isIdxInRngs(clssLstMtch.index, htmlScrRngs)) {
      clssLstMtch = CLSS_METH_RE.exec(fullText);
      continue;
    }
    proClLsCl(clssLstMtch, document, allKnwnClss, diagnostics, usdClFrMr);
    clssLstMtch = CLSS_METH_RE.exec(fullText);
  }
  // querySelector* / jQuery selectors (unified loop) ―――-
  for (const selRe of [QRYS_RE, JQRY_SEL_RE]) {
    selRe.lastIndex = 0;
    let selMtch = selRe.exec(fullText);
    while (selMtch) {
      if (isHtml && !isIdxInRngs(selMtch.index, htmlScrRngs)) {
        selMtch = selRe.exec(fullText);
        continue;
      }
      const q = selMtch[2];
      if (q.includes(`\${`)) {
        selMtch = selRe.exec(fullText);
        continue;
      }
      const base = selMtch.index + selMtch[0].indexOf(q);
      CSTR.lastIndex = 0;
      ISTR.lastIndex = 0;
      let m = CSTR.exec(q);
      while (m) {
        const val = m[2].replaceAll(BCKS_RE, ``);
        if (val) {
          if (allKnwnClss.has(val)) {
            usdClFrMr.add(val);
          }
          else {
            const start = base + m.index + (m[1] ? 1 : 0) + 1;
            const d = new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS001`;
            diagnostics.push(d);
          }
        }
        m = CSTR.exec(q);
      }
      m = ISTR.exec(q);
      while (m) {
        const val = m[2].replaceAll(BCKS_RE, ``);
        if (val) {
          if (allKnownIds.has(val)) {
            usdIdFrMr.add(val);
          }
          else {
            const start = base + m.index + (m[1] ? 1 : 0) + 1;
            const d = new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS id '#${val}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS002`;
            diagnostics.push(d);
          }
        }
        m = ISTR.exec(q);
      }
      selMtch = selRe.exec(fullText);
    }
  }
  // getElementById
  let gebi = GTLM_RE.exec(fullText);
  while (gebi) {
    if (isHtml && !isIdxInRngs(gebi.index, htmlScrRngs)) {
      gebi = GTLM_RE.exec(fullText);
      continue;
    }
    const id = gebi[2];
    if (id) {
      if (allKnownIds.has(id)) {
        usdIdFrMr.add(id);
      }
      else {
        const m = gebi[0].match(QTD_LTRL_RE);
        const litLen = m ? m[0].length : id.length + 2;
        const start = gebi.index + (m ? gebi[0].indexOf(m[0]) : 0);
        const d = new vscode.Diagnostic(makeRange(document, start, litLen), `CSS id '#${id}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS002`;
        diagnostics.push(d);
      }
    }
    gebi = GTLM_RE.exec(fullText);
  }
  // getElementsByClassName
  let gebc = GTLM_RE2.exec(fullText);
  while (gebc) {
    if (isHtml && !isIdxInRngs(gebc.index, htmlScrRngs)) {
      gebc = GTLM_RE2.exec(fullText);
      continue;
    }
    const raw = gebc[2];
    const base = gebc.index + gebc[0].indexOf(raw);
    const tokens = cllcClssToks(raw);
    for (const val of tokens) {
      if (val) {
        if (allKnwnClss.has(val)) {
          usdClFrMr.add(val);
        }
        else {
          const start = base + raw.indexOf(val);
          const d = new vscode.Diagnostic(makeRange(document, start, val.length), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning);
          d.source = `CSS-Analyzer`;
          d.code = `CSS001`;
          diagnostics.push(d);
        }
      }
    }
    gebc = GTLM_RE2.exec(fullText);
  }
  // setAttribute("class"|"id", ...)
  let sa = STTT_RE.exec(fullText);
  while (sa) {
    if (isHtml && !isIdxInRngs(sa.index, htmlScrRngs)) {
      sa = STTT_RE.exec(fullText);
      continue;
    }
    const attr = (sa[2] || ``).toLowerCase();
    const args = sa[3] || ``;
    STR_LTRL_RE.lastIndex = 0;
    let lit = STR_LTRL_RE.exec(args);
    while (lit) {
      const raw = lit[2];
      const absBase = sa.index + sa[0].indexOf(lit[0]) + lit[0].indexOf(raw);
      if (attr === `class`) {
        const classTokens = cllcClssToks(raw);
        for (const v of classTokens) {
          if (v) {
            if (allKnwnClss.has(v)) {
              usdClFrMr.add(v);
            }
            else {
              const rel = raw.indexOf(v);
              const start = rel >= 0 ? absBase + rel : absBase;
              const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS class '${v}' not found`, vscode.DiagnosticSeverity.Warning);
              d.source = `CSS-Analyzer`;
              d.code = `CSS001`;
              diagnostics.push(d);
            }
          }
        }
      }

      if (attr === `id`) {
        const idTokens = cllcIdToks(raw);
        for (const v of idTokens) {
          if (v) {
            if (allKnownIds.has(v)) {
              usdIdFrMr.add(v);
            }
            else {
              const rel = raw.indexOf(v);
              const start = rel >= 0 ? absBase + rel : absBase;
              const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS id '#${v}' not found`, vscode.DiagnosticSeverity.Warning);
              d.source = `CSS-Analyzer`;
              d.code = `CSS002`;
              diagnostics.push(d);
            }
          }
        }
      }
      lit = STR_LTRL_RE.exec(args);
    }
    sa = STTT_RE.exec(fullText);
  }
  // element.className = "..."
  let cna = CLSS_ASSG_RE.exec(fullText);
  while (cna) {
    if (isHtml && !isIdxInRngs(cna.index, htmlScrRngs)) {
      cna = CLSS_ASSG_RE.exec(fullText);
      continue;
    }
    const raw = cna[2];
    const base = cna.index + cna[0].indexOf(raw);
    const tokens = cllcClssToks(raw);
    for (const v of tokens) {
      if (v) {
        if (allKnwnClss.has(v)) {
          usdClFrMr.add(v);
        }
        else {
          const rel = raw.indexOf(v);
          const start = rel >= 0 ? base + rel : base;
          const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS class '${v}' not found`, vscode.DiagnosticSeverity.Warning);
          d.source = `CSS-Analyzer`;
          d.code = `CSS001`;
          diagnostics.push(d);
        }
      }
    }
    cna = CLSS_ASSG_RE.exec(fullText);
  }
  // element.id = "..."
  let ida = ID_ASSG_RE.exec(fullText);
  while (ida) {
    if (isHtml && !isIdxInRngs(ida.index, htmlScrRngs)) {
      ida = ID_ASSG_RE.exec(fullText);
      continue;
    }
    const raw = ida[2];
    const base = ida.index + ida[0].indexOf(raw);
    const tokens = cllcIdToks(raw);
    for (const v of tokens) {
      if (v) {
        if (allKnownIds.has(v)) {
          usdIdFrMr.add(v);
        }
        else {
          const rel = raw.indexOf(v);
          const start = rel >= 0 ? base + rel : base;
          const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS id '#${v}' not found`, vscode.DiagnosticSeverity.Warning);
          d.source = `CSS-Analyzer`;
          d.code = `CSS002`;
          diagnostics.push(d);
        }
      }
    }
    ida = ID_ASSG_RE.exec(fullText);
  }
  return { diagnostics, usedClassesFromMarkup: usdClFrMr, usedIdsFromMarkup: usdIdFrMr };
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const scnLclUnsd = async (doc: vscode.TextDocument, support: CssSupLk, fullText: string): Promise<vscode.Diagnostic[]> => {
  const diagnostics: vscode.Diagnostic[] = [];
  const sels = await support.getLocalDoc(doc);
  const bodyOnly = extrCssBds(fullText);
  const usedClasses = new Set<string>();
  const usedIds = new Set<string>();
  CSTR.lastIndex = 0;
  ISTR.lastIndex = 0;
  let m = CSTR.exec(bodyOnly);
  while (m) {
    usedClasses.add(m[2].replaceAll(BCKS_RE, ``));
    m = CSTR.exec(bodyOnly);
  }
  m = ISTR.exec(bodyOnly);
  while (m) {
    usedIds.add(m[2].replaceAll(BCKS_RE, ``));
    m = ISTR.exec(bodyOnly);
  }
  for (const s of sels) {
    const used = s.type === SelectorType.CLASS ? usedClasses.has(s.selector) : usedIds.has(s.selector);
    !used && (() => {
        const symbolOffset = 1;
        const base = doc.positionAt(s.index);
        const start = base.translate(0, symbolOffset);
        const end = start.translate(0, s.selector.length);
        const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? `.` : `#`) + s.selector}'`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS003`;
        d.tags = [vscode.DiagnosticTag.Unnecessary];
        diagnostics.push(d);
      })();
  }
  return diagnostics;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const scnEmbdUnsd = async (doc: vscode.TextDocument, support: CssSupLk, usdClFrMr: Set<string>, usdIdFrMr: Set<string>, fullText?: string): Promise<vscode.Diagnostic[]> => {
  const diagnostics: vscode.Diagnostic[] = [];
  const localDefs = await support.getLocalDoc(doc, fullText);
  for (const s of localDefs) {
    const used = s.type === SelectorType.CLASS ? usdClFrMr.has(s.selector) : usdIdFrMr.has(s.selector);
    !used && (() => {
        const symbolOffset = 1;
        const base = doc.positionAt(s.index);
        const start = base.translate(0, symbolOffset);
        const end = start.translate(0, s.selector.length);
        const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${(s.type === SelectorType.CLASS ? `.` : `#`) + s.selector}'`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS003`;
        d.tags = [vscode.DiagnosticTag.Unnecessary];
        diagnostics.push(d);
      })();
  }
  return diagnostics;
};
