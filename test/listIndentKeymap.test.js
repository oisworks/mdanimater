import { describe, expect, it } from "vitest";
import { insertNewlineContinueMarkup, markdown } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";

import { listIndentKeymap } from "../src/rich-editor/presentation/codemirror/listIndent.js";

const [tabBinding] = listIndentKeymap;

function createState(doc, anchor = doc.length, head = anchor) {
  return EditorState.create({
    doc,
    selection: EditorSelection.single(anchor, head),
    extensions: [markdown(), indentUnit.of("\t"), EditorState.tabSize.of(4)],
  });
}

// Runs a command and returns the next state and whether it handled the key.
function run(command, state) {
  let next = state;
  const handled = command({ state, dispatch: (transaction) => (next = transaction.state) });
  return { state: next, handled };
}

describe("listIndentKeymap", () => {
  it("continues a nested item with a tab and renumbers it on Tab, like Obsidian", () => {
    const entered = run(insertNewlineContinueMarkup, createState("6. 創立費（費用）\n\t1. 定義"));
    expect(entered.state.doc.toString()).toBe("6. 創立費（費用）\n\t1. 定義\n\t2. ");

    const indented = run(tabBinding.run, entered.state);
    expect(indented.handled).toBe(true);
    expect(indented.state.doc.toString()).toBe("6. 創立費（費用）\n\t1. 定義\n\t\t1. ");
    expect(indented.state.selection.main.head).toBe(indented.state.doc.length);

    const outdented = run(tabBinding.shift, indented.state);
    expect(outdented.state.doc.toString()).toBe("6. 創立費（費用）\n\t1. 定義\n\t2. ");
  });

  it("shifts every selected item", () => {
    const doc = "- a\n- b\n- c";
    const { state } = run(tabBinding.run, createState(doc, 4, doc.length));
    expect(state.doc.toString()).toBe("- a\n\t- b\n\t- c");
  });

  it("handles Shift-Tab on an unindented item without changing it", () => {
    const { state, handled } = run(tabBinding.shift, createState("1. a"));
    expect(handled).toBe(true);
    expect(state.doc.toString()).toBe("1. a");
  });

  it("leaves other lines, multiple selections and read-only documents to indentWithTab", () => {
    expect(run(tabBinding.run, createState("text")).handled).toBe(false);

    const multiple = EditorState.create({
      doc: "- a\n- b",
      selection: EditorSelection.create([EditorSelection.cursor(1), EditorSelection.cursor(5)]),
      extensions: [EditorState.allowMultipleSelections.of(true)],
    });
    expect(run(tabBinding.run, multiple).handled).toBe(false);

    const readOnly = EditorState.create({ doc: "- a", extensions: [EditorState.readOnly.of(true)] });
    expect(run(tabBinding.run, readOnly).handled).toBe(false);
  });
});
