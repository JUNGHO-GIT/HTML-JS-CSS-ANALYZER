// langs/html/HtmlConfig.ts

import { fs, path } from "@exportLibs";
import { logger } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
export const loadHtmlHintConfig = (filePath: string): any => {
  try {
    let base = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    const root = path.parse(base).root;
    while (true) {
      for (const name of [".htmlhintrc", ".htmlhintrc.json"]) {
        const f = path.join(base, name);
        if (fs.existsSync(f)) {
          try { const txt = fs.readFileSync(f, "utf8"); return JSON.parse(txt); }
          catch (e: any) { logger(`error`, `HtmlHint`, `config parse error: ${f} -> ${e?.message || e}`); return {}; }
        }
      }
      if (base === root) break;
      const parent = path.dirname(base); if (parent === base) break; base = parent;
    }
  }
  catch { /* ignore */ }
  return {};
};
