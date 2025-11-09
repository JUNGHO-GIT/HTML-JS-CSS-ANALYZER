// langs/html/HtmlLoader.ts

import { createRequire } from "@exportLibs";
import { fallbackMetaUrl } from "@exportConsts";
import { logger } from "@exportScripts";
import type { HtmlHintInstanceType } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
export const loadHtmlHint = (): HtmlHintInstanceType | null => {
  try {
    const metaUrl = (import.meta as any)?.url || fallbackMetaUrl;
    const requireFn = createRequire(metaUrl);
    const htmlhintModule = requireFn("htmlhint");
    return htmlhintModule.default || htmlhintModule.HTMLHint || htmlhintModule;
  }
  catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger(`debug`, `HtmlHint`, `module not loaded (optional): ${errorMessage}`);
    return null;
  }
};

// -------------------------------------------------------------------------------------------------
export const htmlhint: HtmlHintInstanceType | null = loadHtmlHint();
