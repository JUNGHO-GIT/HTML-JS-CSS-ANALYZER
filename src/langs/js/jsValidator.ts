/**
 * @file jsValidator.ts
 * @since 2025-11-26
 * @description JSHint 검증 및 진단 생성
 */

import type { ComplexityIssue as CmplIss, FunctionInfo, JSHintError, JSHintInstance as JsHntInst, PotentialBug, SourceAnalysis as SrcAnly, VariableInfo } from "@exportLangs";
import { analyzeSourceCode as anlySrcCd, loadJSHint, loadJSHintConfig as ldJsHntCfg } from "@exportLangs";
import { Position, vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { clclErrRng, clclSvrt } from "@langs/js/jsUtils";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const ERR_SVR_TYP = new Set([`eval-usage`, `with-statement`, `assignment-in-condition`, `innerhtml-usage`, `document-write`]);
const WRN_SVR_TYP = new Set([`empty-catch`, `var-usage`]);
const MX_FN_PRMS = 6;
const MOD_EXTS = [`.mjs`, `.cjs`];
let jsHintCache: JsHntInst | null | undefined;

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const getJSHint = (): JsHntInst | null => {
  if (jsHintCache === undefined) {
    jsHintCache = loadJSHint();
  }
  return jsHintCache;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const gnrtAddDiags = (document: vscode.TextDocument, analysis: SrcAnly): vscode.Diagnostic[] => {
  const diagnostics: vscode.Diagnostic[] = [];

  analysis.complexityIssues.forEach((issue: CmplIss) => {
    const line = Math.max(issue.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const severity = issue.type === `deep-nesting` ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
    const diagnostic = new vscode.Diagnostic(range, issue.message, severity);

    diagnostic.source = `JSHint`;
    diagnostic.code = `complexity-${issue.type}`;
    (diagnostic as any).data = {
      ruleId: `complexity-${issue.type}`,
      line: issue.line,
      analysisType: `complexity`,
    };

    diagnostics.push(diagnostic);
  });

  analysis.potentialBugs.forEach((bug: PotentialBug) => {
    const line = Math.max(bug.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const severity = ERR_SVR_TYP.has(bug.type) ? vscode.DiagnosticSeverity.Error : WRN_SVR_TYP.has(bug.type) ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
    const diagnostic = new vscode.Diagnostic(range, bug.message, severity);

    diagnostic.source = `JSHint`;
    diagnostic.code = `bug-${bug.type}`;
    (diagnostic as any).data = {
      ruleId: `bug-${bug.type}`,
      line: bug.line,
      analysisType: `potential-bug`,
    };

    diagnostics.push(diagnostic);
  });

  analysis.functions.forEach((func: FunctionInfo) => {
    if (func.parameters <= MX_FN_PRMS) {
      return;
    }
    const line = Math.max(func.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const diagnostic = new vscode.Diagnostic(range, `Function '${func.name}' has too many parameters (${func.parameters}): consider using an object or config parameter`, vscode.DiagnosticSeverity.Information);

    diagnostic.source = `JSHint`;
    diagnostic.code = `function-too-many-params`;
    (diagnostic as any).data = {
      ruleId: `function-too-many-params`,
      line: func.line,
      analysisType: `function-complexity`,
      functionName: func.name,
      parameterCount: func.parameters,
    };

    diagnostics.push(diagnostic);
  });

  const varUsages = analysis.variables.filter((v: VariableInfo) => v.type === `var`);
  varUsages.forEach((varUsage: VariableInfo) => {
    const line = Math.max(varUsage.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new Position(line, 0), new Position(line, lineText.length));
    const diagnostic = new vscode.Diagnostic(range, `Recommend using 'let' or 'const' instead of 'var'`, vscode.DiagnosticSeverity.Information);

    diagnostic.source = `JSHint`;
    diagnostic.code = `prefer-let-const`;
    (diagnostic as any).data = {
      ruleId: `prefer-let-const`,
      line: varUsage.line,
      analysisType: `code-style`,
      variableName: varUsage.name,
      currentType: `var`,
    };

    diagnostics.push(diagnostic);
  });

  if (!analysis.hasStrictMode && !analysis.isModule) {
    const diagnostic = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 0), `Recommend using 'use strict' directive`, vscode.DiagnosticSeverity.Information);

    diagnostic.source = `JSHint`;
    diagnostic.code = `missing-strict-mode`;
    (diagnostic as any).data = {
      ruleId: `missing-strict-mode`,
      line: 1,
      analysisType: `best-practice`,
    };

    diagnostics.push(diagnostic);
  }

  return diagnostics;
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export const runJSHint = (document: vscode.TextDocument): vscode.Diagnostic[] => {
  const jsHint = getJSHint();

  if (!jsHint) {
    logger(`warn`, `module not loaded - JSHint is optional`);
    return [];
  }
  try {
    logger(`debug`, `starting analysis for: ${document.fileName} (languageId: ${document.languageId})`);

    const config = { ...ldJsHntCfg(document.uri.fsPath) };
    const fileName = document.fileName.toLowerCase();
    const sourceText = document.getText();
    const isModule = MOD_EXTS.some((ext) => fileName.endsWith(ext)) || sourceText.includes(`import `) || sourceText.includes(`export `);

    if (isModule) {
      config.module = true;
      config.esversion = Math.max(config.esversion || 6, 6);
    }
    const { processedCode: procdCd, analysis } = anlySrcCd(sourceText, document);

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
        const range = clclErrRng(document, error);
        const severity = clclSvrt(error);
        const message = error.reason || `JSHint error`;
        const diagnostic = new vscode.Diagnostic(range, message, severity);

        diagnostic.source = `JSHint`;
        diagnostic.code = error.code;
        (diagnostic as any).data = {
          ruleId: error.code,
          line: error.line,
          character: error.character,
          evidence: error.evidence,
          reason: error.reason,
          originalRange: range,
        };

        diagnostics.push(diagnostic);

        severity === vscode.DiagnosticSeverity.Error ? errorCount++ : severity === vscode.DiagnosticSeverity.Warning ? warningCount++ : infoCount++;
      }
      logger(`debug`, `analysis completed: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info (${document.fileName})`);
    }
    const addDiags = gnrtAddDiags(document, analysis);
    diagnostics.push(...addDiags);

    const totalIssues = diagnostics.length;
    const addIsss = addDiags.length;

    if (addIsss > 0) {
      logger(`debug`, `analysis completed: ${addIsss} code quality issues found (${document.fileName})`);
    }
    logger(`debug`, `analysis finished: total ${totalIssues} issues (${document.fileName})`);

    return diagnostics;
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack ?? `` : ``;
    logger(`error`, `execution error: ${errorMessage} (${document.fileName})`);
    if (errorStack) {
      logger(`debug`, `stack trace: ${errorStack}`);
    }
    return [];
  }
};
