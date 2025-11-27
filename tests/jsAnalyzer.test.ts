/**
 * @file jsAnalyzer.test.ts
 * @description JavaScript 코드 분석기 TDD 테스트
 */

// JS 분석 타입 및 함수 (vscode 의존성 없음)
const MAX_NESTING = 8;
const MAX_LINE_LENGTH = 200;
const MAX_REGEX_LENGTH = 80;
const MAX_REGEX_COMPLEXITY = 15;

const INDENT_REGEX = /^\s*/;
const REGEX_PATTERN = /\/(?![*/])(?:[^\\/\n]|\\.)+\/[gimsuvy]*/g;
const COMPLEX_CHARS_REGEX = /[\](){}|*+?[]/g;
const COMMENT_START_REGEX = /^\s*(?:\/\/|\/\*)/;
const ASSIGNMENT_IN_IF_REGEX = /\bif\s*\([^)]*[^=!<>]=(?!=)[^=]/;
const EMPTY_CATCH_REGEX = /\bcatch\s*\([^)]*\)\s*\{\s*\}/;
const EVAL_USAGE_REGEX = /\beval\s*\(/;
const WITH_STATEMENT_REGEX = /\bwith\s*\(/;

type ComplexityIssue = { type: string; line: number; message: string; };
type PotentialBug = { type: string; line: number; message: string; };
type FunctionInfo = { name: string; line: number; parameters: number; };
type VariableInfo = { name: string; type: `let` | `const` | `var`; line: number; };
type ImportInfo = { module: string; line: number; };
type ExportInfo = { declaration: string; line: number; };
type SourceAnalysis = {
	isModule: boolean;
	hasStrictMode: boolean;
	functions: FunctionInfo[];
	variables: VariableInfo[];
	imports: ImportInfo[];
	exports: ExportInfo[];
	complexityIssues: ComplexityIssue[];
	potentialBugs: PotentialBug[];
};
type AnalyzeResult = { processedCode: string; analysis: SourceAnalysis; };

const analyzeComplexity = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;

		const indentMatch = INDENT_REGEX.exec(line);
		const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;
		if (indentLevel > MAX_NESTING) {
			analysis.complexityIssues.push({ type: `deep-nesting`, line: i + 1, message: `Excessive nesting (${indentLevel} levels): consider refactoring` });
		}
		if (line.length > MAX_LINE_LENGTH) {
			analysis.complexityIssues.push({ type: `long-line`, line: i + 1, message: `Long line (${line.length} chars): consider line break for readability` });
		}
	}
};

const analyzePotentialBugs = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (trimmed.length === 0 || COMMENT_START_REGEX.test(trimmed)) continue;

		if (ASSIGNMENT_IN_IF_REGEX.test(line)) {
			analysis.potentialBugs.push({ type: `assignment-in-condition`, line: i + 1, message: `Assignment in condition: did you mean comparison operator (===)?` });
		}
		if (EMPTY_CATCH_REGEX.test(line)) {
			analysis.potentialBugs.push({ type: `empty-catch`, line: i + 1, message: `Empty catch block: error handling required` });
		}
		if (EVAL_USAGE_REGEX.test(line)) {
			analysis.potentialBugs.push({ type: `eval-usage`, line: i + 1, message: `Use of eval: security risk` });
		}
		if (WITH_STATEMENT_REGEX.test(line)) {
			analysis.potentialBugs.push({ type: `with-statement`, line: i + 1, message: `Use of with statement: forbidden in strict mode and has performance issues` });
		}
	}
};

const analyzeModernJs = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		if (/\bvar\s+/.test(lines[i])) {
			analysis.potentialBugs.push({ type: `var-usage`, line: i + 1, message: `Avoid using 'var', use 'let' or 'const' instead (Modern JS)` });
		}
	}
};

const analyzeSecurity = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split(`\n`);
	for (let i = 0; i < lines.length; i++) {
		if (/\.innerHTML\s*=/.test(lines[i])) {
			analysis.potentialBugs.push({ type: `innerhtml-usage`, line: i + 1, message: `Assignment to innerHTML can be an XSS vulnerability` });
		}
		if (/document\.write\(/.test(lines[i])) {
			analysis.potentialBugs.push({ type: `document-write`, line: i + 1, message: `Avoid using document.write()` });
		}
	}
};

const analyzeSourceCode = (sourceCode: string, document: { fileName: string }): AnalyzeResult => {
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

	analysis.isModule = sourceCode.includes(`import `) || sourceCode.includes(`export `) || document.fileName.endsWith(`.mjs`);
	analysis.hasStrictMode = sourceCode.includes(`"use strict"`) || sourceCode.includes(`'use strict'`);

	const functionMatches = sourceCode.matchAll(/\bfunction\s+(\w+)\s*\([^)]*\)\s*\{/g);
	[ ...functionMatches ].forEach(match => {
		const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] || ``;
		analysis.functions.push({ name: match[1], line: sourceCode.substring(0, match.index).split(`\n`).length, parameters: paramsText.split(`,`).filter(p => p.trim()).length });
	});

	const arrowMatches = sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g);
	[ ...arrowMatches ].forEach(match => {
		const paramsText = /\(([^)]*)\)/.exec(match[0])?.[1] || ``;
		analysis.functions.push({ name: match[1], line: sourceCode.substring(0, match.index).split(`\n`).length, parameters: paramsText.split(`,`).filter(p => p.trim()).length });
	});

	const variableMatches = sourceCode.matchAll(/\b(let|const|var)\s+(\w+)/g);
	[ ...variableMatches ].forEach(match => {
		analysis.variables.push({ name: match[2], type: match[1] as `let` | `const` | `var`, line: sourceCode.substring(0, match.index).split(`\n`).length });
	});

	const importMatches = sourceCode.matchAll(/\bimport\s+.*?from\s+[`'"]([^`'"]+)[`'"]/g);
	[ ...importMatches ].forEach(match => {
		analysis.imports.push({ module: match[1], line: sourceCode.substring(0, match.index).split(`\n`).length });
	});

	const exportMatches = sourceCode.matchAll(/\bexport\s+(.*?)(?=\n|$)/g);
	[ ...exportMatches ].forEach(match => {
		analysis.exports.push({ declaration: match[1], line: sourceCode.substring(0, match.index).split(`\n`).length });
	});

	analyzeComplexity(sourceCode, analysis);
	analyzePotentialBugs(sourceCode, analysis);
	analyzeModernJs(sourceCode, analysis);
	analyzeSecurity(sourceCode, analysis);

	return { processedCode: sourceCode, analysis };
};

// Mock document creator
const createMockDocument = (content: string, options: { fileName?: string } = {}) => ({
	fileName: options.fileName ?? `/test/file.js`,
});

describe(`analyzeSourceCode - JavaScript 코드 분석`, () => {
	const createDoc = (content: string, opts?: { fileName?: string }) => createMockDocument(content, {
		fileName: opts?.fileName ?? `/test/file.js`,
	});

	describe(`모듈 감지`, () => {
		it(`import 문이 있으면 모듈로 감지해야 함`, () => {
			const code = `import { useState } from 'react';`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.isModule).toBe(true);
		});

		it(`export 문이 있으면 모듈로 감지해야 함`, () => {
			const code = `export const foo = 'bar';`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.isModule).toBe(true);
		});

		it(`import/export가 없으면 모듈이 아님`, () => {
			const code = `const foo = 'bar';`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.isModule).toBe(false);
		});

		it(`.mjs 파일은 모듈로 감지해야 함`, () => {
			const code = `const foo = 'bar';`;
			const doc = createMockDocument(code, {
				fileName: `/test/file.mjs`,
			});
			const { analysis } = analyzeSourceCode(code, doc);

			expect(analysis.isModule).toBe(true);
		});
	});

	describe(`strict mode 감지`, () => {
		it(`"use strict" 디렉티브를 감지해야 함`, () => {
			const code = `"use strict";\nconst x = 1;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.hasStrictMode).toBe(true);
		});

		it(`작은따옴표 'use strict'도 감지해야 함`, () => {
			const code = `'use strict';\nconst x = 1;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.hasStrictMode).toBe(true);
		});

		it(`strict mode가 없으면 false여야 함`, () => {
			const code = `const x = 1;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.hasStrictMode).toBe(false);
		});
	});

	describe(`함수 분석`, () => {
		it(`함수 선언을 감지해야 함`, () => {
			const code = `function hello(name, age) { return name + age; }`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.functions).toHaveLength(1);
			expect(analysis.functions[0].name).toBe(`hello`);
			expect(analysis.functions[0].parameters).toBe(2);
		});

		it(`여러 함수를 감지해야 함`, () => {
			const code = `
				function first() {}
				function second(a) {}
				function third(a, b, c) {}
			`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.functions.length).toBeGreaterThanOrEqual(3);
		});

		it(`화살표 함수를 감지해야 함`, () => {
			const code = `const greet = (name) => name;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.functions.some(f => f.name === `greet`)).toBe(true);
		});
	});

	describe(`변수 분석`, () => {
		it(`const 변수를 감지해야 함`, () => {
			const code = `const x = 1;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.variables.some(v => v.type === `const`)).toBe(true);
		});

		it(`let 변수를 감지해야 함`, () => {
			const code = `let y = 2;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.variables.some(v => v.type === `let`)).toBe(true);
		});

		it(`var 변수를 감지해야 함`, () => {
			const code = `var z = 3;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.variables.some(v => v.type === `var`)).toBe(true);
		});
	});

	describe(`복잡도 이슈 검사`, () => {
		it(`과도한 중첩을 감지해야 함`, () => {
			// 각 줄 앞에 20개의 공백(10레벨의 들여쓰기)을 추가하여 심층 중첩 시뮬레이션
			const code = `                                        console.log('deeply nested');`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const deepNesting = analysis.complexityIssues.filter(i => i.type === `deep-nesting`);
			expect(deepNesting.length).toBeGreaterThan(0);
		});

		it(`긴 라인을 감지해야 함`, () => {
			const longLine = `const x = "${"a".repeat(250)}";`;
			const { analysis } = analyzeSourceCode(longLine, createDoc(longLine));

			const longLineIssues = analysis.complexityIssues.filter(i => i.type === `long-line`);
			expect(longLineIssues.length).toBeGreaterThan(0);
		});
	});

	describe(`잠재적 버그 검사`, () => {
		it(`조건문에서 할당을 감지해야 함`, () => {
			const code = `if (x = 5) { console.log('assigned'); }`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const assignmentIssues = analysis.potentialBugs.filter(i => i.type === `assignment-in-condition`);
			expect(assignmentIssues.length).toBeGreaterThan(0);
		});

		it(`빈 catch 블록을 감지해야 함`, () => {
			const code = `try { doSomething(); } catch (e) {}`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const emptyCatch = analysis.potentialBugs.filter(i => i.type === `empty-catch`);
			expect(emptyCatch.length).toBeGreaterThan(0);
		});

		it(`eval 사용을 감지해야 함`, () => {
			const code = `const result = eval('1 + 1');`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const evalUsage = analysis.potentialBugs.filter(i => i.type === `eval-usage`);
			expect(evalUsage.length).toBeGreaterThan(0);
		});

		it(`with 문 사용을 감지해야 함`, () => {
			const code = `with (obj) { console.log(prop); }`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const withStatement = analysis.potentialBugs.filter(i => i.type === `with-statement`);
			expect(withStatement.length).toBeGreaterThan(0);
		});
	});

	describe(`모던 JS 검사`, () => {
		it(`var 사용을 감지해야 함`, () => {
			const code = `var oldStyle = 'legacy';`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const varUsage = analysis.potentialBugs.filter(i => i.type === `var-usage`);
			expect(varUsage.length).toBeGreaterThan(0);
		});

		it(`let/const 사용은 경고하지 않아야 함`, () => {
			const code = `const x = 1;\nlet y = 2;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const varUsage = analysis.potentialBugs.filter(i => i.type === `var-usage`);
			expect(varUsage).toHaveLength(0);
		});
	});

	describe(`보안 검사`, () => {
		it(`innerHTML 할당을 감지해야 함`, () => {
			const code = `element.innerHTML = userInput;`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const innerHtml = analysis.potentialBugs.filter(i => i.type === `innerhtml-usage`);
			expect(innerHtml.length).toBeGreaterThan(0);
		});

		it(`document.write 사용을 감지해야 함`, () => {
			const code = `document.write('<script>alert("XSS")</script>');`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			const docWrite = analysis.potentialBugs.filter(i => i.type === `document-write`);
			expect(docWrite.length).toBeGreaterThan(0);
		});
	});

	describe(`import 분석`, () => {
		it(`import 문을 분석해야 함`, () => {
			const code = `import { useState } from 'react';`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.imports).toHaveLength(1);
			expect(analysis.imports[0].module).toBe(`react`);
		});

		it(`여러 import 문을 분석해야 함`, () => {
			const code = `
				import React from 'react';
				import { render } from 'react-dom';
			`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.imports.length).toBeGreaterThanOrEqual(2);
		});
	});

	describe(`export 분석`, () => {
		it(`export 문을 분석해야 함`, () => {
			const code = `export const foo = 'bar';`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.exports.length).toBeGreaterThan(0);
		});

		it(`export default를 분석해야 함`, () => {
			const code = `export default function App() {}`;
			const { analysis } = analyzeSourceCode(code, createDoc(code));

			expect(analysis.exports.length).toBeGreaterThan(0);
		});
	});

	describe(`processedCode 반환`, () => {
		it(`원본 코드를 반환해야 함`, () => {
			const code = `const x = 1;`;
			const { processedCode } = analyzeSourceCode(code, createDoc(code));

			expect(processedCode).toBe(code);
		});
	});

	describe(`빈 입력 처리`, () => {
		it(`빈 코드는 기본 분석 결과를 반환해야 함`, () => {
			const { analysis } = analyzeSourceCode(``, createDoc(``));

			expect(analysis.isModule).toBe(false);
			expect(analysis.hasStrictMode).toBe(false);
			expect(analysis.functions).toHaveLength(0);
			expect(analysis.variables).toHaveLength(0);
			expect(analysis.imports).toHaveLength(0);
			expect(analysis.exports).toHaveLength(0);
			expect(analysis.complexityIssues).toHaveLength(0);
			expect(analysis.potentialBugs).toHaveLength(0);
		});
	});
});
