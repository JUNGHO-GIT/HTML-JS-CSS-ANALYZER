/**
 * @file diagnostic.ts
 * @since 2025-11-21
 * @description 진단 컬렉션 관리 및 자동 유효성 검사 스케줄링
 */

import { type CssSupport, cacheClear, cacheDelete, cacheSize } from "@exportLangs";
import { vscode } from "@exportLibs";
import { isAnalyzable, logger } from "@exportScripts";
import { AutoValidationMode } from "@exportTypes";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const BASE_VALIDATION_DELAY_MS = 250;
const MAX_VALIDATION_DELAY_MS = 1000;
const RAPID_CHANGE_THRESHOLD = 5;
const MAX_VALIDATION_TEXT_CACHE_CHARS = 500_000;

type ValidationSnapshot = {
  cssDiagnostics: vscode.Diagnostic[];
  htmlHintDiagnostics: vscode.Diagnostic[];
  jsHintDiagnostics: vscode.Diagnostic[];
  text: string;
};

// DIAGNOSTIC MANAGER CLASS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
class DiagnosticManager {
  private readonly cssCollection: vscode.DiagnosticCollection;
  private readonly htmlHintCollection: vscode.DiagnosticCollection;
  private readonly jsHintCollection: vscode.DiagnosticCollection;
  private readonly debounceTimers: Map<string, NodeJS.Timeout>;
  private readonly lastValidatedVersions: Map<string, number>;
  private readonly lastValidationSnapshots: Map<string, ValidationSnapshot>;
  private readonly changeCounters: Map<string, number>;
  private readonly lastChangeTimestamps: Map<string, number>;
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
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  bindCssSupport(cssSupport: CssSupport): void {
    this.cssSupportInstance = cssSupport;
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private applySnapshot(document: vscode.TextDocument, snapshot: ValidationSnapshot): void {
    this.cssCollection.set(document.uri, snapshot.cssDiagnostics);
    this.htmlHintCollection.set(document.uri, snapshot.htmlHintDiagnostics);
    this.jsHintCollection.set(document.uri, snapshot.jsHintDiagnostics);
    this.lastValidatedVersions.set(document.uri.toString(), document.version);
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private storeSnapshot(documentKey: string, text: string, cssDiagnostics: vscode.Diagnostic[], htmlHintDiagnostics: vscode.Diagnostic[], jsHintDiagnostics: vscode.Diagnostic[]): void {
    text.length <= MAX_VALIDATION_TEXT_CACHE_CHARS ? this.lastValidationSnapshots.set(documentKey, {
        cssDiagnostics,
        htmlHintDiagnostics,
        jsHintDiagnostics,
        text,
      }) : this.lastValidationSnapshots.delete(documentKey);
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  clearValidationState(): void {
    this.lastValidatedVersions.clear();
    this.lastValidationSnapshots.clear();
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  scheduleValidation(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): void {
    !isAnalyzable(document) ? void 0 : (
      (() => {
        const documentKey = document.uri.toString();
        const now = Date.now();
        const lastChange = this.lastChangeTimestamps.get(documentKey) || 0;
        const changeCount = this.changeCounters.get(documentKey) || 0;
        const isRapidChange = now - lastChange < 1000;
        const newChangeCount = isRapidChange ? changeCount + 1 : 1;

        this.changeCounters.set(documentKey, newChangeCount);
        this.lastChangeTimestamps.set(documentKey, now);

        const existingTimer = this.debounceTimers.get(documentKey);
        existingTimer && clearTimeout(existingTimer);

        const delay = newChangeCount >= RAPID_CHANGE_THRESHOLD ? Math.min(BASE_VALIDATION_DELAY_MS * Math.log2(newChangeCount), MAX_VALIDATION_DELAY_MS) : BASE_VALIDATION_DELAY_MS;

        const fnUpdate = async () => {
          this.debounceTimers.delete(documentKey);
          this.changeCounters.delete(documentKey);
          await this.updateDiagnostics(cssSupport, document, triggerMode);
        };

        this.debounceTimers.set(documentKey, setTimeout(fnUpdate, delay));
      })()
    );
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  async updateDiagnostics(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): Promise<void> {
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
      const cssDiagnostics = result.filter((d) => d.source === `CSS-Analyzer`);
      const htmlHintDiagnostics = result.filter((d) => d.source === `HTMLHint`);
      const jsHintDiagnostics = result.filter((d) => d.source === `JSHint`);
      this.cssCollection.set(document.uri, cssDiagnostics);
      this.htmlHintCollection.set(document.uri, htmlHintDiagnostics);
      this.jsHintCollection.set(document.uri, jsHintDiagnostics);
      this.lastValidatedVersions.set(documentKey, document.version);
      this.storeSnapshot(documentKey, currentText, cssDiagnostics, htmlHintDiagnostics, jsHintDiagnostics);
      logger(`debug`, `${document.fileName} -> CSS: ${cssDiagnostics.length}, HTML: ${htmlHintDiagnostics.length}, JS: ${jsHintDiagnostics.length}`);
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? (error.stack ?? error.message) : String(error);
      logger(`error`, `update error: ${errorMessage}`);
    }
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  clearAllCache(): void {
    const cacheCountBefore = cacheSize();

    cacheClear();
    this.clearValidationState();
    this.cssSupportInstance?.clearWorkspaceIndex();

    vscode.window.showInformationMessage(`Style cache cleared: ${cacheCountBefore}`);
  }
}
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const diagnosticManager = new DiagnosticManager();

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const scheduleValidate = (cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): void => {
  diagnosticManager.scheduleValidation(cssSupport, document, triggerMode);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const updateDiagnostics = async (cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): Promise<void> => {
  await diagnosticManager.updateDiagnostics(cssSupport, document, triggerMode);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const onClosed = (document: vscode.TextDocument): void => {
  diagnosticManager.handleDocumentClosed(document);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const bindCssSupport = (cssSupport: CssSupport): void => {
  diagnosticManager.bindCssSupport(cssSupport);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clearAll = (): void => {
  diagnosticManager.clearAllCache();
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clearValidationState = (): void => {
  diagnosticManager.clearValidationState();
};
