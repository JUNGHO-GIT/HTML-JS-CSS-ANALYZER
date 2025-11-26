/**
 * @file jsValidator.ts
 * @since 2025-11-26
 * @description JSHint 검증 및 진단 생성
 */

import { vscode, Position } from "@exportLibs";
import { logger } from "@exportScripts";
import type {
	JSHintInstance,
	SourceAnalysis,
	ComplexityIssue,
	PotentialBug,
	FunctionInfo,
	VariableInfo,
} from "@exportLangs";
import { loadJSHint, loadJSHintConfig, analyzeSourceCode } from "@exportLangs";
import { calculateErrorRange, calculateSeverity } from "@langs/js/jsUtils";

// -------------------------------------------------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------------------------------------------------
const ERROR_SEVERITY_TYPES = [ `eval-usage`, `with-statement`, `assignment-in-condition`, `innerhtml-usage`, `document-write` ];
const WARNING_SEVERITY_TYPES = [ `empty-catch`, `var-usage` ];
const MAX_FUNCTION_PARAMS = 6;
const MODULE_EXTENSIONS = [ `.mjs`, `.cjs` ];

// -------------------------------------------------------------------------------------------------
// MODULE STATE
// -------------------------------------------------------------------------------------------------
let jsHintCache: JSHintInstance | null | undefined;

// -------------------------------------------------------------------------------------------------
export const getJSHint = (): JSHintInstance | null => {
	let result: JSHintInstance | null;

	jsHintCache === undefined ? (
		jsHintCache = loadJSHint(),
		result = jsHintCache
	) : (
		result = jsHintCache
	);

	return result;
};

// -------------------------------------------------------------------------------------------------
export const generateAdditionalDiagnostics = (document: vscode.TextDocument, analysis: SourceAnalysis): vscode.Diagnostic[] => {
	const diagnostics: vscode.Diagnostic[] = [];

	analysis.complexityIssues.forEach((issue: ComplexityIssue) => {
		const line = Math.max(issue.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
		const severity = issue.type === `deep-nesting` ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
		const diagnostic = new vscode.Diagnostic(range, issue.message, severity);

		diagnostic.source = `JSHint`;
		diagnostic.code = `complexity-${issue.type}`;
		(diagnostic as any).data = {
			ruleId: `complexity-${issue.type}`,
			line: issue.line,
			analysisType: `complexity`,
		};

		diagnostics.push(diagnostic);
	});

	analysis.potentialBugs.forEach((bug: PotentialBug) => {
		const line = Math.max(bug.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
		const severity = ERROR_SEVERITY_TYPES.includes(bug.type) ? (
			vscode.DiagnosticSeverity.Error
		) : WARNING_SEVERITY_TYPES.includes(bug.type) ? (
			vscode.DiagnosticSeverity.Warning
		) : (
			vscode.DiagnosticSeverity.Information
		);
		const diagnostic = new vscode.Diagnostic(range, bug.message, severity);

		diagnostic.source = `JSHint`;
		diagnostic.code = `bug-${bug.type}`;
		(diagnostic as any).data = {
			ruleId: `bug-${bug.type}`,
			line: bug.line,
			analysisType: `potential-bug`,
		};

		diagnostics.push(diagnostic);
	});

	analysis.functions.forEach((func: FunctionInfo) => {
		func.parameters > MAX_FUNCTION_PARAMS && (() => {
			const line = Math.max(func.line - 1, 0);
			const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
			const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
			const diagnostic = new vscode.Diagnostic(
				range,
				`Function '${func.name}' has too many parameters (${func.parameters}): consider using an object or config parameter`,
				vscode.DiagnosticSeverity.Information
			);

			diagnostic.source = `JSHint`;
			diagnostic.code = `function-too-many-params`;
			(diagnostic as any).data = {
				ruleId: `function-too-many-params`,
				line: func.line,
				analysisType: `function-complexity`,
				functionName: func.name,
				parameterCount: func.parameters,
			};

			diagnostics.push(diagnostic);
		})();
	});

	const varUsages = analysis.variables.filter((v: VariableInfo) => v.type === `var`);
	varUsages.forEach((varUsage: VariableInfo) => {
		const line = Math.max(varUsage.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
		const diagnostic = new vscode.Diagnostic(
			range,
			`Recommend using 'let' or 'const' instead of 'var'`,
			vscode.DiagnosticSeverity.Information
		);

		diagnostic.source = `JSHint`;
		diagnostic.code = `prefer-let-const`;
		(diagnostic as any).data = {
			ruleId: `prefer-let-const`,
			line: varUsage.line,
			analysisType: `code-style`,
			variableName: varUsage.name,
			currentType: `var`,
		};

		diagnostics.push(diagnostic);
	});

	!analysis.hasStrictMode && !analysis.isModule && (() => {
		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(0, 0, 0, 0),
			`Recommend using 'use strict' directive`,
			vscode.DiagnosticSeverity.Information
		);

		diagnostic.source = `JSHint`;
		diagnostic.code = `missing-strict-mode`;
		(diagnostic as any).data = {
			ruleId: `missing-strict-mode`,
			line: 1,
			analysisType: `best-practice`,
		};

		diagnostics.push(diagnostic);
	})();

	return diagnostics;
};

// -------------------------------------------------------------------------------------------------
export const runJSHint = (document: vscode.TextDocument): vscode.Diagnostic[] => {
	const jsHint = getJSHint();

	return !jsHint ? (
		logger(`warn`, `module not loaded - JSHint is optional`),
		[]
	) : (() => {
		try {
			logger(`debug`, `starting analysis for: ${document.fileName} (languageId: ${document.languageId})`);

			const config = { ...loadJSHintConfig(document.uri.fsPath) };
			const fileName = document.fileName.toLowerCase();
			const sourceText = document.getText();

			const isModule = (
				MODULE_EXTENSIONS.some(ext => fileName.endsWith(ext)) ||
				sourceText.includes(`import `) ||
				sourceText.includes(`export `)
			);

			isModule && (
				config.module = true,
				config.esversion = Math.max(config.esversion || 6, 6)
			);

			const {processedCode, analysis} = analyzeSourceCode(sourceText, document);

			logger(`debug`, `analysis started: ${document.fileName}`);

			const isValid = jsHint.JSHINT(processedCode, config);

			return isValid ? (
				logger(`debug`, `analysis completed: no errors (${document.fileName})`),
				[]
			) : (() => {
				const dataMethod = (jsHint as any).data || (jsHint.JSHINT as any)?.data;
				const hasDataMethod = typeof dataMethod === `function`;

				return !hasDataMethod ? (
					logger(`error`, `data() method not available in JSHint instance`),
					[]
				) : (() => {
					const result = dataMethod.call(jsHint.JSHINT || jsHint);
					const diagnostics: vscode.Diagnostic[] = [];

					if (result && Array.isArray(result.errors)) {
						let errorCount = 0;
						let warningCount = 0;
						let infoCount = 0;

						for (const error of result.errors) {
							if (!error || error.line === null || error.line === undefined) {
								continue;
							}

							const range = calculateErrorRange(document, error);
							const severity = calculateSeverity(error);
							const message = error.reason || `JSHint error`;
							const diagnostic = new vscode.Diagnostic(range, message, severity);

							diagnostic.source = `JSHint`;
							diagnostic.code = error.code;
							(diagnostic as any).data = {
								ruleId: error.code,
								line: error.line,
								character: error.character,
								evidence: error.evidence,
								reason: error.reason,
								originalRange: range,
							};

							diagnostics.push(diagnostic);

							severity === vscode.DiagnosticSeverity.Error ? (
								errorCount++
							) : severity === vscode.DiagnosticSeverity.Warning ? (
								warningCount++
							) : (
								infoCount++
							);
						}

						logger(`debug`, `analysis completed: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info (${document.fileName})`);
					}
					const additionalDiagnostics = generateAdditionalDiagnostics(document, analysis);
					diagnostics.push(...additionalDiagnostics);

					const totalIssues = diagnostics.length;
					const additionalIssues = additionalDiagnostics.length;

					additionalIssues > 0 && logger(`debug`, `analysis completed: ${additionalIssues} code quality issues found (${document.fileName})`);
					logger(`debug`, `analysis finished: total ${totalIssues} issues (${document.fileName})`);

					return diagnostics;
				})();
			})();
		}
		catch (error: any) {
			const errorMessage = error?.message || String(error);
			const errorStack = error?.stack || ``;
			logger(`error`, `execution error: ${errorMessage} (${document.fileName})`);
			errorStack && logger(`debug`, `stack trace: ${errorStack}`);
			return [];
		}
	})();
};
