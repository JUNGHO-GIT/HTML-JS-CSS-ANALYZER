// src/utils/diagnostic.ts

import * as vscode from "vscode";
import {AutoValidationMode} from "../langs/types/common.js";
import {CssSupport} from "../langs/css/cssSupport.js";
import {cacheClear, cacheDelete, cacheSize} from "../langs/css/cssCache.js";
import {isAnalyzable} from "./filter.js";
import {log} from "./logger.js";

// -------------------------------------------------------------------------------------------------
const diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection();
const debounceTimers: Map<string, NodeJS.Timeout> = new Map();
const lastValidatedVersion: Map<string, number> = new Map();
const VALIDATION_DELAY_MS = 250;

// -------------------------------------------------------------------------------------------------
export const scheduleValidate = (cssSupport: CssSupport, doc: vscode.TextDocument, triggerMode: AutoValidationMode) => {
  if (!isAnalyzable(doc)) return;
  const key = doc.uri.toString();
  const prev = debounceTimers.get(key);
  if (prev) clearTimeout(prev);
  const t = setTimeout(async () => {
    debounceTimers.delete(key);
    await updateDiagnostics(cssSupport, doc, triggerMode);
  }, VALIDATION_DELAY_MS);
  debounceTimers.set(key, t);
};

// -------------------------------------------------------------------------------------------------
export const updateDiagnostics = async (cssSupport: CssSupport, doc: vscode.TextDocument, triggerMode: AutoValidationMode) => {
  if (!isAnalyzable(doc)) {
    diagnosticCollection.delete(doc.uri);
    return;
  }
  try {
    const force = triggerMode === (AutoValidationMode as any).FORCE;
    const key = doc.uri.toString();
    const lastVer = lastValidatedVersion.get(key);
    if (!force && lastVer === doc.version) {
			return;
		}
    const diags = await cssSupport.validate(doc);
    diagnosticCollection.set(doc.uri, diags);
    lastValidatedVersion.set(key, doc.version);
    log("info", `diagnostics: ${doc.fileName} -> ${diags.length}`);
  }
	catch (e: any) {
    log("error", `updateDiagnostics error: ${e?.stack || e?.message || e}`);
  }
};

// -------------------------------------------------------------------------------------------------
export const onClosed = (closedDoc: vscode.TextDocument) => {
	const key = closedDoc.uri.toString();
	const timer = debounceTimers.get(key);
	if (timer) {
		clearTimeout(timer);
		debounceTimers.delete(key);
	}
	diagnosticCollection.delete(closedDoc.uri);
	cacheDelete(key);
	lastValidatedVersion.delete(key);
};

// -------------------------------------------------------------------------------------------------
let cssSupportRef: CssSupport | null = null;
export const bindCssSupport = (inst: CssSupport) => { cssSupportRef = inst; };

// -------------------------------------------------------------------------------------------------
export const clearAll = () => {
  const sizeBefore = cacheSize();
  cacheClear();
  lastValidatedVersion.clear();
  if (cssSupportRef) {
    try { cssSupportRef.clearWorkspaceIndex(); } catch {}
  }
  vscode.window.showInformationMessage(`Style cache cleared: ${sizeBefore}`);
};
