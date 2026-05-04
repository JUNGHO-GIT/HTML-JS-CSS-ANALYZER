/**
 * @file logger.ts
 * @since 2026-01-04
 * @description 출력 채널 기반 로깅 유틸리티
 */

import { vscode } from "@exportLibs";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const MAIN = `Html-Js-Css-Analyzer`;
const logLevelMap = {
  debug: 0,
  info: 1,
  hint: 2,
  warn: 3,
  error: 4,
  off: 5,
};
let outputChannel: vscode.OutputChannel | null = null;
let cachedLogLevel: number | null = null;
let configWatcher: vscode.Disposable | null = null;

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const initLogger = (context?: vscode.ExtensionContext): void => {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(MAIN);
  }
  if (!configWatcher && typeof vscode.workspace.onDidChangeConfiguration === `function`) {
    configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration || event.affectsConfiguration(MAIN)) {
        cachedLogLevel = null;
      }
    });
    context?.subscriptions.push(configWatcher);
  }
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const getLogLevel = (): number => {
  if (cachedLogLevel !== null) {
    return cachedLogLevel;
  }
  const config = vscode.workspace.getConfiguration(MAIN);
  const level = config.get<string>(`logLevel`, `info`);
  const rs = logLevelMap[level as keyof typeof logLevelMap] ?? logLevelMap.info;
  cachedLogLevel = rs;
  return rs;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const appendOutput = (levelKey: keyof typeof logLevelMap, msg: string, activeLevel: number): void => {
  outputChannel && logLevelMap[levelKey] >= activeLevel && outputChannel.appendLine(msg);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const formatLog = (text=``): string => text.trim().replaceAll(/^\s+/gm, ``);

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const logger = (type: `debug` | `info` | `hint` | `warn` | `error`, value: string): void => {
  const activeLevel = getLogLevel();
  if (logLevelMap[type] < activeLevel) {
    return;
  }
  const config = {
    line: {
      str: `―――――――――――――――――――――――――――――――――――――――--`,
      color: `\u001B[38;2;255;162;0m`,
    },
    title: {
      str: `[${MAIN}]`,
      color: `\u001B[38;2;78;201;176m`,
    },
    debug: {
      str: `[DEBUG]`,
      color: `\u001B[38;5;141m`,
    },
    info: {
      str: `[INFO]`,
      color: `\u001B[38;5;46m`,
    },
    hint: {
      str: `[HINT]`,
      color: `\u001B[38;5;39m`,
    },
    warn: {
      str: `[WARN]`,
      color: `\u001B[38;5;214m`,
    },
    error: {
      str: `[ERROR]`,
      color: `\u001B[38;5;196m`,
    },
    reset: {
      str: ``,
      color: `\u001B[0m`,
    },
  };
  const separator = `${config.reset.color}${config.line.color}${config.line.str}${config.reset.color}`;
  const title = `${config.reset.color}${config.title.color}${config.title.str}${config.reset.color}`;
  const level = `${config.reset.color}${config[type].color}${config[type].str}${config.reset.color}`;
  const logMsg = formatLog(`
  ${separator}
  ${title} ${level}
  ${value}
  `);
  const outputMsg = formatLog(`
  ${config.line.str}
  ${config[type].str} - ${value}
  `);

  switch (type) {
    case `debug`:
      console.debug(logMsg);
      appendOutput(`debug`, outputMsg, activeLevel);
      break;
    case `info`:
      console.info(logMsg);
      appendOutput(`info`, outputMsg, activeLevel);
      break;
    case `hint`:
      console.log(logMsg);
      appendOutput(`hint`, outputMsg, activeLevel);
      break;
    case `warn`:
      console.warn(logMsg);
      appendOutput(`warn`, outputMsg, activeLevel);
      break;
    case `error`:
      console.error(logMsg);
      appendOutput(`error`, outputMsg, activeLevel);
      break;
  }
};
