// langs/js/JsHintCore.ts (legacy shim after refactor)

export { runJsHint } from "./JsRunner";
export { jshint, loadJsHint } from "./JsLoader";
export { loadJsHintConfig } from "./JsConfig";
export { analyzeSourceCode, calculateErrorRange, calculateSeverity, generateAdditionalDiagnostics } from "./JsAnalyzer";
