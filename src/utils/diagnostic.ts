// src/utils/diagnostic.ts

import * as vscode from "vscode";
import {AutoValidationMode} from "../langs/types/common.js";
import {CssSupport} from "../langs/css/cssSupport.js";
import {cacheClear, cacheDelete, cacheSize} from "../langs/css/cssCache.js";
import {isAnalyzable} from "./filter.js";
import {log} from "./logger.js";

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
		if (!isAnalyzable(document)) {
			return;
		}

		const documentKey = document.uri.toString();
		const now = Date.now();

		// 변경 빈도 추적
		const lastChange = this.lastChangeTimestamps.get(documentKey) || 0;
		const changeCount = this.changeCounters.get(documentKey) || 0;

		// 빠른 연속 변경 감지 (1초 내 여러 변경)
		const isRapidChange = (now - lastChange) < 1000;
		const newChangeCount = isRapidChange ? changeCount + 1 : 1;

		this.changeCounters.set(documentKey, newChangeCount);
		this.lastChangeTimestamps.set(documentKey, now);

		// 기존 타이머 정리
		const existingTimer = this.debounceTimers.get(documentKey);
		existingTimer && clearTimeout(existingTimer);

		// 적응형 지연 시간 계산
		let delay = BASE_VALIDATION_DELAY_MS;
		if (newChangeCount >= RAPID_CHANGE_THRESHOLD) {
			// 빠른 변경이 많을 경우 지연 시간 증가
			delay = Math.min(
				BASE_VALIDATION_DELAY_MS * Math.log2(newChangeCount),
				MAX_VALIDATION_DELAY_MS
			);
		}

		// 새 타이머 설정
		const newTimer = setTimeout(async () => {
			this.debounceTimers.delete(documentKey);
			this.changeCounters.delete(documentKey);
			await this.updateDiagnostics(cssSupport, document, triggerMode);
		}, delay);

		this.debounceTimers.set(documentKey, newTimer);
	}

	// -------------------------------------------------------------------------------------------------
	async updateDiagnostics(cssSupport: CssSupport, document: vscode.TextDocument, triggerMode: AutoValidationMode): Promise<void> {
		if (!isAnalyzable(document)) {
			this.collection.delete(document.uri);
			return;
		}

		try {
			const isForceMode = triggerMode === AutoValidationMode.FORCE;
			const documentKey = document.uri.toString();
			const lastVersion = this.lastValidatedVersions.get(documentKey);

			// 강제 모드가 아니고 동일한 버전이면 스킵
			if (!isForceMode && lastVersion === document.version) {
				return;
			}

			const diagnostics = await cssSupport.validate(document);
			this.collection.set(document.uri, diagnostics);
			this.lastValidatedVersions.set(documentKey, document.version);

			log("info", `[Html-Css-Js-Analyzer] Diagnostics: ${document.fileName} -> ${diagnostics.length} items`);
		}
		catch (error: any) {
			const errorMessage = error?.stack || error?.message || String(error);
			log("error", `[Html-Css-Js-Analyzer] Diagnostic update error: ${errorMessage}`);
		}
	}

	// -------------------------------------------------------------------------------------------------
	handleDocumentClosed(document: vscode.TextDocument): void {
		const documentKey = document.uri.toString();

		// 타이머 정리
		const timer = this.debounceTimers.get(documentKey);
		timer && (clearTimeout(timer), this.debounceTimers.delete(documentKey));

		// 진단 정보 정리
		this.collection.delete(document.uri);
		cacheDelete(documentKey);
		this.lastValidatedVersions.delete(documentKey);
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
