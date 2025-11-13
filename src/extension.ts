// src/extension.ts

import { vscode } from "@exportLibs";
import { CssSupport, HtmlHintCodeActionProvider, JSHintCodeActionProvider } from "@exportLangs";
import { AutoValidationMode } from "@exportTypes";
import { getLogLevel } from "@exportConsts";
import { scheduleValidate, updateDiagnostics, onClosed, clearAll, bindCssSupport } from "@exportScripts";

// -------------------------------------------------------------------------------------------------
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

const HTML_LANGUAGE: vscode.DocumentSelector = [{language: "html"}];

const JS_LANGUAGES: vscode.DocumentSelector = [
	{language: "javascript"},
	{language: "typescript"},
	{language: "javascriptreact"},
	{language: "typescriptreact"}
];

// -------------------------------------------------------------------------------------------------
export const deactivate = (): void => {};

// -------------------------------------------------------------------------------------------------
const fnRegisterProviders = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		vscode.languages.registerCompletionItemProvider(SUPPORTED_LANGUAGES, cssSupport, ".", "#", "\"", "'", "`", " "),
		vscode.languages.registerDefinitionProvider(SUPPORTED_LANGUAGES, cssSupport),
		vscode.languages.registerCodeActionsProvider(HTML_LANGUAGE, new HtmlHintCodeActionProvider(), {providedCodeActionKinds: HtmlHintCodeActionProvider.metadata.providedCodeActionKinds}),
		vscode.languages.registerCodeActionsProvider(JS_LANGUAGES, new JSHintCodeActionProvider(), {providedCodeActionKinds: JSHintCodeActionProvider.metadata.providedCodeActionKinds})
	);
};

// -------------------------------------------------------------------------------------------------
const fnRegisterEventHandlers = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(async (savedDoc: vscode.TextDocument) => await updateDiagnostics(cssSupport, savedDoc, AutoValidationMode.SAVE)),
		vscode.workspace.onDidOpenTextDocument(async (openedDoc: vscode.TextDocument) => await updateDiagnostics(cssSupport, openedDoc, AutoValidationMode.ALWAYS)),
		vscode.workspace.onDidChangeTextDocument(async (changeEvent: vscode.TextDocumentChangeEvent) => scheduleValidate(cssSupport, changeEvent.document, AutoValidationMode.ALWAYS)),
		vscode.workspace.onDidCloseTextDocument(onClosed)
	);
};

// -------------------------------------------------------------------------------------------------
const fnRegisterCommands = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.validate", async (mode?: AutoValidationMode) => {
			const editor = vscode.window.activeTextEditor;
			editor && await updateDiagnostics(cssSupport, editor.document, mode ?? AutoValidationMode.FORCE);
		}),
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.clear", clearAll)
	);
};

// -------------------------------------------------------------------------------------------------
export const activate = (context: vscode.ExtensionContext): void => {
	const cssSupport = new CssSupport();
	bindCssSupport(cssSupport);

	fnRegisterProviders(context, cssSupport);
	fnRegisterEventHandlers(context, cssSupport);
	fnRegisterCommands(context, cssSupport);

	const activeEditor = vscode.window.activeTextEditor;
	activeEditor && void updateDiagnostics(cssSupport, activeEditor.document, AutoValidationMode.ALWAYS);
};