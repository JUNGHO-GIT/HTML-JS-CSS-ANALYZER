/**
 * @file jsAnalyzer.ts
 * @since 2025-11-22
 */

import { vscode } from "@exportLibs";
import type { SourceAnalysis, AnalyzeResult } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
const MAX_NESTING = 8;
const MAX_LINE_LENGTH = 200;
const MAX_REGEX_LENGTH = 80;
const MAX_REGEX_COMPLEXITY = 15;

// -------------------------------------------------------------------------------------------------
// 최적화된 정규식 패턴 (성능 및 정확도 개선)
const INDENT_REGEX = /^\s*/;
const REGEX_PATTERN = /\/(?![*/])(?:[^\\/\n]|\\.)+\/[gimsuvy]*/g;
const COMPLEX_CHARS_REGEX = /[\](){}|*+?[]/g;
const COMMENT_START_REGEX = /^\s*(?:\/\/|\/\*)/;
const ASSIGNMENT_IN_IF_REGEX = /\bif\s*\([^)]*[^=!<>]=(?!=)[^=]/;
const EMPTY_CATCH_REGEX = /\bcatch\s*\([^)]*\)\s*\{\s*\}/;
const EVAL_USAGE_REGEX = /\beval\s*\(/;
const WITH_STATEMENT_REGEX = /\bwith\s*\(/;

// -------------------------------------------------------------------------------------------------
const analyzeComplexity = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		const trimmed = line.trim();

		if (trimmed.length === 0) {
			continue;
		}

		const indentMatch = INDENT_REGEX.exec(line);
		const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;

		indentLevel > MAX_NESTING && analysis.complexityIssues.push({
			type: `deep-nesting`,
			line: lineNum,
			message: `Excessive nesting (${indentLevel} levels): consider refactoring`,
		});

		line.length > MAX_LINE_LENGTH && analysis.complexityIssues.push({
			type: `long-line`,
			line: lineNum,
			message: `Long line (${line.length} chars): consider line break for readability`,
		});

		const regexMatches = line.match(REGEX_PATTERN);
		regexMatches && regexMatches.forEach(regex => {
			const complexity = (regex.match(COMPLEX_CHARS_REGEX) || []).length;
			(regex.length > MAX_REGEX_LENGTH || complexity > MAX_REGEX_COMPLEXITY) && analysis.complexityIssues.push({
				type: `complex-regex`,
				line: lineNum,
				message: `Complex regex: consider splitting or adding comments for readability`,
			});
		});
	}
};

// -------------------------------------------------------------------------------------------------
const analyzePotentialBugs = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		const trimmed = line.trim();

		if (trimmed.length === 0 || COMMENT_START_REGEX.test(trimmed)) {
			continue;
		}

		ASSIGNMENT_IN_IF_REGEX.test(line) && analysis.potentialBugs.push({
			type: `assignment-in-condition`,
			line: lineNum,
			message: `Assignment in condition: did you mean comparison operator (===)?`,
		});

		EMPTY_CATCH_REGEX.test(line) && analysis.potentialBugs.push({
			type: `empty-catch`,
			line: lineNum,
			message: `Empty catch block: error handling required`,
		});

		EVAL_USAGE_REGEX.test(line) && analysis.potentialBugs.push({
			type: `eval-usage`,
			line: lineNum,
			message: `Use of eval: security risk`,
		});

		WITH_STATEMENT_REGEX.test(line) && analysis.potentialBugs.push({
			type: `with-statement`,
			line: lineNum,
			message: `Use of with statement: forbidden in strict mode and has performance issues`,
		});
	}
};

// -------------------------------------------------------------------------------------------------
const analyzeModernJs = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		if (/\bvar\s+/.test(line)) {
			analysis.potentialBugs.push({
				type: `var-usage`,
				line: lineNum,
				message: `Avoid using 'var', use 'let' or 'const' instead (Modern JS)`,
			});
		}
	}
};

// -------------------------------------------------------------------------------------------------
const analyzeSecurity = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		if (/\.innerHTML\s*=/.test(line)) {
			analysis.potentialBugs.push({
				type: `innerhtml-usage`,
				line: lineNum,
				message: `Assignment to innerHTML can be an XSS vulnerability`,
			});
		}

		if (/document\.write\(/.test(line)) {
			analysis.potentialBugs.push({
				type: `document-write`,
				line: lineNum,
				message: `Avoid using document.write()`,
			});
		}
	}
};

// -------------------------------------------------------------------------------------------------
const analyzePerformance = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);
	let loopDepth = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;

		if (/(for|while)\s*\(/.test(line) && !line.trim().startsWith(`//`)) {
			loopDepth++;
			if (loopDepth > 2) {
				analysis.potentialBugs.push({
					type: `large-loop`,
					line: lineNum,
					message: `Deeply nested loop detected (depth: ${loopDepth}). This might affect performance.`,
				});
			}
		}

		if (line.includes(`}`)) {
			loopDepth > 0 && loopDepth--;
		}
	}
};

// -------------------------------------------------------------------------------------------------
export const analyzeSourceCode = (sourceCode: string, document: vscode.TextDocument): AnalyzeResult => {
	const analysis: SourceAnalysis = {
		isModule: false,
		hasStrictMode: false,
		functions: [],
		variables: [],
		imports: [],
		exports: [],
		complexityIssues: [],
		potentialBugs: [],
	};

	analysis.isModule = (
		sourceCode.includes(`import `) ||
		sourceCode.includes(`export `) ||
		document.fileName.endsWith(`.mjs`)
	);
	analysis.hasStrictMode = (
		sourceCode.includes(`"use strict"`) ||
		sourceCode.includes(`'use strict'`)
	);

	// 함수 선언 분석 (최적화된 정규식)
	const functionMatches = sourceCode.matchAll(/\bfunction\s+(\w+)\s*\([^)]*\)\s*\{/g);
	[ ...functionMatches ].forEach(match => {
		const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] || ``;
		analysis.functions.push({
			name: match[1],
			line: sourceCode.substring(0, match.index).split(`\n`).length,
			parameters: paramsText.split(`,`).filter(p => p.trim()).length,
		});
	});

	// 화살표 함수 분석
	const arrowMatches = sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g);
	[ ...arrowMatches ].forEach(match => {
		const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] || ``;
		analysis.functions.push({
			name: match[1],
			line: sourceCode.substring(0, match.index).split(`\n`).length,
			parameters: paramsText.split(`,`).filter(p => p.trim()).length,
		});
	});

	// 변수 선언 분석
	const variableMatches = sourceCode.matchAll(/\b(let|const|var)\s+(\w+)/g);
	[ ...variableMatches ].forEach(match => {
		analysis.variables.push({
			name: match[2],
			type: match[1] as `let` | `const` | `var`,
			line: sourceCode.substring(0, match.index).split(`\n`).length,
		});
	});

	// import 문 분석
	const importMatches = sourceCode.matchAll(/\bimport\s+.*?from\s+[`'"]([^`'"]+)[`'"]/g);
	[ ...importMatches ].forEach(match => {
		analysis.imports.push({
			module: match[1],
			line: sourceCode.substring(0, match.index).split(`\n`).length,
		});
	});

	// export 문 분석
	const exportMatches = sourceCode.matchAll(/\bexport\s+(.*?)(?=\n|$)/g);
	[ ...exportMatches ].forEach(match => {
		analysis.exports.push({
			declaration: match[1],
			line: sourceCode.substring(0, match.index).split(`\n`).length,
		});
	});

	analyzeComplexity(sourceCode, analysis);
	analyzePotentialBugs(sourceCode, analysis);
	analyzeModernJs(sourceCode, analysis);
	analyzeSecurity(sourceCode, analysis);
	analyzePerformance(sourceCode, analysis);

	const processedCode = sourceCode;

	return { processedCode, analysis };
};
