/**
 * @file diagnostic.ts
 * @since 2025-11-21
 * @description 진단 컬렉션 관리 및 자동 유효성 검사 스케줄링
 */

import { type CssSupport, cacheClear, cacheDelete, cacheSize } from "@exportLangs";
import { vscode } from "@exportLibs";
import { isAnalyzable, logger } from "@exportScripts";
import { AutoValidationMode as AtValMd } from "@exportTypes";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const BVDM = 250;
const MVDM = 1000;
const RPD_CHG_THRS = 5;
const MVTCC = 500_000;

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
  private storeSnapshot(documentKey: string, text: string, cssDiags: vscode.Diagnostic[], htmlHntDiags: vscode.Diagnostic[], jsHntDiags: vscode.Diagnostic[]): void {
    text.length <= MVTCC ? this.lastValidationSnapshots.set(documentKey, {
        cssDiagnostics: cssDiags,
        htmlHintDiagnostics: htmlHntDiags,
        jsHintDiagnostics: jsHntDiags,
        text,
      }) : this.lastValidationSnapshots.delete(documentKey);
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  clearValidationState(): void {
    this.lastValidatedVersions.clear();
    this.lastValidationSnapshots.clear();
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  scheduleValidation(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AtValMd): void {
    !isAnalyzable(document) ? void 0 : (
      (() => {
        const documentKey = document.uri.toString();
        const now = Date.now();
        const lastChange = this.lastChangeTimestamps.get(documentKey) || 0;
        const changeCount = this.changeCounters.get(documentKey) || 0;
        const isRpdChg = now - lastChange < 1000;
        const nwChgCnt = isRpdChg ? changeCount + 1 : 1;

        this.changeCounters.set(documentKey, nwChgCnt);
        this.lastChangeTimestamps.set(documentKey, now);

        const exstTmr = this.debounceTimers.get(documentKey);
        exstTmr && clearTimeout(exstTmr);

        const delay = nwChgCnt >= RPD_CHG_THRS ? Math.min(BVDM * Math.log2(nwChgCnt), MVDM) : BVDM;

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
  async updateDiagnostics(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AtValMd): Promise<void> {
    const documentKey = document.uri.toString();
    const isForceMode = triggerMode === AtValMd.FORCE;
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
      const htmlHntDiags = result.filter((d) => d.source === `HTMLHint`);
      const jsHntDiags = result.filter((d) => d.source === `JSHint`);
      this.cssCollection.set(document.uri, cssDiags);
      this.htmlHintCollection.set(document.uri, htmlHntDiags);
      this.jsHintCollection.set(document.uri, jsHntDiags);
      this.lastValidatedVersions.set(documentKey, document.version);
      this.storeSnapshot(documentKey, currentText, cssDiags, htmlHntDiags, jsHntDiags);
      logger(`debug`, `${document.fileName} -> CSS: ${cssDiags.length}, HTML: ${htmlHntDiags.length}, JS: ${jsHntDiags.length}`);
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
    const cchCntBfr = cacheSize();

    cacheClear();
    this.clearValidationState();
    this.cssSupportInstance?.clearWorkspaceIndex();

    vscode.window.showInformationMessage(`Style cache cleared: ${cchCntBfr}`);
  }
}
// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const diagMgr = new DiagnosticManager();

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const schedVal = (cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AtValMd): void => {
  diagMgr.scheduleValidation(cssSupport, document, triggerMode);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const updtDiags = async (cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AtValMd): Promise<void> => {
  await diagMgr.updateDiagnostics(cssSupport, document, triggerMode);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const onClosed = (document: vscode.TextDocument): void => {
  diagMgr.handleDocumentClosed(document);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const bndCssSup = (cssSupport: CssSupport): void => {
  diagMgr.bindCssSupport(cssSupport);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clearAll = (): void => {
  diagMgr.clearAllCache();
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const clrValSt = (): void => {
  diagMgr.clearValidationState();
};
