/**
 * @file diagnostic.ts
 * @since 2025-11-21
 * @description 진단 컬렉션 관리 및 자동 유효성 검사 스케줄링
 */

import { type CssSupport, cacheClear, cacheDelete, cacheSize } from "@exportLangs";
import { vscode } from "@exportLibs";
import { isAnalyzable, logger } from "@exportScripts";
import { AutoValidationMode } from "@exportTypes";

// CONSTANTS ---------------------------------------------------------------------------------------
const BASE_DEBOUNCE_MS = 250;
const MAX_DEBOUNCE_MS = 1000;
const RAPID_CHANGE_THRESHOLD = 5;
const MAX_SNAPSHOT_TEXT_LEN = 500_000;
const RPD_CHG_WINDOW_MS = 1000;

type ValidationSnapshot = {
  cssDiagnostics: vscode.Diagnostic[];
  htmlHintDiagnostics: vscode.Diagnostic[];
  jsHintDiagnostics: vscode.Diagnostic[];
  text: string;
};

// DIAGNOSTIC MANAGER CLASS ------------------------------------------------------------------------
class DiagnosticManager {
  private readonly cssCollection: vscode.DiagnosticCollection;
  private readonly htmlHintCollection: vscode.DiagnosticCollection;
  private readonly jsHintCollection: vscode.DiagnosticCollection;
  private readonly debounceTimers: Map<string, NodeJS.Timeout>;
  private readonly lastValidatedVersions: Map<string, number>;
  private readonly lastValidationSnapshots: Map<string, ValidationSnapshot>;
  private readonly changeCounters: Map<string, number>;
  private readonly lastChangeTimestamps: Map<string, number>;
  private readonly inFlight: Map<string, Promise<void>>;
  private cssSupportInstance: CssSupport | null = null;
  constructor() {
    this.cssCollection = vscode.languages.createDiagnosticCollection(`CSS-Analyzer`);
    this.htmlHintCollection = vscode.languages.createDiagnosticCollection(`HTMLHint`);
    this.jsHintCollection = vscode.languages.createDiagnosticCollection(`JSHint`);
    this.debounceTimers = new Map();
    this.lastValidatedVersions = new Map();
    this.lastValidationSnapshots = new Map();
    this.changeCounters = new Map();
    this.lastChangeTimestamps = new Map();
    this.inFlight = new Map();
  }
  // -------------------------------------------------------------------------------------------------
  bindCssSupport(cssSupport: CssSupport): void {
    this.cssSupportInstance = cssSupport;
  }
  // -------------------------------------------------------------------------------------------------
  private applySnapshot(document: vscode.TextDocument, snapshot: ValidationSnapshot): void {
    this.cssCollection.set(document.uri, snapshot.cssDiagnostics);
    this.htmlHintCollection.set(document.uri, snapshot.htmlHintDiagnostics);
    this.jsHintCollection.set(document.uri, snapshot.jsHintDiagnostics);
    this.lastValidatedVersions.set(document.uri.toString(), document.version);
  }
  // -------------------------------------------------------------------------------------------------
  private storeSnapshot(documentKey: string, text: string, cssDiags: vscode.Diagnostic[], htmlHintDiags: vscode.Diagnostic[], jsHintDiags: vscode.Diagnostic[]): void {
    if (text.length <= MAX_SNAPSHOT_TEXT_LEN) {
      this.lastValidationSnapshots.set(documentKey, {
        cssDiagnostics: cssDiags,
        htmlHintDiagnostics: htmlHintDiags,
        jsHintDiagnostics: jsHintDiags,
        text,
      });
    }
    else {
      this.lastValidationSnapshots.delete(documentKey);
    }
  }
  // -------------------------------------------------------------------------------------------------
  clearValidationState(): void {
    this.lastValidatedVersions.clear();
    this.lastValidationSnapshots.clear();
  }
  // -------------------------------------------------------------------------------------------------
  scheduleValidation(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): void {
    if (!isAnalyzable(document)) {
      return;
    }
    const documentKey = document.uri.toString();
    const now = Date.now();
    const lastChange = this.lastChangeTimestamps.get(documentKey) || 0;
    const changeCount = this.changeCounters.get(documentKey) || 0;
    const isRapidChange = now - lastChange < RPD_CHG_WINDOW_MS;
    const newChangeCount = isRapidChange ? changeCount + 1 : 1;

    this.changeCounters.set(documentKey, newChangeCount);
    this.lastChangeTimestamps.set(documentKey, now);

    const existingTimer = this.debounceTimers.get(documentKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delay = newChangeCount >= RAPID_CHANGE_THRESHOLD ? Math.min(BASE_DEBOUNCE_MS * Math.log2(newChangeCount), MAX_DEBOUNCE_MS) : BASE_DEBOUNCE_MS;

    const fnUpdate = async () => {
      this.debounceTimers.delete(documentKey);
      this.changeCounters.delete(documentKey);
      await this.updateDiagnostics(cssSupport, document, triggerMode);
    };

    this.debounceTimers.set(documentKey, setTimeout(fnUpdate, delay));
  }
  // -------------------------------------------------------------------------------------------------
  async updateDiagnostics(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): Promise<void> {
    const documentKey = document.uri.toString();
    const prev = this.inFlight.get(documentKey);
    if (prev) {
      await prev.catch(() => undefined);
    }
    const running = this.runUpdate(cssSupport, document, triggerMode);
    this.inFlight.set(documentKey, running);
    try {
      await running;
    }
    finally {
      if (this.inFlight.get(documentKey) === running) {
        this.inFlight.delete(documentKey);
      }
    }
  }
  // -------------------------------------------------------------------------------------------------
  private async runUpdate(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): Promise<void> {
    const documentKey = document.uri.toString();
    const isForceMode = triggerMode === AutoValidationMode.FORCE;
    const lastVersion = this.lastValidatedVersions.get(documentKey);
    if (!isForceMode && lastVersion === document.version) {
      return;
    }
    let currentText: string | undefined;
    const snapshot = this.lastValidationSnapshots.get(documentKey);
    if (!isForceMode && snapshot) {
      currentText = document.getText();
      if (snapshot.text === currentText) {
        this.applySnapshot(document, snapshot);
        return;
      }
    }
    if (!isAnalyzable(document)) {
      this.cssCollection.delete(document.uri);
      this.htmlHintCollection.delete(document.uri);
      this.jsHintCollection.delete(document.uri);
      this.lastValidationSnapshots.delete(documentKey);
      return;
    }
    try {
      currentText ??= document.getText();
      const result = await cssSupport.validate(document, currentText);
      const cssDiags = result.filter((d) => d.source === `CSS-Analyzer`);
      const htmlHintDiags = result.filter((d) => d.source === `HTMLHint`);
      const jsHintDiags = result.filter((d) => d.source === `JSHint`);
      this.cssCollection.set(document.uri, cssDiags);
      this.htmlHintCollection.set(document.uri, htmlHintDiags);
      this.jsHintCollection.set(document.uri, jsHintDiags);
      this.lastValidatedVersions.set(documentKey, document.version);
      this.storeSnapshot(documentKey, currentText, cssDiags, htmlHintDiags, jsHintDiags);
      logger(`debug`, `${document.fileName} -> CSS: ${cssDiags.length}, HTML: ${htmlHintDiags.length}, JS: ${jsHintDiags.length}`);
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
      logger(`error`, `update error: ${errorMessage}`);
    }
  }
  // -------------------------------------------------------------------------------------------------
  handleDocumentClosed(document: vscode.TextDocument): void {
    const documentKey = document.uri.toString();
    const timer = this.debounceTimers.get(documentKey);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(documentKey);
    }
    this.cssCollection.delete(document.uri);
    this.htmlHintCollection.delete(document.uri);
    this.jsHintCollection.delete(document.uri);
    cacheDelete(documentKey);
    this.lastValidatedVersions.delete(documentKey);
    this.lastValidationSnapshots.delete(documentKey);
    this.changeCounters.delete(documentKey);
    this.lastChangeTimestamps.delete(documentKey);
  }
  // -------------------------------------------------------------------------------------------------
  clearAllCache(): void {
    const cacheCountBefore = cacheSize();

    cacheClear();
    this.clearValidationState();
    this.cssSupportInstance?.clearWorkspaceIndex();

    vscode.window.showInformationMessage(`Style cache cleared: ${cacheCountBefore}`);
  }
  // -------------------------------------------------------------------------------------------------
  dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.changeCounters.clear();
    this.lastChangeTimestamps.clear();
    this.lastValidatedVersions.clear();
    this.lastValidationSnapshots.clear();
    this.inFlight.clear();
    this.cssCollection.dispose();
    this.htmlHintCollection.dispose();
    this.jsHintCollection.dispose();
  }
}
// -------------------------------------------------------------------------------------------------
const diagnosticManager = new DiagnosticManager();

// -------------------------------------------------------------------------------------------------
export const scheduleValidate = (cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): void => {
  diagnosticManager.scheduleValidation(cssSupport, document, triggerMode);
};

// -------------------------------------------------------------------------------------------------
export const updateDiagnostics = async (cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): Promise<void> => {
  await diagnosticManager.updateDiagnostics(cssSupport, document, triggerMode);
};

// -------------------------------------------------------------------------------------------------
export const onClosed = (document: vscode.TextDocument): void => {
  diagnosticManager.handleDocumentClosed(document);
};

// -------------------------------------------------------------------------------------------------
export const bindCssSupport = (cssSupport: CssSupport): void => {
  diagnosticManager.bindCssSupport(cssSupport);
};

// -------------------------------------------------------------------------------------------------
export const clearAll = (): void => {
  diagnosticManager.clearAllCache();
};

// -------------------------------------------------------------------------------------------------
export const clearValidationState = (): void => {
  diagnosticManager.clearValidationState();
};

// -------------------------------------------------------------------------------------------------
export const disposeAll = (): void => {
  diagnosticManager.dispose();
};
