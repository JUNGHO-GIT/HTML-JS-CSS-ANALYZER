/**
 * @file extension.ts
 * @since 2025-11-22
 */

import { vscode } from "@exportLibs";
import { CssSupport, HtmlHintCodeActionProvider, JSHintCodeActionProvider } from "@exportLangs";
import { AutoValidationMode } from "@exportTypes";
import { scheduleValidate, updateDiagnostics, onClosed, clearAll, bindCssSupport } from "@exportScripts";
import { initLogger, logger } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
export const deactivate = () => {};
export const activate = (context: vscode.ExtensionContext) => {

	// 0. Initialize Logger ------------------------------------------------------------------------
	initLogger();
	logger("info", "activation", `Html-Js-Css-Analyzer is now active!`);
	const cssSupport = new CssSupport();
	bindCssSupport(cssSupport);

	registerProviders(context, cssSupport);
	registerEventHandlers(context, cssSupport);
	registerCommands(context, cssSupport);

	const activeEditor = vscode.window.activeTextEditor;
	activeEditor && void updateDiagnostics(cssSupport, activeEditor.document, AutoValidationMode.ALWAYS);
};

// -------------------------------------------------------------------------------------------------
const HTML_LANGUAGE: vscode.DocumentSelector = [
	{language: "html"}
];
const SUPPORTED_LANGUAGES: vscode.DocumentSelector = [
	{language: "html"},
	{language: "css"},
	{language: "scss"},
	{language: "less"},
	{language: "sass"},
	{language: "javascript"},
	{language: "typescript"},
	{language: "javascriptreact"},
	{language: "typescriptreact"}
];
const JS_LANGUAGES: vscode.DocumentSelector = [
	{language: "javascript"},
	{language: "typescript"},
	{language: "javascriptreact"},
	{language: "typescriptreact"}
];

// -------------------------------------------------------------------------------------------------
const registerProviders = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(SUPPORTED_LANGUAGES, cssSupport, ".", "#", "\"", "'", "`", " "),
		vscode.languages.registerDefinitionProvider(SUPPORTED_LANGUAGES, cssSupport),
		vscode.languages.registerCodeActionsProvider(HTML_LANGUAGE, new HtmlHintCodeActionProvider(), {providedCodeActionKinds: HtmlHintCodeActionProvider.metadata.providedCodeActionKinds}),
		vscode.languages.registerCodeActionsProvider(JS_LANGUAGES, new JSHintCodeActionProvider(), {providedCodeActionKinds: JSHintCodeActionProvider.metadata.providedCodeActionKinds})
	);
};

// -------------------------------------------------------------------------------------------------
const registerEventHandlers = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async (savedDoc: vscode.TextDocument) => await updateDiagnostics(cssSupport, savedDoc, AutoValidationMode.SAVE)),
		vscode.workspace.onDidOpenTextDocument(async (openedDoc: vscode.TextDocument) => await updateDiagnostics(cssSupport, openedDoc, AutoValidationMode.ALWAYS)),
		vscode.workspace.onDidChangeTextDocument(async (changeEvent: vscode.TextDocumentChangeEvent) => scheduleValidate(cssSupport, changeEvent.document, AutoValidationMode.ALWAYS)),
		vscode.workspace.onDidCloseTextDocument(onClosed)
	);
};

// -------------------------------------------------------------------------------------------------
const registerCommands = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.validate", async (mode?: AutoValidationMode) => {
			const editor = vscode.window.activeTextEditor;
			editor && await updateDiagnostics(cssSupport, editor.document, mode ?? AutoValidationMode.FORCE);
		}),
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.clear", clearAll)
	);
};