// assets/scripts/notify.ts

import { vscode } from "@exportLibs";

// -----------------------------------------------------------------------------------------
export const notify = (
	type:
	`debug` |
	`info` |
	`warn` |
	`error`,
	key: string,
	value: string,
): void => {
	const text = `[Html-Js-Css] [${key}] ${value}`;
	const AUTO_CLOSE_MS = 1000;
	if (type === `debug` || type === `info`) {
		void vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: text,
			cancellable: false
		},
		async (_) => {
			await new Promise((res) => {
				setTimeout(res, AUTO_CLOSE_MS);
			});
		});
		return;
	}
	if (type === `warn`) {
		vscode.window.showWarningMessage(text, { modal: false });
		void vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: text,
			cancellable: false
		},
		async (_) => {
			await new Promise((res) => {
				setTimeout(res, AUTO_CLOSE_MS);
			});
		});
		return;
	}
	if (type === `error`) {
		vscode.window.showErrorMessage(text, { modal: false });
		void vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: text,
			cancellable: false
		},
		async (_) => {
			await new Promise((res) => {
				setTimeout(res, AUTO_CLOSE_MS);
			});
		});
		return;
	}
};
