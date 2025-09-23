// src/extension.ts

import * as vscode from "vscode";
import {CssSupport} from "./langs/css/cssSupport.js";
import {HtmlHintCodeActionProvider} from "./langs/html/htmlHint.js";
import {AutoValidationMode} from "./langs/types/common.js";
import {getLogLevel} from "./configs/setting.js";
import {initLogger, setLogLevel, getChannel} from "./utils/logger.js";
import {scheduleValidate, updateDiagnostics, onClosed, clearAll, bindCssSupport} from "./utils/diagnostic.js";

// -------------------------------------------------------------------------------------------------
export const deactivate = () => {};
export const activate = (context: vscode.ExtensionContext) => {
	initLogger();
	setLogLevel(getLogLevel());

	const cssSupport = new CssSupport();
	bindCssSupport(cssSupport);

	const enabledLanguages: vscode.DocumentSelector = [
		{language: "html"},
		{language: "css"},
		{language: "scss"},
		{language: "less"},
		{language: "sass"}
	];

	context.subscriptions.push(

		// 1. CSS 클래스 및 ID 자동 완성 제공
		vscode.languages.registerCompletionItemProvider(
			enabledLanguages,
			cssSupport, ".", "#", "\"", "'", "`", " "
		),

		// 2. CSS 클래스 및 ID 정의로 이동 제공
		vscode.languages.registerDefinitionProvider(
			enabledLanguages,
			cssSupport
		),

		// 2-1. HTMLHint QuickFix
		vscode.languages.registerCodeActionsProvider(
			[{language: "html"}],
			new HtmlHintCodeActionProvider(),
			{providedCodeActionKinds: HtmlHintCodeActionProvider.metadata.providedCodeActionKinds}
		),

		// 3. 문서 저장 시 유효성 검사 실행
		vscode.workspace.onDidSaveTextDocument(async (savedDoc) => {
			await updateDiagnostics(cssSupport, savedDoc, AutoValidationMode.SAVE);
		}),

		// 4. 문서 열기 시 유효성 검사 실행
		vscode.workspace.onDidOpenTextDocument(async (openedDoc) => {
			await updateDiagnostics(cssSupport, openedDoc, AutoValidationMode.ALWAYS);
		}),

		// 5. 문서 변경 시 유효성 검사 예약
		vscode.workspace.onDidChangeTextDocument(async (changeEvent) => {
			scheduleValidate(cssSupport, changeEvent.document, AutoValidationMode.ALWAYS);
		}),

		// 6. 문서 닫기 시 캐시 정리
		vscode.workspace.onDidCloseTextDocument(
			onClosed
		),

		// 7. 명령어 등록
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.validate", async (mode?: AutoValidationMode) => {
			const editor = vscode.window.activeTextEditor;
			editor && await updateDiagnostics(cssSupport, editor.document, mode ?? (AutoValidationMode as any).FORCE);
		}),

		// 8. CSS 분석기 초기화
		vscode.commands.registerCommand("Html-Js-Css-Analyzer.clear", () => {
			clearAll();
		}),

		// 10. 출력 채널 등록
		getChannel()
	);

	const ed = vscode.window.activeTextEditor;
	ed && void updateDiagnostics(cssSupport, ed.document, AutoValidationMode.ALWAYS);
};