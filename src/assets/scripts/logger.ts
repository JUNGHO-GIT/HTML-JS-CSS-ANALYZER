/**
 * @file logger.ts
 * @since 2026-01-04
 * @description 출력 채널 기반 로깅 유틸리티
 */

import { vscode } from "@exportLibs";

const LEADING_WS_RE = /^\s+/gm;
const MAIN = `Html-Js-Css-Analyzer`;
const LOG_LEVEL_MAP = {
  "off": 0,
  "debug": 10,
  "info": 20,
  "hint": 30,
  "warn": 40,
  "error": 50,
} as const;
const LOG_CONFIG = {
  "line": {
    "str": `-----------------------------------------`,
    "color": `\u001B[38;2;255;162;0m`,
  },
  "debug": {
    "str": `[D]`,
    "color": `\u001B[38;5;141m`,
  },
  "info": {
    "str": `[I]`,
    "color": `\u001B[38;5;111m`,
  },
  "hint": {
    "str": `[H]`,
    "color": `\u001B[38;5;45m`,
  },
  "warn": {
    "str": `[W]`,
    "color": `\u001B[38;5;220m`,
  },
  "error": {
    "str": `[E]`,
    "color": `\u001B[38;5;196m`,
  },
  "reset": {
    "str": ``,
    "color": `\u001B[0m`,
  },
} as const;

type LogType = Exclude<keyof typeof LOG_LEVEL_MAP, `off`>;

let outputChannel: vscode.OutputChannel | null = null;
let cachedLogLevel: number | null = null;
let configWatcher: vscode.Disposable | null = null;

// 1. Init logger ---------------------------------------------------------------
export const initLogger = (context?: vscode.ExtensionContext): void => {
  outputChannel ??= vscode.window.createOutputChannel(MAIN);

  if (!configWatcher && typeof vscode.workspace.onDidChangeConfiguration === `function`) {
    configWatcher = vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration || event.affectsConfiguration(MAIN)) {
        cachedLogLevel = null;
      }
    });
    context?.subscriptions.push(configWatcher);
  }
};

// 2. Get log level ---------------------------------------------------------------
const getLogLevel = (): number => {
  if (cachedLogLevel !== null) {
    return cachedLogLevel;
  }
  const config = vscode.workspace.getConfiguration(MAIN);
  const level = config.get<string>(`logLevel`, `info`);
  const result = LOG_LEVEL_MAP[level as keyof typeof LOG_LEVEL_MAP] ?? LOG_LEVEL_MAP.info;
  cachedLogLevel = result;
  return result;
};

// 3. Should log ------------------------------------------------------------------
const shouldLog = (type: LogType): boolean => {
  const activeLevel = getLogLevel();
  return activeLevel !== LOG_LEVEL_MAP.off && LOG_LEVEL_MAP[type] >= activeLevel;
};

// 4. Format log ------------------------------------------------------------------
const formatLog = (text = ``): string => text.trim().replaceAll(LEADING_WS_RE, ``);

// 5. Append output ----------------------------------------------------------------
const appendOutput = (message: string): void => {
  outputChannel?.appendLine(message);
};

// 6. Logger ----------------------------------------------------------------------
export const logger = (type: LogType, value: string): void => {
  if (!shouldLog(type)) {
    return;
  }

  const levelConfig = LOG_CONFIG[type];
  const level = `${LOG_CONFIG.reset.color}${levelConfig.color}${levelConfig.str}${LOG_CONFIG.reset.color}`;
  const text = `${levelConfig.color}${value}${LOG_CONFIG.reset.color}`;
  const logMsg = formatLog(`
    ${level} ${text}
  `);
  const outputMsg = formatLog(`
    ${levelConfig.str} ${value}
  `);

  if (type === `debug`) {
    console.debug(logMsg);
  }
  else if (type === `info`) {
    console.info(logMsg);
  }
  else if (type === `hint`) {
    console.log(logMsg);
  }
  else if (type === `warn`) {
    console.warn(logMsg);
  }
  else if (type === `error`) {
    console.error(logMsg);
  }

  appendOutput(outputMsg);
};
