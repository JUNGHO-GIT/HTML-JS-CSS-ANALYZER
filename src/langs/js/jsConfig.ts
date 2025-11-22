/**
 * @file jsConfig.ts
 * @since 2025-11-22
 */

import { path, fs, createRequire, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import type { JSHintInstance } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
export const DEFAULT_JSHINT_CONFIG: Record<string, any> = {
	esversion: 2022,
	moz: false,
	bitwise: false,
	curly: true,
	eqeqeq: true,
	forin: true,
	freeze: true,
	futurehostile: true,
	immed: true,
	latedef: `nofunc`,
	newcap: true,
	noarg: true,
	noempty: false,
	nonbsp: true,
	nonew: true,
	noreturnawait: true,
	regexpu: true,
	singleGroups: false,
	undef: false,
	unused: `vars`,
	varstmt: false,

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
	shadow: `outer`,
	sub: true,
	supernew: false,
	validthis: false,
	withstmt: false,

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

	predef: [
		`console`, `process`, `Buffer`, `global`, `__dirname`, `__filename`,
		`module`, `exports`, `require`, `setTimeout`, `setInterval`,
		`clearTimeout`, `clearInterval`, `setImmediate`, `clearImmediate`,
		`Promise`, `Symbol`, `Map`, `Set`, `WeakMap`, `WeakSet`,
		`Proxy`, `Reflect`, `ArrayBuffer`, `DataView`, `Int8Array`,
		`Uint8Array`, `Uint8ClampedArray`, `Int16Array`, `Uint16Array`,
		`Int32Array`, `Uint32Array`, `Float32Array`, `Float64Array`,
		`BigInt`, `BigInt64Array`, `BigUint64Array`, `SharedArrayBuffer`,
		`Atomics`, `WebAssembly`, `URL`, `URLSearchParams`, `TextEncoder`,
		`TextDecoder`, `AbortController`, `AbortSignal`, `Event`, `EventTarget`,
		`document`, `window`, `navigator`, `location`, `history`, `screen`,
		`alert`, `confirm`, `prompt`, `XMLHttpRequest`, `fetch`, `FormData`,
		`Blob`, `File`, `FileReader`, `localStorage`, `sessionStorage`,
	],
};

// -------------------------------------------------------------------------------------------------
export const loadJSHint = (): JSHintInstance | null => {
	let result: JSHintInstance | null = null;

	const fnValidate = (mod: any): JSHintInstance | null => {
		const isValid = (
			mod?.JSHINT &&
			typeof mod.JSHINT === `function` &&
			typeof mod.JSHINT.data === `function`
		);
		return isValid ? mod : null;
	};

	const candidates: string[] = [];

	try {
		typeof __dirname === `string` ? (
			candidates.push(__dirname),
			candidates.push(path.resolve(__dirname, `..`)),
			candidates.push(path.resolve(__dirname, `..`, `..`))
		) : (
			void 0
		);
	}
	catch {}

	try {
		const extContext = vscode.extensions.getExtension(`jungho.html-js-css-analyzer`);
		const extPath = extContext?.extensionPath;
		extPath && extPath.length > 0 ? candidates.push(extPath) : void 0;
	}
	catch {}

	candidates.push(process.cwd());

	vscode.workspace.workspaceFolders && (() => {
		for (const f of vscode.workspace.workspaceFolders) {
			candidates.push(f.uri.fsPath);
		}
	})();

	for (const base of candidates) {
		result ? (
			void 0
		) : (() => {
			try {
				const req = createRequire(path.join(base, `index.js`));
				const mod = fnValidate(req(`jshint`));

				mod ? (
					result = mod
				) : (
					void 0
				);

				result ? logger(`debug`, `module loaded: ${base}`) : void 0;
			}
			catch {
				logger(`debug`, `load attempt failed: ${base}`);
			}
		})();
	}

	result ? (
		void 0
	) : (
		logger(`warn`, `module not loaded - JSHint is optional`)
	);

	return result;
};

// -------------------------------------------------------------------------------------------------
const parseConfigValue = (value: string): any => {
	const trimmed = value.trim();

	trimmed === `true` ? true :
		trimmed === `false` ? false :
			trimmed === `null` ? null :
				trimmed === `undefined` ? undefined :
					/^-?\d+$/.test(trimmed) ? parseInt(trimmed, 10) :
						/^-?\d+\.\d+$/.test(trimmed) ? parseFloat(trimmed) :
							trimmed.startsWith(`[`) && trimmed.endsWith(`]`) ? (() => {
								try {
									return JSON.parse(trimmed);
								}
								catch {
									return [];
								}
							})() :
								trimmed.startsWith(`{`) && trimmed.endsWith(`}`) ? (() => {
									try {
										return JSON.parse(trimmed);
									}
									catch {
										return {};
									}
								})() :
										(trimmed.startsWith(`"`) && trimmed.endsWith(`"`)) ||
										(trimmed.startsWith(`'`) && trimmed.endsWith(`'`)) ? trimmed.slice(1, -1) :
											trimmed;

	return trimmed;
};

// -------------------------------------------------------------------------------------------------
const parseJSHintConfigJS = (configContent: string): Record<string, any> => {
	try {
		let config: Record<string, any> = {};
		const cleanContent = configContent
			.replace(/\/\*[\s\S]*?\*\//g, ``)
			.replace(/\/\/.*$/gm, ``);

		const moduleExportsPattern = /module\.exports\s*=\s*({[\s\S]*?});?\s*(?:$|\n)/;
		const moduleExportsMatch = cleanContent.match(moduleExportsPattern);

		moduleExportsMatch && (() => {
			try {
				const objectStr = moduleExportsMatch[1];
				config = Function(`"use strict"; return (${objectStr})`)();
			}
			catch {
				try {
					config = JSON.parse(moduleExportsMatch[1]);
				}
				catch {
					logger(`error`, `JS config parsing failed - module.exports format`);
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
		logger(`error`, `JS config file parsing failed: ${error?.message || error}`);
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
		const lines = configContent.split(`\n`);

		lines.forEach(line => {
			const trimmed = line.trim();
			(!trimmed || trimmed.startsWith(`//`) || trimmed.startsWith(`#`)) ? (
				void 0
			) : (() => {
				const colonMatch = trimmed.match(/^(\w+)\s*:\s*(.+)$/);
				const equalMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
				const match = colonMatch || equalMatch;

				match && (() => {
					const key = match[1].trim();
					const value = match[2].trim().replace(/[,;]$/, ``);
					config[key] = parseConfigValue(value);
				})();
			})();
		});

		return { ...DEFAULT_JSHINT_CONFIG, ...config };
	}
	catch (error: any) {
		logger(`error`, `file parsing failed: ${error?.message || error}`);
		return DEFAULT_JSHINT_CONFIG;
	}
};

// -------------------------------------------------------------------------------------------------
export const loadJSHintConfig = (filePath: string): Record<string, any> => {
	try {
		let baseDir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
		const rootDir = path.parse(baseDir).root;

		while (true) {
			const configFiles = [ `.jshintrc`, `.jshintrc.json`, `.jshintrc.js` ];

			for (const configFile of configFiles) {
				const configPath = path.join(baseDir, configFile);

				fs.existsSync(configPath) && (() => {
					try {
						const configContent = fs.readFileSync(configPath, `utf8`);

						return configFile.endsWith(`.js`) ? (
							parseJSHintConfigJS(configContent)
						) : configFile.endsWith(`.json`) || configFile === `.jshintrc` ? (() => {
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
						logger(`error`, `file parsing error: ${configPath} -> ${parseError?.message || parseError}`);
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
		logger(`debug`, `search error: ${error?.message || error}`);
	}

	return DEFAULT_JSHINT_CONFIG;
};
