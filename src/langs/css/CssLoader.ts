// langs/css/CssLoader.ts

import { fs, path, https, http } from "@exportLibs";
import { logger } from "@exportScripts";
import { requestTimeoutMs, maxRedirects, maxCssFileSizeBytes, maxCssContentLength } from "@exportConsts";
import { parseSelectors } from "@langs/css/CssParser";
import { cacheGet, cacheSet } from "@langs/css/CssCache";
import type { SelectorPosType } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
const fetchWithNativeFetch = async (url: string): Promise<string> => {
  const response = await (globalThis as any).fetch(url);
  if (!response?.ok) {
    const statusInfo = response?.statusText || `HTTP ${response?.status || 'unknown'}`;
    throw new Error(statusInfo);
  }
  return await response.text();
};

// -------------------------------------------------------------------------------------------------
const fetchWithNodeHttp = async (url: string, redirectsRemaining = maxRedirects): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const httpLib = url.startsWith("https") ? https : http;
    const request = httpLib.get(url, (response) => {
      const status = response.statusCode || 0;
      if (status >= 300 && status < 400 && response.headers && response.headers.location) {
        const location = response.headers.location as string;
        if (redirectsRemaining > 0) {
          try {
            const newUrl = location.startsWith('http') ? location : new URL(location, url).toString();
            response.resume();
            resolve(fetchWithNodeHttp(newUrl, redirectsRemaining - 1));
            return;
          }
          catch (e: any) {
            response.resume();
            reject(new Error(`Invalid redirect location: ${location}`));
            return;
          }
        }
        response.resume();
        reject(new Error('Too many redirects'));
        return;
      }
      let data = "";
      response.setEncoding && response.setEncoding('utf8');
      response.on("data", (chunk: string) => { data += chunk; });
      response.on("end", () => {
        const isSuccessStatus = status >= 200 && status < 300;
        isSuccessStatus ? resolve(data) : reject(new Error(`HTTP ${status}`));
      });
    });
    request.on("error", (err: Error) => reject(err));
    request.setTimeout && request.setTimeout(requestTimeoutMs, () => {
      try { request.abort(); } catch (_e) { /* ignore */ }
      reject(new Error('Request timeout'));
    });
  });
};

// -------------------------------------------------------------------------------------------------
export const fetchCss = async (url: string): Promise<string> => {
  try {
    if (typeof (globalThis as any).fetch === "function") {
      return await fetchWithNativeFetch(url);
    }
    return await fetchWithNodeHttp(url);
  }
  catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger(`error`, `CssLoader`, `CSS file fetch failed (${url}): ${errorMessage}`);
    return "";
  }
};

// -------------------------------------------------------------------------------------------------
export const fetchRemoteSelectors = async (url: string): Promise<SelectorPosType[]> => {
  const cached = cacheGet(url);
  return cached ? cached.data : (async () => {
    const data = parseSelectors(await fetchCss(url));
    cacheSet(url, {version: -1, data});
    return data;
  })();
};

// -------------------------------------------------------------------------------------------------
export const readSelectorsFromFsPath = async (fsPath: string): Promise<SelectorPosType[]> => {
  try {
    const stat = await fs.promises.stat(fsPath);
    const key = `fs://${fsPath}`;
    const cached = cacheGet(key);
    return (cached && cached.version === stat.mtimeMs) ? cached.data : (async () => {
      return stat.size > maxCssFileSizeBytes ? (
        logger(`info`, `CssLoader`, `Large CSS file skipped: ${fsPath} (${Math.round(stat.size / 1024 / 1024 * 100) / 100}MB)`),
        []
      ) : (async () => {
        const content = await fs.promises.readFile(fsPath, "utf8");
        return content.length > maxCssContentLength ? (
          logger(`info`, `CssLoader`, `Large CSS content sampled: ${fsPath}`),
          (() => {
            const parsed = parseSelectors(content.substring(0, maxCssContentLength));
            cacheSet(key, {version: stat.mtimeMs, data: parsed});
            return parsed;
          })()
        ) : (() => {
          const parsed = parseSelectors(content);
          cacheSet(key, {version: stat.mtimeMs, data: parsed});
          return parsed;
        })();
      })();
    })();
  }
  catch (e: any) {
    return (e?.code === 'ENOMEM' || e?.message?.includes('out of memory')) ? (
      logger(`error`, `CssLoader`, `Memory limit reached processing: ${fsPath}`),
      []
    ) : (
      logger(`error`, `CssLoader`, `Selector read from file failed: ${fsPath} -> ${e?.message || e}`),
      []
    );
  }
};

// -------------------------------------------------------------------------------------------------
export const resolveLinkedStylesheetPath = (docPath: string, href: string): string | null => {
  let targetPath = href;
  if (!path.isAbsolute(targetPath)) {
    targetPath = path.join(path.dirname(docPath), targetPath);
  }
  targetPath = path.normalize(targetPath);
  if (!fs.existsSync(targetPath)) {
    return null;
  }
  return targetPath;
};
