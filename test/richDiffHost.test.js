import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
const hostRequire = createRequire(new URL("../extension.js", import.meta.url));
const source = readFileSync(new URL("../extension.js", import.meta.url), "utf8");
function uri(scheme, name = "/notes.md", ref = "") {
  return { scheme, path: name, fsPath: name, query: JSON.stringify({path:name,ref}),
    toString() { return `${this.scheme}:${this.path}?${this.query}`; },
    with(update) { return Object.assign(uri(this.scheme, this.path, ref), update); },
  };
}
function setup() {
  const panels = [];
  const files = new Map();
  let changeDocument;
  const config = { get: (_key, fallback) => fallback };
  const vscode = {
    languages: { createDiagnosticCollection: () => ({}) },
    workspace: {
      textDocuments: [], getConfiguration: () => config,
      fs: { readFile: vi.fn(async target => {
        if (!files.has(target.toString())) throw new Error("Missing revision");
        return Buffer.from(files.get(target.toString()));
      }) },
      onDidChangeTextDocument: listener => {changeDocument = listener; return {dispose() {}};},
      onDidChangeConfiguration: () => ({dispose() {}}),
    },
    window: { tabGroups: {activeTabGroup:{}}, showWarningMessage: vi.fn(),
      createWebviewPanel: (_type,title) => {
        const panel = { title, webview: { cspSource:"test:", asWebviewUri: value => value,
          onDidReceiveMessage() {}, postMessage: vi.fn() }, onDidDispose() {} };
        panels.push(panel); return panel;
      },
    },
    Uri: {file: name => uri("file",name), joinPath: (base,...parts) => uri(base.scheme,path.join(base.path,...parts))},
    ViewColumn: {Active:1},
  };
  const context = {module:{exports:{}}, Buffer, console, setTimeout, clearTimeout,
    require: name => name === "vscode" ? vscode : hostRequire(name)};
  vm.runInNewContext(source + "\nmodule.exports.test = {openRichComparison, openRichDiff};", context);
  const api = context.module.exports.test;
  const extensionContext = {extensionUri:uri("file","/extension")};
  const data = () => JSON.parse(panels.at(-1).webview.html.match(/id="initial-diff">([\s\S]*?)<\/script>/)[1]);
  return {api,files,vscode,panels,data,extensionContext,change: event => changeDocument(event)};
}

describe("Rich Diff extension host", () => {
  it("reads staged revisions without substituting working-tree contents", async () => {
    const s = setup();
    const original = uri("git","/notes.md","HEAD");
    const modified = uri("git","/notes.md","");
    s.files.set(original.toString(),"committed");
    s.files.set(modified.toString(),"staged");
    s.vscode.workspace.textDocuments.push({uri:uri("file"),getText:()=>"unstaged"});
    await s.api.openRichComparison(s.extensionContext,{original,modified});
    expect(s.data()).toMatchObject({leftText:"committed",rightText:"staged",leftLabel:"HEAD",rightLabel:"Index"});
    s.change({document:s.vscode.workspace.textDocuments[0]});
    expect(s.panels[0].webview.postMessage).not.toHaveBeenCalled();
  });
  it("opens and refreshes a working comparison with unsaved document text", async () => {
    const s = setup();
    const original = uri("git","/notes.md","HEAD");
    const modified = uri("file");
    s.files.set(original.toString(),"committed");
    s.files.set(modified.toString(),"disk");
    const doc = {uri:modified,getText:()=>"unsaved"};
    s.vscode.workspace.textDocuments.push(doc);
    await s.api.openRichComparison(s.extensionContext,{original,modified});
    expect(s.data().rightText).toBe("unsaved");
    doc.getText = () => "next edit";
    s.change({document:doc});
    await vi.waitFor(() => expect(s.panels[0].webview.postMessage).toHaveBeenCalledWith({type:"updateRight",text:"next edit"}));
  });
  it("keeps the selected revisions when invoked inside a native diff", async () => {
    const s = setup();
    const original = uri("git","/old-name.md","abc123");
    const modified = uri("git","/notes.md","def456");
    s.files.set(original.toString(),"old");
    s.files.set(modified.toString(),"new");
    s.vscode.window.tabGroups.activeTabGroup.activeTab = {input:{original,modified}};
    await s.api.openRichDiff(s.extensionContext);
    expect(s.data()).toMatchObject({leftText:"old",rightText:"new",leftLabel:"abc123",rightLabel:"def456"});
  });
  it("leaves provider failures to the caller instead of showing a fabricated empty base", async () => {
    const s = setup();
    await expect(s.api.openRichComparison(s.extensionContext,{original:uri("git"),modified:uri("file")})).rejects.toThrow("Missing revision");
    expect(s.panels).toHaveLength(0);
  });
});
