// src/langs/js/jsHintRunner.ts

import { vscode, Position } from "@exportLibs";
import { logger } from "@exportScripts";
import type {
	JSHintInstance,
	JSHintError,
	SourceAnalysis,
	ComplexityIssue,
	PotentialBug,
	FunctionInfo,
	VariableInfo
} from "@exportLangs";
import { loadJSHint, loadJSHintConfig, analyzeSourceCode } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
export const jsHint: JSHintInstance | null = loadJSHint();

// -------------------------------------------------------------------------------------------------
const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : value > max ? max : value;
};

// -------------------------------------------------------------------------------------------------
const calculateErrorRange = (document: vscode.TextDocument, error: JSHintError): vscode.Range => {
	const lineNumber = Math.max((error.line || 1) - 1, 0);
	const columnNumber = Math.max((error.character || 1) - 1, 0);
	const safeLineNumber = clamp(lineNumber, 0, document.lineCount - 1);
	const lineText = document.lineAt(safeLineNumber).text;

	let startColumn = columnNumber;
	let endColumn = columnNumber + 1;

	error.code && (() => {
		const match = error.code === 'W033' ? (
			endColumn = lineText.trimRight().length,
			startColumn = Math.max(endColumn - 1, 0),
			null
		) : (error.code === 'W116' || error.code === 'W117') ? (
			lineText.slice(columnNumber).match(/^\w+|^==|^!=/)
		) : error.code === 'W030' ? (
			lineText.slice(columnNumber).match(/^[^;]+/)
		) : (
			lineText.slice(columnNumber).match(/^\S+/)
		);

		match && (
			startColumn = columnNumber,
			endColumn = columnNumber + match[0].length
		);
	})();

	startColumn = clamp(startColumn, 0, lineText.length);
	endColumn = clamp(endColumn, startColumn + 1, lineText.length);

	return new vscode.Range(
		new Position(safeLineNumber, startColumn),
		new Position(safeLineNumber, endColumn)
	);
};

// -------------------------------------------------------------------------------------------------
const calculateSeverity = (error: JSHintError): vscode.DiagnosticSeverity => {
	return !error.code ? (
		vscode.DiagnosticSeverity.Warning
	) : ['E001', 'E002', 'E003', 'E004', 'E005', 'E006', 'E007', 'E008', 'E009', 'E010'].some(code => error.code.startsWith(code)) ? (
		vscode.DiagnosticSeverity.Error
	) : ['W033', 'W116', 'W117', 'W098', 'W097'].includes(error.code) ? (
		vscode.DiagnosticSeverity.Warning
	) : (
		vscode.DiagnosticSeverity.Information
	);
};

// -------------------------------------------------------------------------------------------------
const generateAdditionalDiagnostics = (document: vscode.TextDocument, analysis: SourceAnalysis): vscode.Diagnostic[] => {
	const diagnostics: vscode.Diagnostic[] = [];

	analysis.complexityIssues.forEach((issue: ComplexityIssue) => {
		const line = Math.max(issue.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
		const severity = issue.type === 'deep-nesting' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
		const diagnostic = new vscode.Diagnostic(range, issue.message, severity);

		diagnostic.source = "Html-Js-Css-Analyzer";
		diagnostic.code = `complexity-${issue.type}`;
		(diagnostic as any).data = {
			ruleId: `complexity-${issue.type}`,
			line: issue.line,
			analysisType: 'complexity'
		};

		diagnostics.push(diagnostic);
	});

	analysis.potentialBugs.forEach((bug: PotentialBug) => {
		const line = Math.max(bug.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
		const severity = ['eval-usage', 'with-statement', 'assignment-in-condition'].includes(bug.type) ? (
			vscode.DiagnosticSeverity.Error
		) : ['empty-catch'].includes(bug.type) ? (
			vscode.DiagnosticSeverity.Warning
		) : (
			vscode.DiagnosticSeverity.Information
		);
		const diagnostic = new vscode.Diagnostic(range, bug.message, severity);

		diagnostic.source = "Html-Js-Css-Analyzer";
		diagnostic.code = `bug-${bug.type}`;
		(diagnostic as any).data = {
			ruleId: `bug-${bug.type}`,
			line: bug.line,
			analysisType: 'potential-bug'
		};

		diagnostics.push(diagnostic);
	});

	analysis.functions.forEach((func: FunctionInfo) => {
		func.parameters > 6 && (() => {
			const line = Math.max(func.line - 1, 0);
			const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
			const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
			const diagnostic = new vscode.Diagnostic(
				range,
				`함수 '${func.name}'의 매개변수가 너무 많습니다 (${func.parameters}개): 객체나 설정 매개변수 사용을 고려하세요`,
				vscode.DiagnosticSeverity.Information
			);

			diagnostic.source = "Html-Js-Css-Analyzer";
			diagnostic.code = "function-too-many-params";
			(diagnostic as any).data = {
				ruleId: "function-too-many-params",
				line: func.line,
				analysisType: 'function-complexity',
				functionName: func.name,
				parameterCount: func.parameters
			};

			diagnostics.push(diagnostic);
		})();
	});

	const varUsages = analysis.variables.filter((v: VariableInfo) => v.type === 'var');
	varUsages.forEach((varUsage: VariableInfo) => {
		const line = Math.max(varUsage.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
		const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
		const diagnostic = new vscode.Diagnostic(range, `'var' 대신 'let' 또는 'const' 사용을 권장합니다`, vscode.DiagnosticSeverity.Information);

		diagnostic.source = "Html-Js-Css-Analyzer";
		diagnostic.code = "prefer-let-const";
		(diagnostic as any).data = {
			ruleId: "prefer-let-const",
			line: varUsage.line,
			analysisType: 'code-style',
			variableName: varUsage.name,
			currentType: 'var'
		};

		diagnostics.push(diagnostic);
	});

	!analysis.hasStrictMode && !analysis.isModule && (() => {
		const diagnostic = new vscode.Diagnostic(
			new vscode.Range(0, 0, 0, 0),
			`'use strict' 지시문 사용을 권장합니다`,
			vscode.DiagnosticSeverity.Information
		);

		diagnostic.source = "Html-Js-Css-Analyzer";
		diagnostic.code = "missing-strict-mode";
		(diagnostic as any).data = {
			ruleId: "missing-strict-mode",
			line: 1,
			analysisType: 'best-practice'
		};

		diagnostics.push(diagnostic);
	})();

	return diagnostics;
};

// -------------------------------------------------------------------------------------------------
export const runJSHint = (document: vscode.TextDocument): vscode.Diagnostic[] => {
	return !jsHint ? (
		logger(`warn`, `JSHint`, `module not loaded - JSHint is optional`),
		[]
	) : (() => {
		try {
			logger(`debug`, `JSHint`, `starting analysis for: ${document.fileName} (languageId: ${document.languageId})`);

			const config = { ...loadJSHintConfig(document.uri.fsPath) };
			const fileName = document.fileName.toLowerCase();
			const languageId = document.languageId;
			const sourceText = document.getText();

			const isTypeScript = (
				fileName.endsWith('.ts') ||
				fileName.endsWith('.tsx') ||
				languageId === "typescript" ||
				languageId === "typescriptreact"
			);

			const isModule = (
				fileName.endsWith('.mjs') ||
				fileName.endsWith('.cjs') ||
				sourceText.includes('import ') ||
				sourceText.includes('export ') ||
				isTypeScript
			);

			isTypeScript && (
				config.esversion = 2022,
				config.module = true,
				config.undef = false,
				config.predef = [...(config.predef || []), 'TypeScript', 'namespace', 'interface', 'type', 'declare', 'enum']
			);

			isModule && (
				config.module = true,
				config.esversion = Math.max(config.esversion || 6, 6)
			);

			const { processedCode, analysis } = analyzeSourceCode(sourceText, document);

			logger(`debug`, `JSHint`, `analysis started: ${document.fileName}`);

			const isValid = jsHint.JSHINT(processedCode, config);

			return isValid ? (
				logger(`debug`, `JSHint`, `analysis completed: no errors (${document.fileName})`),
				[]
			) : (() => {
				const dataMethod = (jsHint as any).data || (jsHint.JSHINT as any)?.data;
				const hasDataMethod = typeof dataMethod === "function";

				return !hasDataMethod ? (
					logger(`error`, `JSHint`, `data() method not available in JSHint instance`),
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
							const message = error.reason || 'JSHint 오류';
							const diagnostic = new vscode.Diagnostic(range, message, severity);

							diagnostic.source = "Html-Js-Css-Analyzer";
							diagnostic.code = error.code;
							(diagnostic as any).data = {
								ruleId: error.code,
								line: error.line,
								character: error.character,
								evidence: error.evidence,
								reason: error.reason,
								originalRange: range
							};

							diagnostics.push(diagnostic);

							if (severity === vscode.DiagnosticSeverity.Error) {
								errorCount++;
							}
							else if (severity === vscode.DiagnosticSeverity.Warning) {
								warningCount++;
							}
							else {
								infoCount++;
							}
						}

						logger(`debug`, `JSHint`, `analysis completed: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info (${document.fileName})`);
					}

					const additionalDiagnostics = generateAdditionalDiagnostics(document, analysis);
					diagnostics.push(...additionalDiagnostics);

					const totalIssues = diagnostics.length;
					const additionalIssues = additionalDiagnostics.length;

					additionalIssues > 0 && logger(`debug`, `Additional`, `analysis completed: ${additionalIssues} code quality issues found (${document.fileName})`);
					logger(`debug`, `Complete`, `analysis finished: total ${totalIssues} issues (${document.fileName})`);

					return diagnostics;
				})();
			})();
		}
		catch (error: any) {
			const errorMessage = error?.message || String(error);
			const errorStack = error?.stack || '';
			logger(`error`, `JSHint`, `execution error: ${errorMessage} (${document.fileName})`);
			errorStack && logger(`debug`, `JSHint`, `stack trace: ${errorStack}`);
			return [];
		}
	})();
};
