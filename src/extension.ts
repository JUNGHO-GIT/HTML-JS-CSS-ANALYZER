/**
 * @file extension.ts
 * @since 2025-11-22
 * @description VS Code 확장 진입점 (활성화, 프로바이더 등록)
 */

import { clearConfigurationCache as clrCfgCch } from "@exportConsts";
import { CssSupport, HtmlHintCodeActionProvider as HtmHnCdAcPr, JSHintCodeActionProvider as JsHnCdAcPr } from "@exportLangs";
import { vscode } from "@exportLibs";
import { bindCssSupport as bndCssSup, clearAll, clearValidationState as clrValSt, initLogger, logger, onClosed, scheduleValidate as schedVal, updateDiagnostics as updtDiags } from "@exportScripts";
import { AutoValidationMode as AtValMd } from "@exportTypes";

// CONSTANTS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
const HTML_LANG: vscode.DocumentSelector = [{ language: `html` }];
const JS_LANGUAGES: vscode.DocumentSelector = [{ language: `javascript` }];
const CSS_LANGS: vscode.DocumentSelector = [{ language: `html` }, { language: `css` }];

// FUNCTIONS ―――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
export const deactivate = () => {};
export const activate = (context: vscode.ExtensionContext) => {
  initLogger(context);
  logger(`info`, `Html-Js-Css-Analyzer is now active!`);
  const cssSupport = new CssSupport();
  bndCssSup(cssSupport);

  rgstPrvd(context, cssSupport);
  rgstEvtHndl(context, cssSupport);
  rgstCmds(context, cssSupport);

  const activeEditor = vscode.window.activeTextEditor;
  activeEditor && void updtDiags(cssSupport, activeEditor.document, AtValMd.ALWAYS);
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const rgstPrvd = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(CSS_LANGS, cssSupport, `.`, `#`, `"`, `'`, "`", ` `),
    vscode.languages.registerDefinitionProvider(CSS_LANGS, cssSupport),
    vscode.languages.registerCodeActionsProvider(HTML_LANG, new HtmHnCdAcPr(), {
      providedCodeActionKinds: HtmHnCdAcPr.metadata.providedCodeActionKinds,
    }),
    vscode.languages.registerCodeActionsProvider(JS_LANGUAGES, new JsHnCdAcPr(), {
      providedCodeActionKinds: JsHnCdAcPr.metadata.providedCodeActionKinds,
    }),
  );
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const rgstEvtHndl = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (savedDoc: vscode.TextDocument) => {
      await updtDiags(cssSupport, savedDoc, AtValMd.SAVE);
    }),
    vscode.workspace.onDidOpenTextDocument(async (openedDoc: vscode.TextDocument) => {
      await updtDiags(cssSupport, openedDoc, AtValMd.ALWAYS);
    }),
    vscode.workspace.onDidChangeTextDocument(async (changeEvent: vscode.TextDocumentChangeEvent) => {
      schedVal(cssSupport, changeEvent.document, AtValMd.ALWAYS);
    }),
    vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (event.affectsConfiguration(`Html-Js-Css-Analyzer`)) {
        clrCfgCch();
        clrValSt();
        cssSupport.clearWorkspaceIndex();
      }
    }),
    vscode.workspace.onDidCloseTextDocument(onClosed),
  );
};

// ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――-
const rgstCmds = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand(`Html-Js-Css-Analyzer.validate`, async (mode?: AtValMd) => {
      const editor = vscode.window.activeTextEditor;
      editor && (await updtDiags(cssSupport, editor.document, mode ?? AtValMd.FORCE));
    }),
    vscode.commands.registerCommand(`Html-Js-Css-Analyzer.clear`, clearAll),
  );
};
