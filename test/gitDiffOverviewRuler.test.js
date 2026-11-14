// @vitest-environment jsdom
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it } from "vitest";
import { createGitDiffGutter } from "../src/rich-editor/presentation/codemirror/gitDiffGutter.js";
import { layoutGitRulerMarkers } from "../src/rich-editor/presentation/codemirror/gitDiffOverviewRuler.js";

const entry = (pos, top, type = "added") => ({ pos, top, type, height: 20 });
describe("Git ruler layout", () => {
  it("positions additions, modifications and deletions across the document", () => {
    expect(layoutGitRulerMarkers([entry(0, 0), entry(20, 1000, "modified"), entry(40, 1980, "deleted")], 2000, 400))
      .toEqual([{ pos: 0, top: 0, height: 4, type: "added" }, { pos: 20, top: 200, height: 4, type: "modified" }, { pos: 40, top: 396, height: 4, type: "deleted" }]);
  });
  it("merges same-type overlaps without hiding a different type", () => {
    const marks = layoutGitRulerMarkers([entry(0, 0), entry(1, 1), entry(0, 0, "deleted")], 10000, 300);
    expect(marks).toHaveLength(2);
    expect(marks.map((mark) => mark.type)).toEqual(["added", "deleted"]);
  });
  it("clamps minimum height and handles zero-height and short documents", () => {
    const [mark] = layoutGitRulerMarkers([entry(99, 99999)], 100000, 300);
    expect(mark.height).toBe(3);
    expect(mark.top + mark.height).toBe(300);
    expect(layoutGitRulerMarkers([entry(0, 100)], 200, 800)[0].top).toBe(100);
    expect(layoutGitRulerMarkers([entry(0, 0)], 100, 0)).toEqual([]);
    expect(layoutGitRulerMarkers([], 100, 100)).toEqual([]);
  });
});

describe("Git ruler integration", () => {
  let view;
  afterEach(() => { view?.destroy(); view = null; });
  it("reflects host updates, preserves the caret on clicks, clears and destroys", () => {
    const git = createGitDiffGutter();
    view = new EditorView({ parent: document.body, state: EditorState.create({ doc: "a\nb\nc", extensions: git.extension }) });
    Object.defineProperty(view.scrollDOM, "clientHeight", { value: 300 });
    const ruler = view.dom.querySelector(".cm-git-diff-ruler");
    view.measure();
    expect(ruler.hidden).toBe(true);
    git.update(view, [{ line: 2, type: "modified" }, { line: 900, type: "deleted" }]);
    view.measure();
    expect(ruler.hidden).toBe(false);
    expect(ruler.querySelectorAll(".cm-git-diff-ruler-mark")).toHaveLength(2);
    expect(ruler.style.right).toBe("8px");
    const selection = view.state.selection;
    ruler.querySelector(".cm-git-diff-ruler-mark").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(view.state.selection).toBe(selection);
    git.update(view, []);
    view.measure();
    expect(ruler.hidden).toBe(true);
    const editor = view.dom;
    view.destroy(); view = null;
    expect(editor.querySelector(".cm-git-diff-ruler")).toBeNull();
  });
});
