// src/utils/logger.ts

import * as vscode from "vscode";
import {type LogLevel, getLogLevel} from "../configs/setting.js";

// -------------------------------------------------------------------------------------------------
let channel: vscode.OutputChannel | null = null;
let currentLevel: LogLevel = "off";
let order: Record<LogLevel, number> = {off: 0, error: 1, info: 2, debug: 3};

// -------------------------------------------------------------------------------------------------
export const initLogger = (resource?: vscode.Uri) => {
	channel || (channel = vscode.window.createOutputChannel("Html-Js-Css-Analyzer"));
	currentLevel = getLogLevel(resource);
};

// -------------------------------------------------------------------------------------------------
export const setLogLevel = (lv: LogLevel) => {
	currentLevel = lv;
	channel && channel.appendLine(`[logger] level -> ${lv}`);
};

// -------------------------------------------------------------------------------------------------
export const log = (lv: LogLevel, msg: string) => {
	channel || (channel = vscode.window.createOutputChannel("Html-Js-Css-Analyzer"));
	currentLevel !== "off" && order[lv] <= order[currentLevel] && channel!.appendLine(`[${lv}] ${msg}`);
};

// -------------------------------------------------------------------------------------------------
export const getChannel = (): vscode.OutputChannel => {
	channel || (channel = vscode.window.createOutputChannel("Html-Js-Css-Analyzer"));
	return channel as vscode.OutputChannel;
};
