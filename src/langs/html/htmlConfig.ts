/**
 * @file htmlConfig.ts
 * @since 2025-11-22
 */

import { path, fs, createRequire } from "@exportLibs";
import { logger } from "@exportScripts";
import type { HtmlHintInstance } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
const FALLBACK_META_URL = typeof __filename === `string` ? __filename : path.join(process.cwd(), `index.js`);

// HTML head 태그 추출 정규식 (비탐욕적 매칭 최적화)
export const HEAD_TAG_REGEX = /<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i;

// -------------------------------------------------------------------------------------------------
export const loadHtmlHint = (): HtmlHintInstance | null => {
	let result: HtmlHintInstance | null = null;

	const fnValidate = (mod: unknown): HtmlHintInstance | null => {
		const m = mod as ({ default?: { verify?: unknown }; HTMLHint?: { verify?: unknown }; verify?: unknown } | undefined);
		const raw = (m?.default ?? m?.HTMLHint ?? m) as { verify?: unknown } | undefined;
		return raw && typeof raw.verify === `function` ? raw as HtmlHintInstance : null;
	};

	try {
		const primaryReq = createRequire(FALLBACK_META_URL);
		result = fnValidate(primaryReq(`htmlhint`));
		if (result) {
			logger(`debug`, `module loaded successfully (primary)`);
		}
		else {
			logger(`warn`, `primary load succeeded but validation failed`);
		}
	}
	catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger(`debug`, `primary load failed: ${msg}`);
	}

	if (!result) {
		const dirs: string[] = (() => {
			const arr: string[] = [];
			try {
				arr.push(path.resolve(__dirname, `..`, `..`));
			}
			catch {}
			arr.push(process.cwd());
			return arr;
		})();
		for (const base of dirs) {
			if (result) {
				break;
			}
			try {
				const req = createRequire(path.join(base, `index.js`));
				const mod = fnValidate(req(`htmlhint`));
				if (mod) {
					result = mod;
					logger(`debug`, `module loaded successfully (fallback: ${base})`);
				}
				else {
					logger(`warn`, `fallback validation failed: ${base}`);
				}
			}
			catch (e: unknown) {
				const msg = e instanceof Error ? e.message : String(e);
				logger(`debug`, `fallback load failed: ${base} -> ${msg}`);
			}
		}
	}

	if (!result) {
		logger(`warn`, `module not loaded - HTMLHint is optional; install with 'npm install htmlhint' or ensure packaging includes dependency`);
	}

	return result;
};

// -------------------------------------------------------------------------------------------------
export const loadConfig = (filePath: string): Record<string, unknown> => {
	try {
		let base = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
		const root = path.parse(base).root;

		while (base !== root) {
			for (const name of [ `.htmlhintrc`, `.htmlhintrc.json` ]) {
				const fullpath = path.join(base, name);

				if (!fs.existsSync(fullpath)) {
					continue;
				}
				const json = fs.readFileSync(fullpath, `utf8`);
				try {
					return JSON.parse(json) as Record<string, unknown>;
				}
				catch (e: unknown) {
					const msg = e instanceof Error ? e.message : String(e);
					logger(`error`, `file parsing error: ${fullpath} -> ${msg}`);
					return {};
				}
			}

			if (base === root) {
				break;
			}

			const parent = path.dirname(base);
			if (parent === base) {
				break;
			}

			base = parent;
		}
	}
	catch {
		// ignore
	}

	return {};
};

// -------------------------------------------------------------------------------------------------
export const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : value > max ? max : value;
};
