import { path, fs, createRequire } from "@exportLibs";
import { logger } from "@exportScripts";
import type { HtmlHintInstance } from "@exportLangs";

// 상수 정의 ------------------------------------------------------------------------------------
const FALLBACK_META_URL = path.join("/", "index.js");
export const HEAD_TAG_REGEX = /<head(\s[^>]*)?>([\s\S]*?)<\/head>/i;

// HTMLHint 모듈 로딩 ---------------------------------------------------------------------------
export const loadHtmlHint = (): HtmlHintInstance | null => {
  try {
    const metaUrl = (import.meta as any)?.url || FALLBACK_META_URL;
    const requireFn = createRequire(metaUrl);
    const htmlhintModule = requireFn("htmlhint");
    return htmlhintModule.default || htmlhintModule.HTMLHint || htmlhintModule;
  }
  catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger(`debug`, `HTMLHint`, `module not loaded (optional): ${errorMessage}`);
    return null;
  }
};

// HTMLHint 설정 로딩 ---------------------------------------------------------------------------
export const loadConfig = (filePath: string): any => {
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
          }
          catch (e: any) {
            logger(`error`, `HTMLHint config`, `file parsing error: ${f} -> ${e?.message || e}`);
            return {};
          }
        }
      }
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

// 유틸리티 함수 --------------------------------------------------------------------------------
export const clamp = (value: number, min: number, max: number): number => {
  return value < min ? min : value > max ? max : value;
};
