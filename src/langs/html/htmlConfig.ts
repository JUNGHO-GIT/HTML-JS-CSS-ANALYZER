/**
 * @file htmlConfig.ts
 * @since 2025-11-22
 */

import { path, fs, createRequire } from "@exportLibs";
import { logger } from "@exportScripts";
import type { HtmlHintInstance } from "@exportLangs";

// -------------------------------------------------------------------------------------------------
const FALLBACK_META_URL = path.join(`/`, `index.js`);

// HTML head 태그 추출 정규식 (비탐욕적 매칭 최적화)
export const HEAD_TAG_REGEX = /<head(?:\s[^>]*)?>([\s\S]*?)<\/head>/i;

// -------------------------------------------------------------------------------------------------
export const loadHtmlHint = (): HtmlHintInstance | null => {
	let result: HtmlHintInstance | null = null;

	try {
		const requireFn = createRequire(FALLBACK_META_URL);
		const htmlhintModule = requireFn(`htmlhint`);
		result = htmlhintModule.default || htmlhintModule.HTMLHint || htmlhintModule;
	}
	catch (error: any) {
		const msg = error?.message || String(error);
		logger(`debug`, `HTMLHint`, `module not loaded (optional): ${msg}`);
		result = null;
	}

	return result;
};

// -------------------------------------------------------------------------------------------------
export const loadConfig = (filePath: string): any => {
	try {
		let base = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
		const root = path.parse(base).root;

		while (true) {
			for (const name of [ `.htmlhintrc`, `.htmlhintrc.json` ]) {
				const fullpath = path.join(base, name);

				if (fs.existsSync(fullpath)) {
					try {
						const json = fs.readFileSync(fullpath, `utf8`);
						return JSON.parse(json);
					}
					catch (e: any) {
						logger(`error`, `HTMLHint config`, `file parsing error: ${fullpath} -> ${e?.message || e}`);
						return {};
					}
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
