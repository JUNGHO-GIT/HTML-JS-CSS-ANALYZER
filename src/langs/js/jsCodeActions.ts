/**
 * @file jsCodeActions.ts
 * @since 2025-11-22
 * @description JS 코드 액션 및 Quick Fix 제공
 */

import { CodeAction, CodeActionKind as CdActnKnd, type Diagnostic, Position, type Range, vscode } from "@exportLibs";

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
export class JSHintCodeActionProvider implements vscode.CodeActionProvider {
  static readonly metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: [CdActnKnd.QuickFix, CdActnKnd.Source],
  };

  provideCodeActions(document: vscode.TextDocument, _range: Range | vscode.Selection, context: vscode.CodeActionContext): CodeAction[] {
    const actions: CodeAction[] = [];
    const jsHntDiags = context.diagnostics.filter((diag) => diag.source === `JSHint`);

    jsHntDiags.forEach((diagnostic) => {
      const quickFixes = this.createAdvancedQuickFixes(document, diagnostic);
      actions.push(...quickFixes);
    });

    if (jsHntDiags.length > 0) {
      const srcActn = this.createSourceActions(document, jsHntDiags);
      actions.push(...srcActn);
    }

    return actions;
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private createAdvancedQuickFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const diagDt = (diagnostic as any).data;
    const code = diagDt?.ruleId || diagnostic.code?.toString();
    const _evidence = diagDt?.evidence || ``;

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
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private createEqualityFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const lineText = document.lineAt(diagnostic.range.start.line).text;
    const eqIndex = lineText.indexOf(`==`);

    if (eqIndex >= 0 && lineText.charAt(eqIndex + 2) !== `=`) {
      const fixEquality = new CodeAction(`Change '==' to '==='`, CdActnKnd.QuickFix);
      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(new Position(diagnostic.range.start.line, eqIndex), new Position(diagnostic.range.start.line, eqIndex + 2));

      edit.replace(document.uri, range, `===`);
      fixEquality.edit = edit;
      fixEquality.diagnostics = [diagnostic];
      fixEquality.isPreferred = true;
      actions.push(fixEquality);
    }

    return actions;
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private createUnusedVariableFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const removeVar = new CodeAction(`Remove unused variable`, CdActnKnd.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    const range = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line + 1, 0));

    edit.delete(document.uri, range);
    removeVar.edit = edit;
    removeVar.diagnostics = [diagnostic];
    removeVar.isPreferred = true;
    actions.push(removeVar);

    return actions;
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private createVarToLetConstFixes(document: vscode.TextDocument, diagnostic: Diagnostic): CodeAction[] {
    const actions: CodeAction[] = [];
    const lineText = document.lineAt(diagnostic.range.start.line).text;
    const varIndex = lineText.indexOf(`var`);

    if (varIndex >= 0) {
      const toConst = new CodeAction(`Change 'var' to 'const'`, CdActnKnd.QuickFix);
      const edit1 = new vscode.WorkspaceEdit();
      const range = new vscode.Range(new Position(diagnostic.range.start.line, varIndex), new Position(diagnostic.range.start.line, varIndex + 3));

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
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private createAnalysisFixes(document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction[] {
    const actions: CodeAction[] = [];
    const lineText = document.lineAt(diagnostic.range.start.line).text;
    const bugFix = new CodeAction(`Fix ${code} issue`, CdActnKnd.QuickFix);
    const edit = new vscode.WorkspaceEdit();

    if (code === `bug-console-usage`) {
      const rmvCnsl = new CodeAction(`Remove console statement`, CdActnKnd.QuickFix);
      const edit1 = new vscode.WorkspaceEdit();
      const range = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line + 1, 0));

      edit1.delete(document.uri, range);
      rmvCnsl.edit = edit1;
      rmvCnsl.diagnostics = [diagnostic];
      rmvCnsl.isPreferred = true;
      actions.push(rmvCnsl);

      const cmtCnsl = new CodeAction(`Comment out console statement`, CdActnKnd.QuickFix);
      const edit2 = new vscode.WorkspaceEdit();
      const lineRange = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line, lineText.length));

      edit2.replace(document.uri, lineRange, `// ${lineText.trim()}`);
      cmtCnsl.edit = edit2;
      cmtCnsl.diagnostics = [diagnostic];
      actions.push(cmtCnsl);
    }
    else if (code === `bug-assignment-in-condition`) {
      const fxAssg = new CodeAction(`Change assignment to comparison operator`, CdActnKnd.QuickFix);
      const edit3 = new vscode.WorkspaceEdit();
      const newText = lineText.replaceAll(/=(?!=)/g, `===`);
      const lineRange2 = new vscode.Range(new Position(diagnostic.range.start.line, 0), new Position(diagnostic.range.start.line, lineText.length));

      edit3.replace(document.uri, lineRange2, newText);
      fxAssg.edit = edit3;
      fxAssg.diagnostics = [diagnostic];
      fxAssg.isPreferred = true;
      actions.push(fxAssg);
    }
    else {
      const insertPos = new Position(diagnostic.range.start.line, 0);
      edit.insert(document.uri, insertPos, `// FIXME: resolve ${code.replace(`bug-`, ``).replace(`-`, ` `)} issue\n`);
      bugFix.edit = edit;
      bugFix.diagnostics = [diagnostic];
      actions.push(bugFix);
    }

    return actions;
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
  private createGenericFix(document: vscode.TextDocument, diagnostic: Diagnostic, code: string): CodeAction | null {
    const action = new CodeAction(`Fix ${code}`, CdActnKnd.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    const insertPos = new Position(diagnostic.range.start.line, 0);

    edit.insert(document.uri, insertPos, `// TODO: check ${code} issue\n`);
    action.edit = edit;
    action.diagnostics = [diagnostic];

    return action;
  }
  // ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
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
