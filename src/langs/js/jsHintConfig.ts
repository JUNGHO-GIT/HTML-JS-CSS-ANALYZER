// src/langs/js/jsHintConfig.ts

import { path, fs, createRequire } from "@exportLibs";
import { logger } from "@exportScripts";
import type { JSHintInstance } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
const FALLBACK_META_URL = path.join("/", "index.js");

// -------------------------------------------------------------------------------------------------
export const DEFAULT_JSHINT_CONFIG: Record<string, any> = {
	// ES 버전 및 문법
	esversion: 2022,
	moz: false,

	// 엄격한 문법 검사
	bitwise: false,
	curly: true,
	eqeqeq: true,
	forin: true,
	freeze: true,
	futurehostile: true,
	immed: true,
	latedef: "nofunc",
	newcap: true,
	noarg: true,
	noempty: false,
	nonbsp: true,
	nonew: true,
	noreturnawait: true,
	regexpu: true,
	singleGroups: false,
	undef: false,
	unused: "vars",
	varstmt: false,

	// 코드 스타일
	camelcase: false,
	enforceall: false,
	indent: 2,
	maxcomplexity: 20,
	maxdepth: 8,
	maxlen: 200,
	maxparams: 8,
	maxstatements: 100,
	quotmark: false,
	trailingcomma: false,

	// 완화 옵션
	asi: false,
	boss: true,
	debug: false,
	elision: true,
	eqnull: false,
	evil: false,
	expr: true,
	funcscope: false,
	globalstrict: false,
	iterator: false,
	lastsemic: false,
	laxbreak: true,
	laxcomma: false,
	loopfunc: true,
	multistr: false,
	noyield: false,
	plusplus: false,
	proto: false,
	scripturl: false,
	shadow: "outer",
	sub: true,
	supernew: false,
	validthis: false,
	withstmt: false,

	// 환경 설정
	browser: true,
	browserify: false,
	couch: false,
	devel: true,
	dojo: false,
	jasmine: false,
	jquery: true,
	mocha: false,
	module: true,
	mootools: false,
	node: true,
	nonstandard: false,
	phantom: false,
	prototypejs: false,
	qunit: false,
	rhino: false,
	shelljs: false,
	typed: true,
	worker: false,
	wsh: false,
	yui: false,

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
		"TextDecoder", "AbortController", "AbortSignal", "Event", "EventTarget",
		"document", "window", "navigator", "location", "history", "screen",
		"alert", "confirm", "prompt", "XMLHttpRequest", "fetch", "FormData",
		"Blob", "File", "FileReader", "localStorage", "sessionStorage"
	]
};

// -------------------------------------------------------------------------------------------------
export const loadJSHint = (): JSHintInstance | null => {
	try {
		const metaUrl = (import.meta as any)?.url || FALLBACK_META_URL;
		const requireFn = createRequire(metaUrl);
		const jsHinthintModule = requireFn("jshint");

		const isValid = (
			jsHinthintModule &&
			jsHinthintModule.JSHINT &&
			typeof jsHinthintModule.JSHINT === "function" &&
			typeof jsHinthintModule.JSHINT.data === "function"
		);

		isValid ? (
			logger(`debug`, `JSHint`, `module loaded successfully`)
		) : (
			logger(`warn`, `JSHint`, `module loaded but JSHINT.data not available`)
		);

		return isValid ? jsHinthintModule : null;
	}
	catch (error: any) {
		const errorMessage = error?.message || String(error);
		logger(`debug`, `JSHint`, `not loaded (optional): ${errorMessage}`);
		return null;
	}
};

// -------------------------------------------------------------------------------------------------
const parseConfigValue = (value: string): any => {
	const trimmed = value.trim();

	trimmed === 'true' ? true :
	trimmed === 'false' ? false :
	trimmed === 'null' ? null :
	trimmed === 'undefined' ? undefined :
	/^-?\d+$/.test(trimmed) ? parseInt(trimmed, 10) :
	/^-?\d+\.\d+$/.test(trimmed) ? parseFloat(trimmed) :
	trimmed.startsWith('[') && trimmed.endsWith(']') ? (() => {
		try {
			return JSON.parse(trimmed);
		}
		catch {
			return [];
		}
	})() :
	trimmed.startsWith('{') && trimmed.endsWith('}') ? (() => {
		try {
			return JSON.parse(trimmed);
		}
		catch {
			return {};
		}
	})() :
	(trimmed.startsWith('"') && trimmed.endsWith('"')) ||
	(trimmed.startsWith("'") && trimmed.endsWith("'")) ? trimmed.slice(1, -1) :
	trimmed;

	return trimmed;
};

// -------------------------------------------------------------------------------------------------
const parseJSHintConfigJS = (configContent: string): Record<string, any> => {
	try {
		let config: Record<string, any> = {};
		let cleanContent = configContent
			.replace(/\/\*[\s\S]*?\*\//g, '')
			.replace(/\/\/.*$/gm, '');

		const moduleExportsPattern = /module\.exports\s*=\s*({[\s\S]*?});?\s*(?:$|\n)/;
		const moduleExportsMatch = cleanContent.match(moduleExportsPattern);

		moduleExportsMatch && (() => {
			try {
				const objectStr = moduleExportsMatch[1];
				config = Function('"use strict"; return (' + objectStr + ')')();
			}
			catch {
				try {
					config = JSON.parse(moduleExportsMatch[1]);
				}
				catch {
					logger(`error`, `JSHint`, `JS config parsing failed - module.exports format`);
				}
			}
		})();

		const exportPatterns = cleanContent.match(/exports\.(\w+)\s*=\s*([^;\n,}]+)/g);
		exportPatterns && exportPatterns.forEach(pattern => {
			const match = pattern.match(/exports\.(\w+)\s*=\s*([^;\n,}]+)/);
			match && (() => {
				const key = match[1].trim();
				const value = match[2].trim();
				config[key] = parseConfigValue(value);
			})();
		});

		return { ...DEFAULT_JSHINT_CONFIG, ...config };
	}
	catch (error: any) {
		logger(`error`, `JSHint`, `JS config file parsing failed: ${error?.message || error}`);
		return DEFAULT_JSHINT_CONFIG;
	}
};

// -------------------------------------------------------------------------------------------------
const parseJSHintConfigGeneric = (configContent: string): Record<string, any> => {
	try {
		try {
			return JSON.parse(configContent);
		}
		catch {}

		const config: Record<string, any> = {};
		const lines = configContent.split('\n');

		lines.forEach(line => {
			const trimmed = line.trim();
			(!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) ? (
				void 0
			) : (() => {
				const colonMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
				const equalMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
				const match = colonMatch || equalMatch;

				match && (() => {
					const key = match[1].trim();
					const value = match[2].trim().replace(/[,;]$/, '');
					config[key] = parseConfigValue(value);
				})();
			})();
		});

		return { ...DEFAULT_JSHINT_CONFIG, ...config };
	}
	catch (error: any) {
		logger(`error`, `Generic config`, `file parsing failed: ${error?.message || error}`);
		return DEFAULT_JSHINT_CONFIG;
	}
};

// -------------------------------------------------------------------------------------------------
export const loadJSHintConfig = (filePath: string): Record<string, any> => {
	try {
		let baseDir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
		const rootDir = path.parse(baseDir).root;

		while (true) {
			const configFiles = [".jshintrc", ".jshintrc.json", ".jshintrc.js"];

			for (const configFile of configFiles) {
				const configPath = path.join(baseDir, configFile);

				fs.existsSync(configPath) && (() => {
					try {
						const configContent = fs.readFileSync(configPath, "utf8");

						return configFile.endsWith('.js') ? (
							parseJSHintConfigJS(configContent)
						) : configFile.endsWith('.json') || configFile === '.jshintrc' ? (() => {
							try {
								return JSON.parse(configContent);
							}
							catch {
								return parseJSHintConfigGeneric(configContent);
							}
						})() : (
							parseJSHintConfigGeneric(configContent)
						);
					}
					catch (parseError: any) {
						logger(`error`, `JSHint config`, `file parsing error: ${configPath} -> ${parseError?.message || parseError}`);
						return DEFAULT_JSHINT_CONFIG;
					}
				})();
			}

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
		logger(`debug`, `JSHint config`, `search error: ${error?.message || error}`);
	}

	return DEFAULT_JSHINT_CONFIG;
};
