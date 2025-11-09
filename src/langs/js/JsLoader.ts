// langs/js/JsLoader.ts

import { createRequire, vscode } from "@exportLibs";
import { fallbackMetaUrl } from "@exportConsts";
import { logger } from "@exportScripts";
import type { JsHintInstanceType } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
export const loadJsHint = (): JsHintInstanceType | null => {
  try {
    const metaUrl = (import.meta as any)?.url || fallbackMetaUrl;
    const requireFn = createRequire(metaUrl);
    const jshintModule = requireFn("jshint");
    return jshintModule.JsHINT ? jshintModule : null;
  }
  catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger(`debug`, `JsHint`, `module not loaded (optional): ${errorMessage}`);
    return null;
  }
};

// -------------------------------------------------------------------------------------------------
export const jshint: JsHintInstanceType | null = loadJsHint();
