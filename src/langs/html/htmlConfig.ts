/**
 * @file htmlConfig.ts
 * @since 2025-11-22
 * @description HTMLHint 모듈 로드 및 설정 파일 로드
 */

import { path, fs, createRequire, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import type { HtmlHintInstance } from "@langs/html/htmlType";

// -------------------------------------------------------------------------------------------------
const getBaseUrl = (): string => {
	try {
		const ext = vscode.extensions.getExtension(`jungho.html-js-css-analyzer`);
		const extPath = ext?.extensionPath;
		if (typeof extPath === `string` && extPath.length > 0) {
			return path.join(extPath, `out`, `index.js`);
		}
	}
	catch {}

	try {
		if (typeof __dirname === `string` && __dirname.length > 0) {
			return path.join(__dirname, `index.js`);
		}
	}
	catch {}

	return path.join(process.cwd(), `index.js`);
};

// -------------------------------------------------------------------------------------------------
export const loadHtmlHint = (): HtmlHintInstance | null => {
	let result: HtmlHintInstance | null = null;

	const fnValidate = (mod: unknown): HtmlHintInstance | null => {
		const m = mod as ({ default?: { verify?: unknown }; HTMLHint?: { verify?: unknown }; verify?: unknown } | undefined);
		const raw = (m?.default ?? m?.HTMLHint ?? m) as { verify?: unknown } | undefined;
		return raw && typeof raw.verify === `function` ? raw as HtmlHintInstance : null;
	};

	try {
		const primaryUrl = getBaseUrl();
		const primaryReq = createRequire(primaryUrl);
		const primaryMod = fnValidate(primaryReq(`htmlhint`));
		if (primaryMod) {
			result = primaryMod;
			logger(`debug`, `module loaded successfully (primary: ${primaryUrl})`);
		}
		else {
			logger(`warn`, `primary validation failed`);
		}
	}
	catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger(`debug`, `primary load failed -> ${msg}`);
	}

	!result ? (() => {
		const arr: string[] = [];
		try {
			const ext = vscode.extensions.getExtension(`jungho.html-js-css-analyzer`);
			const extPath = ext?.extensionPath;
			typeof extPath === `string` && extPath.length > 0 && arr.push(extPath);
		}
		catch {}
		try {
			typeof __dirname === `string` && __dirname.length > 0 && (
				arr.push(__dirname),
				arr.push(path.resolve(__dirname, `..`)),
				arr.push(path.resolve(__dirname, `..`, `..`))
			);
		}
		catch {}
		arr.push(process.cwd());
		const folders = vscode.workspace.workspaceFolders;
		folders && (() => {
			for (const f of folders) {
				arr.push(f.uri.fsPath);
			}
		})();

		for (const base of arr) {
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
	})() : void 0;

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
