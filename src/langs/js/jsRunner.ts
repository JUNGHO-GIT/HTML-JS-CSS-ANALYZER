/**
 * @file jsRunner.ts
 * @since 2025-11-22
 */

import { vscode, Position } from "@exportLibs";
import { logger } from "@exportScripts";
import type {
	JSHintInstance,
	JSHintError,
	SourceAnalysis,
	ComplexityIssue,
	PotentialBug,
	FunctionInfo,
	VariableInfo,
} from "@exportLangs";
import { loadJSHint, loadJSHintConfig, analyzeSourceCode } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
let jsHintCache: JSHintInstance | null | undefined;

// -------------------------------------------------------------------------------------------------
const getJSHint = (): JSHintInstance | null => {
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

	// 에러 코드별 최적화된 범위 계산
	const ERROR_W033_CODES = [ `W033` ];
	const ERROR_W116_W117_CODES = [ `W116`, `W117` ];
	const ERROR_W030_CODES = [ `W030` ];

	error.code && (() => {
		const match = ERROR_W033_CODES.includes(error.code) ? (
			endColumn = lineText.trimEnd().length,
			startColumn = Math.max(endColumn - 1, 0),
			null
		) : ERROR_W116_W117_CODES.includes(error.code) ? (
			/^(?:\w+|==|!=)/.exec(lineText.slice(columnNumber))
		) : ERROR_W030_CODES.includes(error.code) ? (
			/^[^;]+/.exec(lineText.slice(columnNumber))
		) : (
			/^\S+/.exec(lineText.slice(columnNumber))
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
// JSHint 에러 심각도 매핑
const ERROR_CODES = new Set([ `E001`, `E002`, `E003`, `E004`, `E005`, `E006`, `E007`, `E008`, `E009`, `E010` ]);
const WARNING_CODES = new Set([ `W033`, `W116`, `W117`, `W098`, `W097` ]);

const calculateSeverity = (error: JSHintError): vscode.DiagnosticSeverity => {
	return !error.code ? (
		vscode.DiagnosticSeverity.Warning
	) : error.code.startsWith(`E`) && ERROR_CODES.has(error.code) ? (
		vscode.DiagnosticSeverity.Error
	) : WARNING_CODES.has(error.code) ? (
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
		const severity = [ `eval-usage`, `with-statement`, `assignment-in-condition` ].includes(bug.type) ? (
			vscode.DiagnosticSeverity.Error
		) : [ `empty-catch` ].includes(bug.type) ? (
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
		func.parameters > 6 && (() => {
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
			const languageId = document.languageId;
			const sourceText = document.getText();

			const isTypeScript = (
				fileName.endsWith(`.ts`) ||
				fileName.endsWith(`.tsx`) ||
				languageId === `typescript` ||
				languageId === `typescriptreact`
			);

			const isModule = (
				fileName.endsWith(`.mjs`) ||
				fileName.endsWith(`.cjs`) ||
				sourceText.includes(`import `) ||
				sourceText.includes(`export `) ||
				isTypeScript
			);

			isTypeScript && (
				config.esversion = 2022,
				config.module = true,
				config.undef = false,
				config.predef = [ ...(config.predef || []), `TypeScript`, `namespace`, `interface`, `type`, `declare`, `enum` ]
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
					}					const additionalDiagnostics = generateAdditionalDiagnostics(document, analysis);
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
