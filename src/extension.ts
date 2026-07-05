/**
 * @file extension.ts
 * @since 2025-11-22
 * @description VS Code 확장 진입점 (활성화, 프로바이더 등록)
 */

import { clearConfigurationCache } from "@exportConsts";
import { CssSupport, HtmlHintCodeActionProvider, JSHintCodeActionProvider } from "@exportLangs";
import { vscode } from "@exportLibs";
import { bindCssSupport, clearAll, clearValidationState, disposeAll, initLogger, logger, onClosed, scheduleValidate, updateDiagnostics } from "@exportScripts";
import { AutoValidationMode } from "@exportTypes";

// CONSTANTS ---------------------------------------------------------------------------------------
const HTML_LANG: vscode.DocumentSelector = [{ language: `html` }];
const JS_LANGUAGES: vscode.DocumentSelector = [{ language: `javascript` }];
const CSS_LANGS: vscode.DocumentSelector = [{ language: `html` }, { language: `css` }];

// FUNCTIONS ---------------------------------------------------------------------------------------
export const deactivate = (): void => {
  disposeAll();
};

// -------------------------------------------------------------------------------------------------
export const activate = (context: vscode.ExtensionContext): void => {
  initLogger(context);
  logger(`info`, `Html-Js-Css-Analyzer is now active!`);
  const cssSupport = new CssSupport();
  bindCssSupport(cssSupport);

  registerProviders(context, cssSupport);
  registerEventHandlers(context, cssSupport);
  registerCommands(context, cssSupport);
  context.subscriptions.push({ dispose: disposeAll });

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    void updateDiagnostics(cssSupport, activeEditor.document, AutoValidationMode.ALWAYS);
  }
};

// -------------------------------------------------------------------------------------------------
const registerProviders = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(CSS_LANGS, cssSupport, `.`, `#`, `"`, `'`, "`", ` `),
    vscode.languages.registerDefinitionProvider(CSS_LANGS, cssSupport),
    vscode.languages.registerCodeActionsProvider(HTML_LANG, new HtmlHintCodeActionProvider(), {
      providedCodeActionKinds: HtmlHintCodeActionProvider.metadata.providedCodeActionKinds,
    }),
    vscode.languages.registerCodeActionsProvider(JS_LANGUAGES, new JSHintCodeActionProvider(), {
      providedCodeActionKinds: JSHintCodeActionProvider.metadata.providedCodeActionKinds,
    }),
  );
};

// -------------------------------------------------------------------------------------------------
const registerEventHandlers = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (savedDoc: vscode.TextDocument) => {
      await updateDiagnostics(cssSupport, savedDoc, AutoValidationMode.SAVE);
    }),
    vscode.workspace.onDidOpenTextDocument(async (openedDoc: vscode.TextDocument) => {
      await updateDiagnostics(cssSupport, openedDoc, AutoValidationMode.ALWAYS);
    }),
    vscode.workspace.onDidChangeTextDocument((changeEvent: vscode.TextDocumentChangeEvent) => {
      scheduleValidate(cssSupport, changeEvent.document, AutoValidationMode.ALWAYS);
    }),
    vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
      if (!event.affectsConfiguration(`Html-Js-Css-Analyzer`)) {
        return;
      }
      clearConfigurationCache();
      clearValidationState();
      cssSupport.clearWorkspaceIndex();
      for (const editor of vscode.window.visibleTextEditors) {
        void updateDiagnostics(cssSupport, editor.document, AutoValidationMode.FORCE);
      }
    }),
    vscode.workspace.onDidCloseTextDocument(onClosed),
  );
};

// -------------------------------------------------------------------------------------------------
const registerCommands = (context: vscode.ExtensionContext, cssSupport: CssSupport): void => {
  context.subscriptions.push(
    vscode.commands.registerCommand(`Html-Js-Css-Analyzer.validate`, async (mode?: AutoValidationMode) => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await updateDiagnostics(cssSupport, editor.document, mode ?? AutoValidationMode.FORCE);
      }
    }),
    vscode.commands.registerCommand(`Html-Js-Css-Analyzer.clear`, clearAll),
  );
};
