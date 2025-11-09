// consts/ConstsJs.ts

import { vscode } from "@exportLibs";

// 1. Number -----------------------------------------------------------------------------------------------

// 2. String -----------------------------------------------------------------------------------------------

// 3. Array ------------------------------------------------------------------------------------------------
export const jsConfig: Record<string, any> = {
  esversion: 2022,
  moz: false,
  bitwise: true,
  curly: true,
  eqeqeq: true,
  forin: true,
  freeze: true,
  futurehostile: true,
  immed: true,
  latedef: "nofunc",
  newcap: true,
  noarg: true,
  noempty: true,
  nonbsp: true,
  nonew: true,
  noreturnawait: true,
  regexpu: true,
  singleGroups: true,
  undef: true,
  unused: true,
  varstmt: false,
  camelcase: true,
  enforceall: false,
  indent: 2,
  maxcomplexity: 12,
  maxdepth: 6,
  maxlen: 120,
  maxparams: 6,
  maxstatements: 60,
  quotmark: "double",
  trailingcomma: true,
  asi: false,
  boss: false,
  debug: false,
  elision: false,
  eqnull: false,
  evil: false,
  expr: true,
  funcscope: false,
  globalstrict: false,
  iterator: false,
  lastsemic: false,
  laxbreak: false,
  laxcomma: false,
  loopfunc: false,
  multistr: false,
  noyield: false,
  plusplus: false,
  proto: false,
  scripturl: false,
  shadow: "inner",
  sub: false,
  supernew: false,
  validthis: false,
  withstmt: false,
  browser: true,
  browserify: false,
  couch: false,
  devel: false,
  dojo: false,
  jasmine: false,
  jquery: false,
  mocha: false,
  module: true,
  mootools: false,
  node: true,
  nonstandard: false,
  phantom: false,
  prototypejs: false,
  qunit: false,
  rhino: false,
  shelljs: false,
  typed: false,
  worker: false,
  wsh: false,
  yui: false,
  predef: [
    "console", "process", "Buffer", "global", "__dirname", "__filename",
    "module", "exports", "require", "setTimeout", "setInterval",
    "clearTimeout", "clearInterval", "setImmediate", "clearImmediate",
    "Promise", "Symbol", "Map", "Set", "WeakMap", "WeakSet",
    "Proxy", "Reflect", "ArrayBuffer", "DataView", "Int8Array",
    "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
    "Int32Array", "Uint32Array", "Float32Array", "Float64Array",
    "BigInt", "BigInt64Array", "BigUint64Array", "SharedArrayBuffer",
    "Atomics", "WebAssembly", "URL", "URLSearchParams", "TextEncoder",
    "TextDecoder", "AbortController", "AbortSignal", "Event", "EventTarget"
  ]
};
export const jsLanguages: vscode.DocumentSelector = [
	{language: "javascript"},
	{language: "typescript"},
	{language: "javascriptreact"},
	{language: "typescriptreact"}
];

// 4. Regex ------------------------------------------------------------------------------------------------
export const regexCompletionContext = /(?:(?:id|class|className|[.#])\s*[=:]?\s*["'`]?[^\n]*|classList\.(?:add|remove|toggle|contains|replace)\s*\([^)]*|querySelector(?:All)?\s*\(\s*["'`][^)]*|getElementById\s*\(\s*["'][^)]*)$/i;
export const templateLiteralRegex = /\$\{[^}]*\}/g;
export const classAttributeRegex = /(?:class|className)\s*[=:]\s*(["'`])((?:(?!\1).)*?)\1/gis;
export const classListMethodRegex = /classList\.(?:add|remove|toggle|contains)\s*\(([^)]+)\)/gis;
export const stringLiteralRegex = /(['"`])((?:(?!\1).)*?)\1/g;
export const innerHtmlRegex = /\.(?:innerHTML|outerHTML)\s*[=:]\s*(["'`])((?:(?!\1)[\s\S])*?)\1/gis;
export const insertAdjacentHtmlRegex = /\.insertAdjacentHTML\s*\(\s*["'`][^"'`]*["'`]\s*,\s*(["'`])((?:(?!\1)[\s\S])*?)\1\s*\)/gis;
export const templateLiteralHtmlRegex = /(?:innerHTML|outerHTML)\s*[=:]\s*`((?:[^`\\]|\\.)*?)`/gis;
export const querySelectorRegex = /querySelector(?:All)?\s*\(\s*(["'`])((?:(?!\1)[\s\S])*?)\1\s*\)/gis;
export const getElementByIdRegex = /getElementById\s*\(\s*(["'])((?:(?!\1)[^"'`])+?)\1\s*\)/gis;
export const quoteChars = ["'", '"', '`'] as const;