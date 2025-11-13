// src/langs/js/jsHint.ts

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {createRequire} from "module";
import {log} from "../../utils/logger.js";
import {CodeAction, CodeActionKind, Diagnostic, Position, Range} from "vscode";

// -------------------------------------------------------------------------------------------------
interface JSHintError {
	line: number;
	character: number;
	reason: string;
	evidence: string;
	code: string;
	scope: string;
}

interface JSHintResult {
	errors: JSHintError[];
	functions: any[];
	globals: any[];
	unused: any[];
}

interface JSHintInstance {
	JSHINT(source: string, options?: Record<string, any>, globals?: Record<string, any>): boolean;
	data(): JSHintResult;
}

// -------------------------------------------------------------------------------------------------
const FALLBACK_META_URL = path.join("/", "index.js");
const DEFAULT_JSHINT_CONFIG: Record<string, any> = {
	// ES 버전 및 문법
	esversion: 2022,        // ES2022 지원
	moz: false,             // Mozilla 확장 비활성화

	// 엄격한 문법 검사
	bitwise: true,          // 비트 연산자 사용 금지
	curly: true,            // 중괄호 필수
	eqeqeq: true,          // === 와 !== 사용 강제
	forin: true,            // for-in 루프에서 hasOwnProperty 체크 필수
	freeze: true,           // 네이티브 프로토타입 확장 금지
	futurehostile: true,    // 미래 예약어 사용 금지
	immed: true,            // 즉시 실행 함수 괄호 필수
	latedef: "nofunc",      // 함수 제외한 변수 사용 전 정의 필수
	newcap: true,           // 생성자 함수는 대문자로 시작
	noarg: true,            // arguments.caller, arguments.callee 사용 금지
	noempty: true,          // 빈 블록 금지
	nonbsp: true,           // 비표준 공백 문자 금지
	nonew: true,            // new 연산자 결과를 변수에 할당하지 않으면 경고
	noreturnawait: true,    // 불필요한 return await 금지
	regexpu: true,          // 정규식 u 플래그 검사
	singleGroups: true,     // 불필요한 그룹화 금지
	undef: true,            // 정의되지 않은 변수 사용 금지
	unused: true,           // 사용되지 않는 변수 경고
	varstmt: false,         // var 문 사용 허용 (let/const 권장하지만 허용)

	// 코드 스타일
	camelcase: true,        // camelCase 명명 규칙
	enforceall: false,      // 모든 옵션 강제하지 않음
	indent: 2,              // 들여쓰기 2칸
	maxcomplexity: 12,      // 최대 순환 복잡도 12
	maxdepth: 6,            // 최대 중첩 깊이 6단계
	maxlen: 120,            // 최대 줄 길이 120자
	maxparams: 6,           // 최대 매개변수 개수 6개
	maxstatements: 60,      // 함수 내 최대 구문 수 60개
	quotmark: "double",     // 일관된 따옴표 사용 (double)
	trailingcomma: true,    // 후행 쉼표 허용

	// 완화 옵션
	asi: false,             // 자동 세미콜론 삽입 금지
	boss: false,            // 할당문을 조건문에서 사용 금지
	debug: false,           // debugger 문 사용 금지
	elision: false,         // 배열 구멍 허용하지 않음
	eqnull: false,          // == null 사용 금지
	evil: false,            // eval 사용 금지
	expr: true,             // 표현식 문 허용
	funcscope: false,       // 함수 스코프 변수 접근 금지
	globalstrict: false,    // 전역 strict mode 금지
	iterator: false,        // __iterator__ 사용 금지
	lastsemic: false,       // 마지막 세미콜론 생략 금지
	laxbreak: false,        // 안전하지 않은 줄바꿈 금지
	laxcomma: false,        // 쉼표 앞 줄바꿈 금지
	loopfunc: false,        // 루프 내 함수 선언 금지
	multistr: false,        // 멀티라인 문자열 금지
	noyield: false,         // yield 없는 제너레이터 허용하지 않음
	plusplus: false,        // ++ 및 -- 연산자 허용
	proto: false,           // __proto__ 사용 금지
	scripturl: false,       // javascript: URL 사용 금지
	shadow: "inner",        // 내부 스코프에서 섀도잉 허용
	sub: false,             // [] 표기법 대신 점 표기법 권장
	supernew: false,        // 이상한 생성자 사용 금지
	validthis: false,       // strict mode에서 this 사용 제한
	withstmt: false,        // with 문 사용 금지

	// 환경 설정
	browser: true,          // 브라우저 환경
	browserify: false,      // Browserify 환경
	couch: false,           // CouchDB 환경
	devel: false,           // 개발용 전역변수 (console 등)
	dojo: false,            // Dojo 라이브러리
	jasmine: false,         // Jasmine 테스트 프레임워크
	jquery: false,          // jQuery 라이브러리
	mocha: false,           // Mocha 테스트 프레임워크
	module: true,           // ES6 모듈
	mootools: false,        // MooTools 라이브러리
	node: true,             // Node.js 환경
	nonstandard: false,     // 비표준 전역변수
	phantom: false,         // PhantomJS 환경
	prototypejs: false,     // Prototype.js 라이브러리
	qunit: false,           // QUnit 테스트 프레임워크
	rhino: false,           // Rhino 환경
	shelljs: false,         // ShellJS 환경
	typed: false,           // Typed Array 환경
	worker: false,          // Web Worker 환경
	wsh: false,             // Windows Script Host 환경
	yui: false,             // YUI 라이브러리

	// 전역 변수
	predef: [
		"console", "process", "Buffer", "global", "__dirname", "__filename",
		"module", "exports", "require", "setTimeout", "setInterval",
		"clearTimeout", "clearInterval", "setImmediate", "clearImmediate",
		"Promise", "Symbol", "Map", "Set", "WeakMap", "WeakSet",
		"Proxy", "Reflect", "ArrayBuffer", "DataView", "Int8Array",
		"Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
		"Int32Array", "Uint32Array", "Float32Array", "Float64Array",
		"BigInt", "BigInt64Array", "BigUint64Array", "SharedArrayBuffer",
		"Atomics", "WebAssembly", "URL", "URLSearchParams", "TextEncoder",
		"TextDecoder", "AbortController", "AbortSignal", "Event", "EventTarget"
	]
};

// -------------------------------------------------------------------------------------------------
const loadJSHint = (): JSHintInstance | null => {
	try {
		const metaUrl = (import.meta as any)?.url || FALLBACK_META_URL;
		const requireFn = createRequire(metaUrl);
		const jshintModule = requireFn("jshint");

		return jshintModule.JSHINT ? jshintModule : null;
	}
	catch (error: any) {
		const errorMessage = error?.message || String(error);
		log("debug", `jshint not loaded (optional): ${errorMessage}`);
		return null;
	}
};

// -------------------------------------------------------------------------------------------------
const jshint: JSHintInstance | null = loadJSHint();

// -------------------------------------------------------------------------------------------------
const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : value > max ? max : value;
};

/**
 * JSHint JS 설정 파일 파싱 (정교한 구현)
 */
const parseJSHintConfigJS = (configContent: string): Record<string, any> => {
	try {
		let config: Record<string, any> = {};

		// 주석 제거 (/* */ 와 // 스타일)
		let cleanContent = configContent
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*$/gm, '');

		// module.exports = {...} 패턴 추출
		const moduleExportsPattern = /module\.exports\s*=\s*({[\s\S]*?});?\s*(?:$|\n)/;
		const moduleExportsMatch = cleanContent.match(moduleExportsPattern);

		if (moduleExportsMatch) {
			try {
				// Function 생성자를 사용한 안전한 실행
				const objectStr = moduleExportsMatch[1];
				config = Function('"use strict"; return (' + objectStr + ')')();
			} catch {
				// JSON.parse로 재시도
				try {
					config = JSON.parse(moduleExportsMatch[1]);
				} catch {
					log("error", "JSHint JS config parsing failed - module.exports format");
				}
			}
		}

		// exports.property = value 패턴들 추출
		const exportPatterns = cleanContent.match(/exports\.(\w+)\s*=\s*([^;\n,}]+)/g);
		if (exportPatterns) {
			for (const pattern of exportPatterns) {
				const match = pattern.match(/exports\.(\w+)\s*=\s*([^;\n,}]+)/);
				if (match) {
					const key = match[1].trim();
					let value: any = match[2].trim();

					// 값 타입 정교한 변환
					config[key] = parseConfigValue(value);
				}
			}
		}

		return { ...DEFAULT_JSHINT_CONFIG, ...config };

	} catch (error: any) {
		log("error", `JSHint JS config file parsing failed: ${error?.message || error}`);
		return DEFAULT_JSHINT_CONFIG;
	}
};

/**
 * 설정 값 타입 정교한 변환
 */
const parseConfigValue = (value: string): any => {
	const trimmed = value.trim();

	// Boolean 값
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;

	// null, undefined
	if (trimmed === 'null') return null;
	if (trimmed === 'undefined') return undefined;

	// 숫자 (정수)
	if (/^-?\d+$/.test(trimmed)) {
		return parseInt(trimmed, 10);
	}

	// 숫자 (소수)
	if (/^-?\d+\.\d+$/.test(trimmed)) {
		return parseFloat(trimmed);
	}

	// 배열
	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		try {
			return JSON.parse(trimmed);
		} catch {
			// 배열 파싱 실패 시 빈 배열 반환
			return [];
		}
	}

	// 객체
	if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
		try {
			return JSON.parse(trimmed);
		} catch {
			// 객체 파싱 실패 시 빈 객체 반환
			return {};
		}
	}

	// 문자열 (따옴표 제거)
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
	    (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
		return trimmed.slice(1, -1);
	}

	// 기본적으로 문자열로 처리
	return trimmed;
};

/**
 * 일반 형식 설정 파일 파싱
 */
const parseJSHintConfigGeneric = (configContent: string): Record<string, any> => {
	try {
		// JSON 형식으로 먼저 시도
		try {
			return JSON.parse(configContent);
		} catch {}

		// 키-값 쌍 추출 (key: value 또는 key = value)
		const config: Record<string, any> = {};
		const lines = configContent.split('\n');

		for (const line of lines) {
			const trimmed = line.trim();

			// 주석이나 빈 줄 건너뛰기
			if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
				continue;
			}

			// key: value 또는 key = value 패턴
			const colonMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
			const equalMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);

			const match = colonMatch || equalMatch;
			if (match) {
				const key = match[1].trim();
				const value = match[2].trim().replace(/[,;]$/, ''); // 끝의 쉼표나 세미콜론 제거

				config[key] = parseConfigValue(value);
			}
		}

		return { ...DEFAULT_JSHINT_CONFIG, ...config };

	} catch (error: any) {
		log("error", `Generic config file parsing failed: ${error?.message || error}`);
		return DEFAULT_JSHINT_CONFIG;
	}
};

// -------------------------------------------------------------------------------------------------
const loadJSHintConfig = (filePath: string): Record<string, any> => {
	try {
		let baseDir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
		const rootDir = path.parse(baseDir).root;

		while (true) {
			const configFiles = [".jshintrc", ".jshintrc.json", ".jshintrc.js"];

			for (const configFile of configFiles) {
				const configPath = path.join(baseDir, configFile);

				if (fs.existsSync(configPath)) {
					try {
						const configContent = fs.readFileSync(configPath, "utf8");

						// 정교한 파싱 로직 적용
						if (configFile.endsWith('.js')) {
							return parseJSHintConfigJS(configContent);
						} else if (configFile.endsWith('.json') || configFile === '.jshintrc') {
							try {
								return JSON.parse(configContent);
							} catch {
								// JSON 파싱 실패 시 일반 형식으로 재시도
								return parseJSHintConfigGeneric(configContent);
							}
						} else {
							return parseJSHintConfigGeneric(configContent);
						}
					}
					catch (parseError: any) {
						log("error", `JSHint config file parsing error: ${configPath} -> ${parseError?.message || parseError}`);
						return DEFAULT_JSHINT_CONFIG;
					}
				}
			}

			// 상위 디렉터리로 이동
			if (baseDir === rootDir) {
				break;
			}

			const parentDir = path.dirname(baseDir);
			if (parentDir === baseDir) {
				break;
			}

			baseDir = parentDir;
		}
	}
	catch (error: any) {
		log("debug", `JSHint config search error: ${error?.message || error}`);
	}

	return DEFAULT_JSHINT_CONFIG;
};

/**
 * 정교한 소스 코드 분석 및 전처리
 */
const analyzeSourceCode = (sourceCode: string, document: vscode.TextDocument): {
	processedCode: string;
	analysis: SourceAnalysis;
} => {
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

	// 파일 타입 분석
	analysis.isTypeScript = document.fileName.endsWith('.ts') || document.fileName.endsWith('.tsx');
	analysis.isModule = sourceCode.includes('import ') ||
	                  sourceCode.includes('export ') ||
	                  document.fileName.endsWith('.mjs');
	analysis.hasStrictMode = sourceCode.includes('"use strict"') || sourceCode.includes("'use strict'");

	// 함수 분석
	const functionMatches = sourceCode.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*{/g);
	for (const match of functionMatches) {
		analysis.functions.push({
			name: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length,
			parameters: (match[0].match(/\([^)]*\)/)?.[0] || '()').slice(1, -1).split(',').length
		});
	}

	// 화살표 함수 분석
	const arrowMatches = sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g);
	for (const match of arrowMatches) {
		analysis.functions.push({
			name: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length,
			parameters: (match[0].match(/\([^)]*\)/)?.[0] || '()').slice(1, -1).split(',').length
		});
	}

	// 변수 선언 분석
	const variableMatches = sourceCode.matchAll(/(let|const|var)\s+(\w+)/g);
	for (const match of variableMatches) {
		analysis.variables.push({
			name: match[2],
			type: match[1] as 'let' | 'const' | 'var',
			line: sourceCode.substring(0, match.index).split('\n').length
		});
	}

	// import/export 분석
	const importMatches = sourceCode.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
	for (const match of importMatches) {
		analysis.imports.push({
			module: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length
		});
	}

	const exportMatches = sourceCode.matchAll(/export\s+(.*?)(?=\n|$)/g);
	for (const match of exportMatches) {
		analysis.exports.push({
			declaration: match[1],
			line: sourceCode.substring(0, match.index).split('\n').length
		});
	}

	// 복잡도 분석
	analyzeComplexity(sourceCode, analysis);

	// 잠재적 버그 패턴 분석
	analyzePotentialBugs(sourceCode, analysis);

	// TypeScript 코드 전처리
	let processedCode = sourceCode;
	if (analysis.isTypeScript) {
		processedCode = preprocessTypeScriptCode(sourceCode);
	}

	return { processedCode, analysis };
};

/**
 * TypeScript 코드 정교한 전처리
 */
const preprocessTypeScriptCode = (sourceCode: string): string => {
	let processed = sourceCode;

	// 타입 어노테이션 정교한 제거
	processed = processed
		// 함수 매개변수 타입
		.replace(/(\w+):\s*[\w\[\]<>|&]+(?=\s*[,)])/g, '$1')
		// 함수 반환 타입
		.replace(/\):\s*[\w\[\]<>|&]+(?=\s*[{;])/g, ')')
		// 변수 타입 어노테이션
		.replace(/(let|const|var)\s+(\w+):\s*[\w\[\]<>|&]+/g, '$1 $2')
		// 제네릭 타입 매개변수
		.replace(/<[\w\s,<>|&]+>/g, '')
		// 타입 단언 (as)
		.replace(/\s+as\s+[\w\[\]<>|&]+/g, '')
		// interface 선언
		.replace(/interface\s+\w+\s*{[^{}]*(?:{[^{}]*}[^{}]*)*}/g, '')
		// type 별칭
		.replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
		// declare 선언
		.replace(/declare\s+(const|let|var|function|class|interface|type|namespace)\s+[^;{]+[;{][^}]*}?/g, '')
		// enum 선언
		.replace(/enum\s+\w+\s*{[^}]*}/g, '')
		// namespace 선언
		.replace(/namespace\s+\w+\s*{[^}]*}/g, '')
		// 옵셔널 체이닝 및 null 병합 연산자는 최신 JS에서 지원하므로 유지
		// export/import type
		.replace(/export\s+type\s+[^;]+;/g, '')
		.replace(/import\s+type\s+[^;]+;/g, '');

	return processed;
};

/**
 * 복잡도 분석
 */
const analyzeComplexity = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		// 깊은 중첩 검사
		const indentLevel = (lines[i].match(/^\s*/)?.[0].length || 0) / 2;
		if (indentLevel > 6) {
			analysis.complexityIssues.push({
				type: 'deep-nesting',
				line: i + 1,
				message: `과도한 중첩 (${indentLevel}단계): 코드 리팩토링을 고려하세요`
			});
		}

		// 긴 줄 검사
		if (line.length > 120) {
			analysis.complexityIssues.push({
				type: 'long-line',
				line: i + 1,
				message: `긴 줄 (${line.length}자): 가독성을 위해 줄바꿈을 고려하세요`
			});
		}

		// 복잡한 정규식 검사
		const regexMatches = line.match(/\/[^\/\n]*\/[gimuy]*/g);
		if (regexMatches) {
			for (const regex of regexMatches) {
				if (regex.length > 50 || (regex.match(/[\[\](){}|*+?]/g) || []).length > 10) {
					analysis.complexityIssues.push({
						type: 'complex-regex',
						line: i + 1,
						message: '복잡한 정규식: 가독성을 위해 분리하거나 주석을 추가하세요'
					});
				}
			}
		}
	}
};

/**
 * 잠재적 버그 패턴 분석
 */
const analyzePotentialBugs = (sourceCode: string, analysis: SourceAnalysis): void => {
	const lines = sourceCode.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();

		// 할당과 비교 혼동
		if (/if\s*\([^)]*=\s*[^=]/.test(line)) {
			analysis.potentialBugs.push({
				type: 'assignment-in-condition',
				line: i + 1,
				message: '조건문에서 할당 연산자 사용: 비교 연산자(===)를 의도하셨나요?'
			});
		}

		// 잠재적 null 참조
		if (/\w+\.\w+/.test(line) && !/null|undefined/.test(line) && !/typeof/.test(line)) {
			const objectAccess = line.match(/(\w+)\.\w+/g);
			if (objectAccess) {
				for (const access of objectAccess) {
					const varName = access.split('.')[0];
					if (!analysis.variables.some(v => v.name === varName)) {
						analysis.potentialBugs.push({
							type: 'potential-null-reference',
							line: i + 1,
							message: `잠재적 null 참조: '${varName}'이 null/undefined일 수 있습니다`
						});
					}
				}
			}
		}

		// 빈 catch 블록
		if (/catch\s*\([^)]*\)\s*{\s*}/.test(line)) {
			analysis.potentialBugs.push({
				type: 'empty-catch',
				line: i + 1,
				message: '빈 catch 블록: 오류 처리가 필요합니다'
			});
		}

		// console.log 남용
		if (/console\.(log|debug|info)/.test(line)) {
			analysis.potentialBugs.push({
				type: 'console-usage',
				line: i + 1,
				message: 'console 사용: 프로덕션 배포 전에 제거를 고려하세요'
			});
		}

		// eval 사용
		if (/eval\s*\(/.test(line)) {
			analysis.potentialBugs.push({
				type: 'eval-usage',
				line: i + 1,
				message: 'eval 사용: 보안 위험이 있습니다'
			});
		}

		// with 문 사용
		if (/with\s*\(/.test(line)) {
			analysis.potentialBugs.push({
				type: 'with-statement',
				line: i + 1,
				message: 'with 문 사용: strict mode에서 금지되며 성능상 문제가 있습니다'
			});
		}
	}
};

/**
 * 소스 코드 분석 결과 인터페이스
 */
interface SourceAnalysis {
	isModule: boolean;
	isTypeScript: boolean;
	hasStrictMode: boolean;
	functions: FunctionInfo[];
	variables: VariableInfo[];
	imports: ImportInfo[];
	exports: ExportInfo[];
	complexityIssues: ComplexityIssue[];
	potentialBugs: PotentialBug[];
}

interface FunctionInfo {
	name: string;
	line: number;
	parameters: number;
}

interface VariableInfo {
	name: string;
	type: 'let' | 'const' | 'var';
	line: number;
}

interface ImportInfo {
	module: string;
	line: number;
}

interface ExportInfo {
	declaration: string;
	line: number;
}

interface ComplexityIssue {
	type: 'deep-nesting' | 'long-line' | 'complex-regex';
	line: number;
	message: string;
}

interface PotentialBug {
	type: 'assignment-in-condition' | 'potential-null-reference' | 'empty-catch' | 'console-usage' | 'eval-usage' | 'with-statement';
	line: number;
	message: string;
}

/**
 * 정교한 오류 범위 계산
 */
const calculateErrorRange = (
	document: vscode.TextDocument,
	error: JSHintError
): vscode.Range => {
	const lineNumber = Math.max((error.line || 1) - 1, 0);
	const columnNumber = Math.max((error.character || 1) - 1, 0);

	// 안전한 라인 번호 계산
	const safeLineNumber = clamp(lineNumber, 0, document.lineCount - 1);
	const lineText = document.lineAt(safeLineNumber).text;

	// 오류 위치 정교하게 계산
	let startColumn = columnNumber;
	let endColumn = columnNumber + 1;

	// 특정 오류 코드에 따른 정교한 범위 계산
	if (error.code) {
		switch (error.code) {
			case 'W033': // Missing semicolon
				// 세미콜론이 누락된 경우 라인 끝으로
				endColumn = lineText.trimRight().length;
				startColumn = Math.max(endColumn - 1, 0);
				break;

			case 'W116': // Expected '===' and instead saw '=='
			case 'W117': // 'variable' is not defined
				// 식별자나 연산자 전체 범위
				const match = lineText.slice(columnNumber).match(/^\w+|^==|^!=/);
				if (match) {
					endColumn = columnNumber + match[0].length;
				}
				break;

			case 'W030': // Expected an assignment or function call
				// 전체 표현식 범위
				const exprMatch = lineText.slice(columnNumber).match(/^[^;]+/);
				if (exprMatch) {
					endColumn = columnNumber + exprMatch[0].length;
				}
				break;

			default:
				// 기본적으로 다음 공백이나 구두점까지
				const defaultMatch = lineText.slice(columnNumber).match(/^\S+/);
				if (defaultMatch) {
					endColumn = columnNumber + defaultMatch[0].length;
				}
		}
	}

	// 안전한 컬럼 범위 보장
	startColumn = clamp(startColumn, 0, lineText.length);
	endColumn = clamp(endColumn, startColumn + 1, lineText.length);

	return new vscode.Range(
		new vscode.Position(safeLineNumber, startColumn),
		new vscode.Position(safeLineNumber, endColumn)
	);
};

/**
 * 추가 진단 생성 (분석 결과 기반)
 */
const generateAdditionalDiagnostics = (
	document: vscode.TextDocument,
	analysis: SourceAnalysis
): vscode.Diagnostic[] => {
	const diagnostics: vscode.Diagnostic[] = [];

	// 복잡도 문제들
	for (const issue of analysis.complexityIssues) {
		const line = Math.max(issue.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;

		const range = new vscode.Range(
			new Position(line, 0),
			new Position(line, lineText.length)
		);

		const severity = issue.type === 'deep-nesting' ?
			vscode.DiagnosticSeverity.Warning :
			vscode.DiagnosticSeverity.Information;

		const diagnostic = new vscode.Diagnostic(
			range,
			`${issue.message}`,
			severity
		);

		diagnostic.source = "Html-Js-Css-Analyzer";
		diagnostic.code = `complexity-${issue.type}`;

		(diagnostic as any).data = {
			ruleId: `complexity-${issue.type}`,
			line: issue.line,
			analysisType: 'complexity'
		};

		diagnostics.push(diagnostic);
	}

	// 잠재적 버그들
	for (const bug of analysis.potentialBugs) {
		const line = Math.max(bug.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;

		const range = new vscode.Range(
			new Position(line, 0),
			new Position(line, lineText.length)
		);

		const severity = ['eval-usage', 'with-statement', 'assignment-in-condition'].includes(bug.type) ?
			vscode.DiagnosticSeverity.Error :
			['potential-null-reference', 'empty-catch'].includes(bug.type) ?
				vscode.DiagnosticSeverity.Warning :
				vscode.DiagnosticSeverity.Information;

		const diagnostic = new vscode.Diagnostic(
			range,
			`${bug.message}`,
			severity
		);

		diagnostic.source = "Html-Js-Css-Analyzer";
		diagnostic.code = `bug-${bug.type}`;

		(diagnostic as any).data = {
			ruleId: `bug-${bug.type}`,
			line: bug.line,
			analysisType: 'potential-bug'
		};

		diagnostics.push(diagnostic);
	}

	// 함수 복잡도 분석
	for (const func of analysis.functions) {
		if (func.parameters > 6) {
			const line = Math.max(func.line - 1, 0);
			const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;

			const range = new vscode.Range(
				new Position(line, 0),
				new Position(line, lineText.length)
			);

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
		}
	}

	// var 사용 권장 사항
	const varUsages = analysis.variables.filter(v => v.type === 'var');
	for (const varUsage of varUsages) {
		const line = Math.max(varUsage.line - 1, 0);
		const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;

		const range = new vscode.Range(
			new Position(line, 0),
			new Position(line, lineText.length)
		);

		const diagnostic = new vscode.Diagnostic(
			range,
			`'var' 대신 'let' 또는 'const' 사용을 권장합니다`,
			vscode.DiagnosticSeverity.Information
		);

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
	}

	// strict mode 권장사항
	if (!analysis.hasStrictMode && !analysis.isModule) {
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
	}

	return diagnostics;
};

/**
 * 오류 심각도 계산
 */
const calculateSeverity = (error: JSHintError): vscode.DiagnosticSeverity => {
	if (!error.code) {
		return vscode.DiagnosticSeverity.Warning;
	}

	// 심각한 오류들 (Error 레벨)
	const errorCodes = ['E001', 'E002', 'E003', 'E004', 'E005', 'E006', 'E007', 'E008', 'E009', 'E010'];
	if (errorCodes.some(code => error.code.startsWith(code))) {
		return vscode.DiagnosticSeverity.Error;
	}

	// 중요한 경고들 (Warning 레벨)
	const warningCodes = ['W033', 'W116', 'W117', 'W098', 'W097'];
	if (warningCodes.includes(error.code)) {
		return vscode.DiagnosticSeverity.Warning;
	}

	// 일반적인 정보 (Information 레벨)
	return vscode.DiagnosticSeverity.Information;
};

// -------------------------------------------------------------------------------------------------
export const runJSHint = (document: vscode.TextDocument): vscode.Diagnostic[] => {
	if (!jshint) {
		log("debug", "JSHint not loaded");
		return [];
	}

	try {
		// 정교한 설정 로드
		const config = { ...loadJSHintConfig(document.uri.fsPath) };

		// 파일 타입에 따른 설정 조정
		const isTypeScript = document.fileName.endsWith('.ts') || document.fileName.endsWith('.tsx');
		const isModule = document.fileName.endsWith('.mjs') ||
		                document.getText().includes('import ') ||
		                document.getText().includes('export ');

		if (isTypeScript) {
			// TypeScript 파일에 대한 특별 설정
			config.esversion = 2022;
			config.module = true;
			config.predef = [...(config.predef || []), 'TypeScript', 'namespace', 'interface', 'type'];
		}

		if (isModule) {
			config.module = true;
			config.esversion = Math.max(config.esversion || 6, 6);
		}

		// 정교한 소스 코드 분석 및 전처리
		const originalCode = document.getText();
		const { processedCode, analysis } = analyzeSourceCode(originalCode, document);

		log("debug", `JSHint analysis started: ${document.fileName}`);

		// JSHint 실행
		const isValid = jshint.JSHINT(processedCode, config);

		if (isValid) {
			log("info", `JSHint analysis completed: no errors (${document.fileName})`);
			return [];
		}

		const result = jshint.data();
		const diagnostics: vscode.Diagnostic[] = [];

		// JSHint 오류 처리
		if (result && result.errors) {
			let errorCount = 0;
			let warningCount = 0;
			let infoCount = 0;

			for (const error of result.errors) {
				if (!error || error.line === null || error.line === undefined) {
					continue;
				}

				// 정교한 오류 범위 계산
				const range = calculateErrorRange(document, error);

				// 심각도 계산
				const severity = calculateSeverity(error);

				// 메시지 형식 통일
				const message = `${error.reason || 'JSHint 오류'}`;

				const diagnostic = new vscode.Diagnostic(range, message, severity);

				diagnostic.source = "Html-Js-Css-Analyzer";
				diagnostic.code = error.code;

				// 추가 정보 저장 (QuickFix를 위해)
				(diagnostic as any).data = {
					ruleId: error.code,
					line: error.line,
					character: error.character,
					evidence: error.evidence,
					reason: error.reason,
					originalRange: range
				};

				diagnostics.push(diagnostic);

				// 통계 집계
				switch (severity) {
					case vscode.DiagnosticSeverity.Error:
						errorCount++;
						break;
					case vscode.DiagnosticSeverity.Warning:
						warningCount++;
						break;
					default:
						infoCount++;
				}
			}

			log("info", `JSHint analysis completed: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info (${document.fileName})`);
		}

		// 추가 정교한 분석 결과를 진단으로 변환
		const additionalDiagnostics = generateAdditionalDiagnostics(document, analysis);
		diagnostics.push(...additionalDiagnostics);

		// 최종 통계
		const totalIssues = diagnostics.length;
		const additionalIssues = additionalDiagnostics.length;

		if (additionalIssues > 0) {
			log("info", `Additional analysis completed: ${additionalIssues} code quality issues found (${document.fileName})`);
		}

		log("info", `Complete analysis finished: total ${totalIssues} issues (${document.fileName})`);

		return diagnostics;
	}
	catch (error: any) {
		const errorMessage = error?.message || String(error);
		log("error", `JSHint execution error: ${errorMessage} (${document.fileName})`);
		return [];
	}
};

// -------------------------------------------------------------------------------------------------
export class JSHintCodeActionProvider implements vscode.CodeActionProvider {
	static readonly metadata: vscode.CodeActionProviderMetadata = {
		providedCodeActionKinds: [CodeActionKind.QuickFix, CodeActionKind.Source]
	};

	provideCodeActions(
		document: vscode.TextDocument,
		range: Range | vscode.Selection,
		context: vscode.CodeActionContext
	): CodeAction[] {
		const actions: CodeAction[] = [];

		// JSHint 관련 진단만 처리
		const jshintDiagnostics = context.diagnostics.filter(
			diag => diag.source === "Html-Js-Css-Analyzer"
		);

		for (const diagnostic of jshintDiagnostics) {
			// 정교한 QuickFix 생성
			const quickFixes = this.createAdvancedQuickFixes(document, diagnostic);
			actions.push(...quickFixes);
		}

		// 소스 액션 (파일 전체 수정)
		if (jshintDiagnostics.length > 0) {
			const sourceActions = this.createSourceActions(document, jshintDiagnostics);
			actions.push(...sourceActions);
		}

		return actions;
	}

	/**
	 * 정교한 QuickFix 생성
	 */
	private createAdvancedQuickFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const diagnosticData = (diagnostic as any).data;
		const code = diagnosticData?.ruleId || diagnostic.code?.toString();
		const evidence = diagnosticData?.evidence || '';

		if (!code) {
			return actions;
		}

		// 오류 코드별 정교한 수정 방법들
		switch (code) {
			case "W033": // Missing semicolon
				actions.push(...this.createSemicolonFixes(document, diagnostic, evidence));
				break;

			case "W116": // Expected '===' and instead saw '=='
				actions.push(...this.createEqualityFixes(document, diagnostic, evidence));
				break;

			case "W117": // 'variable' is not defined
				actions.push(...this.createUndefinedVariableFixes(document, diagnostic, evidence));
				break;

			case "W030": // Expected an assignment or function call
				actions.push(...this.createAssignmentFixes(document, diagnostic, evidence));
				break;

			case "W098": // 'variable' is defined but never used
				actions.push(...this.createUnusedVariableFixes(document, diagnostic, evidence));
				break;

			case "W097": // Use the function form of "use strict"
				actions.push(...this.createStrictModeFixes(document, diagnostic, evidence));
				break;

			case "W025": // Missing name in function declaration
				actions.push(...this.createFunctionNameFixes(document, diagnostic, evidence));
				break;

			case "W004": // 'variable' was used before it was defined
				actions.push(...this.createVariableOrderFixes(document, diagnostic, evidence));
				break;

			// 추가 분석 결과에 대한 수정
			case "prefer-let-const":
				actions.push(...this.createVarToLetConstFixes(document, diagnostic));
				break;

			case "missing-strict-mode":
				actions.push(...this.createStrictModeFixes(document, diagnostic, evidence));
				break;

			case "function-too-many-params":
				actions.push(...this.createFunctionParameterFixes(document, diagnostic));
				break;

			default:
				// 복잡도 및 잠재적 버그에 대한 수정
				if (code.startsWith('complexity-') || code.startsWith('bug-')) {
					actions.push(...this.createAnalysisFixes(document, diagnostic, code));
				} else {
					// 일반적인 수정 제안
					const genericFix = this.createGenericFix(document, diagnostic, code, evidence);
					if (genericFix) {
						actions.push(genericFix);
					}
				}
		}

		return actions;
	}

	/**
	 * 세미콜론 관련 수정
	 */
	private createSemicolonFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];
		const line = diagnostic.range.end.line;
		const lineText = document.lineAt(line).text;

		// 1. 단순 세미콜론 추가
		const addSemicolon = new CodeAction(
			"세미콜론 추가",
			CodeActionKind.QuickFix
		);
		const edit1 = new vscode.WorkspaceEdit();
		const endOfLine = new Position(line, lineText.trimRight().length);
		edit1.insert(document.uri, endOfLine, ";");
		addSemicolon.edit = edit1;
		addSemicolon.diagnostics = [diagnostic];
		addSemicolon.isPreferred = true;
		actions.push(addSemicolon);

		// 2. 줄바꿈과 함께 세미콜론 추가 (필요한 경우)
		if (lineText.trimRight().length < lineText.length) {
			const addSemicolonWithNewline = new CodeAction(
				"세미콜론 추가 후 정리",
				CodeActionKind.QuickFix
			);
			const edit2 = new vscode.WorkspaceEdit();
			const range = new vscode.Range(
				new Position(line, lineText.trimRight().length),
				new Position(line, lineText.length)
			);
			edit2.replace(document.uri, range, ";");
			addSemicolonWithNewline.edit = edit2;
			addSemicolonWithNewline.diagnostics = [diagnostic];
			actions.push(addSemicolonWithNewline);
		}

		return actions;
	}

	/**
	 * 등호 연산자 관련 수정
	 */
	private createEqualityFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];

		// == 를 === 로 변경
		if (evidence.includes('==') && !evidence.includes('===')) {
			const fixEquality = new CodeAction(
				"'==' 를 '===' 로 변경",
				CodeActionKind.QuickFix
			);
			const edit = new vscode.WorkspaceEdit();
			const lineText = document.lineAt(diagnostic.range.start.line).text;
			const eqIndex = lineText.indexOf('==');

			if (eqIndex >= 0 && lineText.charAt(eqIndex + 2) !== '=') {
				const range = new vscode.Range(
					new Position(diagnostic.range.start.line, eqIndex),
					new Position(diagnostic.range.start.line, eqIndex + 2)
				);
				edit.replace(document.uri, range, "===");
				fixEquality.edit = edit;
				fixEquality.diagnostics = [diagnostic];
				fixEquality.isPreferred = true;
				actions.push(fixEquality);
			}
		}

		// != 를 !== 로 변경
		if (evidence.includes('!=') && !evidence.includes('!==')) {
			const fixInequality = new CodeAction(
				"'!=' 를 '!==' 로 변경",
				CodeActionKind.QuickFix
			);
			const edit = new vscode.WorkspaceEdit();
			const lineText = document.lineAt(diagnostic.range.start.line).text;
			const neqIndex = lineText.indexOf('!=');

			if (neqIndex >= 0 && lineText.charAt(neqIndex + 2) !== '=') {
				const range = new vscode.Range(
					new Position(diagnostic.range.start.line, neqIndex),
					new Position(diagnostic.range.start.line, neqIndex + 2)
				);
				edit.replace(document.uri, range, "!==");
				fixInequality.edit = edit;
				fixInequality.diagnostics = [diagnostic];
				fixInequality.isPreferred = true;
				actions.push(fixInequality);
			}
		}

		return actions;
	}

	/**
	 * 정의되지 않은 변수 관련 수정
	 */
	private createUndefinedVariableFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];

		// 변수명 추출
		const variableMatch = evidence.match(/['"]([^'"]+)['"] is not defined/);
		const variableName = variableMatch?.[1];

		if (variableName) {
			// 1. 변수 선언 추가
			const declareVariable = new CodeAction(
				`'${variableName}' 변수 선언 추가`,
				CodeActionKind.QuickFix
			);
			const edit1 = new vscode.WorkspaceEdit();
			const insertPos = new Position(Math.max(diagnostic.range.start.line - 1, 0), 0);
			edit1.insert(document.uri, insertPos, `let ${variableName};\n`);
			declareVariable.edit = edit1;
			declareVariable.diagnostics = [diagnostic];
			actions.push(declareVariable);

			// 2. 전역 변수로 주석 추가
			const addGlobalComment = new CodeAction(
				`'${variableName}' 전역 변수로 표시`,
				CodeActionKind.QuickFix
			);
			const edit2 = new vscode.WorkspaceEdit();
			const topPos = new Position(0, 0);
			edit2.insert(document.uri, topPos, `/* global ${variableName} */\n`);
			addGlobalComment.edit = edit2;
			addGlobalComment.diagnostics = [diagnostic];
			actions.push(addGlobalComment);
		}

		return actions;
	}

	/**
	 * 할당 또는 함수 호출 관련 수정
	 */
	private createAssignmentFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];

		// 표현식을 함수 호출로 변경
		const makeCall = new CodeAction(
			"함수 호출로 변경",
			CodeActionKind.QuickFix
		);
		const edit = new vscode.WorkspaceEdit();
		edit.replace(document.uri, diagnostic.range, evidence.trim() + "()");
		makeCall.edit = edit;
		makeCall.diagnostics = [diagnostic];
		actions.push(makeCall);

		return actions;
	}

	/**
	 * 사용되지 않는 변수 관련 수정
	 */
	private createUnusedVariableFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];

		// 변수 삭제
		const removeVariable = new CodeAction(
			"사용되지 않는 변수 제거",
			CodeActionKind.QuickFix
		);
		const edit = new vscode.WorkspaceEdit();
		const fullLine = new vscode.Range(
			new Position(diagnostic.range.start.line, 0),
			new Position(diagnostic.range.start.line + 1, 0)
		);
		edit.delete(document.uri, fullLine);
		removeVariable.edit = edit;
		removeVariable.diagnostics = [diagnostic];
		removeVariable.isPreferred = true;
		actions.push(removeVariable);

		return actions;
	}

	/**
	 * Strict mode 관련 수정
	 */
	private createStrictModeFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];

		const addStrictMode = new CodeAction(
			"함수 내부에 'use strict' 추가",
			CodeActionKind.QuickFix
		);
		const edit = new vscode.WorkspaceEdit();
		const insertPos = new Position(diagnostic.range.start.line + 1, 0);
		edit.insert(document.uri, insertPos, '\t"use strict";\n');
		addStrictMode.edit = edit;
		addStrictMode.diagnostics = [diagnostic];
		actions.push(addStrictMode);

		return actions;
	}

	/**
	 * 함수명 관련 수정
	 */
	private createFunctionNameFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];

		const addFunctionName = new CodeAction(
			"함수명 추가",
			CodeActionKind.QuickFix
		);
		const edit = new vscode.WorkspaceEdit();
		const lineText = document.lineAt(diagnostic.range.start.line).text;
		const functionIndex = lineText.indexOf('function');

		if (functionIndex >= 0) {
			const insertPos = new Position(diagnostic.range.start.line, functionIndex + 8);
			edit.insert(document.uri, insertPos, " myFunction");
			addFunctionName.edit = edit;
			addFunctionName.diagnostics = [diagnostic];
			actions.push(addFunctionName);
		}

		return actions;
	}

	/**
	 * 변수 순서 관련 수정
	 */
	private createVariableOrderFixes(document: vscode.TextDocument, diagnostic: Diagnostic, evidence: string): CodeAction[] {
		const actions: CodeAction[] = [];

		// 변수 선언을 앞으로 이동하는 것은 복잡하므로 주석으로 안내
		const addComment = new CodeAction(
			"변수 정의 순서 확인 필요",
			CodeActionKind.QuickFix
		);
		const edit = new vscode.WorkspaceEdit();
		const insertPos = new Position(diagnostic.range.start.line, 0);
		edit.insert(document.uri, insertPos, "// TODO: 변수를 사용하기 전에 정의해야 합니다\n");
		addComment.edit = edit;
		addComment.diagnostics = [diagnostic];
		actions.push(addComment);

		return actions;
	}

	/**
	 * 일반적인 수정 제안
	 */
	private createGenericFix(document: vscode.TextDocument, diagnostic: Diagnostic, code: string, evidence: string): CodeAction | null {
		const action = new CodeAction(
			`${code} 문제 해결 (수동 확인 필요)`,
			CodeActionKind.QuickFix
		);
		const edit = new vscode.WorkspaceEdit();
		const insertPos = new Position(diagnostic.range.start.line, 0);
		edit.insert(document.uri, insertPos, `// FIXME: JSHint ${code} - ${diagnostic.message}\n`);
		action.edit = edit;
		action.diagnostics = [diagnostic];
		return action;
	}

	/**
	 * 소스 액션 (파일 전체 수정)
	 */
	private createSourceActions(document: vscode.TextDocument, diagnostics: Diagnostic[]): CodeAction[] {
		const actions: CodeAction[] = [];

		// 모든 세미콜론 자동 추가
		const semicolonDiagnostics = diagnostics.filter(d =>
			(d as any).data?.ruleId === 'W033'
		);

		if (semicolonDiagnostics.length > 0) {
			const fixAllSemicolons = new CodeAction(
				`모든 세미콜론 자동 추가 (${semicolonDiagnostics.length}개)`,
				CodeActionKind.Source
			);

			const edit = new vscode.WorkspaceEdit();
			for (const diag of semicolonDiagnostics) {
				const line = diag.range.end.line;
				const lineText = document.lineAt(line).text;
				const endPos = new Position(line, lineText.trimRight().length);
				edit.insert(document.uri, endPos, ";");
			}

			fixAllSemicolons.edit = edit;
			actions.push(fixAllSemicolons);
		}

		return actions;
	}

	// -------------------------------------------------------------------------------------------------
	private createEqualityFix(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction | null {
		const action = new CodeAction("=== 사용하기", CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();

		const range = diagnostic.range;
		const text = document.getText(range);

		if (text.includes("==") && !text.includes("===")) {
			const newText = text.replace(/==/g, "===").replace(/!=/g, "!==");
			edit.replace(document.uri, range, newText);
			action.edit = edit;
			action.diagnostics = [diagnostic];

			return action;
		}

		return null;
	}

	// -------------------------------------------------------------------------------------------------
	private createUndefinedVariableFix(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction | null {
		// 간단한 var 선언 추가 제안
		const action = new CodeAction("변수 선언 추가", CodeActionKind.QuickFix);
		const edit = new vscode.WorkspaceEdit();

		const diagnosticData = (diagnostic as any).data;
		const evidence = diagnosticData?.evidence || "";

		// 간단한 패턴 매칭으로 변수명 추출 (실제로는 더 정교한 파싱 필요)
		const variableMatch = evidence.match(/['"]?(\w+)['"]?\s+is not defined/);
		if (variableMatch) {
			const variableName = variableMatch[1];
			const insertPosition = new Position(0, 0);
			edit.insert(document.uri, insertPosition, `var ${variableName};\n`);

			action.edit = edit;
			action.diagnostics = [diagnostic];

			return action;
		}

		return null;
	}

	/**
	 * var를 let/const로 변경하는 수정
	 */
	private createVarToLetConstFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];
		const lineText = document.lineAt(diagnostic.range.start.line).text;

		// let으로 변경
		if (lineText.includes('var ')) {
			const toLet = new CodeAction(
				"'var'를 'let'으로 변경",
				CodeActionKind.QuickFix
			);
			const edit1 = new vscode.WorkspaceEdit();
			const newText = lineText.replace(/\bvar\b/, 'let');
			const lineRange = new vscode.Range(
				new Position(diagnostic.range.start.line, 0),
				new Position(diagnostic.range.start.line, lineText.length)
			);
			edit1.replace(document.uri, lineRange, newText);
			toLet.edit = edit1;
			toLet.diagnostics = [diagnostic];
			toLet.isPreferred = true;
			actions.push(toLet);

			// const로 변경 (재할당이 없는 경우)
			const toConst = new CodeAction(
				"'var'를 'const'로 변경 (재할당 없음)",
				CodeActionKind.QuickFix
			);
			const edit2 = new vscode.WorkspaceEdit();
			const newTextConst = lineText.replace(/\bvar\b/, 'const');
			edit2.replace(document.uri, lineRange, newTextConst);
			toConst.edit = edit2;
			toConst.diagnostics = [diagnostic];
			actions.push(toConst);
		}

		return actions;
	}

	/**
	 * 함수 매개변수 수정
	 */
	private createFunctionParameterFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
		const actions: CodeAction[] = [];

		const suggestRefactor = new CodeAction(
			"매개변수를 객체로 리팩터링 제안",
			CodeActionKind.QuickFix
		);
		const edit = new vscode.WorkspaceEdit();
		const insertPos = new Position(diagnostic.range.start.line, 0);
		edit.insert(document.uri, insertPos, "// TODO: 매개변수를 객체로 리팩터링하여 가독성을 향상시키세요\n");
		suggestRefactor.edit = edit;
		suggestRefactor.diagnostics = [diagnostic];
		actions.push(suggestRefactor);

		return actions;
	}

	/**
	 * 분석 결과 기반 수정
	 */
	private createAnalysisFixes(document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction[] {
		const actions: CodeAction[] = [];

		if (code.startsWith('complexity-')) {
			const complexityFix = new CodeAction(
				`${code.replace('complexity-', '').replace('-', ' ')} 문제 해결 제안`,
				CodeActionKind.QuickFix
			);
			const edit = new vscode.WorkspaceEdit();
			const insertPos = new Position(diagnostic.range.start.line, 0);

			let suggestion = "";
			switch (code) {
				case 'complexity-deep-nesting':
					suggestion = "// TODO: 중첩을 줄이기 위해 함수 추출이나 early return 패턴을 고려하세요\n";
					break;
				case 'complexity-long-line':
					suggestion = "// TODO: 긴 줄을 여러 줄로 나누어 가독성을 향상시키세요\n";
					break;
				case 'complexity-complex-regex':
					suggestion = "// TODO: 복잡한 정규식을 단순화하거나 주석을 추가하세요\n";
					break;
				default:
					suggestion = `// TODO: ${code} 문제를 해결하세요\n`;
			}

			edit.insert(document.uri, insertPos, suggestion);
			complexityFix.edit = edit;
			complexityFix.diagnostics = [diagnostic];
			actions.push(complexityFix);
		}

		if (code.startsWith('bug-')) {
			const bugFix = new CodeAction(
				`잠재적 버그 수정 제안`,
				CodeActionKind.QuickFix
			);
			const edit = new vscode.WorkspaceEdit();
			const lineText = document.lineAt(diagnostic.range.start.line).text;

			switch (code) {
				case 'bug-console-usage':
					// console.log 제거
					const removeConsole = new CodeAction(
						"console 구문 제거",
						CodeActionKind.QuickFix
					);
					const edit1 = new vscode.WorkspaceEdit();
					const range = new vscode.Range(
						new Position(diagnostic.range.start.line, 0),
						new Position(diagnostic.range.start.line + 1, 0)
					);
					edit1.delete(document.uri, range);
					removeConsole.edit = edit1;
					removeConsole.diagnostics = [diagnostic];
					removeConsole.isPreferred = true;
					actions.push(removeConsole);

					// console을 주석으로 변경
					const commentConsole = new CodeAction(
						"console 구문을 주석으로 변경",
						CodeActionKind.QuickFix
					);
					const edit2 = new vscode.WorkspaceEdit();
					const lineRange = new vscode.Range(
						new Position(diagnostic.range.start.line, 0),
						new Position(diagnostic.range.start.line, lineText.length)
					);
					edit2.replace(document.uri, lineRange, `// ${lineText.trim()}`);
					commentConsole.edit = edit2;
					commentConsole.diagnostics = [diagnostic];
					actions.push(commentConsole);
					break;

				case 'bug-assignment-in-condition':
					// === 로 변경 제안
					const fixAssignment = new CodeAction(
						"할당을 비교 연산자로 변경",
						CodeActionKind.QuickFix
					);
					const edit3 = new vscode.WorkspaceEdit();
					const newText = lineText.replace(/=(?!=)/g, '===');
					const lineRange2 = new vscode.Range(
						new Position(diagnostic.range.start.line, 0),
						new Position(diagnostic.range.start.line, lineText.length)
					);
					edit3.replace(document.uri, lineRange2, newText);
					fixAssignment.edit = edit3;
					fixAssignment.diagnostics = [diagnostic];
					fixAssignment.isPreferred = true;
					actions.push(fixAssignment);
					break;

				default:
					const insertPos = new Position(diagnostic.range.start.line, 0);
					edit.insert(document.uri, insertPos, `// FIXME: ${code.replace('bug-', '').replace('-', ' ')} 문제를 해결하세요\n`);
					bugFix.edit = edit;
					bugFix.diagnostics = [diagnostic];
					actions.push(bugFix);
			}
		}

		return actions;
	}
}
