// assets/scripts/diagnostic.ts

import { vscode } from "@exportLibs";
import type { AutoValidationModeType } from "@exportTypes";
import type { CssSupportLikeType } from "@exportTypes";
import { cacheClear, cacheDelete, cacheSize } from "@langs/css/CssCache";
import { isAnalyzable } from "./filter";
import { log } from "./logger";
import { baseValidationDelayMs, maxValidationDelayMs, rapidChangeThreshold } from "@exportConsts";

// -------------------------------------------------------------------------------------------------
export const scheduleValidate = (cssSupport: CssSupportLikeType, document: vscode.TextDocument, triggerMode: AutoValidationModeType): void => {
	diagnosticManager.scheduleValidation(cssSupport, document, triggerMode);
};

// -------------------------------------------------------------------------------------------------
export const updateDiagnostics = async (cssSupport: CssSupportLikeType, document: vscode.TextDocument, triggerMode: AutoValidationModeType): Promise<void> => {
	await diagnosticManager.updateDiagnostics(cssSupport, document, triggerMode);
};

// -------------------------------------------------------------------------------------------------
export const onClosed = (document: vscode.TextDocument): void => {
	diagnosticManager.handleDocumentClosed(document);
};

// -------------------------------------------------------------------------------------------------
export const bindCssSupport = (cssSupport: CssSupportLikeType): void => {
	diagnosticManager.bindCssSupport(cssSupport);
};

// -------------------------------------------------------------------------------------------------
export const clearAll = (): void => {
	diagnosticManager.clearAllCache();
};

// -------------------------------------------------------------------------------------------------
// Minimal diagnostic manager to satisfy build (no-op implementations)
const diagnosticManager = {
	support: null as CssSupportLikeType | null,
	scheduleValidation(support: CssSupportLikeType, document: vscode.TextDocument, triggerMode: AutoValidationModeType): void {
		this.support = support;
		void triggerMode; void document;
	},
	async updateDiagnostics(support: CssSupportLikeType, document: vscode.TextDocument, triggerMode: AutoValidationModeType): Promise<void> {
		this.support = support;
		void triggerMode; void document;
	},
	handleDocumentClosed(document: vscode.TextDocument): void {
		void document;
	},
	bindCssSupport(support: CssSupportLikeType): void {
		this.support = support;
	},
	clearAllCache(): void {
		// noop
	}
};
