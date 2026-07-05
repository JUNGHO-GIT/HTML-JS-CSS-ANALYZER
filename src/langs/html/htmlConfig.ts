/**
 * @file htmlConfig.ts
 * @since 2025-11-22
 * @description HTMLHint 모듈 로드 및 설정 파일 로드
 */

import { createRequire as crtRqr, fs, path, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import type { HtmlHintInstance as HtmlHntInst } from "@langs/html/htmlType";

// CONSTANTS ---------------------------------------------------------------------------------------
const EXTENSION_ID = `jungho.html-js-css-analyzer`;
const CONFIG_NAMES = [`.htmlhintrc`, `.htmlhintrc.json`];

// FUNCTIONS ---------------------------------------------------------------------------------------
const getBaseUrl = (): string => {
  try {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    const extPath = ext?.extensionPath;
    if (typeof extPath === `string` && extPath.length > 0) {
      return path.join(extPath, `out`, `index.js`);
    }
  }
  catch {
    // ignore and try next candidate
  }
  try {
    if (typeof __dirname === `string` && __dirname.length > 0) {
      return path.join(__dirname, `index.js`);
    }
  }
  catch {
    // ignore and fall back to cwd
  }
  return path.join(process.cwd(), `index.js`);
};

// -------------------------------------------------------------------------------------------------
// 로드한 모듈이 HTMLHint 계약(verify 함수)을 만족하는지 검증한다.
const validateModule = (mod: unknown): HtmlHntInst | null => {
  const m = mod as
    | {
        default?: { verify?: unknown };
        HTMLHint?: { verify?: unknown };
        verify?: unknown;
      }
    | undefined;
  const raw = (m?.default ?? m?.HTMLHint ?? m) as { verify?: unknown } | undefined;
  if (raw && typeof raw.verify === `function`) {
    return raw as HtmlHntInst;
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
// 1차 로드 실패 시 탐색할 후보 베이스 디렉터리 목록을 구성한다.
const collectFallbackBases = (): string[] => {
  const bases: string[] = [];

  try {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    const extPath = ext?.extensionPath;
    if (typeof extPath === `string` && extPath.length > 0) {
      bases.push(extPath);
    }
  }
  catch {
    // ignore
  }

  try {
    if (typeof __dirname === `string` && __dirname.length > 0) {
      bases.push(__dirname);
      bases.push(path.resolve(__dirname, `..`));
      bases.push(path.resolve(__dirname, `..`, `..`));
    }
  }
  catch {
    // ignore
  }

  bases.push(process.cwd());

  const folders = vscode.workspace.workspaceFolders;
  if (folders) {
    for (const f of folders) {
      bases.push(f.uri.fsPath);
    }
  }

  return bases;
};

// -------------------------------------------------------------------------------------------------
export const loadHtmlHint = (): HtmlHntInst | null => {
  try {
    const primaryUrl = getBaseUrl();
    const primaryReq = crtRqr(primaryUrl);
    const primaryMod = validateModule(primaryReq(`htmlhint`));
    if (primaryMod) {
      logger(`debug`, `module loaded successfully (primary: ${primaryUrl})`);
      return primaryMod;
    }
    logger(`warn`, `primary validation failed`);
  }
  catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger(`debug`, `primary load failed -> ${msg}`);
  }

  for (const base of collectFallbackBases()) {
    try {
      const req = crtRqr(path.join(base, `index.js`));
      const mod = validateModule(req(`htmlhint`));
      if (mod) {
        logger(`debug`, `module loaded successfully (fallback: ${base})`);
        return mod;
      }
      logger(`warn`, `fallback validation failed: ${base}`);
    }
    catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      logger(`debug`, `fallback load failed: ${base} -> ${msg}`);
    }
  }

  logger(`warn`, `module not loaded - HTMLHint is optional; install with 'npm install htmlhint' or ensure packaging includes dependency`);
  return null;
};

// -------------------------------------------------------------------------------------------------
export const loadConfig = (filePath: string): Record<string, unknown> => {
  try {
    const stat = fs.statSync(filePath);
    let base = stat.isDirectory() ? filePath : path.dirname(filePath);
    const root = path.parse(base).root;

    for (;;) {
      for (const name of CONFIG_NAMES) {
        const fullpath = path.join(base, name);
        if (!fs.existsSync(fullpath)) {
          continue;
        }
        const json = fs.readFileSync(fullpath, `utf8`);
        try {
          return JSON.parse(json) as Record<string, unknown>;
        }
        catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          logger(`error`, `file parsing error: ${fullpath} -> ${msg}`);
          return {};
        }
      }

      // 루트 디렉터리까지 검사한 뒤 종료 (루트 자체의 설정 파일도 1회 검사됨)
      if (base === root) {
        break;
      }
      const parent = path.dirname(base);
      if (parent === base) {
        break;
      }
      base = parent;
    }
  }
  catch {
    // ignore
  }
  return {};
};
