// assets/scripts/logger.ts

import { vscode } from "@exportLibs";

// -----------------------------------------------------------------------------------------
let outputChannel: vscode.OutputChannel | null = null;

// -----------------------------------------------------------------------------------------
export const initLogger = (): void => {
	(!outputChannel) ? (
		outputChannel = vscode.window.createOutputChannel(`Html-Js-Css-Analyzer`)
	) : (
		void 0
	);
};

// -----------------------------------------------------------------------------------------
export const logger = (
	type:
	`debug` |
	`info` |
	`warn` |
	`error`,
	key: string,
	value: string,
): void => {
	initLogger();

	const message = `[${type.toUpperCase()}] [${key}] ${value}`;

	type === `debug` && console.debug(
		`[Html-Js-Css] [${key}] ${value}`
	);
	type === `info` && console.info(
		`[Html-Js-Css] [${key}] ${value}`
	);
	type === `warn` && console.warn(
		`[Html-Js-Css] [${key}] ${value}`
	);
	type === `error` && console.error(
		`[Html-Js-Css] [${key}] ${value}`
	);

	outputChannel?.appendLine(message);
};