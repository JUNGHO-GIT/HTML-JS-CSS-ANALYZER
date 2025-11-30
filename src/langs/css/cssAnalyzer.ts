/**
 * @file cssAnalyzer.ts
 * @since 2025-11-26
 * @description CSS 코드 분석 및 품질 검사
 */

import { vscode } from "@exportLibs";
import * as csstree from "css-tree";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const MAX_ID_SELECTORS = 2;

// -------------------------------------------------------------------------------------------------
// TYPE DEFINITIONS
// -------------------------------------------------------------------------------------------------
export type CssAnalysisIssue = {
	type: string;
	line: number;
	message: string;
	severity: `error` | `warning` | `info`;
};

export type CssAnalysisResult = {
	issues: CssAnalysisIssue[];
};

// -------------------------------------------------------------------------------------------------
// MAIN ANALYSIS FUNCTION
// -------------------------------------------------------------------------------------------------
export const analyzeCssCode = (sourceCode: string): CssAnalysisResult => {
	const issues: CssAnalysisIssue[] = [];

	try {
		const ast = csstree.parse(sourceCode, {
			positions: true,
			parseAtrulePrelude: false,
			parseRulePrelude: true,
			parseValue: false
		});

		csstree.walk(ast, (node) => {
			// 1. Empty Rules
			if (node.type === `Rule`) {
				if (node.block.children.isEmpty) {
					if (node.loc) {
						issues.push({
							type: `empty-rule`,
							line: node.loc.start.line,
							message: `Empty CSS rule detected`,
							severity: `warning`,
						});
					}
				}

				// 4. Too many IDs
				if (node.prelude.type === `SelectorList`) {
					node.prelude.children.forEach((selector) => {
						let idCount = 0;
						csstree.walk(selector, (child) => {
							if (child.type === `IdSelector`) {
								idCount++;
							}
						});

						if (idCount > MAX_ID_SELECTORS) {
							if (node.loc) {
								issues.push({
									type: `too-many-ids`,
									line: node.loc.start.line,
									message: `High specificity: ${idCount} ID selectors in one rule`,
									severity: `warning`,
								});
							}
						}
					});
				}
			}

			// 2. !important usage
			if (node.type === `Declaration` && node.important === true) {
				if (node.loc) {
					issues.push({
						type: `important-usage`,
						line: node.loc.start.line,
						message: `Avoid using !important; it breaks cascading`,
						severity: `info`,
					});
				}
			}

			// 3. Universal Selector
			if (node.type === `TypeSelector` && node.name === `*`) {
				if (node.loc) {
					issues.push({
						type: `universal-selector`,
						line: node.loc.start.line,
						message: `Universal selector (*) can be slow`,
						severity: `info`
					});
				}
			}
		});
	}
	catch (error) {
		// Ignore parse errors
	}

	return { issues };
};

// -------------------------------------------------------------------------------------------------
// DIAGNOSTIC GENERATION
// -------------------------------------------------------------------------------------------------
export const generateCssAnalysisDiagnostics = (document: vscode.TextDocument, analysis: CssAnalysisResult): vscode.Diagnostic[] => {
	const diagnostics: vscode.Diagnostic[] = [];

	analysis.issues.forEach((issue) => {
		const line = Math.max(issue.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(
			new vscode.Position(line, 0),
			new vscode.Position(line, lineText.length)
		);

		const severity = issue.severity === `error` ? (
			vscode.DiagnosticSeverity.Error
		) : issue.severity === `warning` ? (
			vscode.DiagnosticSeverity.Warning
		) : (
			vscode.DiagnosticSeverity.Information
		);

		const diagnostic = new vscode.Diagnostic(range, issue.message, severity);
		diagnostic.source = `CSS-Analyzer`;
		diagnostic.code = issue.type;
		(diagnostic as any).data = {
			ruleId: issue.type,
			line: issue.line,
			analysisType: `css-quality`,
		};

		diagnostics.push(diagnostic);
	});

	return diagnostics;
};
