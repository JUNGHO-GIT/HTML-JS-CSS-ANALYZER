/**
 * @file notify.ts
 * @since 2025-11-21
 */

import { vscode } from "@exportLibs";

// -------------------------------------------------------------------------------------------------
const AUTO_CLOSE_MS = 1000;

// -------------------------------------------------------------------------------------------------
const fnShowProgress = async (text: string): Promise<void> => {
	await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: text,
		cancellable: false,
	},
	async (_) => {
		await new Promise((res) => setTimeout(res, AUTO_CLOSE_MS));
	});
};

// -------------------------------------------------------------------------------------------------
export const notify = (
	type: `debug` | `info` | `warn` | `error`,
	key: string,
	value: string
): void => {
	const text = `[Html-Js-Css-Analyzer] [${key}] ${value}`;
	type === `debug` || type === `info` ? (
		void fnShowProgress(text)
	) : type === `warn` ? (
		vscode.window.showWarningMessage(text, { modal: false }),
		void fnShowProgress(text)
	) : type === `error` ? (
		vscode.window.showErrorMessage(text, { modal: false }),
		void fnShowProgress(text)
	) : (
		void 0
	);
};
