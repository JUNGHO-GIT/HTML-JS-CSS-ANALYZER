/**
 * @file jsCodeActions.ts
 * @since 2025-11-22
 */

import { vscode, CodeAction, CodeActionKind, Position, Range, Diagnostic } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
export class JSHintCodeActionProvider implements vscode.CodeActionProvider {
	static readonly metadata: vscode.CodeActionProviderMetadata = {
		providedCodeActionKinds: [ CodeActionKind.QuickFix, CodeActionKind.Source ],
	};

	provideCodeActions(
		document: vscode.TextDocument,
		range: Range | vscode.Selection,
		context: vscode.CodeActionContext
	): CodeAction[] {
		const actions: CodeAction[] = [];
		const jsHinthintDiagnostics = context.diagnostics.filter(diag => diag.source === `Html-Js-Css-Analyzer`);

		jsHinthintDiagnostics.forEach(diagnostic => {
			const quickFixes = this.createAdvancedQuickFixes(document, diagnostic);
			actions.push(...quickFixes);
		});

		jsHinthintDiagnostics.length > 0 && (() => {
			const sourceActions = this.createSourceActions(document, jsHinthintDiagnostics);
			actions.push(...sourceActions);
		})();

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createAdvancedQuickFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const diagnosticData = (diagnostic as any).data;
		const code = diagnosticData?.ruleId || diagnostic.code?.toString();
		const evidence = diagnosticData?.evidence || ``;

		!code ? (
			actions
		) : code === `W033` ? (
			actions.push(...this.createSemicolonFixes(document, diagnostic))
		) : code === `W116` ? (
			actions.push(...this.createEqualityFixes(document, diagnostic))
		) : code === `W117` ? (
			actions.push(...this.createUndefinedVariableFixes(document, diagnostic))
		) : code === `W098` ? (
			actions.push(...this.createUnusedVariableFixes(document, diagnostic))
		) : code === `prefer-let-const` ? (
			actions.push(...this.createVarToLetConstFixes(document, diagnostic))
		) : code === `missing-strict-mode` ? (
			actions.push(...this.createStrictModeFixes(document, diagnostic))
		) : (code.startsWith(`complexity-`) || code.startsWith(`bug-`)) ? (
			actions.push(...this.createAnalysisFixes(document, diagnostic, code))
		) : (() => {
			const genericFix = this.createGenericFix(document, diagnostic, code);
			genericFix && actions.push(genericFix);
		})();

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createSemicolonFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const line = diagnostic.range.end.line;
		const lineText = document.lineAt(line).text;
		const addSemicolon = new CodeAction(`Add semicolon`, CodeActionKind.QuickFix);
		const edit1 = new vscode.WorkspaceEdit();
		const endOfLine = new Position(line, lineText.trimRight().length);

		edit1.insert(document.uri, endOfLine, `;`);
		addSemicolon.edit = edit1;
		addSemicolon.diagnostics = [ diagnostic ];
		addSemicolon.isPreferred = true;
		actions.push(addSemicolon);

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createEqualityFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const lineText = document.lineAt(diagnostic.range.start.line).text;
		const eqIndex = lineText.indexOf(`==`);

		eqIndex >= 0 && lineText.charAt(eqIndex + 2) !== `=` && (() => {
			const fixEquality = new CodeAction(`Change '==' to '==='`, CodeActionKind.QuickFix);
			const edit = new vscode.WorkspaceEdit();
			const range = new vscode.Range(
				new Position(diagnostic.range.start.line, eqIndex),
				new Position(diagnostic.range.start.line, eqIndex + 2)
			);

			edit.replace(document.uri, range, `===`);
			fixEquality.edit = edit;
			fixEquality.diagnostics = [ diagnostic ];
			fixEquality.isPreferred = true;
			actions.push(fixEquality);
		})();

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createUndefinedVariableFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const addComment = new CodeAction(`Mark with comment`, CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();
		const insertPos = new Position(diagnostic.range.start.line, 0);

		edit.insert(document.uri, insertPos, `// TODO: define or import variable\n`);
		addComment.edit = edit;
		addComment.diagnostics = [ diagnostic ];
		actions.push(addComment);

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createUnusedVariableFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const removeVar = new CodeAction(`Remove unused variable`, CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();
		const range = new vscode.Range(
			new Position(diagnostic.range.start.line, 0),
			new Position(diagnostic.range.start.line + 1, 0)
		);

		edit.delete(document.uri, range);
		removeVar.edit = edit;
		removeVar.diagnostics = [ diagnostic ];
		removeVar.isPreferred = true;
		actions.push(removeVar);

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createVarToLetConstFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const lineText = document.lineAt(diagnostic.range.start.line).text;
		const varIndex = lineText.indexOf(`var`);

		varIndex >= 0 && (() => {
			const toConst = new CodeAction(`Change 'var' to 'const'`, CodeActionKind.QuickFix);
			const edit1 = new vscode.WorkspaceEdit();
			const range = new vscode.Range(
				new Position(diagnostic.range.start.line, varIndex),
				new Position(diagnostic.range.start.line, varIndex + 3)
			);

			edit1.replace(document.uri, range, `const`);
			toConst.edit = edit1;
			toConst.diagnostics = [ diagnostic ];
			toConst.isPreferred = true;
			actions.push(toConst);

			const toLet = new CodeAction(`Change 'var' to 'let'`, CodeActionKind.QuickFix);
			const edit2 = new vscode.WorkspaceEdit();
			edit2.replace(document.uri, range, `let`);
			toLet.edit = edit2;
			toLet.diagnostics = [ diagnostic ];
			actions.push(toLet);
		})();

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createStrictModeFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const addStrict = new CodeAction(`Add 'use strict' at file start`, CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();

		edit.insert(document.uri, new Position(0, 0), `'use strict';\n\n`);
		addStrict.edit = edit;
		addStrict.diagnostics = [ diagnostic ];
		addStrict.isPreferred = true;
		actions.push(addStrict);

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createAnalysisFixes(document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction[] {
		const actions: CodeAction[] = [];
		const lineText = document.lineAt(diagnostic.range.start.line).text;
		const bugFix = new CodeAction(`Fix ${code} issue`, CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();

		code === `bug-console-usage` ? (() => {
			const removeConsole = new CodeAction(`Remove console statement`, CodeActionKind.QuickFix);
			const edit1 = new vscode.WorkspaceEdit();
			const range = new vscode.Range(
				new Position(diagnostic.range.start.line, 0),
				new Position(diagnostic.range.start.line + 1, 0)
			);

			edit1.delete(document.uri, range);
			removeConsole.edit = edit1;
			removeConsole.diagnostics = [ diagnostic ];
			removeConsole.isPreferred = true;
			actions.push(removeConsole);

			const commentConsole = new CodeAction(`Comment out console statement`, CodeActionKind.QuickFix);
			const edit2 = new vscode.WorkspaceEdit();
			const lineRange = new vscode.Range(
				new Position(diagnostic.range.start.line, 0),
				new Position(diagnostic.range.start.line, lineText.length)
			);

			edit2.replace(document.uri, lineRange, `// ${lineText.trim()}`);
			commentConsole.edit = edit2;
			commentConsole.diagnostics = [ diagnostic ];
			actions.push(commentConsole);
		})() : code === `bug-assignment-in-condition` ? (() => {
			const fixAssignment = new CodeAction(`Change assignment to comparison operator`, CodeActionKind.QuickFix);
			const edit3 = new vscode.WorkspaceEdit();
			const newText = lineText.replace(/=(?!=)/g, `===`);
			const lineRange2 = new vscode.Range(
				new Position(diagnostic.range.start.line, 0),
				new Position(diagnostic.range.start.line, lineText.length)
			);

			edit3.replace(document.uri, lineRange2, newText);
			fixAssignment.edit = edit3;
			fixAssignment.diagnostics = [ diagnostic ];
			fixAssignment.isPreferred = true;
			actions.push(fixAssignment);
		})() : (() => {
			const insertPos = new Position(diagnostic.range.start.line, 0);
			edit.insert(document.uri, insertPos, `// FIXME: resolve ${code.replace(`bug-`, ``).replace(`-`, ` `)} issue\n`);
			bugFix.edit = edit;
			bugFix.diagnostics = [ diagnostic ];
			actions.push(bugFix);
		})();

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createGenericFix(document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction | null {
		const action = new CodeAction(`Fix ${code}`, CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();
		const insertPos = new Position(diagnostic.range.start.line, 0);

		edit.insert(document.uri, insertPos, `// TODO: check ${code} issue\n`);
		action.edit = edit;
		action.diagnostics = [ diagnostic ];

		return action;
	}

	// -------------------------------------------------------------------------------------------------
	private createSourceActions(document: vscode.TextDocument, diagnostics: Diagnostic[]): CodeAction[] {
		const actions: CodeAction[] = [];
		const organizeImports = new CodeAction(`Attempt to fix all JSHint issues`, CodeActionKind.Source);

		organizeImports.command = {
			title: `Fix JSHint issues`,
			command: `Html-Js-Css-Analyzer.fixAll`,
		};

		actions.push(organizeImports);

		return actions;
	}
}
