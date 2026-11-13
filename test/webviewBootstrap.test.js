// @vitest-environment jsdom
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLUSH_DELAY_MS } from "../src/rich-editor/adapters/syncClient.js";

// The two webview entry points run their whole setup at import time, the way the
// bundled media/*.js files do inside VS Code. These tests build the host page the
// extension would serve, then import the module and drive it through messages.

let postMessage;

function serialize(value) {
  return JSON.stringify(value);
}

function jsonScript(id, value) {
  return `<script type="application/json" id="${id}">${serialize(value)}</script>`;
}

function installHost() {
  postMessage = vi.fn();
  vi.stubGlobal("acquireVsCodeApi", () => ({ postMessage }));
}

function sendMessage(data) {
  window.dispatchEvent(new MessageEvent("message", { data }));
}

// Each test imports a fresh copy of the entry point, which registers its
// listeners on the shared window and document. Remove them afterwards, so a
// capture-phase key handler left by an earlier test cannot answer for the
// current one.
let addedListeners = [];

function recordListeners(target) {
  const add = target.addEventListener.bind(target);
  vi.spyOn(target, "addEventListener").mockImplementation((type, listener, options) => {
    addedListeners.push({ target, type, listener, options });
    add(type, listener, options);
  });
}

beforeEach(() => {
  vi.resetModules();
  recordListeners(window);
  recordListeners(document);
  installHost();
  document.head.replaceChildren();
  document.body.replaceChildren();
  document.documentElement.removeAttribute("style");
  delete document.documentElement.dataset.richTheme;
  delete document.documentElement.dataset.richdownExport;
});

afterEach(() => {
  for (const { target, type, listener, options } of addedListeners) {
    target.removeEventListener(type, listener, options);
  }
  addedListeners = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rich diff webview", () => {
  const DIFF = {
    leftText: "# Title\n\nold line\nshared\n",
    rightText: "# Title\n\nnew line\nshared\nextra\n",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    fileName: "notes.md",
    filePath: "docs/notes.md",
  };

  async function boot(diff = DIFF, settings = { richTheme: "midnight" }) {
    document.body.innerHTML = `
      <div id="diff"></div>
      ${jsonScript("initial-diff", diff)}
      ${jsonScript("initial-settings", settings)}
    `;
    await import("../src/richDiff.js");
    return document.querySelector("#diff");
  }

  it("renders the file header, labels and change summary", async () => {
    const root = await boot();

    expect(root.querySelector(".rdiff-file").textContent).toBe("notes.md");
    expect(root.querySelector(".rdiff-path").textContent).toBe("docs/notes.md");
    expect(
      [...root.querySelectorAll(".rdiff-column-header div")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["HEAD", "Working Tree"]);
    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+2");
    expect(root.querySelector(".rdiff-stat-delete").textContent).toBe("-1");
  });

  it("opens the original text comparison on request", async () => {
    const root = await boot();
    root.querySelector('[data-action="source-diff"]').click();
    expect(postMessage).toHaveBeenCalledWith({ type: "openSourceDiff" });
  });

  it("renders table edits, additions and deletions with aligned columns and line markers", async () => {
    const header = "| Name | Value |\n| --- | ---: |\n";
    const root = await boot({ ...DIFF,
      leftText: header + "| **old** | 10 |\n| removed | 20 |\n| shared | 30 |",
      rightText: header + "| **new** | 1000 |\n| shared | 30 |\n| added | 40 |",
    });
    expect(root.querySelector(".rdiff-left.is-delete td strong").textContent).toBe("old");
    expect(root.querySelector(".rdiff-right.is-insert td strong").textContent).toBe("new");
    expect(root.querySelector(".rdiff-right.is-insert .rdiff-marker").textContent).toBe("+");
    expect(root.querySelector(".rdiff-left.is-delete .rdiff-marker").textContent).toBe("-");
    for (const side of ["left", "right"]) {
      const tables = [...root.querySelectorAll(`.rdiff-${side} table`)];
      expect(tables).toHaveLength(4);
      expect(new Set(tables.map(table => table.querySelector("colgroup").innerHTML)).size).toBe(1);
    }
    expect(root.querySelector(".rdiff-left colgroup").innerHTML).toBe(root.querySelector(".rdiff-right colgroup").innerHTML);
    expect(root.querySelector(".rdiff-table-rule")).toBeNull();
    sendMessage({ type: "updateRight", text: header + "| saved | 99 |" });
    expect(root.querySelector(".rdiff-right td").textContent).toBe("saved");
  });

  it("renders one row per diff line with side markers", async () => {
    const root = await boot();
    const rows = [...root.querySelectorAll(".rdiff-row")];

    expect(rows.length).toBeGreaterThan(3);
    expect(rows.some((row) => row.className.includes("is-replace"))).toBe(true);
    expect(rows.some((row) => row.className.includes("is-insert"))).toBe(true);
    expect(
      [...root.querySelectorAll(".rdiff-marker")].map((cell) => cell.textContent),
    ).toEqual(expect.arrayContaining(["-", "+"]));
  });

  it("renders Markdown inside the rows", async () => {
    const root = await boot();
    expect(root.querySelector(".rdiff-heading")).toBeTruthy();
  });

  it("applies the theme from the host settings", async () => {
    await boot();
    expect(document.documentElement.dataset.richTheme).toBe("midnight");
  });

  it("shows equal rows and a zero summary when both sides match", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "same\n",
      rightText: "same\n",
    });

    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+0");
    expect(root.querySelector(".rdiff-stat-delete").textContent).toBe("-0");
    expect(
      [...root.querySelectorAll(".rdiff-row")].every((row) =>
        row.className.includes("is-equal"),
      ),
    ).toBe(true);
  });

  it("shows the empty state when there is nothing on either side", async () => {
    const root = await boot({ ...DIFF, leftText: "", rightText: "" });

    expect(root.querySelector(".rdiff-empty-title").textContent).toBe(
      "No changes",
    );
  });

  it("falls back to default labels when the host omits them", async () => {
    const root = await boot({ leftText: "a\n", rightText: "b\n" });

    expect(
      [...root.querySelectorAll(".rdiff-column-header div")].map(
        (label) => label.textContent,
      ),
    ).toEqual(["Base", "Working Tree"]);
    expect(root.querySelector(".rdiff-file").textContent).toBe("Markdown");
  });

  it("re-renders when the working tree changes", async () => {
    const root = await boot();
    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+2");

    sendMessage({ type: "updateRight", text: DIFF.leftText });

    expect(root.querySelector(".rdiff-stat-add").textContent).toBe("+0");
    expect(root.querySelector(".rdiff-stat-delete").textContent).toBe("-0");
  });

  it("ignores an updateRight without text", async () => {
    const root = await boot();
    const before = root.innerHTML;
    sendMessage({ type: "updateRight" });

    expect(root.innerHTML).toBe(before);
  });

  it("re-applies the theme when settings arrive", async () => {
    await boot();
    sendMessage({ type: "settings", settings: { richTheme: "paper" } });

    expect(document.documentElement.dataset.richTheme).toBe("paper");
  });

  it("ignores an empty message", async () => {
    const root = await boot();
    const before = root.innerHTML;
    sendMessage(null);

    expect(root.innerHTML).toBe(before);
  });

  it("asks the host to open a clicked link", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "see [docs](https://example.com/a)\n",
      rightText: "see [docs](https://example.com/b)\n",
    });

    root
      .querySelector("a[data-href]")
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "openLink",
      href: expect.stringContaining("https://example.com/"),
    });
  });

  it("copies a code block through the host", async () => {
    vi.useFakeTimers();
    const root = await boot({
      ...DIFF,
      leftText: "```js\nconst a = 1;\n```\n",
      rightText: "```js\nconst a = 2;\n```\n",
    });

    const button = root.querySelector("[data-copy-id]");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(postMessage).toHaveBeenCalledWith({
      type: "copyText",
      text: expect.stringContaining("const a ="),
    });
    expect(button.textContent).toBe("Copied");

    vi.advanceTimersByTime(900);
    expect(button.textContent).toBe("Copy");
  });

  it("asks the host to resolve images and shows the answer", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "![logo](a.png)\n",
      rightText: "![logo](b.png)\n",
    });

    const request = postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === "resolveImage");
    expect(request).toMatchObject({ type: "resolveImage" });

    sendMessage({
      type: "resolvedImage",
      requestId: request.requestId,
      uri: "data:image/png;base64,AAA",
    });

    expect(root.querySelector("[data-image-src] img").getAttribute("src")).toBe(
      "data:image/png;base64,AAA",
    );
  });

  it("shows an error when an image cannot be resolved", async () => {
    const root = await boot({
      ...DIFF,
      leftText: "![logo](a.png)\n",
      rightText: "![logo](gone.png)\n",
    });
    const request = postMessage.mock.calls
      .map(([message]) => message)
      .find((message) => message.type === "resolveImage");

    sendMessage({ type: "resolvedImage", requestId: request.requestId, uri: "" });

    expect(root.querySelector(".rdiff-image-error").textContent).toBe("logo");
  });

  it("gives up on an image the host never resolves", async () => {
    vi.useFakeTimers();
    const root = await boot({
      ...DIFF,
      leftText: "![logo](a.png)\n",
      rightText: "![logo](b.png)\n",
    });

    vi.advanceTimersByTime(4000);
    expect(root.querySelector(".rdiff-image-error").textContent).toBe(
      "Image could not be loaded",
    );
  });

  it("ignores a resolved image for an unknown request", async () => {
    const root = await boot();
    expect(() =>
      sendMessage({ type: "resolvedImage", requestId: 999, uri: "x" }),
    ).not.toThrow();
    expect(root.querySelector(".rdiff-shell")).toBeTruthy();
  });
});

describe("rich editor webview", () => {
  async function boot({
    text = "# Title\n\nbody text\n",
    settings = { richTheme: "midnight", previewWidth: "wide" },
    runtime = {},
    gitDiff = [],
    imageMap = {},
    mermaidScriptUri = "",
    reveal = null,
  } = {}) {
    document.body.innerHTML = `
      <div id="editor"></div>
      ${jsonScript("initial-reveal", reveal)}
      ${jsonScript("initial-document", text)}
      ${jsonScript("initial-settings", settings)}
      ${jsonScript("mermaid-script-uri", mermaidScriptUri)}
      ${jsonScript("initial-git-diff", gitDiff)}
      ${jsonScript("initial-image-map", imageMap)}
      ${jsonScript("initial-runtime", runtime)}
    `;
    await import("../src/richEditor.js");
    return document.querySelector("#editor");
  }

  it("mounts a CodeMirror editor with the host's document", async () => {
    const root = await boot();

    expect(root.querySelector(".cm-editor")).toBeTruthy();
    expect(root.textContent).toContain("Title");
  });

  it("applies the theme and content width from the host settings", async () => {
    await boot();

    expect(document.documentElement.dataset.richTheme).toBe("midnight");
    expect(document.documentElement.dataset.previewWidth).toBe("wide");
  });

  it("renders the settings menu and the outline", async () => {
    await boot();

    expect(document.querySelector(".cm-settings-root")).toBeTruthy();
    expect(document.querySelector(".richdown-outline-root")).toBeTruthy();
  });

  const sentOfType = (type) =>
    postMessage.mock.calls
      .map(([message]) => message)
      .filter((message) => message.type === type);

  // Boots the editor and answers its ready message the way the host does.
  async function bootSynced(options) {
    const root = await boot(options);
    sendMessage({ type: "sync", text: options.text, seq: 1, lastAppliedId: 0 });
    vi.useFakeTimers();
    const view = EditorView.findFromDOM(root.querySelector(".cm-editor"));
    return { root, view };
  }

  const lineInsert = (line, ch, insert) => ({
    from: { line, ch },
    to: { line, ch },
    insert,
  });

  it("tells the host it is ready once the editor is mounted", async () => {
    await boot();
    expect(sentOfType("ready")).toHaveLength(1);
  });

  it("reports typing to the extension host as line edits once typing pauses", async () => {
    const { view } = await bootSynced({ text: "# Title\n" });
    view.dispatch({ changes: { from: 7, insert: "!" } });
    expect(sentOfType("edit")).toEqual([]);

    vi.advanceTimersByTime(FLUSH_DELAY_MS);
    expect(sentOfType("edit")).toEqual([
      { type: "edit", id: 1, seq: 1, changes: [lineInsert(0, 7, "!")] },
    ]);
  });

  it("keeps the user's typing when the host's text changes underneath it", async () => {
    const { root, view } = await bootSynced({ text: "hello world\n" });
    view.dispatch({ changes: { from: 11, insert: "!" } });

    sendMessage({ type: "sync", text: "# hello world\n", seq: 2, lastAppliedId: 0 });

    expect(view.state.doc.toString()).toBe("# hello world!\n");
    expect(root.textContent).toContain("hello world!");
    expect(sentOfType("edit")).toEqual([
      { type: "edit", id: 1, seq: 2, changes: [lineInsert(0, 13, "!")] },
    ]);
  });

  it("does not echo the host's changes back as edits", async () => {
    const { view } = await bootSynced({ text: "one\n" });
    sendMessage({ type: "sync", text: "two\n", seq: 2, lastAppliedId: 0 });
    vi.advanceTimersByTime(FLUSH_DELAY_MS);

    expect(view.state.doc.toString()).toBe("two\n");
    expect(sentOfType("edit")).toEqual([]);
  });

  it("sends typing before saving, and saves through the host", async () => {
    const { view } = await bootSynced({ text: "a\n" });
    view.dispatch({ changes: { from: 1, insert: "b" } });

    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    view.contentDOM.dispatchEvent(event);

    const types = postMessage.mock.calls.map(([message]) => message.type);
    expect(types.slice(-2)).toEqual(["edit", "command"]);
    expect(sentOfType("command")).toEqual([{ type: "command", name: "save" }]);
    expect(event.defaultPrevented).toBe(true);
  });

  const pressKey = (target, init) => {
    const event = new KeyboardEvent("keydown", {
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    target.dispatchEvent(event);
    return event;
  };

  it.each([
    [{ key: "z" }, "undo"],
    [{ key: "Z", shiftKey: true }, "redo"],
    [{ key: "y" }, "redo"],
  ])("sends typing before %o, and leaves the %s to VS Code", async (init, name) => {
    const { view } = await bootSynced({ text: "a\n" });
    view.dispatch({ changes: { from: 1, insert: "b" } });

    const event = pressKey(view.contentDOM, init);

    const types = postMessage.mock.calls.map(([message]) => message.type);
    expect(types.slice(-2)).toEqual(["edit", "command"]);
    expect(sentOfType("command")).toEqual([{ type: "command", name }]);
    expect(event.defaultPrevented).toBe(true);
    expect(view.state.doc.toString()).toBe("ab\n");
  });

  it("leaves Ctrl+Z inside a table cell to the cell", async () => {
    // The table is not on the cursor's line, so it shows as a table widget.
    const { root } = await bootSynced({ text: "intro\n\n| a | b |\n| - | - |\n| 1 | 2 |\n" });
    const cell = root.querySelector(".cm-rich-table-cell-editor");
    expect(cell).toBeTruthy();
    const forwarded = vi.fn();
    window.addEventListener("keydown", forwarded);

    const event = pressKey(cell, { key: "z" });

    expect(sentOfType("command")).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    expect(forwarded).not.toHaveBeenCalled();
  });

  it("sends typing when the webview loses focus", async () => {
    const { view } = await bootSynced({ text: "a\n" });
    view.dispatch({ changes: { from: 1, insert: "b" } });

    window.dispatchEvent(new Event("blur"));

    expect(sentOfType("edit")).toHaveLength(1);
  });

  it("sends typing before any other message to the host", async () => {
    const { view } = await bootSynced({ text: "a\n" });
    view.dispatch({ changes: { from: 1, insert: "b" } });

    document.querySelector(".cm-settings-root button").click();
    document.querySelector("[data-toggle-table-preview]").click();

    const types = postMessage.mock.calls.map(([message]) => message.type);
    expect(types.indexOf("edit")).toBeGreaterThan(-1);
    expect(types.indexOf("edit")).toBeLessThan(types.indexOf("setRichTablePreview"));
  });

  it("keeps syncing through the plain textarea when CodeMirror cannot start", async () => {
    vi.doMock("@codemirror/view", async (importOriginal) => {
      const original = await importOriginal();
      class FailingEditorView extends original.EditorView {
        constructor() {
          throw new Error("editor failed to start");
        }
      }
      return { ...original, EditorView: FailingEditorView };
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const root = await boot({ text: "one\n" });
      const textarea = root.querySelector("textarea.richdown-fallback-editor");
      expect(textarea.value).toBe("one\n");
      sendMessage({ type: "sync", text: "one\n", seq: 1, lastAppliedId: 0 });
      vi.useFakeTimers();

      textarea.value = "one!\n";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      sendMessage({ type: "sync", text: "# one\n", seq: 2, lastAppliedId: 0 });

      expect(textarea.value).toBe("# one!\n");
      expect(sentOfType("edit")).toEqual([
        { type: "edit", id: 1, seq: 2, changes: [lineInsert(0, 5, "!")] },
      ]);

      // The textarea holds the document, so VS Code undoes it.
      pressKey(textarea, { key: "z" });
      expect(sentOfType("command")).toEqual([{ type: "command", name: "undo" }]);
    } finally {
      vi.doUnmock("@codemirror/view");
    }
  });

  it("applies a CRLF host sync without inserting extra line breaks", async () => {
    // New files on Windows use CRLF. CodeMirror stores the document in LF, so an
    // un-normalized update used to arrive as a lone "\r" insert, which the editor
    // applies as an extra blank line while the caret is remapped.
    const root = await boot({ text: "alpha\nbravo\n" });

    sendMessage({
      type: "sync",
      text: "alpha\r\nbravo\r\ncharlie\r\n",
      seq: 1,
      lastAppliedId: 0,
    });

    const lines = [...root.querySelectorAll(".cm-line")].map(
      (line) => line.textContent,
    );
    expect(lines).toEqual(["alpha", "bravo", "charlie", ""]);
    expect(root.textContent).not.toContain("\r");
  });

  it("switches theme on a theme message", async () => {
    await boot();
    sendMessage({ type: "theme", theme: "forest" });

    expect(document.documentElement.dataset.richTheme).toBe("forest");
  });

  it("applies a settings patch from the host", async () => {
    await boot();
    sendMessage({ type: "settings", settings: { previewWidth: "default" } });

    expect(document.documentElement.dataset.previewWidth).toBe("default");
  });

  it("accepts git diff decorations", async () => {
    const root = await boot();
    sendMessage({ type: "gitDiff", changes: [{ line: 1, type: "added" }] });

    expect(root.querySelector(".cm-git-diff-gutter")).toBeTruthy();
  });

  it("ignores an empty message", async () => {
    const root = await boot();
    expect(() => sendMessage(null)).not.toThrow();
    expect(root.querySelector(".cm-editor")).toBeTruthy();
  });

  it("opens at the position the host passed in the initial page", async () => {
    const root = await boot({
      text: "# Title\n\nfind the needle here\n",
      reveal: {
        selection: {
          start: { line: 2, character: 9 },
          end: { line: 2, character: 15 },
        },
      },
    });

    expect(root.querySelector(".cm-richdown-reveal-match")?.textContent).toBe(
      "needle",
    );
  });

  it("reveals a heading when the host asks for one", async () => {
    const root = await boot({ text: "# Title\n\n## Usage\n\ntext\n" });
    sendMessage({ type: "reveal", target: { anchor: "usage" } });

    const activeLine = root.querySelector(".cm-activeLine");
    expect(activeLine?.textContent).toContain("Usage");
  });

  it("shows the Copilot banner while the host reports pending edits", async () => {
    await boot();
    sendMessage({ type: "chatEdits", pending: true });
    expect(document.querySelector(".richdown-chat-edits-banner")).toBeTruthy();

    sendMessage({ type: "chatEdits", pending: false });
    expect(document.querySelector(".richdown-chat-edits-banner")).toBeNull();
  });

  it("runs without an extension host in export mode", async () => {
    vi.stubGlobal("acquireVsCodeApi", undefined);
    const root = await boot({
      runtime: { exportMode: true },
      imageMap: { "img.png": "data:image/png;base64,AAA" },
      text: "![logo](img.png)\n\nbody\n",
    });

    expect(document.documentElement.dataset.richdownExport).toBe("true");
    expect(root.querySelector(".cm-editor")).toBeTruthy();
  });
});
