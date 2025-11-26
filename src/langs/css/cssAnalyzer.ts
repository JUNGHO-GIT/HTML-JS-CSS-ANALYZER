/**
 * @file cssAnalyzer.ts
 * @since 2025-11-26
 * @description CSS 코드 분석 및 품질 검사
 */

import { vscode } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const EMPTY_RULE_REGEX = /([^{]+)\{\s*\}/g;
const IMPORTANT_REGEX = /!important/g;
const UNIVERSAL_SELECTOR_REGEX = /(^|[\s>+~])\*(?![a-zA-Z0-9-_])/g;
const ID_SELECTOR_REGEX = /#[a-zA-Z0-9-_]+/g;
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
// ANALYSIS FUNCTIONS
// -------------------------------------------------------------------------------------------------
const analyzeEmptyRules = (sourceCode: string, issues: CssAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		if (EMPTY_RULE_REGEX.test(line)) {
			issues.push({
				type: `empty-rule`,
				line: lineNum,
				message: `Empty CSS rule detected`,
				severity: `warning`,
			});
		}
	}
};

const analyzeImportant = (sourceCode: string, issues: CssAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		if (IMPORTANT_REGEX.test(line)) {
			issues.push({
				type: `important-usage`,
				line: lineNum,
				message: `Avoid using !important; it breaks cascading`,
				severity: `info`,
			});
		}
	}
};

const analyzePerformance = (sourceCode: string, issues: CssAnalysisIssue[]): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		if (UNIVERSAL_SELECTOR_REGEX.test(line)) {
			issues.push({
				type: `universal-selector`,
				line: lineNum,
				message: `Universal selector (*) can be slow`,
				severity: `info`,
			});
		}

		const idCount = (line.match(ID_SELECTOR_REGEX) || []).length;
		if (idCount > MAX_ID_SELECTORS) {
			issues.push({
				type: `too-many-ids`,
				line: lineNum,
				message: `High specificity: ${idCount} ID selectors in one rule`,
				severity: `warning`,
			});
		}
	}
};

// -------------------------------------------------------------------------------------------------
// MAIN ANALYSIS FUNCTION
// -------------------------------------------------------------------------------------------------
export const analyzeCssCode = (sourceCode: string): CssAnalysisResult => {
	const issues: CssAnalysisIssue[] = [];

	analyzeEmptyRules(sourceCode, issues);
	analyzeImportant(sourceCode, issues);
	analyzePerformance(sourceCode, issues);

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
