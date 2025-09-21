// src/utils/logger.ts

import * as vscode from "vscode";
import {type LogLevel, getLogLevel} from "../configs/setting.js";

// -------------------------------------------------------------------------------------------------
let channel: vscode.OutputChannel | null = null;
let currentLevel: LogLevel = "off";
let order: Record<LogLevel, number> = {off: 0, error: 1, info: 2, debug: 3};

// -------------------------------------------------------------------------------------------------
export const initLogger = (resource?: vscode.Uri) => {
	if (!channel) {
		channel = vscode.window.createOutputChannel("Html-Js-Css-Analyzer");
	}
	currentLevel = getLogLevel(resource);
};

// -------------------------------------------------------------------------------------------------
export const setLogLevel = (lv: LogLevel) => {
	currentLevel = lv;
	if (channel) {
		channel.appendLine(`[logger] level -> ${lv}`);
	}
};

// -------------------------------------------------------------------------------------------------
export const log = (lv: LogLevel, msg: string) => {
	if (!channel) {
		channel = vscode.window.createOutputChannel("Html-Js-Css-Analyzer");
	}
	if (currentLevel === "off") {
		return;
	}
	if (order[lv] <= order[currentLevel]) {
		channel.appendLine(`[${lv}] ${msg}`);
	}
};

// -------------------------------------------------------------------------------------------------
export const getChannel = (): vscode.OutputChannel => {
	if (!channel) {
		channel = vscode.window.createOutputChannel("Html-Js-Css-Analyzer");
	}
	return channel;
};
