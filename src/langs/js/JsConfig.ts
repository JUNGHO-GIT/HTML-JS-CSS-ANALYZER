// langs/js/JsConfig.ts

import { fs, path } from "@exportLibs";
import { jsConfig } from "@exportConsts";
import { logger } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
export const parseConfigValue = (value: string): any => {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;
  if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try { return JSON.parse(trimmed); } catch { return []; }
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try { return JSON.parse(trimmed); } catch { return {}; }
  }
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

// -------------------------------------------------------------------------------------------------
export const parseJsHintConfigJS = (configContent: string): Record<string, any> => {
  try {
    let config: Record<string, any> = {};
    let cleanContent = configContent
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const moduleExportsPattern = /module\.exports\s*=\s*({[\s\S]*?});?\s*(?:$|\n)/;
    const moduleExportsMatch = cleanContent.match(moduleExportsPattern);
    if (moduleExportsMatch) {
      try {
        const objectStr = moduleExportsMatch[1];
        config = Function("\"use strict\"; return (" + objectStr + ")")();
      }
      catch {
        try { config = JSON.parse(moduleExportsMatch[1]); } catch { logger(`error`, `JsHint`, `JS config parsing failed - module.exports format`); }
      }
    }
    const exportPatterns = cleanContent.match(/exports\.(\w+)\s*=\s*([^;\n,}]+)/g);
    if (exportPatterns) {
      for (const pattern of exportPatterns) {
        const match = pattern.match(/exports\.(\w+)\s*=\s*([^;\n,}]+)/);
        if (match) {
          const key = match[1].trim();
          let value: any = match[2].trim();
          config[key] = parseConfigValue(value);
        }
      }
    }
    return { ...jsConfig, ...config };
  }
  catch (error: any) {
    logger(`error`, `JsHint`, `JS config file parsing failed: ${error?.message || error}`);
    return jsConfig;
  }
};

// -------------------------------------------------------------------------------------------------
export const parseJsHintConfigGeneric = (configContent: string): Record<string, any> => {
  try {
    try { return JSON.parse(configContent); } catch {}
    const config: Record<string, any> = {};
    const lines = configContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#")) continue;
      const colonMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
      const equalMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      const match = colonMatch || equalMatch;
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/[,;]$/, "");
        config[key] = parseConfigValue(value);
      }
    }
    return { ...jsConfig, ...config };
  }
  catch (error: any) {
    logger(`error`, `JsHint`, `Generic config file parsing failed: ${error?.message || error}`);
    return jsConfig;
  }
};

// -------------------------------------------------------------------------------------------------
export const loadJsHintConfig = (filePath: string): Record<string, any> => {
  try {
    let baseDir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
    const rootDir = path.parse(baseDir).root;
    while (true) {
      const configFiles = [".jshintrc", ".jshintrc.json", ".jshintrc.js"];
      for (const configFile of configFiles) {
        const configPath = path.join(baseDir, configFile);
        if (fs.existsSync(configPath)) {
          try {
            const content = fs.readFileSync(configPath, "utf8");
            if (configFile.endsWith(".js")) return parseJsHintConfigJS(content);
            if (configFile.endsWith('.json') || configFile === '.jshintrc') {
              try { return JSON.parse(content); } catch { return parseJsHintConfigGeneric(content); }
            }
            return parseJsHintConfigGeneric(content);
          }
          catch (e: any) {
            logger(`error`, `JsHint`, `Config parsing error: ${configPath} -> ${e?.message || e}`);
            return jsConfig;
          }
        }
      }
      if (baseDir === rootDir) break;
      const parentDir = path.dirname(baseDir);
      if (parentDir === baseDir) break;
      baseDir = parentDir;
    }
  }
  catch (error: any) {
    logger(`debug`, `JsHint`, `Config search error: ${error?.message || error}`);
  }
  return jsConfig;
};
