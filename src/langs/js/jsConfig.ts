/**
 * @file jsConfig.ts
 * @since 2025-11-22
 * @description JSHint 모듈 로드 및 설정 파일 로드
 */

import { createRequire as crtRqr, fs, path, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import type { JSHintInstance as JsHntInst } from "@langs/js/jsType";

// CONSTANTS ---------------------------------------------------------------------------------------
export const DEFAULT_JSHINT_CONFIG: Record<string, any> = {
  esversion: 2022,
  moz: false,
  bitwise: false,
  curly: true,
  eqeqeq: true,
  forin: true,
  freeze: true,
  futurehostile: true,
  immed: true,
  latedef: `nofunc`,
  newcap: true,
  noarg: true,
  noempty: false,
  nonbsp: true,
  nonew: true,
  noreturnawait: true,
  regexpu: true,
  singleGroups: false,
  undef: false,
  unused: `vars`,
  varstmt: false,

  camelcase: false,
  enforceall: false,
  indent: 2,
  maxcomplexity: 20,
  maxdepth: 8,
  maxlen: 200,
  maxparams: 8,
  maxstatements: 100,
  quotmark: false,
  trailingcomma: false,

  asi: false,
  boss: true,
  debug: false,
  elision: true,
  eqnull: false,
  evil: false,
  expr: true,
  funcscope: false,
  globalstrict: false,
  iterator: false,
  lastsemic: false,
  laxbreak: true,
  laxcomma: false,
  loopfunc: true,
  multistr: false,
  noyield: false,
  plusplus: false,
  proto: false,
  scripturl: false,
  shadow: `outer`,
  sub: true,
  supernew: false,
  validthis: false,
  withstmt: false,

  browser: true,
  browserify: false,
  couch: false,
  devel: true,
  dojo: false,
  jasmine: false,
  jquery: true,
  mocha: false,
  module: true,
  mootools: false,
  node: true,
  nonstandard: false,
  phantom: false,
  prototypejs: false,
  qunit: false,
  rhino: false,
  shelljs: false,
  typed: true,
  worker: false,
  wsh: false,
  yui: false,

  predef: [`console`, `process`, `Buffer`, `global`, `__dirname`, `__filename`, `module`, `exports`, `require`, `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `setImmediate`, `clearImmediate`, `Promise`, `Symbol`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Proxy`, `Reflect`, `ArrayBuffer`, `DataView`, `Int8Array`, `Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `Float32Array`, `Float64Array`, `BigInt`, `BigInt64Array`, `BigUint64Array`, `SharedArrayBuffer`, `Atomics`, `WebAssembly`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `AbortController`, `AbortSignal`, `Event`, `EventTarget`, `document`, `window`, `navigator`, `location`, `history`, `screen`, `alert`, `confirm`, `prompt`, `XMLHttpRequest`, `fetch`, `FormData`, `Blob`, `File`, `FileReader`, `localStorage`, `sessionStorage`],
};

// HELPERS ----------------------------------------------------------------------------------------
// 파싱 결과를 기본 설정과 병합. 객체가 아니면 기본 설정으로 폴백 (predef/browser/esversion 유지)
const mergeWithDefault = (parsed: unknown): Record<string, any> => {
  if (parsed && typeof parsed === `object` && !Array.isArray(parsed)) {
    return { ...DEFAULT_JSHINT_CONFIG, ...(parsed as Record<string, any>) };
  }
  return { ...DEFAULT_JSHINT_CONFIG };
};

// -------------------------------------------------------------------------------------------------
// 문자열 리터럴을 인식하며 균형 잡힌 중괄호 객체 리터럴을 추출 (중첩 객체 안전)
const QUOTE_CHAR_RE = /["'`]/;
const extractObjectLiteral = (text: string, startIdx: number): string | null => {
  let depth = 0;
  let inStr = false;
  let quote = ``;

  for (let i = startIdx; i < text.length; i++) {
    const ch = text[i];

    if (inStr) {
      if (ch === `\\`) {
        i++;
        continue;
      }
      if (ch === quote) {
        inStr = false;
      }
      continue;
    }
    if (QUOTE_CHAR_RE.test(ch)) {
      inStr = true;
      quote = ch;
      continue;
    }
    if (ch === `{`) {
      depth++;
      continue;
    }
    if (ch === `}`) {
      depth--;
      if (depth === 0) {
        return text.slice(startIdx, i + 1);
      }
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
const parseConfigValue = (value: string): any => {
  const trimmed = value.trim();

  if (trimmed === `true`) {
    return true;
  }
  if (trimmed === `false`) {
    return false;
  }
  if (trimmed === `null`) {
    return null;
  }
  if (trimmed === `undefined`) {
    return undefined;
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (/^-?\d+\.\d+$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }
  if (trimmed.startsWith(`[`) && trimmed.endsWith(`]`)) {
    try {
      return JSON.parse(trimmed);
    }
    catch {
      return [];
    }
  }
  if (trimmed.startsWith(`{`) && trimmed.endsWith(`}`)) {
    try {
      return JSON.parse(trimmed);
    }
    catch {
      return {};
    }
  }
  if ((trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) || (trimmed.startsWith(`'`) && trimmed.endsWith(`'`))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

// -------------------------------------------------------------------------------------------------
// .jshintrc.js 파싱: 보안상 eval/new Function 을 사용하지 않는다.
// module.exports 객체는 균형 중괄호로 추출 후 JSON.parse 시도, 실패 시 기본 설정 폴백.
const parseJSHintConfigJs = (cfgCont: string): Record<string, any> => {
  const config: Record<string, any> = {};

  try {
    const cleanContent = cfgCont.replaceAll(/\/\*[\S\s]*?\*\//g, ``).replaceAll(/\/\/.*$/gm, ``);

    const exportsIdx = cleanContent.search(/module\.exports\s*=\s*\{/);
    if (exportsIdx >= 0) {
      const braceIdx = cleanContent.indexOf(`{`, exportsIdx);
      const objectStr = braceIdx >= 0 ? extractObjectLiteral(cleanContent, braceIdx) : null;

      if (objectStr) {
        try {
          const parsed = JSON.parse(objectStr);
          if (parsed && typeof parsed === `object`) {
            Object.assign(config, parsed);
          }
        }
        catch {
          logger(`warn`, `.jshintrc.js is not JSON-compatible; code execution is disabled for security, using default config`);
          return { ...DEFAULT_JSHINT_CONFIG };
        }
      }
    }

    const exprPats = cleanContent.match(/exports\.(\w+)\s*=\s*([^\n,;}]+)/g);
    if (exprPats) {
      for (const pattern of exprPats) {
        const match = pattern.match(/exports\.(\w+)\s*=\s*([^\n,;}]+)/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          config[key] = parseConfigValue(value);
        }
      }
    }

    return { ...DEFAULT_JSHINT_CONFIG, ...config };
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger(`error`, `JS config file parsing failed: ${msg}`);
    return { ...DEFAULT_JSHINT_CONFIG };
  }
};

// -------------------------------------------------------------------------------------------------
const parseJSHintConfigGeneric = (cfgCont: string): Record<string, any> => {
  try {
    try {
      return mergeWithDefault(JSON.parse(cfgCont));
    }
    catch {}

    const config: Record<string, any> = {};
    const lines = cfgCont.split(`\n`);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(`//`) || trimmed.startsWith(`#`)) {
        continue;
      }
      const colonMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
      const equalMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      const match = colonMatch || equalMatch;
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/[,;]$/, ``);
        config[key] = parseConfigValue(value);
      }
    }

    return { ...DEFAULT_JSHINT_CONFIG, ...config };
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger(`error`, `file parsing failed: ${msg}`);
    return { ...DEFAULT_JSHINT_CONFIG };
  }
};

// FUNCTIONS ---------------------------------------------------------------------------------------
export const loadJSHint = (): JsHntInst | null => {
  let result: JsHntInst | null = null;

  const fnValidate = (mod: unknown): JsHntInst | null => {
    const candidate = mod as { JSHINT?: unknown } | undefined;
    const jshint = candidate?.JSHINT as { data?: unknown } | undefined;
    const isValid = typeof candidate?.JSHINT === `function` && typeof jshint?.data === `function`;
    return isValid ? mod as JsHntInst : null;
  };

  const candidates: string[] = [];

  try {
    const ext = vscode.extensions.getExtension(`jungho.html-js-css-analyzer`);
    const extPath = ext?.extensionPath;
    if (typeof extPath === `string` && extPath.length > 0) {
      candidates.push(extPath);
    }
  }
  catch {}

  try {
    if (typeof __dirname === `string` && __dirname.length > 0) {
      candidates.push(__dirname, path.resolve(__dirname, `..`), path.resolve(__dirname, `..`, `..`));
    }
  }
  catch {}

  candidates.push(process.cwd());

  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      candidates.push(folder.uri.fsPath);
    }
  }

  for (const base of candidates) {
    if (result) {
      break;
    }
    try {
      const reqPath = path.join(base, `index.js`);
      const req = crtRqr(reqPath);
      const mod = fnValidate(req(`jshint`));
      if (mod) {
        result = mod;
        logger(`debug`, `module loaded: ${base}`);
      }
    }
    catch {
      logger(`debug`, `load attempt failed: ${base}`);
    }
  }

  if (!result) {
    logger(`warn`, `module not loaded - JSHint is optional`);
  }

  return result;
};

// -------------------------------------------------------------------------------------------------
export const loadJSHintConfig = (filePath: string): Record<string, any> => {
  try {
    let baseDir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    const rootDir = path.parse(baseDir).root;
    const configFiles = [`.jshintrc`, `.jshintrc.json`, `.jshintrc.js`];

    while (true) {
      for (const configFile of configFiles) {
        const configPath = path.join(baseDir, configFile);

        if (!fs.existsSync(configPath)) {
          continue;
        }
        try {
          const cfgCont = fs.readFileSync(configPath, `utf8`);

          if (configFile.endsWith(`.js`)) {
            return parseJSHintConfigJs(cfgCont);
          }
          if (configFile.endsWith(`.json`) || configFile === `.jshintrc`) {
            try {
              return mergeWithDefault(JSON.parse(cfgCont));
            }
            catch {
              return parseJSHintConfigGeneric(cfgCont);
            }
          }
          return parseJSHintConfigGeneric(cfgCont);
        }
        catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          logger(`error`, `file parsing error: ${configPath} -> ${msg}`);
          return { ...DEFAULT_JSHINT_CONFIG };
        }
      }
      if (baseDir === rootDir) {
        break;
      }
      const parentDir = path.dirname(baseDir);
      if (parentDir === baseDir) {
        break;
      }
      baseDir = parentDir;
    }
  }
  catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger(`debug`, `search error: ${msg}`);
  }
  return { ...DEFAULT_JSHINT_CONFIG };
};
