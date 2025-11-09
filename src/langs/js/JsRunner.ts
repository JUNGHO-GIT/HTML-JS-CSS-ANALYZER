// langs/js/JsRunner.ts

import { vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import { loadJsHintConfig } from "./JsConfig";
import { jshint } from "./JsLoader";
import { analyzeSourceCode, calculateErrorRange, calculateSeverity, generateAdditionalDiagnostics } from "./JsAnalyzer";

// -------------------------------------------------------------------------------------------------
export const runJsHint = (document: vscode.TextDocument): vscode.Diagnostic[] => {
  if (!jshint) {
    logger(`debug`, `JsHint`, `not loaded`);
    return [];
  }
  try {
    const config = { ...loadJsHintConfig(document.uri.fsPath) };
    const isTypeScript = document.fileName.endsWith('.ts') || document.fileName.endsWith('.tsx');
    const isModule = document.fileName.endsWith('.mjs') || document.getText().includes('import ') || document.getText().includes('export ');
    if (isTypeScript) { config.esversion = 2022; config.module = true; config.predef = [...(config.predef || []), 'TypeScript','namespace','interface','type']; }
    if (isModule) { config.module = true; config.esversion = Math.max(config.esversion || 6, 6); }
    const originalCode = document.getText();
    const { processedCode, analysis } = analyzeSourceCode(originalCode, document);
    logger(`debug`, `JsHint`, `analysis started: ${document.fileName}`);
    const isValid = (jshint as any).JsHINT(processedCode, config);
    if (isValid) { logger(`info`, `JsHint`, `analysis completed: no errors (${document.fileName})`); return []; }
    const result = (jshint as any).data();
    const diagnostics: vscode.Diagnostic[] = [];
    if (result && result.errors) {
      let errorCount = 0; let warningCount = 0; let infoCount = 0;
      for (const error of result.errors) {
        if (!error || error.line === null || error.line === undefined) continue;
        const range = calculateErrorRange(document, error);
        const severity = calculateSeverity(error);
        const message = `${(error as any).reason || 'JsHint 오류'}`;
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = "Html-Css-Js-Analyzer"; diagnostic.code = (error as any).code;
        (diagnostic as any).data = { ruleId: (error as any).code, line: (error as any).line, character: (error as any).character, evidence: (error as any).evidence, reason: (error as any).reason, originalRange: range };
        diagnostics.push(diagnostic);
        switch (severity) { case vscode.DiagnosticSeverity.Error: errorCount++; break; case vscode.DiagnosticSeverity.Warning: warningCount++; break; default: infoCount++; }
      }
      logger(`info`, `JsHint`, `analysis: ${errorCount} errors, ${warningCount} warnings, ${infoCount} info (${document.fileName})`);
    }
    const additionalDiagnostics = generateAdditionalDiagnostics(document, analysis);
    diagnostics.push(...additionalDiagnostics);
    const totalIssues = diagnostics.length; const additionalIssues = additionalDiagnostics.length;
    additionalIssues > 0 && logger(`info`, `JsHint`, `additional analysis: ${additionalIssues} issues (${document.fileName})`);
    logger(`info`, `JsHint`, `complete: total ${totalIssues} issues (${document.fileName})`);
    return diagnostics;
  }
  catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger(`error`, `JsHint`, `execution error: ${errorMessage} (${document.fileName})`);
    return [];
  }
};
