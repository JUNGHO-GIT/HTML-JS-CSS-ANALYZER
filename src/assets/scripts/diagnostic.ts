// src/utils/diagnostic.ts

import { vscode } from "@exportLibs";
import { AutoValidationMode } from "@exportTypes";
import { CssSupport, cacheClear, cacheDelete, cacheSize } from "@exportLangs";
import { isAnalyzable } from "@exportScripts";
import { logger } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
const BASE_VALIDATION_DELAY_MS = 250;
const MAX_VALIDATION_DELAY_MS = 1000;
const RAPID_CHANGE_THRESHOLD = 5;

// -------------------------------------------------------------------------------------------------
class DiagnosticManager {
	private readonly collection: vscode.DiagnosticCollection;
	private readonly debounceTimers: Map<string, NodeJS.Timeout>;
	private readonly lastValidatedVersions: Map<string, number>;
	private readonly changeCounters: Map<string, number>;
	private readonly lastChangeTimestamps: Map<string, number>;
	private cssSupportInstance: CssSupport | null = null;

	constructor() {
		this.collection = vscode.languages.createDiagnosticCollection();
		this.debounceTimers = new Map();
		this.lastValidatedVersions = new Map();
		this.changeCounters = new Map();
		this.lastChangeTimestamps = new Map();
	}

	// -------------------------------------------------------------------------------------------------
	bindCssSupport(cssSupport: CssSupport): void {
		this.cssSupportInstance = cssSupport;
	}

	// -------------------------------------------------------------------------------------------------
	scheduleValidation(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): void {
		!isAnalyzable(document) || (() => {
			const documentKey = document.uri.toString();
			const now = Date.now();
			const lastChange = this.lastChangeTimestamps.get(documentKey) || 0;
			const changeCount = this.changeCounters.get(documentKey) || 0;
			const isRapidChange = (now - lastChange) < 1000;
			const newChangeCount = isRapidChange ? changeCount + 1 : 1;

			this.changeCounters.set(documentKey, newChangeCount);
			this.lastChangeTimestamps.set(documentKey, now);

			const existingTimer = this.debounceTimers.get(documentKey);
			existingTimer && clearTimeout(existingTimer);

			const delay = newChangeCount >= RAPID_CHANGE_THRESHOLD ? Math.min(BASE_VALIDATION_DELAY_MS * Math.log2(newChangeCount), MAX_VALIDATION_DELAY_MS) : BASE_VALIDATION_DELAY_MS;

			const fnUpdateDiagnostics = async () => {
				this.debounceTimers.delete(documentKey);
				this.changeCounters.delete(documentKey);
				await this.updateDiagnostics(cssSupport, document, triggerMode);
			};

			this.debounceTimers.set(documentKey, setTimeout(fnUpdateDiagnostics, delay));
		})();
	}

	// -------------------------------------------------------------------------------------------------
	async updateDiagnostics(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): Promise<void> {
		!isAnalyzable(document) ? this.collection.delete(document.uri) : await (async () => {
			try {
				const isForceMode = triggerMode === AutoValidationMode.FORCE;
				const documentKey = document.uri.toString();
				const lastVersion = this.lastValidatedVersions.get(documentKey);

				(!isForceMode && lastVersion === document.version) ? void 0 : await (async () => {
					const diagnostics = await cssSupport.validate(document);
					this.collection.set(document.uri, diagnostics);
					this.lastValidatedVersions.set(documentKey, document.version);
					logger(`debug`, `Diagnostics`, `${document.fileName} -> ${diagnostics.length} items`);
				})();
			}
			catch (error: any) {
				const errorMessage = error?.stack || error?.message || String(error);
				logger(`error`, `Diagnostic`, `update error: ${errorMessage}`);
			}
		})();
	}

	// -------------------------------------------------------------------------------------------------
	handleDocumentClosed(document: vscode.TextDocument): void {
		const documentKey = document.uri.toString();

		const timer = this.debounceTimers.get(documentKey);
		timer && (clearTimeout(timer), this.debounceTimers.delete(documentKey));

		this.collection.delete(document.uri);
		cacheDelete(documentKey);
		this.lastValidatedVersions.delete(documentKey);
		this.changeCounters.delete(documentKey);
		this.lastChangeTimestamps.delete(documentKey);
	}

	// -------------------------------------------------------------------------------------------------
	clearAllCache(): void {
		const cacheCountBefore = cacheSize();

		cacheClear();
		this.lastValidatedVersions.clear();
		this.cssSupportInstance?.clearWorkspaceIndex();

		vscode.window.showInformationMessage(`Style cache cleared: ${cacheCountBefore}`);
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
