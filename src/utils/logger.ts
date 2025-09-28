// src/utils/logger.ts

import * as vscode from "vscode";
import {type LogLevel, getLogLevel} from "../configs/setting.js";

// -------------------------------------------------------------------------------------------------
const CHANNEL_NAME = "Html-Js-Css-Analyzer";
const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
	off: 0,
	error: 1,
	info: 2,
	debug: 3
};

// -------------------------------------------------------------------------------------------------
let channel: vscode.OutputChannel | null = null;
let currentLevel: LogLevel = "off";

// -------------------------------------------------------------------------------------------------
const ensureChannel = (): vscode.OutputChannel => {
	channel = channel || vscode.window.createOutputChannel(CHANNEL_NAME);
	return channel;
};

// -------------------------------------------------------------------------------------------------
export const initLogger = (resource?: vscode.Uri): void => {
	ensureChannel();
	currentLevel = getLogLevel(resource);
};

// -------------------------------------------------------------------------------------------------
export const setLogLevel = (level: LogLevel): void => {
	currentLevel = level;
	const outputChannel = ensureChannel();
	outputChannel.appendLine(`[logger] level -> ${level}`);
};

// -------------------------------------------------------------------------------------------------
export const log = (level: LogLevel, message: string): void => {
	const outputChannel = ensureChannel();
	const shouldLog = currentLevel !== "off" && LOG_LEVEL_ORDER[level] <= LOG_LEVEL_ORDER[currentLevel];

	shouldLog && outputChannel.appendLine(`[${level}] ${message}`);
};

// -------------------------------------------------------------------------------------------------
export const getChannel = (): vscode.OutputChannel => {
	return ensureChannel();
};
