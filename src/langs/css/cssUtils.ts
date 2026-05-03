/**
 * @file cssUtils.ts
 * @since 2025-11-26
 * @description CSS 유틸리티 함수 (파일 읽기, 원격 가져오기, 헬퍼 함수)
 */

import { getAnalyzableExtensions } from "@exportConsts";
import { cacheGet, cacheSet, parseSelectors } from "@exportLangs";
import { fs, http, https, path, vscode } from "@exportLibs";
import { isUriExcludedByGlob, logger, resourceLimiter, withPerformanceMonitoring } from "@exportScripts";
import { type SelectorPos, SelectorType } from "@exportTypes";
import type { CssSupportLike, FetchResponse } from "@langs/css/cssType";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_CONTENT_LENGTH = 500_000;
const MAX_WORKSPACE_FILES = 500;
const BATCH_SIZE = 10;
const REQUEST_TIMEOUT_MS = 10_000;
const TEMPLATE_LITERAL_REGEX = /\${[^}]*}/g;
const VALID_CSS_IDENTIFIER_REGEX = /^[^\s"'`<>/=]+$/;
const QUOTE_CHARS = [`'`, `"`, `\``] as const;
const BACKSLASH_REGEX = /\\/g;
const CLASS_ATTRIBUTE_REGEX = /(?<!:)\b(?:class|classname|ngclass)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const BOUND_CLASS_ATTRIBUTE_REGEX = /\b(?::class|v-bind:class)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const ID_ATTRIBUTE_REGEX = /(?<!:)\bid\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const BOUND_ID_ATTRIBUTE_REGEX = /\b(?::id|v-bind:id)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const TAG_ATTRIBUTE_REGEX = /<[A-Za-z][^>]*\b(class|className|ngClass|:class|v-bind:class|id|:id|v-bind:id)\b\s*=\s*(["'`])((?:(?!\2)[\S\s])*?)\2/gi;
const CLASSLIST_METHOD_REGEX = /classlist\.(?:add|remove|toggle|contains|replace)\s*\(([^)]+)\)/gis;
const STRING_LITERAL_REGEX = /(["'`])((?:(?!\1).)*?)\1/g;
const QUERYSELECTOR_REGEX = /queryselector(?:all)?\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const JQUERY_SELECTOR_REGEX = /(?:\$|jquery)\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const GETELEMENTBYID_REGEX = /getelementbyid\s*\(\s*(["'])((?:(?!\1)[^"'`])+?)\1\s*\)/gis;
const GETELEMENTSBYCLASSNAME_REGEX = /getelementsbyclassname\s*\(\s*(["'`])((?:(?!\1)[\S\s])*?)\1\s*\)/gis;
const SETATTRIBUTE_REGEX = /setattribute\s*\(\s*(["'`])(class|id)\1\s*,\s*([\S\s]*?)\)/gis;
const CLASSNAME_ASSIGN_REGEX = /\.classname\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const ID_ASSIGN_REGEX = /\.id\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
const REMOTE_URL_REGEX = /^https?:\/\//i;

// MODULE STATE ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
let workspaceCssFiles: string[] | null = null;

// FETCH UTILITIES ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const fnFetchWithNativeFetch = async (url: string): Promise<string> => {
  const response = (await (globalThis as any).fetch(url)) as FetchResponse;

  !response.ok && (() => {
      const statusInfo = response?.statusText ?? `HTTP ${response?.status ?? `unknown`}`;
      throw new Error(statusInfo);
    })();

  return response.text();
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const fnFetchWithNodeHttp = async (url: string, redirectsRemaining=5): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const httpLib = url.startsWith(`https`) ? https : http;

    const request = httpLib.get(url, (response) => {
      const status = response.statusCode ?? 0;

      status >= 300 && status < 400 && response.headers?.location && (redirectsRemaining > 0 ? (() => {
            try {
              const location = response.headers.location;
              const newUrl = location.startsWith(`http`) ? location : new URL(location, url).toString();
              response.resume();
              resolve(fnFetchWithNodeHttp(newUrl, redirectsRemaining - 1));
            }
            catch {
              response.resume();
              reject(new Error(`Invalid redirect location: ${response.headers.location}`));
            }
          })() : (response.resume(), reject(new Error(`Too many redirects`))),
        void 0);

      let data = ``;
      response.setEncoding?.(`utf8`);

      response.on(`data`, (chunk: string) => {
        data += chunk;
      });

      response.on(`end`, () => {
        const isSuccessStatus = status >= 200 && status < 300;
        isSuccessStatus ? resolve(data) : reject(new Error(`HTTP ${status}`));
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const fetchCssContent = async (url: string): Promise<string> => {
  try {
    return typeof (globalThis as any).fetch === `function` ? await fnFetchWithNativeFetch(url) : await fnFetchWithNodeHttp(url);
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger(`error`, `file fetch failed (${url}): ${errorMessage}`);
    return ``;
  }
};

// FILE READER UTILITIES ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const readSelectorsFromFsPath = async (fsPath: string): Promise<SelectorPos[]> => {
  try {
    const stat = await fs.promises.stat(fsPath);
    const key = `fs://${fsPath}`;
    const cached = cacheGet(key);
    return cached?.version === stat.mtimeMs ? cached.data : (async () => stat.size > MAX_FILE_SIZE ? (logger(`debug`, `file skipped for performance: ${fsPath} (${Math.round((stat.size / 1024 / 1024) * 100) / 100}MB)`), []) : (async () => {
                const content = await fs.promises.readFile(fsPath, `utf8`);
                return content.length > MAX_CONTENT_LENGTH ? (logger(`debug`, `content sampled: ${fsPath}`),
                    (() => {
                      const parsed = parseSelectors(content.slice(0, Math.max(0, MAX_CONTENT_LENGTH)));
                      cacheSet(key, { version: stat.mtimeMs, data: parsed });
                      return parsed;
                    })()) : (() => {
                      const parsed = parseSelectors(content);
                      cacheSet(key, { version: stat.mtimeMs, data: parsed });
                      return parsed;
                    })();
              })())();
  }
  catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    return err?.code === `ENOMEM` || err?.message?.includes(`out of memory`) ? (logger(`error`, `limit reached processing: ${fsPath}`), []) : (logger(`error`, `read from file failed: ${fsPath} -> ${err?.message ?? error}`), []);
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const processSingleCssFile = async (filePath: string, styleMap: Map<string, SelectorPos[]>): Promise<void> => withPerformanceMonitoring(`CSS file processing: ${path.basename(filePath)}`, async () => {
    try {
      const uri = vscode.Uri.file(filePath);
      const k = uri.toString();
      !styleMap.has(k) && styleMap.set(k, await readSelectorsFromFsPath(filePath));
    }
    catch (error: unknown) {
      const err = error as { message?: string };
      logger(`error`, `read failed: ${filePath} -> ${err?.message ?? error}`);
    }
  });

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const processCssFilesInBatches = async (filePaths: string[], styleMap: Map<string, SelectorPos[]>): Promise<void> => {
  const uncachedFiles = filePaths.filter((filePath) => !styleMap.has(vscode.Uri.file(filePath).toString()));

  for (let i = 0; i < uncachedFiles.length; i += BATCH_SIZE) {
    const batch = uncachedFiles.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((filePath) => resourceLimiter().execute(async () => processSingleCssFile(filePath, styleMap)));
    await Promise.allSettled(batchPromises);
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const ensureWorkspaceCssFiles = async (folder: vscode.WorkspaceFolder, excludePatterns: string[]): Promise<string[]> => {
  workspaceCssFiles && void 0;
  const collected: string[] = [];
  try {
    const styleExts = [`css`];
    const configured = getAnalyzableExtensions(folder.uri).filter((e) => styleExts.includes(e));
    const unique = [...new Set(configured.length > 0 ? configured : styleExts)];
    const patterns = unique.map((e) => `**/*.${e}`);
    for (const glob of patterns) {
      if (collected.length >= MAX_WORKSPACE_FILES) {
        logger(`debug`, `file limit reached (${MAX_WORKSPACE_FILES} files), remaining files ignored`);
        break;
      }
      const include = new vscode.RelativePattern(folder, glob);
      const uris = await vscode.workspace.findFiles(include);
      for (const uri of uris) {
        if (collected.length >= MAX_WORKSPACE_FILES) {
        	break;
        }
        !isUriExcludedByGlob(uri, excludePatterns) && collected.push(uri.fsPath);
        collected.length >= MAX_WORKSPACE_FILES && logger(`debug`, `file limit reached (${MAX_WORKSPACE_FILES} files), remaining files ignored`);
      }
    }
  }
  catch (error: unknown) {
    const err = error as { message?: string };
    logger(`error`, `file check error: ${err?.message ?? error}`);
  }
  logger(`debug`, `files collected: ${collected.length} items`);
  workspaceCssFiles = collected;
  return collected;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const getWorkspaceCssFiles = (): string[] | null => workspaceCssFiles;

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clearWorkspaceCssFilesCache = (): void => {
  workspaceCssFiles = null;
};

// VALIDATION HELPERS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const normalizeToken = (token: string): string => {
  const normalized = !token ? `` : token.replaceAll(TEMPLATE_LITERAL_REGEX, ` `);
  const isQuoted = normalized && QUOTE_CHARS.some((quote) => normalized.startsWith(quote) && normalized.endsWith(quote));
  return isQuoted ? normalized.slice(1, -1) : normalized;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const makeRange = (doc: vscode.TextDocument, startIdx: number, length: number): vscode.Range => {
  const endIdx = startIdx + length;
  return new vscode.Range(doc.positionAt(startIdx), doc.positionAt(endIdx));
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isValidCssIdentifier = (value: string): boolean => VALID_CSS_IDENTIFIER_REGEX.test(value);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const isRemoteUrl = (url: string): boolean => REMOTE_URL_REGEX.test(url);

// CSS BODY EXTRACTION ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export const extractCssBodies = (fullText: string): string => {
  let depth = 0;
  let start = -1;
  let inBlockComment = false;
  let inLineComment = false;
  let inString = false;
  let stringChar = ``;
  const bodies: string[] = [];

  for (let i = 0; i < fullText.length; i++) {
    const ch = fullText[i];
    const prev = i > 0 ? fullText[i - 1] : ``;

    if (inBlockComment) {
    	prev === `*` && ch === `/` && (inBlockComment = false);
      continue;
    }
    if (inLineComment) {
    	ch === `\n` && (inLineComment = false);
      continue;
    }
    if (inString) {
    	ch === stringChar && prev !== `\\` && (inString = false);
      continue;
    }
    prev === `/` && ch === `*` && (inBlockComment = true);
    prev === `/` && ch === `/` && (inLineComment = true);

    (ch === `"` || ch === `'` || ch === `\``) && !inBlockComment && !inLineComment && ((inString = true), (stringChar = ch));

    !inBlockComment && !inString && !inLineComment && (ch === `{` ? (
	depth === 0 && (start = i + 1),
	depth++
) : ch === `}` ? (
	depth--,
	depth === 0 && start >= 0 && (bodies.push(fullText.slice(start, i)), (start = -1))
) : void 0);
  }
  return bodies.join(`\n`);
};

// REGEX EXPORTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
export { BACKSLASH_REGEX, CLASS_ATTRIBUTE_REGEX, CLASSLIST_METHOD_REGEX, GETELEMENTBYID_REGEX, QUERYSELECTOR_REGEX, REMOTE_URL_REGEX, STRING_LITERAL_REGEX };

// VALIDATION FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isHtmlLikeDocument = (document: vscode.TextDocument): boolean => document.languageId === `html` || /\.html?$/i.test(document.fileName);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
type BlockRange = { start: number; end: number };

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const collectHtmlBlockRanges = (fullText: string, tag: `script` | `style`): BlockRange[] => {
  const ranges: BlockRange[] = [];
  const regex = new RegExp(`<${tag}\\b[^>]*>[\\S\\s]*?<\\/${tag}\\s*>`, `gi`);
  let m: RegExpExecArray | null;
  while ((m = regex.exec(fullText))) {
    const start = m.index;
    const end = m.index + m[0].length;
    ranges.push({ start, end });
  }
  return ranges;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const isIndexInRanges = (index: number, ranges: BlockRange[]): boolean => {
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
const collectTokensFromWhitespaceList = (raw: string): string[] => {
  const out = new Set<string>();
  const tokens = raw.split(/\s+/);
  for (const token of tokens) {
    const normalizedValue = normalizeToken(token).trim();
    normalizedValue && isValidCssIdentifier(normalizedValue) && out.add(normalizedValue);
  }
  const values = [...out.values()];
  const filtered = raw.includes(`\${`) ? values.filter((v) => !/[:_-]$/.test(v)) : values;
  return filtered;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const collectTokensFromExpression = (raw: string): string[] => {
  const out = new Set<string>();

  // 1) string literals inside expression: :class="['a', foo]" / :class="{ 'a-b': cond }"
  const localStringLiteralRegex = /(["'`])((?:(?!\1)[\S\s])*?)\1/g;
  let m: RegExpExecArray | null;
  while ((m = localStringLiteralRegex.exec(raw))) {
    const normalizedValue = normalizeToken(m[2]).trim();
    if (!normalizedValue) {
    	continue;
    }
    const parts = normalizedValue.split(/\s+/);
    for (const p of parts) {
      const v = p.trim();
      v && isValidCssIdentifier(v) && out.add(v);
    }
  }
  // 2) unquoted object keys: :class="{ active: isActive }"
  const objectKeyRegex = /(?:^|[,{]\s*)([$A-Z_a-z][\w$-]*)\s*:/g;
  while ((m = objectKeyRegex.exec(raw))) {
    const key = m[1];
    key && isValidCssIdentifier(key) && out.add(key);
  }
  return [...out.values()];
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const collectClassTokens = (raw: string): string[] => {
  const hasExpressionChars = /[,[\]{}]/.test(raw);
  const rs = hasExpressionChars ? collectTokensFromExpression(raw) : collectTokensFromWhitespaceList(raw);
  return rs;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const collectIdTokens = (raw: string): string[] => {
  const tokens = collectTokensFromWhitespaceList(raw);
  const rs = tokens.length > 0 ? [tokens[0]] : [];
  return rs;
};

const processClassValue = (rawClasses: string, baseOffset: number, treatAsExpression: boolean, document: vscode.TextDocument, knownClasses: Set<string>, diagnostics: vscode.Diagnostic[], usedClasses: Set<string>): void => {
  const tokens = treatAsExpression ? collectTokensFromExpression(rawClasses) : collectClassTokens(rawClasses);

  for (const token of tokens) {
    const normalizedValue = token.trim();
    if (!normalizedValue) {
    	continue;
    }
    const relativeIdx = rawClasses.indexOf(normalizedValue);
    const highlightStart = relativeIdx >= 0 ? baseOffset + relativeIdx : baseOffset;
    const highlightLen = normalizedValue.length;

    knownClasses.has(normalizedValue) ? usedClasses.add(normalizedValue) : (() => {
        const d = new vscode.Diagnostic(makeRange(document, highlightStart, highlightLen), `CSS class '${normalizedValue}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS001`;
        diagnostics.push(d);
      })();
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const processIdValue = (rawId: string, baseOffset: number, treatAsExpression: boolean, document: vscode.TextDocument, knownIds: Set<string>, diagnostics: vscode.Diagnostic[], usedIds: Set<string>): void => {
  const tokens = treatAsExpression ? ((): string[] => {
        const out = new Set<string>();
        const localStringLiteralRegex = /(["'`])((?:(?!\1)[\S\s])*?)\1/g;
        let m: RegExpExecArray | null;
        while ((m = localStringLiteralRegex.exec(rawId))) {
          const normalizedValue = normalizeToken(m[2]).trim();
          normalizedValue && isValidCssIdentifier(normalizedValue) && out.add(normalizedValue);
        }
        return [...out.values()];
      })() : collectIdTokens(rawId);

  for (const token of tokens) {
    const normalizedValue = token.trim();
    if (!normalizedValue) {
    	continue;
    }
    const relativeIdx = rawId.indexOf(normalizedValue);
    const highlightStart = relativeIdx >= 0 ? baseOffset + relativeIdx : baseOffset;
    const highlightLen = normalizedValue.length;

    knownIds.has(normalizedValue) ? usedIds.add(normalizedValue) : (() => {
        const d = new vscode.Diagnostic(makeRange(document, highlightStart, highlightLen), `CSS id '#${normalizedValue}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS002`;
        diagnostics.push(d);
      })();
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const processClassListCall = (match: RegExpExecArray, document: vscode.TextDocument, knownClasses: Set<string>, diagnostics: vscode.Diagnostic[], usedClasses: Set<string>): void => {
  const argumentsString = match[1];
  let literalMatch: RegExpExecArray | null;
  const localStringLiteralRegex = /(["'`])((?:(?!\1).)*?)\1/g;

  while ((literalMatch = localStringLiteralRegex.exec(argumentsString))) {
    const normalizedValue = normalizeToken(literalMatch[2]).trim();

    if (!normalizedValue || !isValidCssIdentifier(normalizedValue)) {
    	continue;
    }
    knownClasses.has(normalizedValue) ? usedClasses.add(normalizedValue) : (() => {
        const baseOffset = match.index + match[0].indexOf(literalMatch[0]);
        const innerIdx = literalMatch[0].indexOf(literalMatch[2]);
        const tokenStart = baseOffset + (innerIdx >= 0 ? innerIdx : 0);
        const d = new vscode.Diagnostic(makeRange(document, tokenStart, literalMatch[2].length), `CSS class '${normalizedValue}' not found`, vscode.DiagnosticSeverity.Warning);
        d.source = `CSS-Analyzer`;
        d.code = `CSS001`;
        diagnostics.push(d);
      })();
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
// 2. HTML 마크업에서 정의된 class/id 사전수집 (JS 셀렉터 오탐 방지) ―――-
const collectMarkupDefinitions = (fullText: string, scriptRanges: BlockRange[], styleRanges: BlockRange[]): { markupClasses: Set<string>; markupIds: Set<string> } => {
  const markupClasses = new Set<string>();
  const markupIds = new Set<string>();

  const classRe = /(?<!:)\b(?:class|classname|ngclass)\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(fullText))) {
    if (isIndexInRanges(m.index, scriptRanges) || isIndexInRanges(m.index, styleRanges)) {
    	continue;
    }
    for (const t of collectClassTokens(m[2])) {
      markupClasses.add(t);
    }
  }
  const idRe = /(?<!:)\bid\b\s*=\s*(["'`])((?:(?!\1)[\S\s])*?)\1/gis;
  while ((m = idRe.exec(fullText))) {
    if (isIndexInRanges(m.index, scriptRanges) || isIndexInRanges(m.index, styleRanges)) {
    	continue;
    }
    for (const t of collectIdTokens(m[2])) {
      markupIds.add(t);
    }
  }
  return { markupClasses, markupIds };
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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
  const usedClassesFromMarkup = new Set<string>();
  const usedIdsFromMarkup = new Set<string>();
  const isHtml = isHtmlLikeDocument(document);
  const htmlScriptRanges = isHtml ? collectHtmlBlockRanges(fullText, `script`) : [];
  const htmlStyleRanges = isHtml ? collectHtmlBlockRanges(fullText, `style`) : [];

  // HTML 마크업에 정의된 class/id를 사전수집 → JS 셀렉터에서 참조 시 오탐 방지
  const { markupClasses, markupIds } = isHtml ? collectMarkupDefinitions(fullText, htmlScriptRanges, htmlStyleRanges) : { markupClasses: new Set<string>(), markupIds: new Set<string>() };
  const allKnownClasses = markupClasses.size > 0 ? new Set([...knownClasses, ...markupClasses]) : knownClasses;
  const allKnownIds = markupIds.size > 0 ? new Set([...knownIds, ...markupIds]) : knownIds;

  // Reset regex lastIndex
  CLASS_ATTRIBUTE_REGEX.lastIndex = 0;
  BOUND_CLASS_ATTRIBUTE_REGEX.lastIndex = 0;
  ID_ATTRIBUTE_REGEX.lastIndex = 0;
  BOUND_ID_ATTRIBUTE_REGEX.lastIndex = 0;
  TAG_ATTRIBUTE_REGEX.lastIndex = 0;
  CLASSLIST_METHOD_REGEX.lastIndex = 0;
  QUERYSELECTOR_REGEX.lastIndex = 0;
  JQUERY_SELECTOR_REGEX.lastIndex = 0;
  GETELEMENTBYID_REGEX.lastIndex = 0;
  GETELEMENTSBYCLASSNAME_REGEX.lastIndex = 0;
  SETATTRIBUTE_REGEX.lastIndex = 0;
  CLASSNAME_ASSIGN_REGEX.lastIndex = 0;
  ID_ASSIGN_REGEX.lastIndex = 0;

  isHtml ? (() => {
      // class / className / ngClass (정적)
      let classAttributeMatch: RegExpExecArray | null;
      while ((classAttributeMatch = CLASS_ATTRIBUTE_REGEX.exec(fullText))) {
        if (isIndexInRanges(classAttributeMatch.index, htmlScriptRanges) || isIndexInRanges(classAttributeMatch.index, htmlStyleRanges)) {
        	continue;
        }
        const rawClasses = classAttributeMatch[2];
        const baseOffset = classAttributeMatch.index + classAttributeMatch[0].indexOf(rawClasses);
        processClassValue(rawClasses, baseOffset, false, document, knownClasses, diagnostics, usedClassesFromMarkup);
      }
      // :class / v-bind:class (동적)
      let boundClassMatch: RegExpExecArray | null;
      while ((boundClassMatch = BOUND_CLASS_ATTRIBUTE_REGEX.exec(fullText))) {
        if (isIndexInRanges(boundClassMatch.index, htmlScriptRanges) || isIndexInRanges(boundClassMatch.index, htmlStyleRanges)) {
        	continue;
        }
        const rawClasses = boundClassMatch[2];
        const baseOffset = boundClassMatch.index + boundClassMatch[0].indexOf(rawClasses);
        processClassValue(rawClasses, baseOffset, true, document, knownClasses, diagnostics, usedClassesFromMarkup);
      }
      // id (정적)
      let idAttributeMatch: RegExpExecArray | null;
      while ((idAttributeMatch = ID_ATTRIBUTE_REGEX.exec(fullText))) {
        if (isIndexInRanges(idAttributeMatch.index, htmlScriptRanges) || isIndexInRanges(idAttributeMatch.index, htmlStyleRanges)) {
        	continue;
        }
        const rawId = idAttributeMatch[2];
        const baseOffset = idAttributeMatch.index + idAttributeMatch[0].indexOf(rawId);
        processIdValue(rawId, baseOffset, false, document, knownIds, diagnostics, usedIdsFromMarkup);
      }
      // :id / v-bind:id (동적)
      let boundIdMatch: RegExpExecArray | null;
      while ((boundIdMatch = BOUND_ID_ATTRIBUTE_REGEX.exec(fullText))) {
        if (isIndexInRanges(boundIdMatch.index, htmlScriptRanges) || isIndexInRanges(boundIdMatch.index, htmlStyleRanges)) {
        	continue;
        }
        const rawId = boundIdMatch[2];
        const baseOffset = boundIdMatch.index + boundIdMatch[0].indexOf(rawId);
        processIdValue(rawId, baseOffset, true, document, knownIds, diagnostics, usedIdsFromMarkup);
      }
    })() : (() => {
      // JS 문서에서는 <...> 태그 형태에서만 class/id 속성 추출 (JS 객체 class: "..." 오탐 방지)
      let tagAttrMatch: RegExpExecArray | null;
      while ((tagAttrMatch = TAG_ATTRIBUTE_REGEX.exec(fullText))) {
        const attrName = (tagAttrMatch[1] || ``).toLowerCase();
        const raw = tagAttrMatch[3] || ``;
        const baseOffset = tagAttrMatch.index + tagAttrMatch[0].indexOf(raw);
        const isBound = attrName.startsWith(`:`) || attrName.startsWith(`v-bind:`);
        (attrName.includes(`class`) || attrName === `ngclass`) && processClassValue(raw, baseOffset, isBound, document, knownClasses, diagnostics, usedClassesFromMarkup);
        attrName.includes(`id`) && processIdValue(raw, baseOffset, isBound, document, knownIds, diagnostics, usedIdsFromMarkup);
      }
    })();

  // classList 메서드 호출 처리
  let classListMatch: RegExpExecArray | null;
  while ((classListMatch = CLASSLIST_METHOD_REGEX.exec(fullText))) {
    if (isHtml && !isIndexInRanges(classListMatch.index, htmlScriptRanges)) {
    	continue;
    }
    processClassListCall(classListMatch, document, allKnownClasses, diagnostics, usedClassesFromMarkup);
  }
  // querySelector* / jQuery selectors (unified loop) ―――-
  for (const selectorRegex of [QUERYSELECTOR_REGEX, JQUERY_SELECTOR_REGEX]) {
    selectorRegex.lastIndex = 0;
    let selectorMatch: RegExpExecArray | null;
    while ((selectorMatch = selectorRegex.exec(fullText))) {
      if (isHtml && !isIndexInRanges(selectorMatch.index, htmlScriptRanges)) {
      	continue;
      }
      const q = selectorMatch[2];
      if (q.includes(`\${`)) {
      	continue;
      }
      const base = selectorMatch.index + selectorMatch[0].indexOf(q);
      const clsTok = /(^|[^\\])\.((?:\\.|[\w-])+)/g;
      const idTok = /(^|[^\\])#((?:\\.|[\w-])+)/g;
      let m: RegExpExecArray | null;
      while ((m = clsTok.exec(q))) {
        const val = m[2].replaceAll(BACKSLASH_REGEX, ``);
        val && (allKnownClasses.has(val) ? usedClassesFromMarkup.add(val) : (() => {
              const start = base + m.index + (m[1] ? 1 : 0) + 1;
              const d = new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning);
              d.source = `CSS-Analyzer`;
              d.code = `CSS001`;
              diagnostics.push(d);
            })());
      }
      while ((m = idTok.exec(q))) {
        const val = m[2].replaceAll(BACKSLASH_REGEX, ``);
        val && (allKnownIds.has(val) ? usedIdsFromMarkup.add(val) : (() => {
              const start = base + m.index + (m[1] ? 1 : 0) + 1;
              const d = new vscode.Diagnostic(makeRange(document, start, val.length + 1), `CSS id '#${val}' not found`, vscode.DiagnosticSeverity.Warning);
              d.source = `CSS-Analyzer`;
              d.code = `CSS002`;
              diagnostics.push(d);
            })());
      }
    }
  }
  // getElementById
  let gebi: RegExpExecArray | null;
  while ((gebi = GETELEMENTBYID_REGEX.exec(fullText))) {
    if (isHtml && !isIndexInRanges(gebi.index, htmlScriptRanges)) {
    	continue;
    }
    const id = gebi[2];
    id && (allKnownIds.has(id) ? usedIdsFromMarkup.add(id) : (() => {
          const m = gebi[0].match(/(["'])((?:(?!\1)[^"'`])+)\1/);
          const litLen = m ? m[0].length : id.length + 2;
          const start = gebi.index + (m ? gebi[0].indexOf(m[0]) : 0);
          const d = new vscode.Diagnostic(makeRange(document, start, litLen), `CSS id '#${id}' not found`, vscode.DiagnosticSeverity.Warning);
          d.source = `CSS-Analyzer`;
          d.code = `CSS002`;
          diagnostics.push(d);
        })());
  }
  // getElementsByClassName
  let gebc: RegExpExecArray | null;
  while ((gebc = GETELEMENTSBYCLASSNAME_REGEX.exec(fullText))) {
    if (isHtml && !isIndexInRanges(gebc.index, htmlScriptRanges)) {
    	continue;
    }
    const raw = gebc[2];
    const base = gebc.index + gebc[0].indexOf(raw);
    const tokens = collectClassTokens(raw);
    for (const val of tokens) {
      val && (allKnownClasses.has(val) ? usedClassesFromMarkup.add(val) : (() => {
            const start = base + raw.indexOf(val);
            const d = new vscode.Diagnostic(makeRange(document, start, val.length), `CSS class '${val}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS001`;
            diagnostics.push(d);
          })());
    }
  }
  // setAttribute("class"|"id", ...)
  let sa: RegExpExecArray | null;
  while ((sa = SETATTRIBUTE_REGEX.exec(fullText))) {
    if (isHtml && !isIndexInRanges(sa.index, htmlScriptRanges)) {
    	continue;
    }
    const attr = (sa[2] || ``).toLowerCase();
    const args = sa[3] || ``;
    STRING_LITERAL_REGEX.lastIndex = 0;
    let lit: RegExpExecArray | null;
    while ((lit = STRING_LITERAL_REGEX.exec(args))) {
      const raw = lit[2];
      const absBase = sa.index + sa[0].indexOf(lit[0]) + lit[0].indexOf(raw);
      attr === `class` && (() => {
          const classTokens = collectClassTokens(raw);
          for (const v of classTokens) {
            v && (allKnownClasses.has(v) ? usedClassesFromMarkup.add(v) : (() => {
                  const rel = raw.indexOf(v);
                  const start = rel >= 0 ? absBase + rel : absBase;
                  const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS class '${v}' not found`, vscode.DiagnosticSeverity.Warning);
                  d.source = `CSS-Analyzer`;
                  d.code = `CSS001`;
                  diagnostics.push(d);
                })());
          }
        })();

      attr === `id` && (() => {
          const idTokens = collectIdTokens(raw);
          for (const v of idTokens) {
            v && (allKnownIds.has(v) ? usedIdsFromMarkup.add(v) : (() => {
                  const rel = raw.indexOf(v);
                  const start = rel >= 0 ? absBase + rel : absBase;
                  const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS id '#${v}' not found`, vscode.DiagnosticSeverity.Warning);
                  d.source = `CSS-Analyzer`;
                  d.code = `CSS002`;
                  diagnostics.push(d);
                })());
          }
        })();
    }
  }
  // element.className = "..."
  let cna: RegExpExecArray | null;
  while ((cna = CLASSNAME_ASSIGN_REGEX.exec(fullText))) {
    if (isHtml && !isIndexInRanges(cna.index, htmlScriptRanges)) {
    	continue;
    }
    const raw = cna[2];
    const base = cna.index + cna[0].indexOf(raw);
    const tokens = collectClassTokens(raw);
    for (const v of tokens) {
      v && (allKnownClasses.has(v) ? usedClassesFromMarkup.add(v) : (() => {
            const rel = raw.indexOf(v);
            const start = rel >= 0 ? base + rel : base;
            const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS class '${v}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS001`;
            diagnostics.push(d);
          })());
    }
  }
  // element.id = "..."
  let ida: RegExpExecArray | null;
  while ((ida = ID_ASSIGN_REGEX.exec(fullText))) {
    if (isHtml && !isIndexInRanges(ida.index, htmlScriptRanges)) {
    	continue;
    }
    const raw = ida[2];
    const base = ida.index + ida[0].indexOf(raw);
    const tokens = collectIdTokens(raw);
    for (const v of tokens) {
      v && (allKnownIds.has(v) ? usedIdsFromMarkup.add(v) : (() => {
            const rel = raw.indexOf(v);
            const start = rel >= 0 ? base + rel : base;
            const d = new vscode.Diagnostic(makeRange(document, start, v.length), `CSS id '#${v}' not found`, vscode.DiagnosticSeverity.Warning);
            d.source = `CSS-Analyzer`;
            d.code = `CSS002`;
            diagnostics.push(d);
          })());
    }
  }
  return { diagnostics, usedClassesFromMarkup, usedIdsFromMarkup };
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const scanLocalUnused = async (doc: vscode.TextDocument, support: CssSupportLike, fullText: string): Promise<vscode.Diagnostic[]> => {
  const diagnostics: vscode.Diagnostic[] = [];
  const sels = await support.getLocalDoc(doc);
  const bodyOnly = extractCssBodies(fullText);
  const usedClasses = new Set<string>();
  const usedIds = new Set<string>();
  let m: RegExpExecArray | null;
  const clsUse = /(^|[^\\])\.((?:\\.|[\w-])+)/g;
  while ((m = clsUse.exec(bodyOnly))) {
    usedClasses.add(m[2].replaceAll(BACKSLASH_REGEX, ``));
  }
  const idUse = /(^|[^\\])#((?:\\.|[\w-])+)/g;
  while ((m = idUse.exec(bodyOnly))) {
    usedIds.add(m[2].replaceAll(BACKSLASH_REGEX, ``));
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
export const scanEmbeddedUnused = async (doc: vscode.TextDocument, support: CssSupportLike, usedClassesFromMarkup: Set<string>, usedIdsFromMarkup: Set<string>): Promise<vscode.Diagnostic[]> => {
  const diagnostics: vscode.Diagnostic[] = [];
  const localDefs = await support.getLocalDoc(doc);
  for (const s of localDefs) {
    const used = s.type === SelectorType.CLASS ? usedClassesFromMarkup.has(s.selector) : usedIdsFromMarkup.has(s.selector);
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
