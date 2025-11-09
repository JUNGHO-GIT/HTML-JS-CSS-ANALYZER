// langs/js/JsHintActions.ts

import { vscode } from "@exportLibs";
import { CodeAction, CodeActionKind, Diagnostic, Position, Range } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
const createSemicolonFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	const line = diagnostic.range.end.line;
	const lineText = document.lineAt(line).text;
	const addSemicolon = new CodeAction("세미콜론 추가", CodeActionKind.QuickFix);
	const edit1 = new vscode.WorkspaceEdit();
	const endOfLine = new Position(line, (lineText as any).trimRight().length);
	edit1.insert(document.uri, endOfLine, ";");
	addSemicolon.edit = edit1;
	addSemicolon.diagnostics = [diagnostic];
	addSemicolon.isPreferred = true;
	actions.push(addSemicolon);
	if ((lineText as any).trimRight().length < lineText.length) {
		const addSemicolonWithNewline = new CodeAction("세미콜론 추가 후 정리", CodeActionKind.QuickFix);
		const edit2 = new vscode.WorkspaceEdit();
		const range = new vscode.Range(new Position(line, (lineText as any).trimRight().length), new Position(line, lineText.length));
		edit2.replace(document.uri, range, ";");
		addSemicolonWithNewline.edit = edit2;
		addSemicolonWithNewline.diagnostics = [diagnostic];
		actions.push(addSemicolonWithNewline);
	}
	return actions;
};

const createEqualityFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	if (evidence.includes('==') && !evidence.includes('===')) {
		const fixEquality = new CodeAction("'==' 를 '===' 로 변경", CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();
		const lineText = document.lineAt(diagnostic.range.start.line).text;
		const eqIndex = lineText.indexOf('==');
		if (eqIndex >= 0 && lineText.charAt(eqIndex + 2) !== '=') {
			const range = new vscode.Range(new Position(diagnostic.range.start.line, eqIndex), new Position(diagnostic.range.start.line, eqIndex + 2));
			edit.replace(document.uri, range, "===");
			fixEquality.edit = edit;
			fixEquality.diagnostics = [diagnostic];
			fixEquality.isPreferred = true;
			actions.push(fixEquality);
		}
	}
	if (evidence.includes('!=') && !evidence.includes('!==')) {
		const fixInequality = new CodeAction("'!=' 를 '!==' 로 변경", CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();
		const lineText = document.lineAt(diagnostic.range.start.line).text;
		const neqIndex = lineText.indexOf('!=');
		if (neqIndex >= 0 && lineText.charAt(neqIndex + 2) !== '=') {
			const range = new vscode.Range(new Position(diagnostic.range.start.line, neqIndex), new Position(diagnostic.range.start.line, neqIndex + 2));
			edit.replace(document.uri, range, "!==");
			fixInequality.edit = edit;
			fixInequality.diagnostics = [diagnostic];
			fixInequality.isPreferred = true;
			actions.push(fixInequality);
		}
	}
	return actions;
};

const createUndefinedVariableFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	const variableMatch = evidence.match(/['"]([^'"]+)['"] is not defined/);
	const variableName = variableMatch?.[1];
	if (variableName) {
		const declareVariable = new CodeAction(`'${variableName}' 변수 선언 추가`, CodeActionKind.QuickFix);
		const edit1 = new vscode.WorkspaceEdit();
		const insertPos = new Position(Math.max(diagnostic.range.start.line - 1, 0), 0);
		edit1.insert(document.uri, insertPos, `let ${variableName};\n`);
		declareVariable.edit = edit1;
		declareVariable.diagnostics = [diagnostic];
		actions.push(declareVariable);
		const addGlobalComment = new CodeAction(`'${variableName}' 전역 변수로 표시`, CodeActionKind.QuickFix);
		const edit2 = new vscode.WorkspaceEdit();
		const topPos = new Position(0, 0);
		edit2.insert(document.uri, topPos, `/* global ${variableName} */\n`);
		addGlobalComment.edit = edit2;
		addGlobalComment.diagnostics = [diagnostic];
		actions.push(addGlobalComment);
	}
	return actions;
};

const createAssignmentFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	const makeCall = new CodeAction("함수 호출로 변경", CodeActionKind.QuickFix);
	const edit = new vscode.WorkspaceEdit();
	edit.replace(document.uri, diagnostic.range, evidence.trim() + "()");
	makeCall.edit = edit;
	makeCall.diagnostics = [diagnostic];
	actions.push(makeCall);
	return actions;
};

const createUnusedVariableFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	const removeVariable = new CodeAction("사용되지 않는 변수 제거", CodeActionKind.QuickFix);
	const edit = new vscode.WorkspaceEdit();
	const fullLine = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line + 1, 0));
	edit.delete(document.uri, fullLine);
	removeVariable.edit = edit;
	removeVariable.diagnostics = [diagnostic];
	removeVariable.isPreferred = true;
	actions.push(removeVariable);
	return actions;
};

const createStrictModeFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	const addStrictMode = new CodeAction("함수 내부에 'use strict' 추가", CodeActionKind.QuickFix);
	const edit = new vscode.WorkspaceEdit();
	const insertPos = new Position(diagnostic.range.start.line + 1, 0);
	edit.insert(document.uri, insertPos, '\t"use strict";\n');
	addStrictMode.edit = edit;
	addStrictMode.diagnostics = [diagnostic];
	actions.push(addStrictMode);
	return actions;
};

const createFunctionNameFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	const addFunctionName = new CodeAction("함수명 추가", CodeActionKind.QuickFix);
	const edit = new vscode.WorkspaceEdit();
	const lineText = document.lineAt(diagnostic.range.start.line).text;
	const functionIndex = lineText.indexOf('function');
	if (functionIndex >= 0) {
		const insertPos = new Position(diagnostic.range.start.line, functionIndex + 8);
		edit.insert(document.uri, insertPos, " myFunction");
		addFunctionName.edit = edit;
		addFunctionName.diagnostics = [diagnostic];
		actions.push(addFunctionName);
	}
	return actions;
};

const createVariableOrderFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	const addComment = new CodeAction("변수 정의 순서 확인 필요", CodeActionKind.QuickFix);
	const edit = new vscode.WorkspaceEdit();
	const insertPos = new Position(diagnostic.range.start.line, 0);
	edit.insert(document.uri, insertPos, "// TODO: 변수를 사용하기 전에 정의해야 합니다\n");
	addComment.edit = edit;
	addComment.diagnostics = [diagnostic];
	actions.push(addComment);
	return actions;
};

const createGenericFix = (document: vscode.TextDocument, diagnostic: Diagnostic, code: string, evidence: string): CodeAction | null => {
	const action = new CodeAction(`${code} 문제 해결 (수동 확인 필요)`, CodeActionKind.QuickFix);
	const edit = new vscode.WorkspaceEdit();
	const insertPos = new Position(diagnostic.range.start.line, 0);
	edit.insert(document.uri, insertPos, `// FIXME: JsHint ${code} - ${diagnostic.message}\n`);
	action.edit = edit;
	action.diagnostics = [diagnostic];
	return action;
};

const createSourceActions = (document: vscode.TextDocument, diagnostics: Diagnostic[]): CodeAction[] => {
	const actions: CodeAction[] = [];
	const semicolonDiagnostics = diagnostics.filter(d => (d as any).data?.ruleId === 'W033');
	if (semicolonDiagnostics.length > 0) {
		const fixAllSemicolons = new CodeAction(`모든 세미콜론 자동 추가 (${semicolonDiagnostics.length}개)`, CodeActionKind.Source);
		const edit = new vscode.WorkspaceEdit();
		for (const diag of semicolonDiagnostics) {
			const line = diag.range.end.line;
			const lineText = document.lineAt(line).text;
			const endPos = new Position(line, (lineText as any).trimRight().length);
			edit.insert(document.uri, endPos, ";");
		}
		fixAllSemicolons.edit = edit;
		actions.push(fixAllSemicolons);
	}
	return actions;
};

const createVarToLetConstFixes = (document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] => {
	const actions: CodeAction[] = [];
	const lineText = document.lineAt(diagnostic.range.start.line).text;
	if (lineText.includes('var ')) {
		const toLet = new CodeAction("'var'를 'let'으로 변경", CodeActionKind.QuickFix);
		const edit1 = new vscode.WorkspaceEdit();
		const newText = lineText.replace(/\bvar\b/, 'let');
		const lineRange = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line, lineText.length));
		edit1.replace(document.uri, lineRange, newText);
		toLet.edit = edit1;
		toLet.diagnostics = [diagnostic];
		toLet.isPreferred = true;
		actions.push(toLet);
		const toConst = new CodeAction("'var'를 'const'로 변경 (재할당 없음)", CodeActionKind.QuickFix);
		const edit2 = new vscode.WorkspaceEdit();
		const newTextConst = lineText.replace(/\bvar\b/, 'const');
		edit2.replace(document.uri, lineRange, newTextConst);
		toConst.edit = edit2;
		toConst.diagnostics = [diagnostic];
		actions.push(toConst);
	}
	return actions;
};

const createFunctionParameterFixes = (document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] => {
	const actions: CodeAction[] = [];
	const suggestRefactor = new CodeAction("매개변수를 객체로 리팩터링 제안", CodeActionKind.QuickFix);
	const edit = new vscode.WorkspaceEdit();
	const insertPos = new Position(diagnostic.range.start.line, 0);
	edit.insert(document.uri, insertPos, "// TODO: 매개변수를 객체로 리팩터링하여 가독성을 향상시키세요\n");
	suggestRefactor.edit = edit;
	suggestRefactor.diagnostics = [diagnostic];
	actions.push(suggestRefactor);
	return actions;
};

const createAnalysisFixes = (document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction[] => {
	const actions: CodeAction[] = [];
	if (code.startsWith('complexity-')) {
		const complexityFix = new CodeAction(`${code.replace('complexity-', '').replace('-', ' ')} 문제 해결 제안`, CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();
		const insertPos = new Position(diagnostic.range.start.line, 0);
		let suggestion = "";
		switch (code) {
			case 'complexity-deep-nesting':
				suggestion = "// TODO: 중첩을 줄이기 위해 함수 추출이나 early return 패턴을 고려하세요\n";
				break;
			case 'complexity-long-line':
				suggestion = "// TODO: 긴 줄을 여러 줄로 나누어 가독성을 향상시키세요\n";
				break;
			case 'complexity-complex-regex':
				suggestion = "// TODO: 복잡한 정규식을 단순화하거나 주석을 추가하세요\n";
				break;
			default:
				suggestion = `// TODO: ${code} 문제를 해결하세요\n`;
		}
		edit.insert(document.uri, insertPos, suggestion);
		complexityFix.edit = edit;
		complexityFix.diagnostics = [diagnostic];
		actions.push(complexityFix);
	}
	if (code.startsWith('bug-')) {
		const bugFix = new CodeAction(`잠재적 버그 수정 제안`, CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();
		const lineText = document.lineAt(diagnostic.range.start.line).text;
		switch (code) {
			case 'bug-console-usage': {
				const removeConsole = new CodeAction("console 구문 제거", CodeActionKind.QuickFix);
				const edit1 = new vscode.WorkspaceEdit();
				const range = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line + 1, 0));
				edit1.delete(document.uri, range);
				removeConsole.edit = edit1;
				removeConsole.diagnostics = [diagnostic];
				removeConsole.isPreferred = true;
				actions.push(removeConsole);
				const commentConsole = new CodeAction("console 구문을 주석으로 변경", CodeActionKind.QuickFix);
				const edit2 = new vscode.WorkspaceEdit();
				const lineRange = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line, lineText.length));
				edit2.replace(document.uri, lineRange, `// ${lineText.trim()}`);
				commentConsole.edit = edit2;
				commentConsole.diagnostics = [diagnostic];
				actions.push(commentConsole);
				break; }
			case 'bug-assignment-in-condition': {
				const fixAssignment = new CodeAction("할당을 비교 연산자로 변경", CodeActionKind.QuickFix);
				const edit3 = new vscode.WorkspaceEdit();
				const newText = lineText.replace(/=(?!=)/g, '===');
				const lineRange2 = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line, lineText.length));
				edit3.replace(document.uri, lineRange2, newText);
				fixAssignment.edit = edit3;
				fixAssignment.diagnostics = [diagnostic];
				fixAssignment.isPreferred = true;
				actions.push(fixAssignment);
				break; }
			default: {
				const insertPos = new Position(diagnostic.range.start.line, 0);
				edit.insert(document.uri, insertPos, `// FIXME: ${code.replace('bug-', '').replace('-', ' ')} 문제를 해결하세요\n`);
				bugFix.edit = edit;
				bugFix.diagnostics = [diagnostic];
				actions.push(bugFix);
			}
		}
	}
	return actions;
};

export const jsHintCodeActionProvider: vscode.CodeActionProvider & { metadata: vscode.CodeActionProviderMetadata } = {
	provideCodeActions: (document: vscode.TextDocument, range: Range | vscode.Selection, context: vscode.CodeActionContext): CodeAction[] => {
		const actions: CodeAction[] = [];
		const jshintDiagnostics = context.diagnostics.filter(diag => diag.source === "Html-Css-Js-Analyzer");
		for (const diagnostic of jshintDiagnostics) {
			const diagnosticData = (diagnostic as any).data;
			const code = diagnosticData?.ruleId || diagnostic.code?.toString() || "";
			const evidence = diagnosticData?.evidence || '';
			if (!code) {
				continue;
			}
			switch (code) {
				case "W033":
					actions.push(...createSemicolonFixes(document, diagnostic, evidence));
					break;
				case "W116":
					actions.push(...createEqualityFixes(document, diagnostic, evidence));
					break;
				case "W117":
					actions.push(...createUndefinedVariableFixes(document, diagnostic, evidence));
					break;
				case "W030":
					actions.push(...createAssignmentFixes(document, diagnostic, evidence));
					break;
				case "W098":
					actions.push(...createUnusedVariableFixes(document, diagnostic, evidence));
					break;
				case "W097":
					actions.push(...createStrictModeFixes(document, diagnostic, evidence));
					break;
				case "W025":
					actions.push(...createFunctionNameFixes(document, diagnostic, evidence));
					break;
				case "W004":
					actions.push(...createVariableOrderFixes(document, diagnostic, evidence));
					break;
				case "prefer-let-const":
					actions.push(...createVarToLetConstFixes(document, diagnostic));
					break;
				case "missing-strict-mode":
					actions.push(...createStrictModeFixes(document, diagnostic, evidence));
					break;
				case "function-too-many-params":
					actions.push(...createFunctionParameterFixes(document, diagnostic));
					break;
				default:
					if (code.startsWith('complexity-') || code.startsWith('bug-')) {
						actions.push(...createAnalysisFixes(document, diagnostic, code));
					}
					else {
						const genericFix = createGenericFix(document, diagnostic, code, evidence);
						if (genericFix) {
							actions.push(genericFix);
						}
					}
			}
		}
		if (jshintDiagnostics.length > 0) {
			const sourceActions = createSourceActions(document, jshintDiagnostics as unknown as Diagnostic[]);
			actions.push(...sourceActions);
		}
		return actions;
	},
	metadata: { providedCodeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.Source] }
};
