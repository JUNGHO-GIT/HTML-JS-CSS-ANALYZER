/**
 * @file htmlUtils.ts
 * @since 2025-11-26
 * @description HTML 유틸리티 함수
 */

import { vscode, CodeAction, CodeActionKind, Diagnostic } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
export const HEAD_TAG_REGEX = /<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i;

// -------------------------------------------------------------------------------------------------
export const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : value > max ? max : value;
};

// -------------------------------------------------------------------------------------------------
export const getRuleId = (diagnostic: Diagnostic): string | undefined => {
	try {
		const diagnosticData = (diagnostic as any).data;
		return diagnosticData?.ruleId ?? diagnostic.code?.toString();
	}
	catch {
		return undefined;
	}
};

// -------------------------------------------------------------------------------------------------
export const getDocumentLine = (document: vscode.TextDocument, oneBasedLineNumber: number): string => {
	return document.lineCount <= 0 ? `` : (() => {
		const zeroBasedLineIndex = clamp(oneBasedLineNumber - 1, 0, document.lineCount - 1);
		return document.lineAt(zeroBasedLineIndex).text;
	})();
};

// -------------------------------------------------------------------------------------------------
export const getHeadMatch = (htmlText: string): RegExpMatchArray | null => {
	return HEAD_TAG_REGEX.exec(htmlText);
};

// -------------------------------------------------------------------------------------------------
export const makeQuickFix = (
	title: string,
	editBuilder: (we: vscode.WorkspaceEdit) => void,
	diagnostic: Diagnostic
): CodeAction => {
	const ca = new CodeAction(title, CodeActionKind.QuickFix);
	const we = new vscode.WorkspaceEdit();
	editBuilder(we);
	ca.edit = we;
	ca.diagnostics = [ diagnostic ];
	return ca;
};
