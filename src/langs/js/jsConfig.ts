/**
 * @file jsConfig.ts
 * @since 2025-11-22
 * @description JSHint 모듈 로드 및 설정 파일 로드
 */

import { createRequire as crtRqr, fs, path, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import type { JSHintInstance as JsHntInst } from "@langs/js/jsType";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const DEF_JSHN_CFG: Record<string, any> = {
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

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
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
    for (const f of vscode.workspace.workspaceFolders) {
      candidates.push(f.uri.fsPath);
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const prsCfgVal = (value: string): any => {
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

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const prsJsHnCfJs = (cfgCont: string): Record<string, any> => {
  try {
    let config: Record<string, any> = {};
    const cleanContent = cfgCont.replaceAll(/\/\*[\S\s]*?\*\//g, ``).replaceAll(/\/\/.*$/gm, ``);

    const modExprPat = /module\.exports\s*=\s*({[\S\s]*?});?\s*(?:$|\n)/;
    const modExprMtch = cleanContent.match(modExprPat);

    if (modExprMtch) {
      try {
        const objectStr = modExprMtch[1];
        config = new Function(`"use strict"; return (${objectStr})`)();
      }
      catch {
        try {
          config = JSON.parse(modExprMtch[1]);
        }
        catch {
          logger(`error`, `JS config parsing failed - module.exports format`);
        }
      }
    }

    const exprPats = cleanContent.match(/exports\.(\w+)\s*=\s*([^\n,;}]+)/g);
    exprPats?.forEach((pattern) => {
      const match = pattern.match(/exports\.(\w+)\s*=\s*([^\n,;}]+)/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        config[key] = prsCfgVal(value);
      }
    });

    return { ...DEF_JSHN_CFG, ...config };
  }
  catch (error: any) {
    logger(`error`, `JS config file parsing failed: ${error?.message || error}`);
    return DEF_JSHN_CFG;
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const prsJsHnCfGn = (cfgCont: string): Record<string, any> => {
  try {
    try {
      return JSON.parse(cfgCont);
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
        config[key] = prsCfgVal(value);
      }
    }

    return { ...DEF_JSHN_CFG, ...config };
  }
  catch (error: any) {
    logger(`error`, `file parsing failed: ${error?.message || error}`);
    return DEF_JSHN_CFG;
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const ldJsHntCfg = (filePath: string): Record<string, any> => {
  try {
    let baseDir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    const rootDir = path.parse(baseDir).root;

    while (true) {
      const configFiles = [`.jshintrc`, `.jshintrc.json`, `.jshintrc.js`];

      for (const configFile of configFiles) {
        const configPath = path.join(baseDir, configFile);

        if (!fs.existsSync(configPath)) {
          continue;
        }
        try {
          const cfgCont = fs.readFileSync(configPath, `utf8`);
          if (configFile.endsWith(`.js`)) {
            return prsJsHnCfJs(cfgCont);
          }
          if (configFile.endsWith(`.json`) || configFile === `.jshintrc`) {
            try {
              return JSON.parse(cfgCont);
            }
            catch {
              return prsJsHnCfGn(cfgCont);
            }
          }
          return prsJsHnCfGn(cfgCont);
        }
        catch (parseError: any) {
          logger(`error`, `file parsing error: ${configPath} -> ${parseError?.message || parseError}`);
          return DEF_JSHN_CFG;
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
  catch (error: any) {
    logger(`debug`, `search error: ${error?.message || error}`);
  }
  return DEF_JSHN_CFG;
};
