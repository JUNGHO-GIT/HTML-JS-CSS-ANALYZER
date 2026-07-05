/**
 * @file jsCodeActions.ts
 * @since 2025-11-22
 * @description JS 코드 액션 및 Quick Fix 제공
 */

import { CodeAction, CodeActionKind as CdActnKnd, type Diagnostic, Position, type Range, vscode } from "@exportLibs";
import type { DiagnosticWithData } from "@langs/js/jsType";

// HELPERS ----------------------------------------------------------------------------------------
// 단일 '=' 앞에 올 수 없는(복합/비교 연산자를 구성하는) 문자 집합
const OPS_BEFORE_EQ = new Set([`=`, `!`, `<`, `>`, `+`, `-`, `*`, `/`, `%`, `&`, `|`, `^`, `~`]);

// 라인에서 대입 연산자(단일 '=')의 위치를 탐색. '==', '<=', '+=', '=>' 등은 제외
const findAssignOp = (text: string): number => {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== `=`) {
      continue;
    }
    const prev = i > 0 ? text[i - 1] : ``;
    const next = i + 1 < text.length ? text[i + 1] : ``;
    if (next === `=` || next === `>`) {
      continue;
    }
    if (OPS_BEFORE_EQ.has(prev)) {
      continue;
    }
    return i;
  }
  return -1;
};

// -------------------------------------------------------------------------------------------------
type EqualityFix = { index: number; source: string; target: string; label: string };

// 느슨한 동등 연산자('==' 또는 '!=')를 탐색. '===', '!==' 는 건너뛴다
const findLooseEq = (text: string, from: number): EqualityFix | null => {
  const start = Math.max(from, 0);
  for (let i = start; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2);
    const prev = i > 0 ? text[i - 1] : ``;
    const after = i + 2 < text.length ? text[i + 2] : ``;

    if (two === `==`) {
      if (prev === `=` || prev === `!` || prev === `<` || prev === `>` || after === `=`) {
        continue;
      }
      return { index: i, source: `==`, target: `===`, label: `Change '==' to '==='` };
    }
    if (two === `!=`) {
      if (after === `=`) {
        continue;
      }
      return { index: i, source: `!=`, target: `!==`, label: `Change '!=' to '!=='` };
    }
  }
  return null;
};

// -------------------------------------------------------------------------------------------------
export class JSHintCodeActionProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [CdActnKnd.QuickFix, CdActnKnd.Source],
  };

  provideCodeActions(document: vscode.TextDocument, _range: Range | vscode.Selection, context: vscode.CodeActionContext): CodeAction[] {
    const actions: CodeAction[] = [];
    const jsHntDiags = context.diagnostics.filter((diag) => diag.source === `JSHint`);

    for (const diagnostic of jsHntDiags) {
      const quickFixes = this.createAdvancedQuickFixes(document, diagnostic);
      actions.push(...quickFixes);
    }

    if (jsHntDiags.length > 0) {
      const srcActn = this.createSourceActions(document, jsHntDiags);
      actions.push(...srcActn);
    }

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createAdvancedQuickFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const diagDt = (diagnostic as DiagnosticWithData).data;
    const code = diagDt?.ruleId || diagnostic.code?.toString();

    if (!code) {
      return actions;
    }
    if (code === `W033`) {
      actions.push(...this.createSemicolonFixes(document, diagnostic));
    }
    else if (code === `W116`) {
      actions.push(...this.createEqualityFixes(document, diagnostic));
    }
    else if (code === `W117`) {
      actions.push(...this.createUndefinedVariableFixes(document, diagnostic));
    }
    else if (code === `W098`) {
      actions.push(...this.createUnusedVariableFixes(document, diagnostic));
    }
    else if (code === `prefer-let-const`) {
      actions.push(...this.createVarToLetConstFixes(document, diagnostic));
    }
    else if (code === `missing-strict-mode`) {
      actions.push(...this.createStrictModeFixes(document, diagnostic));
    }
    else if (code.startsWith(`complexity-`) || code.startsWith(`bug-`)) {
      actions.push(...this.createAnalysisFixes(document, diagnostic, code));
    }
    else {
      const genericFix = this.createGenericFix(document, diagnostic, code);
      if (genericFix) {
        actions.push(genericFix);
      }
    }

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createSemicolonFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const line = diagnostic.range.end.line;
    const lineText = document.lineAt(line).text;
    const addSemicolon = new CodeAction(`Add semicolon`, CdActnKnd.QuickFix);
    const edit1 = new vscode.WorkspaceEdit();
    const endOfLine = new Position(line, lineText.trimEnd().length);

    edit1.insert(document.uri, endOfLine, `;`);
    addSemicolon.edit = edit1;
    addSemicolon.diagnostics = [diagnostic];
    addSemicolon.isPreferred = true;
    actions.push(addSemicolon);

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createEqualityFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const line = diagnostic.range.start.line;
    const lineText = document.lineAt(line).text;
    const eqFix = findLooseEq(lineText, diagnostic.range.start.character);

    if (eqFix) {
      const fix = new CodeAction(eqFix.label, CdActnKnd.QuickFix);
      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(new Position(line, eqFix.index), new Position(line, eqFix.index + eqFix.source.length));

      edit.replace(document.uri, range, eqFix.target);
      fix.edit = edit;
      fix.diagnostics = [diagnostic];
      fix.isPreferred = true;
      actions.push(fix);
    }

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createUndefinedVariableFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const addComment = new CodeAction(`Mark with comment`, CdActnKnd.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    const insertPos = new Position(diagnostic.range.start.line, 0);

    edit.insert(document.uri, insertPos, `// TODO: define or import variable\n`);
    addComment.edit = edit;
    addComment.diagnostics = [diagnostic];
    actions.push(addComment);

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createUnusedVariableFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const line = diagnostic.range.start.line;
    const trimmed = document.lineAt(line).text.trim();
    const soleDeclRe = /^(?:var|let|const)\s+[A-Za-z_$][\w$]*\s*(?:=[^;]*)?;?$/;

    // 라인에 단일 선언만 있을 때에만 안전하게 제거 (같은 줄의 다른 코드/파라미터 손상 방지)
    if (soleDeclRe.test(trimmed)) {
      const removeVar = new CodeAction(`Remove unused variable`, CdActnKnd.QuickFix);
      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(new Position(line, 0), new Position(line + 1, 0));

      edit.delete(document.uri, range);
      removeVar.edit = edit;
      removeVar.diagnostics = [diagnostic];
      removeVar.isPreferred = false;
      actions.push(removeVar);
    }

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createVarToLetConstFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const line = diagnostic.range.start.line;
    const lineText = document.lineAt(line).text;
    const varMatch = /\bvar\b/.exec(lineText);

    // 단어경계로 실제 'var' 키워드만 치환 ('variable' 등 식별자 손상 방지)
    if (varMatch) {
      const varIndex = varMatch.index;
      const range = new vscode.Range(new Position(line, varIndex), new Position(line, varIndex + 3));

      const toConst = new CodeAction(`Change 'var' to 'const'`, CdActnKnd.QuickFix);
      const edit1 = new vscode.WorkspaceEdit();
      edit1.replace(document.uri, range, `const`);
      toConst.edit = edit1;
      toConst.diagnostics = [diagnostic];
      toConst.isPreferred = true;
      actions.push(toConst);

      const toLet = new CodeAction(`Change 'var' to 'let'`, CdActnKnd.QuickFix);
      const edit2 = new vscode.WorkspaceEdit();
      edit2.replace(document.uri, range, `let`);
      toLet.edit = edit2;
      toLet.diagnostics = [diagnostic];
      actions.push(toLet);
    }

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createStrictModeFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const addStrict = new CodeAction(`Add 'use strict' at file start`, CdActnKnd.QuickFix);
    const edit = new vscode.WorkspaceEdit();

    edit.insert(document.uri, new Position(0, 0), `'use strict';\n\n`);
    addStrict.edit = edit;
    addStrict.diagnostics = [diagnostic];
    addStrict.isPreferred = true;
    actions.push(addStrict);

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createAnalysisFixes(document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction[] {
    const actions: CodeAction[] = [];
    const line = diagnostic.range.start.line;
    const lineText = document.lineAt(line).text;

    if (code === `bug-assignment-in-condition`) {
      // 진단 라인에서 단일 '=' 만 정밀 치환 (라인 전체 replaceAll 로 '<=', '+=', '=>' 손상 방지)
      const eqIndex = findAssignOp(lineText);
      if (eqIndex >= 0) {
        const fxAssg = new CodeAction(`Change assignment to comparison operator`, CdActnKnd.QuickFix);
        const edit = new vscode.WorkspaceEdit();
        const range = new vscode.Range(new Position(line, eqIndex), new Position(line, eqIndex + 1));

        edit.replace(document.uri, range, `===`);
        fxAssg.edit = edit;
        fxAssg.diagnostics = [diagnostic];
        // 의미가 바뀔 수 있는 변경이므로 자동 선호 fix 로 지정하지 않음
        fxAssg.isPreferred = false;
        actions.push(fxAssg);
      }
      return actions;
    }

    // 그 외 분석 진단: 비파괴적 FIXME 주석 삽입
    const label = code.replace(`bug-`, ``).replace(`complexity-`, ``).replaceAll(`-`, ` `);
    const bugFix = new CodeAction(`Fix ${code} issue`, CdActnKnd.QuickFix);
    const edit = new vscode.WorkspaceEdit();

    edit.insert(document.uri, new Position(line, 0), `// FIXME: resolve ${label} issue\n`);
    bugFix.edit = edit;
    bugFix.diagnostics = [diagnostic];
    actions.push(bugFix);

    return actions;
  }
  // -------------------------------------------------------------------------------------------------
  private createGenericFix(document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction | null {
    const action = new CodeAction(`Fix ${code}`, CdActnKnd.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    const insertPos = new Position(diagnostic.range.start.line, 0);

    edit.insert(document.uri, insertPos, `// TODO: check ${code} issue\n`);
    action.edit = edit;
    action.diagnostics = [diagnostic];

    return action;
  }
  // -------------------------------------------------------------------------------------------------
  private createSourceActions(_document: vscode.TextDocument, _diagnostics: Diagnostic[]): CodeAction[] {
    const actions: CodeAction[] = [];
    const orgnImpr = new CodeAction(`Attempt to fix all JSHint issues`, CdActnKnd.Source);

    orgnImpr.command = {
      title: `Fix JSHint issues`,
      command: `Html-Js-Css-Analyzer.fixAll`,
    };

    actions.push(orgnImpr);

    return actions;
  }
}
