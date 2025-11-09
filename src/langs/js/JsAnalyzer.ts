// langs/js/JsAnalyzer.ts

import { vscode } from "@exportLibs";
import { logger } from "@exportScripts";
import type { JsHintErrorType, SourceAnalysisType, VariableInfoType } from "@exportTypes";

// -------------------------------------------------------------------------------------------------
export const clamp = (value: number, min: number, max: number): number => {
  return value < min ? min : value > max ? max : value;
};

// -------------------------------------------------------------------------------------------------
export const preprocessTypeScriptCode = (sourceCode: string): string => {
  let processed = sourceCode;
  processed = processed
    .replace(/(\w+):\s*[\w\[\]<>|&]+(?=\s*[,)])/g, '$1')
    .replace(/\):\s*[\w\[\]<>|&]+(?=\s*[{;])/g, ')')
    .replace(/(let|const|var)\s+(\w+):\s*[\w\[\]<>|&]+/g, '$1 $2')
    .replace(/<[\w\s,<>|&]+>/g, '')
    .replace(/\s+as\s+[\w\[\]<>|&]+/g, '')
    .replace(/interface\s+\w+\s*{[^{}]*(?:{[^{}]*}[^{}]*)*}/g, '')
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, '')
    .replace(/declare\s+(const|let|var|function|class|interface|type|namespace)\s+[^;{]+[;{][^}]*}?/g, '')
    .replace(/enum\s+\w+\s*{[^}]*}/g, '')
    .replace(/namespace\s+\w+\s*{[^}]*}/g, '')
    .replace(/export\s+type\s+[^;]+;/g, '')
    .replace(/import\s+type\s+[^;]+;/g, '');
  return processed;
};

// -------------------------------------------------------------------------------------------------
export const analyzeComplexity = (sourceCode: string, analysis: SourceAnalysisType): void => {
  const lines = sourceCode.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const indentLevel = ((lines[i].match(/^\s*/)?.[0].length || 0) / 2);
    if (indentLevel > 6) {
      analysis.complexityIssues.push({ type: 'deep-nesting', line: i + 1, message: `과도한 중첩 (${indentLevel}단계): 코드 리팩토링을 고려하세요` });
    }
    if (line.length > 120) {
      analysis.complexityIssues.push({ type: 'long-line', line: i + 1, message: `긴 줄 (${line.length}자): 가독성을 위해 줄바꿈을 고려하세요` });
    }
    const regexMatches = line.match(/\/[^\/\n]*\/[gimuy]*/g);
    if (regexMatches) {
      for (const regex of regexMatches) {
        if (regex.length > 50 || ((regex.match(/[\[\](){}|*+?]/g) || []).length > 10)) {
          analysis.complexityIssues.push({ type: 'complex-regex', line: i + 1, message: '복잡한 정규식: 가독성을 위해 분리하거나 주석을 추가하세요' });
        }
      }
    }
  }
};

// -------------------------------------------------------------------------------------------------
export const analyzePotentialBugs = (sourceCode: string, analysis: SourceAnalysisType): void => {
  const lines = sourceCode.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/if\s*\([^)]*=\s*[^=]/.test(line)) {
      analysis.potentialBugs.push({ type: 'assignment-in-condition', line: i + 1, message: '조건문에서 할당 연산자 사용: 비교 연산자(===)를 의도하셨나요?' });
    }
    if (/\w+\.\w+/.test(line) && !/null|undefined/.test(line) && !/typeof/.test(line)) {
      const objectAccess = line.match(/(\w+)\.\w+/g);
      if (objectAccess) {
        for (const access of objectAccess) {
          const varName = access.split('.')[0];
          if (!(analysis.variables as any).some((v: VariableInfoType) => v.name === varName)) {
            analysis.potentialBugs.push({ type: 'potential-null-reference', line: i + 1, message: `잠재적 null 참조: '${varName}'이 null/undefined일 수 있습니다` });
          }
        }
      }
    }
    if (/catch\s*\([^)]*\)\s*{\s*}/.test(line)) {
      analysis.potentialBugs.push({ type: 'empty-catch', line: i + 1, message: '빈 catch 블록: 오류 처리가 필요합니다' });
    }
    if (/console\.(log|debug|info)/.test(line)) {
      analysis.potentialBugs.push({ type: 'console-usage', line: i + 1, message: 'console 사용: 프로덕션 배포 전에 제거를 고려하세요' });
    }
    if (/eval\s*\(/.test(line)) {
      analysis.potentialBugs.push({ type: 'eval-usage', line: i + 1, message: 'eval 사용: 보안 위험이 있습니다' });
    }
    if (/with\s*\(/.test(line)) {
      analysis.potentialBugs.push({ type: 'with-statement', line: i + 1, message: 'with 문 사용: strict mode에서 금지되며 성능상 문제가 있습니다' });
    }
  }
};

// -------------------------------------------------------------------------------------------------
export const analyzeSourceCode = (sourceCode: string, document: vscode.TextDocument): { processedCode: string; analysis: SourceAnalysisType; } => {
  const analysis: SourceAnalysisType = { isModule: false, isTypeScript: false, hasStrictMode: false, functions: [], variables: [], imports: [], exports: [], complexityIssues: [], potentialBugs: [] };
  analysis.isTypeScript = document.fileName.endsWith('.ts') || document.fileName.endsWith('.tsx');
  analysis.isModule = sourceCode.includes('import ') || sourceCode.includes('export ') || document.fileName.endsWith('.mjs');
  analysis.hasStrictMode = sourceCode.includes('"use strict"') || sourceCode.includes("'use strict'");
  const functionMatches = sourceCode.matchAll(/function\s+(\w+)\s*\([^)]*\)\s*{/g);
  for (const match of functionMatches) {
    analysis.functions.push({ name: (match as any)[1], line: sourceCode.substring(0, (match as any).index).split('\n').length, parameters: (((match as any)[0].match(/\([^)]*\)/)?.[0] || '()').slice(1, -1).split(',').length) });
  }
  const arrowMatches = sourceCode.matchAll(/(\w+)\s*=\s*\([^)]*\)\s*=>/g);
  for (const match of arrowMatches) {
    analysis.functions.push({ name: (match as any)[1], line: sourceCode.substring(0, (match as any).index).split('\n').length, parameters: (((match as any)[0].match(/\([^)]*\)/)?.[0] || '()').slice(1, -1).split(',').length) });
  }
  const variableMatches = sourceCode.matchAll(/(let|const|var)\s+(\w+)/g);
  for (const match of variableMatches) {
    analysis.variables.push({ name: (match as any)[2], type: ((match as any)[1] as 'let'|'const'|'var'), line: sourceCode.substring(0, (match as any).index).split('\n').length });
  }
  const importMatches = sourceCode.matchAll(/import\s+.*?from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    analysis.imports.push({ module: (match as any)[1], line: sourceCode.substring(0, (match as any).index).split('\n').length });
  }
  const exportMatches = sourceCode.matchAll(/export\s+(.*?)(?=\n|$)/g);
  for (const match of exportMatches) {
    analysis.exports.push({ declaration: (match as any)[1], line: sourceCode.substring(0, (match as any).index).split('\n').length });
  }
  analyzeComplexity(sourceCode, analysis);
  analyzePotentialBugs(sourceCode, analysis);
  let processedCode = sourceCode;
  if (analysis.isTypeScript) processedCode = preprocessTypeScriptCode(sourceCode);
  return { processedCode, analysis };
};

// -------------------------------------------------------------------------------------------------
export const calculateErrorRange = (document: vscode.TextDocument, error: JsHintErrorType): vscode.Range => {
  const lineNumber = Math.max((error.line || 1) - 1, 0);
  const columnNumber = Math.max((error.character || 1) - 1, 0);
  const safeLineNumber = clamp(lineNumber, 0, document.lineCount - 1);
  const lineText = document.lineAt(safeLineNumber).text;
  let startColumn = columnNumber;
  let endColumn = columnNumber + 1;
  if (error.code) {
    switch (error.code) {
      case 'W033': { endColumn = (lineText as any).trimRight().length; startColumn = Math.max(endColumn - 1, 0); break; }
      case 'W116':
      case 'W117': { const match = lineText.slice(columnNumber).match(/^\w+|^==|^!=/); if (match) { endColumn = columnNumber + match[0].length; } break; }
      case 'W030': { const expr = lineText.slice(columnNumber).match(/^[^;]+/); if (expr) { endColumn = columnNumber + expr[0].length; } break; }
      default: { const def = lineText.slice(columnNumber).match(/^\S+/); if (def) { endColumn = columnNumber + def[0].length; } }
    }
  }
  startColumn = clamp(startColumn, 0, lineText.length);
  endColumn = clamp(endColumn, startColumn + 1, lineText.length);
  return new vscode.Range(new vscode.Position(safeLineNumber, startColumn), new vscode.Position(safeLineNumber, endColumn));
};

// -------------------------------------------------------------------------------------------------
export const generateAdditionalDiagnostics = (document: vscode.TextDocument, analysis: SourceAnalysisType): vscode.Diagnostic[] => {
  const diagnostics: vscode.Diagnostic[] = [];
  for (const issue of analysis.complexityIssues) {
    const line = Math.max(issue.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lineText.length));
    const severity = issue.type === 'deep-nesting' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
    const d = new vscode.Diagnostic(range, `${issue.message}`, severity);
    d.source = "Html-Css-Js-Analyzer"; d.code = `complexity-${issue.type}`; (d as any).data = { ruleId: `complexity-${issue.type}`, line: issue.line, analysisType: 'complexity' }; diagnostics.push(d);
  }
  for (const bug of (analysis as any).potentialBugs) {
    const line = Math.max(bug.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lineText.length));
    const severity = ['eval-usage','with-statement','assignment-in-condition'].includes(bug.type) ? vscode.DiagnosticSeverity.Error : ['potential-null-reference','empty-catch'].includes(bug.type) ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
    const d = new vscode.Diagnostic(range, `${bug.message}`, severity);
    d.source = "Html-Css-Js-Analyzer"; d.code = `bug-${bug.type}`; (d as any).data = { ruleId: `bug-${bug.type}`, line: bug.line, analysisType: 'potential-bug' }; diagnostics.push(d);
  }
  for (const func of (analysis as any).functions) {
    if (func.parameters > 6) {
      const line = Math.max(func.line - 1, 0);
      const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
      const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lineText.length));
      const d = new vscode.Diagnostic(range, `함수 '${func.name}'의 매개변수가 너무 많습니다 (${func.parameters}개): 객체나 설정 매개변수 사용을 고려하세요`, vscode.DiagnosticSeverity.Information);
      d.source = "Html-Css-Js-Analyzer"; d.code = "function-too-many-params"; (d as any).data = { ruleId: "function-too-many-params", line: func.line, analysisType: 'function-complexity', functionName: func.name, parameterCount: func.parameters }; diagnostics.push(d);
    }
  }
  const varUsages = (analysis as any).variables.filter((v: VariableInfoType) => v.type === 'var');
  for (const v of varUsages) {
    const line = Math.max(v.line - 1, 0);
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, lineText.length));
    const d = new vscode.Diagnostic(range, `'var' 대신 'let' 또는 'const' 사용을 권장합니다`, vscode.DiagnosticSeverity.Information);
    d.source = "Html-Css-Js-Analyzer"; d.code = "prefer-let-const"; (d as any).data = { ruleId: "prefer-let-const", line: v.line, analysisType: 'code-style', variableName: v.name, currentType: 'var' }; diagnostics.push(d);
  }
  if (!(analysis as any).hasStrictMode && !(analysis as any).isModule) {
    const d = new vscode.Diagnostic(new vscode.Range(0,0,0,0), `'use strict' 지시문 사용을 권장합니다`, vscode.DiagnosticSeverity.Information);
    d.source = "Html-Css-Js-Analyzer"; d.code = "missing-strict-mode"; (d as any).data = { ruleId: "missing-strict-mode", line: 1, analysisType: 'best-practice' }; diagnostics.push(d);
  }
  return diagnostics;
};

// -------------------------------------------------------------------------------------------------
export const calculateSeverity = (error: JsHintErrorType): vscode.DiagnosticSeverity => {
  if (!error.code) return vscode.DiagnosticSeverity.Warning;
  const errorCodes = ['E001','E002','E003','E004','E005','E006','E007','E008','E009','E010'];
  if (errorCodes.some(code => (error as any).code.startsWith(code))) return vscode.DiagnosticSeverity.Error;
  const warningCodes = ['W033','W116','W117','W098','W097'];
  if (warningCodes.includes((error as any).code)) return vscode.DiagnosticSeverity.Warning;
  return vscode.DiagnosticSeverity.Information;
};
