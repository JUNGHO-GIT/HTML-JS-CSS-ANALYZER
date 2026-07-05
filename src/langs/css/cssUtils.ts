/**
 * @file cssUtils.ts
 * @since 2025-11-26
 * @description CSS 유틸리티 함수 (파일 읽기, 원격 가져오기, 헬퍼 함수)
 */

import { getAnalyzableExtensions } from "@exportConsts";
import { cacheGet, cacheSet, parseSelectors } from "@exportLangs";
import { fs, http, https, path, vscode } from "@exportLibs";
import { isUriExcludedByGlob as isUrExByGl, logger, resourceLimiter as resLmtr, withPerformanceMonitoring as wthPerfMon } from "@exportScripts";
import { type SelectorPos, SelectorType } from "@exportTypes";
import type { CssSupportLike as CssSupLk, FetchResponse as FtchRes } from "@langs/css/cssType";

// CONSTANTS ---------------------------------------------------------------------------------------
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_CONTENT_LEN = 500_000;
const MAX_WORKSPACE_FILES = 500;
const BATCH_SIZE = 10;
const REQUEST_TIMEOUT_MS = 10_000;
const TEMPLATE_LITERAL_RE = /\${[^}]*}/g;
// CSS 식별자 검증: 공백/따옴표/꺾쇠/슬래시/등호에 더해 표현식·구조 문자({}()[],;#.)도 제외해 오탐을 줄인다.
const VALID_CSS_ID_RE = /^[^\s"'`<>/=.{}()\[\],;#]+$/;
const QUOTE_CHARS = [`'`, `"`, `\``] as const;
const BACKSLASH_RE = /\\/g;
const CLASS_ATTR_MATCH_RE = /(?<!:)\b(?:class|classname|ngclass)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const BIND_CLASS_ATTR_RE = /\b(?::class|v-bind:class)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const ID_ATTR_MATCH_RE = /(?<!:)\bid\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const BIND_ID_ATTR_RE = /\b(?::id|v-bind:id)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const TAG_ATTR_RE = /<[A-Za-z][^>]*\b(class|className|ngClass|:class|v-bind:class|id|:id|v-bind:id)\b\s*=\s*(["'`])((?:(?!\2)[\S\s])*?)\2/gi;
const CLASS_METHOD_RE = /classlist\.(?:add|remove|toggle|contains|replace)\s*\(([^)]+)\)/gis;
const STRING_LITERAL_RE = /(["'`])((?:(?!\1).)*?)\1/g;
const QUERY_SELECTOR_CALL_RE = /queryselector(?:all)?\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const JQUERY_SELECTOR_RE = /(?:\$|jquery)\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const HTML_FILE_RE = /\.html?$/i;
const TRAILING_SEP_RE = /[:_-]$/;
const EXPR_COMPLEX_RE = /[,[\]{}]/;
const QUOTED_LITERAL_RE = /(["'])((?:(?!\1)[^"'`])+)\1/;
const CLASS_TOKEN_RE = /(^|[^\\])\.((?:\\.|[\w-])+)/g;
const ID_TOKEN_RE = /(^|[^\\])#((?:\\.|[\w-])+)/g;
const GET_BY_ID_CALL_RE = /getelementbyid\s*\(\s*(["'])((?:(?!\1)[^"'`])+?)\1\s*\)/gis;
const GET_BY_CLASS_CALL_RE = /getelementsbyclassname\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const SET_ATTRIBUTE_CALL_RE = /setattribute\s*\(\s*(["'`])(class|id)\1\s*,\s*([\S\s]*?)\)/gis;
const CLASS_ASSIGN_RE = /\.classname\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const ID_ASSIGN_RE = /\.id\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const REMOTE_URL_RE = /^https?:\/\//i;

type FetchGlobal = typeof globalThis & {
  fetch?: (url: string) => Promise<FtchRes>;
};

// 토큰과 원문(raw) 내 절대 오프셋을 함께 전달하기 위한 형태.
type TokenHit = { value: string; offset: number };

// MODULE STATE ------------------------------------------------------------------------------------
// 멀티루트 스래싱 방지를 위해 폴더별로 캐시하고, 폴더별 진행 중 조회를 재사용한다.
const wsCssByFolder = new Map<string, { files: string[]; key: string }>();
const wsCssPending = new Map<string, Promise<string[]>>();

// FETCH UTILITIES ---------------------------------------------------------------------------------
const fetchViaNativeFetch = async (url: string): Promise<string> => {
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

// -------------------------------------------------------------------------------------------------
const fetchViaNodeHttp = async (url: string, rdrcRmnn = 5): Promise<string> => {
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
            resolve(fetchViaNodeHttp(newUrl, rdrcRmnn - 1));
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
        if (status >= 200 && status < 300) {
          resolve(data);
        }
        else {
          reject(new Error(`HTTP ${status}`));
        }
      });
    });

    request.on(`error`, (err: Error) => {
      reject(err);
    });
    request.setTimeout?.(REQUEST_TIMEOUT_MS, () => {
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

// -------------------------------------------------------------------------------------------------
export const fetchCssContent = async (url: string): Promise<string> => {
  try {
    const fetchFn = (globalThis as FetchGlobal).fetch;
    return typeof fetchFn === `function` ? await fetchViaNativeFetch(url) : await fetchViaNodeHttp(url);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger(`error`, `file fetch failed (${url}): ${errorMessage}`);
    return ``;
  }
};

// FILE READER UTILITIES ---------------------------------------------------------------------------
export const readSelectorsFromFsPath = async (fsPath: string): Promise<SelectorPos[]> => {
  try {
    const stat = await fs.promises.stat(fsPath);
    const key = `fs://${fsPath}`;
    const cached = cacheGet(key);
    let selectors: SelectorPos[] = cached?.version === stat.mtimeMs ? cached.data : [];
    if (cached?.version !== stat.mtimeMs) {
      if (stat.size > MAX_FILE_SIZE) {
        logger(`debug`, `file skipped for performance: ${fsPath} (${Math.round((stat.size / 1024 / 1024) * 100) / 100}MB)`);
      }
      else {
        const content = await fs.promises.readFile(fsPath, `utf8`);
        if (content.length > MAX_CONTENT_LEN) {
          logger(`debug`, `content sampled: ${fsPath}`);
          selectors = parseSelectors(content.slice(0, Math.max(0, MAX_CONTENT_LEN)));
        }
        else {
          selectors = parseSelectors(content);
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

// -------------------------------------------------------------------------------------------------
const processSingleCssFile = async (filePath: string, styleMap: Map<string, SelectorPos[]>): Promise<void> => wthPerfMon(`CSS file processing: ${path.basename(filePath)}`, async () => {
  try {
    const uri = vscode.Uri.file(filePath);
    const k = uri.toString();
    if (!styleMap.has(k)) {
      styleMap.set(k, await readSelectorsFromFsPath(filePath));
    }
  }
  catch (error: unknown) {
    const err = error as { message?: string };
    logger(`error`, `read failed: ${filePath} -> ${err?.message ?? error}`);
  }
});

// -------------------------------------------------------------------------------------------------
export const processCssFilesInBatches = async (filePaths: string[], styleMap: Map<string, SelectorPos[]>): Promise<void> => {
  const unccFls = filePaths.filter((filePath) => !styleMap.has(vscode.Uri.file(filePath).toString()));

  for (let i = 0; i < unccFls.length; i += BATCH_SIZE) {
    const batch = unccFls.slice(i, i + BATCH_SIZE);
    const btchPrms = batch.map((filePath) => resLmtr().execute(async () => processSingleCssFile(filePath, styleMap)));
    await Promise.allSettled(btchPrms);
  }
};

// -------------------------------------------------------------------------------------------------
export const ensureWorkspaceCssFiles = async (folder: vscode.WorkspaceFolder, exclPats: string[]): Promise<string[]> => {
  const folderKey = folder.uri.toString();
  const cacheKey = `${folderKey}\n${exclPats.join(`\n`)}`;
  const cached = wsCssByFolder.get(folderKey);
  if (cached?.key === cacheKey) {
    return cached.files;
  }
  const inflight = wsCssPending.get(cacheKey);
  if (inflight) {
    return inflight;
  }
  const promise = (async (): Promise<string[]> => {
    const collected: string[] = [];
    try {
      const styleExts = [`css`];
      const configured = getAnalyzableExtensions(folder.uri).filter((e) => styleExts.includes(e));
      const unique = [...new Set(configured.length > 0 ? configured : styleExts)];
      const patterns = unique.map((e) => `**/*.${e}`);
      const exclude = exclPats.length > 0 ? `{${exclPats.join(`,`)}}` : undefined;
      for (const glob of patterns) {
        if (collected.length >= MAX_WORKSPACE_FILES) {
          logger(`debug`, `file limit reached (${MAX_WORKSPACE_FILES} files), remaining files ignored`);
          break;
        }
        const include = new vscode.RelativePattern(folder, glob);
        const remaining = MAX_WORKSPACE_FILES - collected.length;
        const uris = await vscode.workspace.findFiles(include, exclude, remaining);
        for (const uri of uris) {
          if (collected.length >= MAX_WORKSPACE_FILES) {
            break;
          }
          if (!isUrExByGl(uri, exclPats)) {
            collected.push(uri.fsPath);
          }
          if (collected.length >= MAX_WORKSPACE_FILES) {
            logger(`debug`, `file limit reached (${MAX_WORKSPACE_FILES} files), remaining files ignored`);
          }
        }
      }
    }
    catch (error: unknown) {
      const err = error as { message?: string };
      logger(`error`, `file check error: ${err?.message ?? error}`);
    }
    logger(`debug`, `files collected: ${collected.length} items`);
    wsCssByFolder.set(folderKey, { files: collected, key: cacheKey });
    return collected;
  })();

  wsCssPending.set(cacheKey, promise);
  try {
    return await promise;
  }
  finally {
    wsCssPending.delete(cacheKey);
  }
};

// -------------------------------------------------------------------------------------------------
export const getWorkspaceCssFiles = (): string[] | null => {
  if (wsCssByFolder.size === 0) {
    return null;
  }
  const all: string[] = [];
  for (const entry of wsCssByFolder.values()) {
    all.push(...entry.files);
  }
  return all;
};

// -------------------------------------------------------------------------------------------------
export const clearWorkspaceCssFilesCache = (): void => {
  wsCssByFolder.clear();
  wsCssPending.clear();
};

// VALIDATION HELPERS ------------------------------------------------------------------------------
export const normalizeToken = (token: string): string => {
  const normalized = !token ? `` : token.replaceAll(TEMPLATE_LITERAL_RE, ` `);
  const isQuoted = normalized && QUOTE_CHARS.some((quote) => normalized.startsWith(quote) && normalized.endsWith(quote));
  return isQuoted ? normalized.slice(1, -1) : normalized;
};

// -------------------------------------------------------------------------------------------------
export const makeRange = (doc: vscode.TextDocument, startIdx: number, length: number): vscode.Range => {
  const endIdx = startIdx + length;
  return new vscode.Range(doc.positionAt(startIdx), doc.positionAt(endIdx));
};

// -------------------------------------------------------------------------------------------------
export const collectKnownSelectors = (all: Map<string, SelectorPos[]>): { knownClasses: Set<string>; knownIds: Set<string> } => {
  const knownClasses = new Set<string>();
  const knownIds = new Set<string>();
  for (const arr of all.values()) {
    for (const s of arr) {
      (s.type === SelectorType.CLASS ? knownClasses : knownIds).add(s.selector);
    }
  }
  return { knownClasses, knownIds };
};

// -------------------------------------------------------------------------------------------------
export const isValidCssIdentifier = (value: string): boolean => VALID_CSS_ID_RE.test(value);

// -------------------------------------------------------------------------------------------------
export const isRemoteUrl = (url: string): boolean => REMOTE_URL_RE.test(url);

// CSS BODY EXTRACTION -----------------------------------------------------------------------------
// CSS 는 /* */ 블록주석만 존재한다. // 라인주석 처리를 두면 url(http://...) 등에서 중괄호 매칭이 붕괴하므로 제외한다.
export const extractCssBodies = (fullText: string): string => {
  let depth = 0;
  let start = -1;
  let inBlckCmt = false;
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
    if (inString) {
      if (ch === stringChar && prev !== `\\`) {
        inString = false;
      }
      continue;
    }
    if (prev === `/` && ch === `*`) {
      inBlckCmt = true;
      continue;
    }
    if (ch === `"` || ch === `'` || ch === `\``) {
      inString = true;
      stringChar = ch;
      continue;
    }
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
  return bodies.join(`\n`);
};

// REGEX EXPORTS -----------------------------------------------------------------------------------
export { BACKSLASH_RE as BACKSLASH_REGEX, CLASS_ATTR_MATCH_RE as CLASS_ATTRIBUTE_REGEX, CLASS_METHOD_RE as CLASSLIST_METHOD_REGEX, GET_BY_ID_CALL_RE as GETELEMENTBYID_REGEX, QUERY_SELECTOR_CALL_RE as QUERYSELECTOR_REGEX, REMOTE_URL_RE as REMOTE_URL_REGEX, STRING_LITERAL_RE as STRING_LITERAL_REGEX };

// VALIDATION FUNCTIONS ----------------------------------------------------------------------------
const isHtmlLikeDoc = (document: vscode.TextDocument): boolean => document.languageId === `html` || HTML_FILE_RE.test(document.fileName);

// -------------------------------------------------------------------------------------------------
type BlockRange = { start: number; end: number };

// -------------------------------------------------------------------------------------------------
const collectHtmlBlockRanges = (fullText: string, tag: `script` | `style`): BlockRange[] => {
  const ranges: BlockRange[] = [];
  const regex = new RegExp(`<${tag}\\b[^>]*>[\\S\\s]*?<\\/${tag}\\s*>`, `gi`);
  let m = regex.exec(fullText);
  while (m) {
    ranges.push({ start: m.index, end: m.index + m[0].length });
    m = regex.exec(fullText);
  }
  return ranges;
};

// -------------------------------------------------------------------------------------------------
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

// TOKEN COLLECTION (POSITION-AWARE) ---------------------------------------------------------------
// 부분문자열/중복 토큰에서 밑줄이 오배치되지 않도록, 각 토큰을 원문(raw) 내 실제 오프셋과 함께 수집한다.
const wsClassHits = (raw: string): TokenHit[] => {
  const seen = new Set<string>();
  const hits: TokenHit[] = [];
  const hasTmpl = raw.includes(`\${`);
  const re = /\S+/g;
  let m = re.exec(raw);
  while (m) {
    const normVal = normalizeToken(m[0]).trim();
    if (normVal && isValidCssIdentifier(normVal) && !seen.has(normVal) && !(hasTmpl && TRAILING_SEP_RE.test(normVal))) {
      seen.add(normVal);
      const inner = m[0].indexOf(normVal);
      hits.push({ value: normVal, offset: m.index + (inner >= 0 ? inner : 0) });
    }
    m = re.exec(raw);
  }
  return hits;
};

// -------------------------------------------------------------------------------------------------
const exprClassHits = (raw: string): TokenHit[] => {
  const seen = new Set<string>();
  const hits: TokenHit[] = [];
  // 1) 표현식 내부 문자열 리터럴: :class="['a', foo]" / :class="{ 'a-b': cond }"
  const strRe = /(["'`])((?:(?!\1)[\S\s])*?)\1/g;
  let m = strRe.exec(raw);
  while (m) {
    const content = m[2];
    const contentStart = m.index + m[0].indexOf(content);
    const partRe = /\S+/g;
    let p = partRe.exec(content);
    while (p) {
      const v = normalizeToken(p[0]).trim();
      if (v && isValidCssIdentifier(v) && !seen.has(v)) {
        seen.add(v);
        const inner = p[0].indexOf(v);
        hits.push({ value: v, offset: contentStart + p.index + (inner >= 0 ? inner : 0) });
      }
      p = partRe.exec(content);
    }
    m = strRe.exec(raw);
  }
  // 2) 따옴표 없는 객체 키: :class="{ active: isActive }"
  const keyRe = /(?:^|[,{]\s*)([$A-Z_a-z][\w$-]*)\s*:/g;
  m = keyRe.exec(raw);
  while (m) {
    const key = m[1];
    if (key && isValidCssIdentifier(key) && !seen.has(key)) {
      seen.add(key);
      hits.push({ value: key, offset: m.index + m[0].indexOf(key) });
    }
    m = keyRe.exec(raw);
  }
  return hits;
};

// -------------------------------------------------------------------------------------------------
const exprIdHits = (raw: string): TokenHit[] => {
  const seen = new Set<string>();
  const hits: TokenHit[] = [];
  const strRe = /(["'`])((?:(?!\1)[\S\s])*?)\1/g;
  let m = strRe.exec(raw);
  while (m) {
    const content = m[2];
    const v = normalizeToken(content).trim();
    if (v && isValidCssIdentifier(v) && !seen.has(v)) {
      seen.add(v);
      const contentStart = m.index + m[0].indexOf(content);
      const inner = content.indexOf(v);
      hits.push({ value: v, offset: contentStart + (inner >= 0 ? inner : 0) });
    }
    m = strRe.exec(raw);
  }
  return hits;
};

// -------------------------------------------------------------------------------------------------
const classHits = (raw: string): TokenHit[] => (EXPR_COMPLEX_RE.test(raw) ? exprClassHits(raw) : wsClassHits(raw));

// -------------------------------------------------------------------------------------------------
const wsIdHits = (raw: string): TokenHit[] => {
  const hits = wsClassHits(raw);
  return hits.length > 0 ? [hits[0]] : [];
};

// -------------------------------------------------------------------------------------------------
const processClassValue = (rawClasses: string, baseOffset: number, trtAsExpr: boolean, document: vscode.TextDocument, knownClasses: Set<string>, diagnostics: vscode.Diagnostic[], usedClasses: Set<string>): void => {
  const hits = trtAsExpr ? exprClassHits(rawClasses) : classHits(rawClasses);
  for (const hit of hits) {
    const normVal = hit.value;
    if (knownClasses.has(normVal)) {
      usedClasses.add(normVal);
      continue;
    }
    const hiStrt = baseOffset + hit.offset;
    const d = new vscode.Diagnostic(makeRange(document, hiStrt, normVal.length), `CSS class '${normVal}' not found`, vscode.DiagnosticSeverity.Warning);
    d.source = `CSS-Analyzer`;
    d.code = `CSS001`;
    diagnostics.push(d);
  }
};

// -------------------------------------------------------------------------------------------------
const processIdValue = (rawId: string, baseOffset: number, trtAsExpr: boolean, document: vscode.TextDocument, knownIds: Set<string>, diagnostics: vscode.Diagnostic[], usedIds: Set<string>): void => {
  const hits = trtAsExpr ? exprIdHits(rawId) : wsIdHits(rawId);
  for (const hit of hits) {
    const normVal = hit.value;
    if (knownIds.has(normVal)) {
      usedIds.add(normVal);
      continue;
    }
    const hiStrt = baseOffset + hit.offset;
    const d = new vscode.Diagnostic(makeRange(document, hiStrt, normVal.length), `CSS id '#${normVal}' not found`, vscode.DiagnosticSeverity.Warning);
    d.source = `CSS-Analyzer`;
    d.code = `CSS002`;
    diagnostics.push(d);
  }
};

// -------------------------------------------------------------------------------------------------
const processClassListMatch = (match: RegExpExecArray, document: vscode.TextDocument, knownClasses: Set<string>, diagnostics: vscode.Diagnostic[], usedClasses: Set<string>): void => {
  const argsStr = match[1];
  const argsBase = match.index + match[0].indexOf(argsStr);
  const lclStrLtrlRe = /(["'`])((?:(?!\1).)*?)\1/g;
  let literalMatch = lclStrLtrlRe.exec(argsStr);
  while (literalMatch) {
    const normVal = normalizeToken(literalMatch[2]).trim();
    if (normVal && isValidCssIdentifier(normVal)) {
      if (knownClasses.has(normVal)) {
        usedClasses.add(normVal);
      }
      else {
        const inner = literalMatch[0].indexOf(literalMatch[2]);
        const tokenStart = argsBase + literalMatch.index + (inner >= 0 ? inner : 0);
        const d = new vscode.Diagnostic(makeRange(document, tokenStart, literalMatch[2].length), `CSS class '${normVal}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS001`;
        diagnostics.push(d);
      }
    }
    literalMatch = lclStrLtrlRe.exec(argsStr);
  }
};

// -------------------------------------------------------------------------------------------------
// 2. HTML 마크업에서 정의된 class/id 사전수집 (JS 셀렉터 오탐 방지) ----
const collectMarkupDefined = (fullText: string, scriptRanges: BlockRange[], styleRanges: BlockRange[]): { markupClasses: Set<string>; markupIds: Set<string> } => {
  const mrkpClss = new Set<string>();
  const markupIds = new Set<string>();

  const classRe = /(?<!:)\b(?:class|classname|ngclass)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
  let m = classRe.exec(fullText);
  while (m) {
    if (!isIdxInRngs(m.index, scriptRanges) && !isIdxInRngs(m.index, styleRanges)) {
      for (const hit of classHits(m[2])) {
        mrkpClss.add(hit.value);
      }
    }
    m = classRe.exec(fullText);
  }
  const idRe = /(?<!:)\bid\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
  m = idRe.exec(fullText);
  while (m) {
    if (!isIdxInRngs(m.index, scriptRanges) && !isIdxInRngs(m.index, styleRanges)) {
      for (const hit of wsIdHits(m[2])) {
        markupIds.add(hit.value);
      }
    }
    m = idRe.exec(fullText);
  }
  return { markupClasses: mrkpClss, markupIds };
};

// -------------------------------------------------------------------------------------------------
export const scanDocumentUsages = (
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
  const isHtml = isHtmlLikeDoc(document);
  const htmlScrRngs = isHtml ? collectHtmlBlockRanges(fullText, `script`) : [];
  const htmlStylRngs = isHtml ? collectHtmlBlockRanges(fullText, `style`) : [];

  // HTML 마크업에 정의된 class/id를 사전수집 → JS 셀렉터에서 참조 시 오탐 방지
  const { markupClasses: mrkpClss, markupIds } = isHtml ? collectMarkupDefined(fullText, htmlScrRngs, htmlStylRngs) : { markupClasses: new Set<string>(), markupIds: new Set<string>() };
  const allKnwnClss = mrkpClss.size > 0 ? new Set([...knownClasses, ...mrkpClss]) : knownClasses;
  const allKnownIds = markupIds.size > 0 ? new Set([...knownIds, ...markupIds]) : knownIds;

  // 정규식 lastIndex 초기화
  CLASS_ATTR_MATCH_RE.lastIndex = 0;
  BIND_CLASS_ATTR_RE.lastIndex = 0;
  ID_ATTR_MATCH_RE.lastIndex = 0;
  BIND_ID_ATTR_RE.lastIndex = 0;
  TAG_ATTR_RE.lastIndex = 0;
  CLASS_METHOD_RE.lastIndex = 0;
  QUERY_SELECTOR_CALL_RE.lastIndex = 0;
  JQUERY_SELECTOR_RE.lastIndex = 0;
  GET_BY_ID_CALL_RE.lastIndex = 0;
  GET_BY_CLASS_CALL_RE.lastIndex = 0;
  SET_ATTRIBUTE_CALL_RE.lastIndex = 0;
  CLASS_ASSIGN_RE.lastIndex = 0;
  ID_ASSIGN_RE.lastIndex = 0;

  if (isHtml) {
    // class / className / ngClass (정적)
    let clssAttrMtch = CLASS_ATTR_MATCH_RE.exec(fullText);
    while (clssAttrMtch) {
      if (!isIdxInRngs(clssAttrMtch.index, htmlScrRngs) && !isIdxInRngs(clssAttrMtch.index, htmlStylRngs)) {
        const rawClasses = clssAttrMtch[2];
        const baseOffset = clssAttrMtch.index + clssAttrMtch[0].indexOf(rawClasses);
        processClassValue(rawClasses, baseOffset, false, document, knownClasses, diagnostics, usdClFrMr);
      }
      clssAttrMtch = CLASS_ATTR_MATCH_RE.exec(fullText);
    }

    // :class / v-bind:class (동적)
    let bndClssMtch = BIND_CLASS_ATTR_RE.exec(fullText);
    while (bndClssMtch) {
      if (!isIdxInRngs(bndClssMtch.index, htmlScrRngs) && !isIdxInRngs(bndClssMtch.index, htmlStylRngs)) {
        const rawClasses = bndClssMtch[2];
        const baseOffset = bndClssMtch.index + bndClssMtch[0].indexOf(rawClasses);
        processClassValue(rawClasses, baseOffset, true, document, knownClasses, diagnostics, usdClFrMr);
      }
      bndClssMtch = BIND_CLASS_ATTR_RE.exec(fullText);
    }

    // id (정적)
    let idAttrMtch = ID_ATTR_MATCH_RE.exec(fullText);
    while (idAttrMtch) {
      if (!isIdxInRngs(idAttrMtch.index, htmlScrRngs) && !isIdxInRngs(idAttrMtch.index, htmlStylRngs)) {
        const rawId = idAttrMtch[2];
        const baseOffset = idAttrMtch.index + idAttrMtch[0].indexOf(rawId);
        processIdValue(rawId, baseOffset, false, document, knownIds, diagnostics, usdIdFrMr);
      }
      idAttrMtch = ID_ATTR_MATCH_RE.exec(fullText);
    }

    // :id / v-bind:id (동적)
    let boundIdMatch = BIND_ID_ATTR_RE.exec(fullText);
    while (boundIdMatch) {
      if (!isIdxInRngs(boundIdMatch.index, htmlScrRngs) && !isIdxInRngs(boundIdMatch.index, htmlStylRngs)) {
        const rawId = boundIdMatch[2];
        const baseOffset = boundIdMatch.index + boundIdMatch[0].indexOf(rawId);
        processIdValue(rawId, baseOffset, true, document, knownIds, diagnostics, usdIdFrMr);
      }
      boundIdMatch = BIND_ID_ATTR_RE.exec(fullText);
    }
  }
  else {
    // JS 문서에서는 <...> 태그 형태에서만 class/id 속성 추출 (JS 객체 class: "..." 오탐 방지)
    let tagAttrMatch = TAG_ATTR_RE.exec(fullText);
    while (tagAttrMatch) {
      const attrName = (tagAttrMatch[1] || ``).toLowerCase();
      const raw = tagAttrMatch[3] || ``;
      const baseOffset = tagAttrMatch.index + tagAttrMatch[0].indexOf(raw);
      const isBound = attrName.startsWith(`:`) || attrName.startsWith(`v-bind:`);
      if (attrName.includes(`class`) || attrName === `ngclass`) {
        processClassValue(raw, baseOffset, isBound, document, knownClasses, diagnostics, usdClFrMr);
      }
      if (attrName.includes(`id`)) {
        processIdValue(raw, baseOffset, isBound, document, knownIds, diagnostics, usdIdFrMr);
      }
      tagAttrMatch = TAG_ATTR_RE.exec(fullText);
    }
  }

  // classList 메서드 호출 처리
  let clssLstMtch = CLASS_METHOD_RE.exec(fullText);
  while (clssLstMtch) {
    if (isHtml && !isIdxInRngs(clssLstMtch.index, htmlScrRngs)) {
      clssLstMtch = CLASS_METHOD_RE.exec(fullText);
      continue;
    }
    processClassListMatch(clssLstMtch, document, allKnwnClss, diagnostics, usdClFrMr);
    clssLstMtch = CLASS_METHOD_RE.exec(fullText);
  }

  // querySelector* / jQuery selectors (unified loop) ----
  for (const selRe of [QUERY_SELECTOR_CALL_RE, JQUERY_SELECTOR_RE]) {
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
      CLASS_TOKEN_RE.lastIndex = 0;
      ID_TOKEN_RE.lastIndex = 0;
      let m = CLASS_TOKEN_RE.exec(q);
      while (m) {
        const rawName = m[2];
        const val = rawName.replaceAll(BACKSLASH_RE, ``);
        if (val) {
          if (allKnwnClss.has(val)) {
            usdClFrMr.add(val);
          }
          else {
            // 접두 . 다음 위치에서 원문 길이(rawName.length)만큼 하이라이트 (이스케이프 셀렉터 대응)
            const start = base + m.index + (m[1] ? m[1].length : 0) + 1;
            const d = new vscode.Diagnostic(makeRange(document, start, rawName.length), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS001`;
            diagnostics.push(d);
          }
        }
        m = CLASS_TOKEN_RE.exec(q);
      }
      m = ID_TOKEN_RE.exec(q);
      while (m) {
        const rawName = m[2];
        const val = rawName.replaceAll(BACKSLASH_RE, ``);
        if (val) {
          if (allKnownIds.has(val)) {
            usdIdFrMr.add(val);
          }
          else {
            const start = base + m.index + (m[1] ? m[1].length : 0) + 1;
            const d = new vscode.Diagnostic(makeRange(document, start, rawName.length), `CSS id '#${val}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS002`;
            diagnostics.push(d);
          }
        }
        m = ID_TOKEN_RE.exec(q);
      }
      selMtch = selRe.exec(fullText);
    }
  }

  // getElementById
  let gebi = GET_BY_ID_CALL_RE.exec(fullText);
  while (gebi) {
    if (isHtml && !isIdxInRngs(gebi.index, htmlScrRngs)) {
      gebi = GET_BY_ID_CALL_RE.exec(fullText);
      continue;
    }
    const id = gebi[2];
    if (id) {
      if (allKnownIds.has(id)) {
        usdIdFrMr.add(id);
      }
      else {
        const litMatch = gebi[0].match(QUOTED_LITERAL_RE);
        const litLen = litMatch ? litMatch[0].length : id.length + 2;
        const start = gebi.index + (litMatch ? gebi[0].indexOf(litMatch[0]) : 0);
        const d = new vscode.Diagnostic(makeRange(document, start, litLen), `CSS id '#${id}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS002`;
        diagnostics.push(d);
      }
    }
    gebi = GET_BY_ID_CALL_RE.exec(fullText);
  }

  // getElementsByClassName
  let gebc = GET_BY_CLASS_CALL_RE.exec(fullText);
  while (gebc) {
    if (isHtml && !isIdxInRngs(gebc.index, htmlScrRngs)) {
      gebc = GET_BY_CLASS_CALL_RE.exec(fullText);
      continue;
    }
    const raw = gebc[2];
    const base = gebc.index + gebc[0].indexOf(raw);
    for (const hit of classHits(raw)) {
      const val = hit.value;
      if (allKnwnClss.has(val)) {
        usdClFrMr.add(val);
      }
      else {
        const d = new vscode.Diagnostic(makeRange(document, base + hit.offset, val.length), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS001`;
        diagnostics.push(d);
      }
    }
    gebc = GET_BY_CLASS_CALL_RE.exec(fullText);
  }

  // setAttribute("class"|"id", ...)
  let sa = SET_ATTRIBUTE_CALL_RE.exec(fullText);
  while (sa) {
    if (isHtml && !isIdxInRngs(sa.index, htmlScrRngs)) {
      sa = SET_ATTRIBUTE_CALL_RE.exec(fullText);
      continue;
    }
    const attr = (sa[2] || ``).toLowerCase();
    const args = sa[3] || ``;
    STRING_LITERAL_RE.lastIndex = 0;
    let lit = STRING_LITERAL_RE.exec(args);
    while (lit) {
      const raw = lit[2];
      const absBase = sa.index + sa[0].indexOf(lit[0]) + lit[0].indexOf(raw);
      if (attr === `class`) {
        for (const hit of classHits(raw)) {
          const v = hit.value;
          if (allKnwnClss.has(v)) {
            usdClFrMr.add(v);
          }
          else {
            const d = new vscode.Diagnostic(makeRange(document, absBase + hit.offset, v.length), `CSS class '${v}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS001`;
            diagnostics.push(d);
          }
        }
      }
      if (attr === `id`) {
        for (const hit of wsIdHits(raw)) {
          const v = hit.value;
          if (allKnownIds.has(v)) {
            usdIdFrMr.add(v);
          }
          else {
            const d = new vscode.Diagnostic(makeRange(document, absBase + hit.offset, v.length), `CSS id '#${v}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS002`;
            diagnostics.push(d);
          }
        }
      }
      lit = STRING_LITERAL_RE.exec(args);
    }
    sa = SET_ATTRIBUTE_CALL_RE.exec(fullText);
  }

  // element.className = "..."
  let cna = CLASS_ASSIGN_RE.exec(fullText);
  while (cna) {
    if (isHtml && !isIdxInRngs(cna.index, htmlScrRngs)) {
      cna = CLASS_ASSIGN_RE.exec(fullText);
      continue;
    }
    const raw = cna[2];
    const base = cna.index + cna[0].indexOf(raw);
    for (const hit of classHits(raw)) {
      const v = hit.value;
      if (allKnwnClss.has(v)) {
        usdClFrMr.add(v);
      }
      else {
        const d = new vscode.Diagnostic(makeRange(document, base + hit.offset, v.length), `CSS class '${v}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS001`;
        diagnostics.push(d);
      }
    }
    cna = CLASS_ASSIGN_RE.exec(fullText);
  }

  // element.id = "..."
  let ida = ID_ASSIGN_RE.exec(fullText);
  while (ida) {
    if (isHtml && !isIdxInRngs(ida.index, htmlScrRngs)) {
      ida = ID_ASSIGN_RE.exec(fullText);
      continue;
    }
    const raw = ida[2];
    const base = ida.index + ida[0].indexOf(raw);
    for (const hit of wsIdHits(raw)) {
      const v = hit.value;
      if (allKnownIds.has(v)) {
        usdIdFrMr.add(v);
      }
      else {
        const d = new vscode.Diagnostic(makeRange(document, base + hit.offset, v.length), `CSS id '#${v}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS002`;
        diagnostics.push(d);
      }
    }
    ida = ID_ASSIGN_RE.exec(fullText);
  }
  return { diagnostics, usedClassesFromMarkup: usdClFrMr, usedIdsFromMarkup: usdIdFrMr };
};

// -------------------------------------------------------------------------------------------------
const pushUnusedDiag = (document: vscode.TextDocument, s: SelectorPos, diagnostics: vscode.Diagnostic[]): void => {
  const symbolOffset = 1;
  const base = document.positionAt(s.index);
  const start = base.translate(0, symbolOffset);
  const end = start.translate(0, s.selector.length);
  const prefix = s.type === SelectorType.CLASS ? `.` : `#`;
  const d = new vscode.Diagnostic(new vscode.Range(start, end), `Unused CSS selector '${prefix + s.selector}'`, vscode.DiagnosticSeverity.Warning);
  d.source = `CSS-Analyzer`;
  d.code = `CSS003`;
  d.tags = [vscode.DiagnosticTag.Unnecessary];
  diagnostics.push(d);
};

// -------------------------------------------------------------------------------------------------
export const scanLocalUnused = async (doc: vscode.TextDocument, support: CssSupLk, fullText: string): Promise<vscode.Diagnostic[]> => {
  const diagnostics: vscode.Diagnostic[] = [];
  const sels = await support.getLocalDoc(doc);
  const bodyOnly = extractCssBodies(fullText);
  const usedClasses = new Set<string>();
  const usedIds = new Set<string>();
  CLASS_TOKEN_RE.lastIndex = 0;
  ID_TOKEN_RE.lastIndex = 0;
  let m = CLASS_TOKEN_RE.exec(bodyOnly);
  while (m) {
    usedClasses.add(m[2].replaceAll(BACKSLASH_RE, ``));
    m = CLASS_TOKEN_RE.exec(bodyOnly);
  }
  m = ID_TOKEN_RE.exec(bodyOnly);
  while (m) {
    usedIds.add(m[2].replaceAll(BACKSLASH_RE, ``));
    m = ID_TOKEN_RE.exec(bodyOnly);
  }
  for (const s of sels) {
    const used = s.type === SelectorType.CLASS ? usedClasses.has(s.selector) : usedIds.has(s.selector);
    if (!used) {
      pushUnusedDiag(doc, s, diagnostics);
    }
  }
  return diagnostics;
};

// -------------------------------------------------------------------------------------------------
export const scanEmbeddedUnused = async (doc: vscode.TextDocument, support: CssSupLk, usdClFrMr: Set<string>, usdIdFrMr: Set<string>, fullText?: string): Promise<vscode.Diagnostic[]> => {
  const diagnostics: vscode.Diagnostic[] = [];
  const localDefs = await support.getLocalDoc(doc, fullText);
  for (const s of localDefs) {
    const used = s.type === SelectorType.CLASS ? usdClFrMr.has(s.selector) : usdIdFrMr.has(s.selector);
    if (!used) {
      pushUnusedDiag(doc, s, diagnostics);
    }
  }
  return diagnostics;
};
