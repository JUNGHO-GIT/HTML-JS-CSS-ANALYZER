/**
 * @file jsValidator.ts
 * @since 2025-11-26
 * @description JSHint 검증 및 진단 생성
 */

import type { FunctionInfo, JSHintError, JSHintInstance as JsHntInst, PotentialBug, SourceAnalysis as SrcAnly, VariableInfo } from "@exportLangs";
import { analyzeSourceCode, loadJSHint, loadJSHintConfig } from "@exportLangs";
import { Position, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import type { DiagnosticData, DiagnosticWithData } from "@langs/js/jsType";
import { calculateErrorRange, calculateSeverity } from "@langs/js/jsUtils";

// CONSTANTS ---------------------------------------------------------------------------------------
const ERROR_SEVERITY_TYPES = new Set([`eval-usage`, `with-statement`, `assignment-in-condition`, `innerhtml-usage`, `document-write`]);
const WARN_SEVERITY_TYPES = new Set([`empty-catch`]);
const MAX_FN_PARAMS = 6;
const MODULE_EXTS = [`.mjs`, `.cjs`];
const MIN_ES_VERSION = 6;
let jsHintCache: JsHntInst | null | undefined;

// HELPERS ----------------------------------------------------------------------------------------
// 외부 설정값 boundary 검증: esversion 이 유효 숫자가 아니면 최소 버전으로 폴백
const normalizeEsVersion = (value: unknown): number => {
  const num = typeof value === `number` ? value : Number(value);
  return Number.isFinite(num) ? num : MIN_ES_VERSION;
};

// -------------------------------------------------------------------------------------------------
const severityForBug = (type: string): vscode.DiagnosticSeverity => {
  if (ERROR_SEVERITY_TYPES.has(type)) {
    return vscode.DiagnosticSeverity.Error;
  }
  if (WARN_SEVERITY_TYPES.has(type)) {
    return vscode.DiagnosticSeverity.Warning;
  }
  return vscode.DiagnosticSeverity.Information;
};

// FUNCTIONS ---------------------------------------------------------------------------------------
export const getJSHint = (): JsHntInst | null => {
  if (jsHintCache === undefined) {
    jsHintCache = loadJSHint();
  }
  return jsHintCache;
};

// -------------------------------------------------------------------------------------------------
export const generateAdditionalDiagnostics = (document: vscode.TextDocument, analysis: SrcAnly): vscode.Diagnostic[] => {
  const diagnostics: vscode.Diagnostic[] = [];
  const lastLine = document.lineCount - 1;

  for (const issue of analysis.complexityIssues) {
    const line = Math.max(issue.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, lastLine)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const severity = issue.type === `deep-nesting` ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);

    diagnostic.source = `JSHint`;
    diagnostic.code = `complexity-${issue.type}`;
    const data: DiagnosticData = {
      ruleId: `complexity-${issue.type}`,
      line: issue.line,
      analysisType: `complexity`,
    };
    (diagnostic as DiagnosticWithData).data = data;

    diagnostics.push(diagnostic);
  }

  for (const bug of analysis.potentialBugs as PotentialBug[]) {
    const line = Math.max(bug.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, lastLine)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const severity = severityForBug(bug.type);
    const diagnostic = new vscode.Diagnostic(range, bug.message, severity);

    diagnostic.source = `JSHint`;
    diagnostic.code = `bug-${bug.type}`;
    const data: DiagnosticData = {
      ruleId: `bug-${bug.type}`,
      line: bug.line,
      analysisType: `potential-bug`,
    };
    (diagnostic as DiagnosticWithData).data = data;

    diagnostics.push(diagnostic);
  }

  for (const func of analysis.functions as FunctionInfo[]) {
    if (func.parameters <= MAX_FN_PARAMS) {
      continue;
    }
    const line = Math.max(func.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, lastLine)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const diagnostic = new vscode.Diagnostic(range, `Function '${func.name}' has too many parameters (${func.parameters}): consider using an object or config parameter`, vscode.DiagnosticSeverity.Information);

    diagnostic.source = `JSHint`;
    diagnostic.code = `function-too-many-params`;
    const data: DiagnosticData = {
      ruleId: `function-too-many-params`,
      line: func.line,
      analysisType: `function-complexity`,
      functionName: func.name,
      parameterCount: func.parameters,
    };
    (diagnostic as DiagnosticWithData).data = data;

    diagnostics.push(diagnostic);
  }

  // var -> let/const 권고는 여기서만 생성 (분석기의 var-usage 와 이중 생성하지 않도록 통합)
  const varUsages = analysis.variables.filter((v: VariableInfo) => v.type === `var`);
  for (const varUsage of varUsages) {
    const line = Math.max(varUsage.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, lastLine)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const diagnostic = new vscode.Diagnostic(range, `Recommend using 'let' or 'const' instead of 'var'`, vscode.DiagnosticSeverity.Information);

    diagnostic.source = `JSHint`;
    diagnostic.code = `prefer-let-const`;
    const data: DiagnosticData = {
      ruleId: `prefer-let-const`,
      line: varUsage.line,
      analysisType: `code-style`,
      variableName: varUsage.name,
      currentType: `var`,
    };
    (diagnostic as DiagnosticWithData).data = data;

    diagnostics.push(diagnostic);
  }

  if (!analysis.hasStrictMode && !analysis.isModule) {
    const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `Recommend using 'use strict' directive`, vscode.DiagnosticSeverity.Information);

    diagnostic.source = `JSHint`;
    diagnostic.code = `missing-strict-mode`;
    const data: DiagnosticData = {
      ruleId: `missing-strict-mode`,
      line: 1,
      analysisType: `best-practice`,
    };
    (diagnostic as DiagnosticWithData).data = data;

    diagnostics.push(diagnostic);
  }

  return diagnostics;
};

// -------------------------------------------------------------------------------------------------
export const runJSHint = (document: vscode.TextDocument): vscode.Diagnostic[] => {
  const jsHint = getJSHint();

  if (!jsHint) {
    logger(`warn`, `module not loaded - JSHint is optional`);
    return [];
  }
  try {
    logger(`debug`, `starting analysis for: ${document.fileName} (languageId: ${document.languageId})`);

    const config = { ...loadJSHintConfig(document.uri.fsPath) };
    const fileName = document.fileName.toLowerCase();
    const sourceText = document.getText();
    const isModule = MODULE_EXTS.some((ext) => fileName.endsWith(ext)) || sourceText.includes(`import `) || sourceText.includes(`export `);

    if (isModule) {
      config.module = true;
      config.esversion = Math.max(normalizeEsVersion(config.esversion), MIN_ES_VERSION);
    }
    const { processedCode: procdCd, analysis } = analyzeSourceCode(sourceText, document);

    logger(`debug`, `analysis started: ${document.fileName}`);

    const isValid = jsHint.JSHINT(procdCd, config);
    if (isValid) {
      logger(`debug`, `analysis completed: no errors (${document.fileName})`);
      return [];
    }
    type JSHintDataMethod = () => { errors?: Array<JSHintError | null | undefined> };
    const instanceData = jsHint as JsHntInst & { data?: JSHintDataMethod };
    const functionData = jsHint.JSHINT as unknown as { data?: JSHintDataMethod };
    const dataMethod = instanceData.data ?? functionData.data;
    if (typeof dataMethod !== `function`) {
      logger(`error`, `data() method not available in JSHint instance`);
      return [];
    }
    const result = dataMethod.call(jsHint.JSHINT || jsHint);
    const diagnostics: vscode.Diagnostic[] = [];

    if (result && Array.isArray(result.errors)) {
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;

      for (const error of result.errors) {
        if (!error || error.line === null || error.line === undefined) {
          continue;
        }
        const range = calculateErrorRange(document, error);
        const severity = calculateSeverity(error);
        const message = error.reason || `JSHint error`;
        const diagnostic = new vscode.Diagnostic(range, message, severity);

        diagnostic.source = `JSHint`;
        diagnostic.code = error.code;
        const data: DiagnosticData = {
          ruleId: error.code,
          line: error.line,
          character: error.character,
          evidence: error.evidence,
          reason: error.reason,
          originalRange: range,
        };
        (diagnostic as DiagnosticWithData).data = data;

        diagnostics.push(diagnostic);

        if (severity === vscode.DiagnosticSeverity.Error) {
          errorCount++;
        }
        else if (severity === vscode.DiagnosticSeverity.Warning) {
          warningCount++;
        }
        else {
          infoCount++;
        }
      }
      logger(`debug`, `analysis completed: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info (${document.fileName})`);
    }
    const addDiags = generateAdditionalDiagnostics(document, analysis);
    diagnostics.push(...addDiags);

    const totalIssues = diagnostics.length;
    const addIsss = addDiags.length;

    if (addIsss > 0) {
      logger(`debug`, `analysis completed: ${addIsss} code quality issues found (${document.fileName})`);
    }
    logger(`debug`, `analysis finished: total ${totalIssues} issues (${document.fileName})`);

    return diagnostics;
  }
  catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorStack = e instanceof Error ? e.stack ?? `` : ``;
    logger(`error`, `execution error: ${errorMessage} (${document.fileName})`);
    if (errorStack) {
      logger(`debug`, `stack trace: ${errorStack}`);
    }
    return [];
  }
};
