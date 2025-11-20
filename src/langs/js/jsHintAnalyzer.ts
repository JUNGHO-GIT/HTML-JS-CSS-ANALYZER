// src/langs/js/jsHintAnalyzer.ts

import { vscode } from "@exportLibs";
import type { SourceAnalysis, AnalyzeResult } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
const MAX_NESTING = 8;
const MAX_LINE_LENGTH = 200;
const MAX_REGEX_LENGTH = 80;

// -------------------------------------------------------------------------------------------------
const analyzeComplexity = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split('\n');
	const INDENT_REGEX = /^\s*/;
	const REGEX_PATTERN = /\/(?![*\/])[^\/\n]+\/[gimsuvy]*/g;
	const COMPLEX_CHARS_REGEX = /[\[\](){}|*+?]/g;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		const indentMatch = line.match(INDENT_REGEX);
		const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;

		indentLevel > MAX_NESTING && analysis.complexityIssues.push({
			type: 'deep-nesting',
			line: lineNum,
			message: `과도한 중첩 (${indentLevel}단계): 코드 리팩토링을 고려하세요`
		});

		const lineLength = line.length;
		lineLength > MAX_LINE_LENGTH && line.trim().length > 0 && analysis.complexityIssues.push({
			type: 'long-line',
			line: lineNum,
			message: `긴 줄 (${lineLength}자): 가독성을 위해 줄바꿈을 고려하세요`
		});

		const regexMatches = line.match(REGEX_PATTERN);
		regexMatches && regexMatches.forEach(regex => {
			const complexity = (regex.match(COMPLEX_CHARS_REGEX) || []).length;
			(regex.length > MAX_REGEX_LENGTH || complexity > 15) && analysis.complexityIssues.push({
				type: 'complex-regex',
				line: lineNum,
				message: '복잡한 정규식: 가독성을 위해 분리하거나 주석을 추가하세요'
			});
		});
	}
};

// -------------------------------------------------------------------------------------------------
const analyzePotentialBugs = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split('\n');
	const COMMENT_START_REGEX = /^\s*(\/\/|\/\*)/;
	const ASSIGNMENT_IN_IF_REGEX = /if\s*\([^)]*[^=!<>]=(?!=)[^=]/;
	const EMPTY_CATCH_REGEX = /catch\s*\([^)]*\)\s*{\s*}/;
	const EVAL_USAGE_REGEX = /\beval\s*\(/;
	const WITH_STATEMENT_REGEX = /\bwith\s*\(/;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lineNum = i + 1;
		const trimmed = line.trim();

		if (trimmed.length === 0 || COMMENT_START_REGEX.test(trimmed)) {
			continue;
		}

		ASSIGNMENT_IN_IF_REGEX.test(line) && analysis.potentialBugs.push({
			type: 'assignment-in-condition',
			line: lineNum,
			message: '조건문에서 할당 연산자 사용: 비교 연산자(===)를 의도하셨나요?'
		});

		EMPTY_CATCH_REGEX.test(line) && analysis.potentialBugs.push({
			type: 'empty-catch',
			line: lineNum,
			message: '빈 catch 블록: 오류 처리가 필요합니다'
		});

		EVAL_USAGE_REGEX.test(line) && analysis.potentialBugs.push({
			type: 'eval-usage',
			line: lineNum,
			message: 'eval 사용: 보안 위험이 있습니다'
		});

		WITH_STATEMENT_REGEX.test(line) && analysis.potentialBugs.push({
			type: 'with-statement',
			line: lineNum,
			message: 'with 문 사용: strict mode에서 금지되며 성능상 문제가 있습니다'
		});
	}
};

// -------------------------------------------------------------------------------------------------
const preprocessTypeScriptCode = (sourceCode: string): string => {
	let result = sourceCode;
	const patterns = [
		[/(\w+):\s*[\w\[\]<>|&.]+(?=\s*[,)])/g, '$1'],
		[/\):\s*[\w\[\]<>|&.]+(?=\s*[{;=])/g, ')'],
		[/(let|const|var)\s+(\w+):\s*[\w\[\]<>|&.]+/g, '$1 $2'],
		[/<[\w\s,<>|&.]+>/g, ''],
		[/\s+as\s+[\w\[\]<>|&.]+/g, ''],
		[/interface\s+\w+\s*{[^{}]*(?:{[^{}]*}[^{}]*)*}/g, ''],
		[/type\s+\w+\s*=\s*[^;]+;/g, ''],
		[/declare\s+(const|let|var|function|class|interface|type|namespace)\s+[^;{]+[;{][^}]*}?/g, ''],
		[/enum\s+\w+\s*{[^}]*}/g, ''],
		[/namespace\s+\w+\s*{[^}]*}/g, ''],
		[/export\s+type\s+[^;]+;/g, ''],
		[/import\s+type\s+[^;]+;/g, '']
	] as const;

	for (const [pattern, replacement] of patterns) {
		result = result.replace(pattern, replacement);
	}

	return result;
};

// -------------------------------------------------------------------------------------------------
export const analyzeSourceCode = (sourceCode: string, document: vscode.TextDocument): AnalyzeResult => {
	const analysis: SourceAnalysis = {
		isModule: false,
		isTypeScript: false,
		hasStrictMode: false,
		functions: [],
		variables: [],
		imports: [],
		exports: [],
		complexityIssues: [],
		potentialBugs: []
	};

	analysis.isTypeScript = document.fileName.endsWith('.ts') || document.fileName.endsWith('.tsx');
	analysis.isModule = (
		sourceCode.includes('import ') ||
		sourceCode.includes('export ') ||
		document.fileName.endsWith('.mjs')
	);
	analysis.hasStrictMode = (
		sourceCode.includes('"use strict"') ||
		sourceCode.includes("'use strict'")
	);

	const functionMatches = sourceCode.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*{/g);
	[...functionMatches].forEach(match => {
		analysis.functions.push({
			name: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length,
			parameters: (match[0].match(/\([^)]*\)/)?.[0] || '()').slice(1, -1).split(',').filter(p => p.trim()).length
		});
	});

	const arrowMatches = sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g);
	[...arrowMatches].forEach(match => {
		analysis.functions.push({
			name: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length,
			parameters: (match[0].match(/\([^)]*\)/)?.[0] || '()').slice(1, -1).split(',').filter(p => p.trim()).length
		});
	});

	const variableMatches = sourceCode.matchAll(/(let|const|var)\s+(\w+)/g);
	[...variableMatches].forEach(match => {
		analysis.variables.push({
			name: match[2],
			type: match[1] as 'let' | 'const' | 'var',
			line: sourceCode.substring(0, match.index).split('\n').length
		});
	});

	const importMatches = sourceCode.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
	[...importMatches].forEach(match => {
		analysis.imports.push({
			module: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length
		});
	});

	const exportMatches = sourceCode.matchAll(/export\s+(.*?)(?=\n|$)/g);
	[...exportMatches].forEach(match => {
		analysis.exports.push({
			declaration: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length
		});
	});

	analyzeComplexity(sourceCode, analysis);
	analyzePotentialBugs(sourceCode, analysis);

	const processedCode = analysis.isTypeScript ? preprocessTypeScriptCode(sourceCode) : sourceCode;

	return { processedCode, analysis };
};
