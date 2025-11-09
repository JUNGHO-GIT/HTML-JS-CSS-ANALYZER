// extension.ts

import { vscode } from "@exportLibs";
import { supportedLanguages, htmlLanguages, jsLanguages } from "@exportConsts";
import { cssSupport, htmlHintCodeActionProvider, jsHintCodeActionProvider } from "@exportLangs";
import { type CssSupportLikeType, type AutoValidationModeType } from "@exportTypes";
import { scheduleValidate, updateDiagnostics, onClosed, clearAll, bindCssSupport, logger } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
const registerProviders = (context: vscode.ExtensionContext, cssSupport: CssSupportLikeType): void => {
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(
			supportedLanguages,
			cssSupport,
			".", "#", "\"", "'", "`", " "
		),
		vscode.languages.registerDefinitionProvider(
			supportedLanguages,
			cssSupport
		),
		vscode.languages.registerCodeActionsProvider(
			htmlLanguages,
			htmlHintCodeActionProvider,
			{ providedCodeActionKinds: htmlHintCodeActionProvider.metadata.providedCodeActionKinds }
		),
		vscode.languages.registerCodeActionsProvider(
			jsLanguages,
			jsHintCodeActionProvider,
			{ providedCodeActionKinds: jsHintCodeActionProvider.metadata.providedCodeActionKinds }
		)
	);
};

// -------------------------------------------------------------------------------------------------
const registerEventHandlers = (context: vscode.ExtensionContext, cssSupport: CssSupportLikeType): void => {
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(
			async (savedDoc: vscode.TextDocument) => {
				await updateDiagnostics(cssSupport, savedDoc, `Save`);
			}
		),
		vscode.workspace.onDidOpenTextDocument(
			async (openedDoc: vscode.TextDocument) => {
				await updateDiagnostics(cssSupport, openedDoc, `Always`);
			}
		),
		vscode.workspace.onDidChangeTextDocument(
			async (changeEvent: vscode.TextDocumentChangeEvent) => {
				scheduleValidate(cssSupport, changeEvent.document, `Always`);
			}
		),
		vscode.workspace.onDidCloseTextDocument(onClosed)
	);
};

// -------------------------------------------------------------------------------------------------
const registerCommands = (context: vscode.ExtensionContext, cssSupport: CssSupportLikeType): void => {
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"html-js-css-analyzer.validate",
			async (mode?: AutoValidationModeType) => {
				const editor = vscode.window.activeTextEditor;
				editor && await updateDiagnostics(cssSupport, editor.document, mode ?? `__Force__`);
			}
		),
		vscode.commands.registerCommand(
			"html-js-css-analyzer.clear",
			clearAll
		)
	);
};

// 1. activate --------------------------------------------------------------------------------------
export const activate = (context: vscode.ExtensionContext): void => {
	logger(`info`, `Extension`, `Activated`);
	bindCssSupport(cssSupport);
	registerProviders(context, cssSupport);
	registerEventHandlers(context, cssSupport);
	registerCommands(context, cssSupport);

	const activeEditor = vscode.window.activeTextEditor;
	activeEditor && void updateDiagnostics(cssSupport, activeEditor.document, "Always");
};

// 2. deactivate ------------------------------------------------------------------------------------
export const deactivate = (): void => {};
