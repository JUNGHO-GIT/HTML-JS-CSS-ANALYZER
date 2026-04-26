/**
 * @file jsAnalyzer.ts
 * @since 2025-11-22
 * @description JS 소스코드 분석 및 품질 검사
 */

import { vscode } from "@exportLibs";
import type { SourceAnalysis, AnalyzeResult } from "@exportLangs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const MAX_NESTING = 8;
const MAX_LINE_LENGTH = 200;
const MAX_REGEX_LENGTH = 80;
const MAX_REGEX_COMPLEXITY = 15;

// REGEX PATTERNS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const INDENT_REGEX = /^\s*/;
const REGEX_PATTERN = /\/(?![*/])(?:[^\n/\\]|\\.)+\/[gimsuvy]*/g;
const COMPLEX_CHARS_REGEX = /[()*+?[\]{|}]/g;
const COMMENT_LINE_REGEX = /^\s*\/\//;
const STRING_CONTENT_REGEX = /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g;
const ASSIGNMENT_IN_IF_REGEX = /\bif\s*\([^)]*[^!<=>]=(?!=)[^=]/;
const EMPTY_CATCH_REGEX = /\bcatch\s*\([^)]*\)\s*{\s*}/;
const EVAL_USAGE_REGEX = /\beval\s*\(/;
const WITH_STATEMENT_REGEX = /\bwith\s*\(/;
const LOOP_START_REGEX = /\b(for|while)\s*\(/;

// HELPERS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――--
const stripStringsAndComments = (line: string): string => {
	return line
		.replaceAll(STRING_CONTENT_REGEX, `""`)
		.replace(/\/\/.*$/, ``)
		.replaceAll(/\/\*.*?\*\//g, ``);
};

// Helper: Build line offset index for O(log n) line lookups ――――――
const buildLineOffsets = (text: string): number[] => {
	const offsets = [0];
	for (const [i, ch] of [...text].entries()) {
		ch === `\n` && offsets.push(i + 1);
	}
	return offsets;
};

// Helper: Binary search to find 1-based line number from offset --
const lineAtOffset = (offsets: number[], offset: number): number => {
	let lo = 0;
	let hi = offsets.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		offsets[mid] <= offset ? (lo = mid) : (hi = mid - 1);
	}
	return lo + 1;
};

// Helper: Precompute block comment state per line ―――――――――――――――-
const precomputeBlockCommentState = (lines: string[]): boolean[] => {
	const state = Array.from<boolean>({ length: lines.length });
	let inBlock = false;
	for (const [i, line] of lines.entries()) {
		line.includes(`/*`) && !line.includes(`*/`) && (inBlock = true);
		inBlock && line.includes(`*/`) && (inBlock = false);
		state[i] = inBlock;
	}
	return state;
};

// ANALYSIS FUNCTIONS ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const analyzeComplexity = (lines: string[], analysis: SourceAnalysis): void => {
	for (const [i, line] of lines.entries()) {
		const lineNum = i + 1;
		const trimmed = line.trim();

		if (trimmed.length === 0) {
			continue;
		}
		const indentMatch = INDENT_REGEX.exec(line);
		const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;

		indentLevel > MAX_NESTING &&
			analysis.complexityIssues.push({
				type: `deep-nesting`,
				line: lineNum,
				message: `Excessive nesting (${indentLevel} levels): consider refactoring`,
			});

		line.length > MAX_LINE_LENGTH &&
			analysis.complexityIssues.push({
				type: `long-line`,
				line: lineNum,
				message: `Long line (${line.length} chars): consider line break for readability`,
			});

		const regexMatches = line.match(REGEX_PATTERN);
		regexMatches?.forEach((regex) => {
			const complexity = (regex.match(COMPLEX_CHARS_REGEX) ?? []).length;
			(regex.length > MAX_REGEX_LENGTH || complexity > MAX_REGEX_COMPLEXITY) &&
				analysis.complexityIssues.push({
					type: `complex-regex`,
					line: lineNum,
					message: `Complex regex: consider splitting or adding comments for readability`,
				});
		});
	}
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const analyzePotentialBugs = (
	lines: string[],
	blockCommentState: boolean[],
	analysis: SourceAnalysis,
): void => {
	for (const [i, line] of lines.entries()) {
		const lineNum = i + 1;
		const trimmed = line.trim();

		if (trimmed.length === 0) {
			continue;
		}
		// Skip comments (precomputed block comment state)
		if (blockCommentState[i] || COMMENT_LINE_REGEX.test(trimmed)) {
			continue;
		}
		// Strip strings for accurate detection
		const strippedLine = stripStringsAndComments(line);

		ASSIGNMENT_IN_IF_REGEX.test(strippedLine) &&
			analysis.potentialBugs.push({
				type: `assignment-in-condition`,
				line: lineNum,
				message: `Assignment in condition: did you mean comparison operator (===)?`,
			});

		EMPTY_CATCH_REGEX.test(strippedLine) &&
			analysis.potentialBugs.push({
				type: `empty-catch`,
				line: lineNum,
				message: `Empty catch block: error handling required`,
			});

		EVAL_USAGE_REGEX.test(strippedLine) &&
			analysis.potentialBugs.push({
				type: `eval-usage`,
				line: lineNum,
				message: `Use of eval: security risk`,
			});

		WITH_STATEMENT_REGEX.test(strippedLine) &&
			analysis.potentialBugs.push({
				type: `with-statement`,
				line: lineNum,
				message: `Use of with statement: forbidden in strict mode and has performance issues`,
			});
	}
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const analyzeModernJs = (
	lines: string[],
	blockCommentState: boolean[],
	analysis: SourceAnalysis,
): void => {
	for (const [i, line] of lines.entries()) {
		const lineNum = i + 1;

		if (blockCommentState[i] || COMMENT_LINE_REGEX.test(line.trim())) {
			continue;
		}
		// Strip strings for accurate detection
		const strippedLine = stripStringsAndComments(line);

		/\bvar\s+/.test(strippedLine) &&
			analysis.potentialBugs.push({
				type: `var-usage`,
				line: lineNum,
				message: `Avoid using 'var', use 'let' or 'const' instead (Modern JS)`,
			});
	}
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const analyzeSecurity = (
	lines: string[],
	blockCommentState: boolean[],
	analysis: SourceAnalysis,
): void => {
	for (const [i, line] of lines.entries()) {
		const lineNum = i + 1;

		if (blockCommentState[i] || COMMENT_LINE_REGEX.test(line.trim())) {
			continue;
		}
		// Strip strings for accurate detection
		const strippedLine = stripStringsAndComments(line);

		strippedLine.includes(`.innerHTML`) &&
			/\.innerHTML\s*=/.test(strippedLine) &&
			analysis.potentialBugs.push({
				type: `innerhtml-usage`,
				line: lineNum,
				message: `Assignment to innerHTML can be an XSS vulnerability`,
			});

		strippedLine.includes(`document.write(`) &&
			analysis.potentialBugs.push({
				type: `document-write`,
				line: lineNum,
				message: `Avoid using document.write()`,
			});
	}
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const analyzePerformance = (
	lines: string[],
	blockCommentState: boolean[],
	analysis: SourceAnalysis,
): void => {
	const loopStack: number[] = []; // Stack of brace depths where loops started
	let braceDepth = 0;

	for (const [i, line] of lines.entries()) {
		const lineNum = i + 1;

		if (blockCommentState[i] || COMMENT_LINE_REGEX.test(line.trim())) {
			continue;
		}
		const strippedLine = stripStringsAndComments(line);

		// Detect loop start
		LOOP_START_REGEX.test(strippedLine) &&
			(() => {
				loopStack.push(braceDepth);
				loopStack.length > 2 &&
					analysis.potentialBugs.push({
						type: `large-loop`,
						line: lineNum,
						message: `Deeply nested loop detected (depth: ${loopStack.length}). This might affect performance.`,
					});
			})();

		// Count braces
		const openBraces = (strippedLine.match(/{/g) ?? []).length;
		const closeBraces = (strippedLine.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		// Pop loop stack when we exit a loop's brace level
		while (loopStack.length > 0 && braceDepth <= loopStack.at(-1)) {
			loopStack.pop();
		}
	}
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const analyzeSourceCode = (
	sourceCode: string,
	document: vscode.TextDocument,
): AnalyzeResult => {
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

	analysis.isModule =
		sourceCode.includes(`import `) ||
		sourceCode.includes(`export `) ||
		document.fileName.endsWith(`.mjs`);
	analysis.hasStrictMode =
		sourceCode.includes(`"use strict"`) || sourceCode.includes(`'use strict'`);

	const lineOffsets = buildLineOffsets(sourceCode);

	// 함수 선언 분석 (최적화된 정규식)
	const functionMatches = sourceCode.matchAll(
		/\bfunction\s+(\w+)\s*\([^)]*\)\s*{/g,
	);
	[...functionMatches].forEach((match) => {
		const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] ?? ``;
		analysis.functions.push({
			name: match[1],
			line: lineAtOffset(lineOffsets, match.index),
			parameters: paramsText.split(`,`).filter((p) => p.trim()).length,
		});
	});

	// 화살표 함수 분석
	const arrowMatches = sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g);
	[...arrowMatches].forEach((match) => {
		const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] ?? ``;
		analysis.functions.push({
			name: match[1],
			line: lineAtOffset(lineOffsets, match.index),
			parameters: paramsText.split(`,`).filter((p) => p.trim()).length,
		});
	});

	// 변수 선언 분석
	const variableMatches = sourceCode.matchAll(/\b(let|const|var)\s+(\w+)/g);
	[...variableMatches].forEach((match) => {
		analysis.variables.push({
			name: match[2],
			type: match[1] as `let` | `const` | `var`,
			line: lineAtOffset(lineOffsets, match.index),
		});
	});

	// import 문 분석
	const importMatches = sourceCode.matchAll(
		/\bimport\s+.*?from\s+["'`]([^"'`]+)["'`]/g,
	);
	[...importMatches].forEach((match) => {
		analysis.imports.push({
			module: match[1],
			line: lineAtOffset(lineOffsets, match.index),
		});
	});

	// export 문 분석
	const exportMatches = sourceCode.matchAll(/\bexport\s+(.*?)(?=\n|$)/g);
	[...exportMatches].forEach((match) => {
		analysis.exports.push({
			declaration: match[1],
			line: lineAtOffset(lineOffsets, match.index),
		});
	});

	const lines = sourceCode.split(`\n`);
	const blockCommentState = precomputeBlockCommentState(lines);
	analyzeComplexity(lines, analysis);
	analyzePotentialBugs(lines, blockCommentState, analysis);
	analyzeModernJs(lines, blockCommentState, analysis);
	analyzeSecurity(lines, blockCommentState, analysis);
	analyzePerformance(lines, blockCommentState, analysis);

	const processedCode = sourceCode;

	return { processedCode, analysis };
};
