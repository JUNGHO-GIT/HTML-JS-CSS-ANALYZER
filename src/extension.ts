// src/extension.ts

import * as vscode from "vscode";
import {CssSupport} from "./langs/css/cssSupport.js";
import {HtmlHintCodeActionProvider} from "./langs/html/htmlHint.js";
import {JSHintCodeActionProvider} from "./langs/js/jsHint.js";
import {AutoValidationMode} from "./langs/types/common.js";
import {getLogLevel} from "./configs/setting.js";
import {initLogger, setLogLevel, getChannel} from "./utils/logger.js";
import {scheduleValidate, updateDiagnostics, onClosed, clearAll, bindCssSupport} from "./utils/diagnostic.js";

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
const registerProviders = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		// CSS 클래스 및 ID 자동 완성 제공
		vscode.languages.registerCompletionItemProvider(
			SUPPORTED_LANGUAGES,
			cssSupport,
			".", "#", "\"", "'", "`", " "
		),

		// CSS 클래스 및 ID 정의로 이동 제공
		vscode.languages.registerDefinitionProvider(
			SUPPORTED_LANGUAGES,
			cssSupport
		),

		// HTMLHint QuickFix 제공
		vscode.languages.registerCodeActionsProvider(
			HTML_LANGUAGE,
			new HtmlHintCodeActionProvider(),
			{providedCodeActionKinds: HtmlHintCodeActionProvider.metadata.providedCodeActionKinds}
		),

		// JSHint QuickFix 제공
		vscode.languages.registerCodeActionsProvider(
			JS_LANGUAGES,
			new JSHintCodeActionProvider(),
			{providedCodeActionKinds: JSHintCodeActionProvider.metadata.providedCodeActionKinds}
		)
	);
};

// -------------------------------------------------------------------------------------------------
const registerEventHandlers = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		// 문서 저장 시 유효성 검사 실행
		vscode.workspace.onDidSaveTextDocument(async (savedDoc: vscode.TextDocument) => {
			await updateDiagnostics(cssSupport, savedDoc, AutoValidationMode.SAVE);
		}),

		// 문서 열기 시 유효성 검사 실행
		vscode.workspace.onDidOpenTextDocument(async (openedDoc: vscode.TextDocument) => {
			await updateDiagnostics(cssSupport, openedDoc, AutoValidationMode.ALWAYS);
		}),

		// 문서 변경 시 유효성 검사 예약
		vscode.workspace.onDidChangeTextDocument(async (changeEvent: vscode.TextDocumentChangeEvent) => {
			scheduleValidate(cssSupport, changeEvent.document, AutoValidationMode.ALWAYS);
		}),

		// 문서 닫기 시 캐시 정리
		vscode.workspace.onDidCloseTextDocument(onClosed)
	);
};

// -------------------------------------------------------------------------------------------------
const registerCommands = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
	context.subscriptions.push(
		// 수동 유효성 검사 명령어
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.validate", async (mode?: AutoValidationMode) => {
			const editor = vscode.window.activeTextEditor;
			editor && await updateDiagnostics(cssSupport, editor.document, mode ?? AutoValidationMode.FORCE);
		}),

		// CSS 분석기 캐시 초기화 명령어
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.clear", clearAll)
	);
};

// -------------------------------------------------------------------------------------------------
export const activate = (context: vscode.ExtensionContext): void => {
	// 로거 초기화
	initLogger();
	setLogLevel(getLogLevel());

	// CSS 지원 인스턴스 생성 및 바인딩
	const cssSupport = new CssSupport();
	bindCssSupport(cssSupport);

	// 프로바이더, 이벤트 핸들러, 명령어 등록
	registerProviders(context, cssSupport);
	registerEventHandlers(context, cssSupport);
	registerCommands(context, cssSupport);

	// 출력 채널 등록
	context.subscriptions.push(getChannel());

	// 현재 활성 에디터 초기 유효성 검사
	const activeEditor = vscode.window.activeTextEditor;
	activeEditor && void updateDiagnostics(cssSupport, activeEditor.document, AutoValidationMode.ALWAYS);
};