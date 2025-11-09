// langs/css/CssAnalyzer.ts

import { vscode, path } from "@exportLibs";
import { withPerformanceMonitoring, isAnalyzable, logger } from "@exportScripts";
import { regexRemoteUrl, regexStyleTag, regexLinkStylesheet, regexHrefAttribute, maxWorkspaceStyleFiles } from "@exportConsts";
import type { SelectorPosType, CssSupportLikeType } from "@exportTypes";
import { fetchRemoteSelectors, readSelectorsFromFsPath, resolveLinkedStylesheetPath } from "@langs/css/CssLoader";
import { getWorkspaceFolderFor, getWorkspaceStyleGlobs, getCssExcludeGlobs } from "@langs/css/CssConfig";

// -------------------------------------------------------------------------------------------------
export const getLinkedStyles = async (doc: vscode.TextDocument): Promise<Map<string, SelectorPosType[]>> => {
  const map = new Map<string, SelectorPosType[]>();
  if (!/\.html?$/i.test(doc.fileName) && doc.languageId !== "html") {
    return map;
  }
  const text = doc.getText();
  let m: RegExpExecArray | null;
  while ((m = regexLinkStylesheet.exec(text))) {
    const tag = m[0];
    const hrefMatch = regexHrefAttribute.exec(tag);
    if (!hrefMatch) {
      continue;
    }
    const href = hrefMatch[2].trim();
    if (!href) {
      continue;
    }
    try {
      if (regexRemoteUrl.test(href)) {
        if (!map.has(href)) {
          const sels = await fetchRemoteSelectors(href);
          map.set(href, sels);
        }
      }
      else {
        const targetPath = resolveLinkedStylesheetPath(doc.uri.fsPath, href);
        if (targetPath) {
          try {
            const sels = await readSelectorsFromFsPath(targetPath);
            map.set(vscode.Uri.file(targetPath).toString(), sels);
          }
          catch (e: any) {
            logger(`error`, `CssAnalyzer`, `Linked stylesheet read failed: ${href} -> ${e?.message || e}`);
          }
        }
      }
    }
    catch (e: any) {
      logger(`error`, `CssAnalyzer`, `Linked stylesheet parsing error: ${href} -> ${e?.message || e}`);
    }
  }
  return map;
};

// -------------------------------------------------------------------------------------------------
export const getLocalSelectors = async (doc: vscode.TextDocument, support: CssSupportLikeType): Promise<SelectorPosType[]> => {
  return await support.getLocalDoc(doc);
};

// -------------------------------------------------------------------------------------------------
export const collectAllStyles = async (doc: vscode.TextDocument, support: CssSupportLikeType): Promise<Map<string, SelectorPosType[]>> => {
  const styleMap: Map<string, SelectorPosType[]> = new Map();
  if (!isAnalyzable(doc)) {
    return styleMap;
  }
  styleMap.set(doc.uri.toString(), await getLocalSelectors(doc, support));
  const linked = await getLinkedStyles(doc);
  for (const [k, v] of linked) {
    if (!styleMap.has(k)) {
      styleMap.set(k, v);
    }
  }
  const workspaceFolder = getWorkspaceFolderFor(doc.uri);
  if (workspaceFolder) {
    const globs = await getWorkspaceStyleGlobs(workspaceFolder);
    const excludePatterns = getCssExcludeGlobs(doc.uri);
    const uris = await vscode.workspace.findFiles(
      globs.length === 1 ? new vscode.RelativePattern(workspaceFolder, globs[0]) : globs.map(g => new vscode.RelativePattern(workspaceFolder, g)) as any
    );
    const files: string[] = [];
    for (const uri of (Array.isArray(uris) ? uris : [uris])) {
      files.push(uri.fsPath);
      if (files.length >= maxWorkspaceStyleFiles) {
        break;
      }
    }
    for (const filePath of files) {
      try {
        const k = vscode.Uri.file(filePath).toString();
        if (!styleMap.has(k)) {
          const sels = await readSelectorsFromFsPath(filePath);
          styleMap.set(k, sels);
        }
      }
      catch (e: any) {
        logger(`error`, `CssAnalyzer`, `Workspace CSS read failed: ${filePath} -> ${e?.message || e}`);
      }
    }
  }
  return styleMap;
};
