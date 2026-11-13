// Rich editor webview entrypoint.
//
// Keep this file focused on bootstrapping VS Code/CodeMirror integration. Rich
// Markdown parsing, preview widgets, settings UI, and decorations live in
// feature modules under src/rich-editor so contributors can change one area
// without learning the whole editor surface.
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { yamlFrontmatter } from "@codemirror/lang-yaml";
import { indentUnit, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import { interceptCommandKeys } from "./rich-editor/adapters/commandKeys.js";
import { diffText, textOf } from "./rich-editor/adapters/lineEditChanges.js";
import { SyncClient } from "./rich-editor/adapters/syncClient.js";
import { createVsCodeWebviewPort } from "./rich-editor/adapters/vscodeWebviewPort.js";
import { applySettingsPatch } from "./rich-editor/application/settingsUseCases.js";
import { normalizeRichEditorSettings } from "./rich-editor/domain/settingsModel.js";
import { normalizeLineEndings } from "./rich-editor/domain/textChange.js";
import {
  codeLanguages,
  markdownHighlightStyle,
} from "./rich-editor/presentation/codemirror/language.js";
import { createMarkdownCompletion } from "./rich-editor/presentation/codemirror/completions.js";
import { createGitDiffGutter } from "./rich-editor/presentation/codemirror/gitDiffGutter.js";
import { createLintDecorations } from "./rich-editor/presentation/codemirror/lintDecorations.js";
import { findLinkAtClick } from "./rich-editor/presentation/codemirror/links.js";
import { listIndentKeymap } from "./rich-editor/presentation/codemirror/listIndent.js";
import { createSlashCommandController } from "./rich-editor/presentation/codemirror/slashCommands.js";
import { createPreviewExtensions } from "./rich-editor/presentation/codemirror/previewExtensions.js";
import { createChatEditsBanner } from "./rich-editor/presentation/chatEdits/chatEditsBanner.js";
import { createFallbackEditor } from "./rich-editor/presentation/fallback/fallbackEditor.js";
import { createInlineMarkdownSupport } from "./rich-editor/presentation/markdown/inlineMarkdown.js";
import { createOutlineNavigation } from "./rich-editor/presentation/outline/outlineNavigation.js";
import {
  revealHighlightField,
  revealInEditor,
} from "./rich-editor/presentation/reveal/revealTarget.js";
import {
  createSearchExtensions,
  getSearchKeymap,
  installSearchShortcut,
} from "./rich-editor/presentation/search/searchExtensions.js";
import { createPreviewWidthResizer } from "./rich-editor/presentation/settings/previewWidthResizer.js";
import { createSettingsMenuController } from "./rich-editor/presentation/settings/settingsMenu.js";
import {
  applyPreviewWidth,
  applyTheme,
} from "./rich-editor/presentation/settings/themeController.js";
import { createEditorThemeExtension } from "./rich-editor/presentation/styles/editorTheme.js";
import { injectStyles } from "./rich-editor/presentation/styles/globalStyles.js";
import { closeTableContextMenu } from "./rich-editor/presentation/table/tablePreview.js";

const initialRuntime = readJsonScript("initial-runtime", {});
const exportMode = initialRuntime.exportMode === true;
const vscode =
  typeof acquireVsCodeApi === "function" && !exportMode
    ? acquireVsCodeApi()
    : null;
const hostPort = createVsCodeWebviewPort(vscode);
// Every other message reaches the host after the typing before it, so the host
// never acts on (formats, completes, saves) text older than what is on screen.
const vscodePort = {
  postMessage(message) {
    documentSync.flush();
    hostPort.postMessage(message);
  },
};
const root = document.querySelector("#editor");
const initialDocument = normalizeLineEndings(readJsonScript("initial-document", ""));
const initialSettings = readJsonScript("initial-settings", {});
const mermaidScriptUri = readJsonScript("mermaid-script-uri", "");
const initialGitDiffChanges = readJsonScript("initial-git-diff", []);
const exportImageMap = readJsonScript("initial-image-map", {});
const initialReveal = readJsonScript("initial-reveal", null);

let view;
let applyingExternalUpdate = false;
let settings = normalizeRichEditorSettings(initialSettings);
let latestGitDiffChanges = initialGitDiffChanges;
let latestLintDiagnostics = [];
let fallbackText = null;
const documentSync = new SyncClient({
  send: (message) => hostPort.postMessage(message),
  // The editor is created with the initial document, so the first load only
  // has to catch up when the text differs.
  reset: (text) => applyHostChanges(diffText(textOf(currentText()), text)),
  applyRemote: (changes) => applyHostChanges(changes),
});
// The page already carries the document the host had when it built the page.
// seq 0 marks it as older than any sync the host sends after `ready`.
documentSync.receive({ type: "sync", text: initialDocument, seq: 0, lastAppliedId: 0 });
const outlineNavigation = createOutlineNavigation();
const fallbackEditor = createFallbackEditor({
  root,
  onTextChange: (previousText, nextText) => {
    fallbackText = nextText;
    documentSync.localChange(diffText(textOf(previousText), nextText));
  },
});
const slashCommands = createSlashCommandController();
const chatEditsBanner = createChatEditsBanner({
  postMessage: (message) => vscodePort.postMessage(message),
});
const gitDiffGutter = createGitDiffGutter(initialGitDiffChanges);
const lintDecorations = createLintDecorations();
const settingsMenu = createSettingsMenuController({
  getSettings: () => settings,
  postMessage: (message) => vscodePort.postMessage(message),
  refreshDecorations: () => previewExtensions.refresh(view),
});
const inlineMarkdown = createInlineMarkdownSupport({
  postMessage: (message) => vscodePort.postMessage(message),
  requestEditorMeasure,
  resolveImageSource: exportMode ? resolveExportImageSource : undefined,
});
const {
  appendInlineMarkdown,
  findMarkdownImages,
  handleResolvedImage,
  ImagePreviewWidget,
  isRangeInsideRanges,
} = inlineMarkdown;
const markdownCompletion = createMarkdownCompletion({
  postMessage: (message) => vscodePort.postMessage(message),
});
const previewExtensions = createPreviewExtensions({
  appendInlineMarkdown,
  findMarkdownImages,
  ImagePreviewWidget,
  isRangeInsideRanges,
  mermaidScriptUri,
  postMessage: (message) => vscodePort.postMessage(message),
  reportError: reportRichdownError,
  requestEditorMeasure,
  getSettings: () => settings,
});


applyTheme(settings.richTheme);
applyPreviewWidth(settings.previewWidth, settings.previewWidthPixels);
injectStyles();
if (exportMode) {
  document.documentElement.dataset.richdownExport = "true";
}

function readJsonScript(id, fallback) {
  const element = document.querySelector(`#${id}`);
  if (!element) {
    return fallback;
  }
  try {
    return JSON.parse(element.textContent || "null") ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function resolveExportImageSource(src) {
  if (/^(https?:|data:|blob:|file:)/i.test(src)) {
    return Promise.resolve(src);
  }
  if (Object.prototype.hasOwnProperty.call(exportImageMap, src)) {
    return Promise.resolve(exportImageMap[src]);
  }
  try {
    const decoded = decodeURI(src);
    if (Object.prototype.hasOwnProperty.call(exportImageMap, decoded)) {
      return Promise.resolve(exportImageMap[decoded]);
    }
  } catch (error) {
    // Keep the original source when it is not valid URI text.
  }
  return Promise.reject(new Error("Image could not be resolved."));
}

function reportRichdownError(context, error) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : "";
  console.error(`[mdanimater] ${context}`, error);
  vscodePort.postMessage({
    type: "webviewError",
    context,
    message,
    stack,
  });
}

function requestEditorMeasure(view) {
  if (view && typeof view.requestMeasure === "function") {
    view.requestMeasure();
  }
}


if (!exportMode) {
  installSearchShortcut({
    getView: () => view,
    closeSlashCommandMenu: slashCommands.close,
    closeTableContextMenu,
  });
  // Undo, redo and save run in VS Code after the typing still queued in the
  // sync client, so the document has a single undo stack.
  interceptCommandKeys(document, /Mac/i.test(navigator.platform), {
    command: (name) => documentSync.command(name),
    shortcut: () => documentSync.flush(),
    keepsOwnUndo,
  });
  window.addEventListener("pagehide", () => documentSync.flush());
}

queueMicrotask(() => {
  try {
    view = new EditorView({
      parent: root,
      state: EditorState.create({
        doc: initialDocument,
        extensions: [
          ...(exportMode
            ? [
                EditorState.readOnly.of(true),
                EditorView.editable.of(false),
              ]
            : [
                gitDiffGutter.extension,
                lintDecorations.extension,
                lineNumbers(),
                highlightActiveLine(),
                highlightActiveLineGutter(),
                markdownCompletion.extension,
                revealHighlightField,
                ...createSearchExtensions(),
              ]),
          // Obsidian's default: indent with one tab, four columns wide.
          indentUnit.of("	"),
          EditorState.tabSize.of(4),
          syntaxHighlighting(markdownHighlightStyle),
          // Wrapping Markdown in yamlFrontmatter keeps a leading "---" header
          // parsed as YAML instead of a setext heading or thematic break.
          yamlFrontmatter({
            content: markdown({
              extensions: GFM,
              codeLanguages,
            }),
          }),
          ...previewExtensions.extensions,
          EditorView.domEventHandlers({
            blur(event, view) {
              slashCommands.close();
              previewExtensions.exitDetailsEditMode(view, true);
              previewExtensions.exitFrontmatterEditMode(view, true);
              previewExtensions.exitTableEditMode(view, true);
              previewExtensions.exitMermaidEditMode(view, true);
              previewExtensions.exitGherkinEditMode(view, true);
              return false;
            },
            mousedown(event, view) {
              if (event.button !== 0 || event.metaKey || event.ctrlKey) {
                return false;
              }
              const linkTarget = findLinkAtClick(view, event);
              if (!linkTarget) {
                return false;
              }
              const line = view.state.doc.lineAt(linkTarget.position);
              if (previewExtensions.isLineFocused(view.state, line)) {
                return false;
              }
              event.preventDefault();
              return true;
            },
            click(event, view) {
              const linkTarget = findLinkAtClick(view, event);
              if (!linkTarget) {
                return false;
              }

              const line = view.state.doc.lineAt(linkTarget.position);
              const linkNeedsModifier = previewExtensions.isLineFocused(view.state, line);
              if (linkNeedsModifier && !event.metaKey && !event.ctrlKey) {
                return false;
              }

              event.preventDefault();
              vscodePort.postMessage({
                type: "openLink",
                href: linkTarget.href,
              });
              return true;
            },
          }),
          ...(exportMode
            ? []
            : [
                keymap.of([
                  {
                    // VS Code's Format Document shortcut, which the text
                    // editor binds; a custom editor has to ask for it.
                    key: "Shift-Alt-f",
                    preventDefault: true,
                    run: () => {
                      vscodePort.postMessage({ type: "formatDocument" });
                      return true;
                    },
                  },
                  ...listIndentKeymap,
                  indentWithTab,
                  ...slashCommands.keymap,
                  ...getSearchKeymap(),
                  ...defaultKeymap,
                ]),
              ]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            slashCommands.sync(update);
            outlineNavigation.sync(update);
            if (update.focusChanged && !update.view.hasFocus) {
              documentSync.flush();
            }
            if (exportMode || !update.docChanged || applyingExternalUpdate) {
              return;
            }
            documentSync.localChange(update.changes);
          }),
          createEditorThemeExtension(),
          ...(exportMode ? [] : [createPreviewWidthResizer({
            getSettings: () => settings,
            postMessage: message => vscodePort.postMessage(message),
            onChange: () => settingsMenu.update(),
          })]),
        ],
      }),
    });
    if (!exportMode) {
      settingsMenu.render();
      outlineNavigation.render(view);
      gitDiffGutter.update(view, latestGitDiffChanges);
      lintDecorations.update(view, latestLintDiagnostics);
      if (initialReveal) {
        // Applied before the first paint, so the editor opens at the target
        // instead of drawing the top of the document and then jumping.
        revealInEditor(view, initialReveal);
      }
    }
    vscodePort.postMessage({ type: "ready" });
  } catch (error) {
    reportRichdownError("editor-startup", error);
    view = null;
    fallbackText = initialDocument;
    fallbackEditor.render(initialDocument);
    vscodePort.postMessage({ type: "ready" });
  }
});

window.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "resolvedImage") {
    handleResolvedImage(event.data);
    return;
  }

  if (event.data.type === "hostCompletions") {
    markdownCompletion.handleHostCompletions(event.data);
    return;
  }

  if (event.data.type === "linkCompletions") {
    markdownCompletion.handleLinkCompletions(event.data);
    return;
  }

  if (event.data.type === "reveal") {
    if (view) {
      revealInEditor(view, event.data.target);
    }
    return;
  }

  if (event.data.type === "chatEdits") {
    chatEditsBanner.update(event.data.pending === true);
    return;
  }

  if (event.data.type === "gitDiff") {
    latestGitDiffChanges = event.data.changes || [];
    gitDiffGutter.update(view, latestGitDiffChanges);
    return;
  }

  if (event.data.type === "lintDiagnostics") {
    latestLintDiagnostics = event.data.diagnostics || [];
    lintDecorations.update(view, latestLintDiagnostics);
    return;
  }

  if (event.data.type === "theme") {
    settings.richTheme = event.data.theme || "default";
    applyTheme(settings.richTheme);
    settingsMenu.update();
    return;
  }

  if (event.data.type === "settings") {
    const result = applySettingsPatch(settings, event.data.settings);
    settings = result.settings;
    applyTheme(settings.richTheme);
    applyPreviewWidth(settings.previewWidth, settings.previewWidthPixels);
    settingsMenu.update();
    if (result.previewChanged) {
      previewExtensions.refresh(view);
    }
    return;
  }

  if (event.data.type === "sync" && typeof event.data.text === "string") {
    // The host already sends LF text; normalizing again keeps a CRLF document
    // from turning into stray carriage returns inside the CodeMirror document.
    documentSync.receive({ ...event.data, text: normalizeLineEndings(event.data.text) });
    return;
  }

  if (event.data.type === "ack") {
    documentSync.receive(event.data);
  }
});

function currentText() {
  if (view) {
    return view.state.doc.toString();
  }
  return fallbackText ?? initialDocument;
}

// Text fields other than the document editor (a table cell before it is
// committed, the search box) undo their own typing in the browser. The document
// itself is undone by VS Code, which also sees the AI's edits.
function keepsOwnUndo(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }
  if (element === view?.contentDOM || element.closest(".richdown-fallback-editor")) {
    return false;
  }
  return (
    element.contentEditable === "true" ||
    element.contentEditable === "plaintext-only" ||
    element.matches('textarea, input:not([type]), input[type="text"], input[type="search"]')
  );
}

// Applies the host's changes to whichever editor is showing.
function applyHostChanges(changes) {
  if (changes.empty) {
    return;
  }
  if (view) {
    const editorView = view;
    const scrollTop = editorView.scrollDOM.scrollTop;
    const scrollLeft = editorView.scrollDOM.scrollLeft;
    applyingExternalUpdate = true;
    try {
      editorView.dispatch({ changes });
    } finally {
      applyingExternalUpdate = false;
    }
    requestAnimationFrame(() => {
      editorView.scrollDOM.scrollTop = scrollTop;
      editorView.scrollDOM.scrollLeft = scrollLeft;
    });
    return;
  }
  if (fallbackText !== null) {
    fallbackText = changes.apply(textOf(fallbackText)).toString();
    fallbackEditor.applyUpdate(fallbackText);
  }
}

window.addEventListener("click", (event) => {
  if (!event.target.closest(".cm-table-context-menu")) {
    closeTableContextMenu();
  }
  if (!event.target.closest(".richdown-outline-root")) {
    outlineNavigation.close();
  }
  if (event.target.closest(".cm-settings-root")) return;
  const menu = document.querySelector(".cm-settings-menu");
  if (menu) menu.hidden = true;
});

window.addEventListener("blur", () => {
  documentSync.flush();
  slashCommands.close();
  closeTableContextMenu();
  previewExtensions.exitDetailsEditMode(view, true);
  previewExtensions.exitFrontmatterEditMode(view, true);
  previewExtensions.exitTableEditMode(view, true);
  previewExtensions.exitMermaidEditMode(view, true);
});

window.addEventListener(
  "keydown",
  (event) => {
    if (
      event.key === "Escape" &&
      closeTableContextMenu({ restoreFocus: true })
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  },
  true,
);
