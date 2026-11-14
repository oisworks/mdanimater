import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { history, undo } from "@codemirror/commands";
import { findTableBlocks } from "../src/rich-editor/domain/markdownBlocks.js";
import {
  getTableDisplayWidths,
  setTableDisplayWidths,
  tableDisplayWidthsField,
} from "../src/rich-editor/presentation/table/displayWidths.js";

const table = "| A | B |\n| --- | --- |\n| a | b |";
function create(doc = `intro\n\n${table}\n`) {
  return EditorState.create({ doc, extensions: [tableDisplayWidthsField, history()] });
}
function resize(state, widths = [20, 30]) {
  const block = findTableBlocks(state.doc)[0];
  return state.update({ effects: setTableDisplayWidths.of({
    from: block.from, to: block.sourceTo, widths,
  }) }).state;
}
function widths(state) {
  return getTableDisplayWidths(state, findTableBlocks(state.doc)[0]);
}

describe("display-only table widths", () => {
  it("never modifies text or creates a document undo step", () => {
    const original = create();
    const state = resize(original);
    expect(state.doc).toBe(original.doc);
    expect(widths(state)).toEqual([20, 30]);
    expect(undo({ state, dispatch: () => { throw new Error("unexpected undo"); } })).toBe(false);
  });

  it("maps widths through an insertion directly before the table", () => {
    let state = resize(create());
    const from = findTableBlocks(state.doc)[0].from;
    state = state.update({ changes: { from, insert: "new paragraph\n\n" } }).state;
    expect(widths(state)).toEqual([20, 30]);
  });

  it("retains widths after a whole-table cell edit", () => {
    let state = resize(create());
    const block = findTableBlocks(state.doc)[0];
    state = state.update({ changes: {
      from: block.from, to: block.sourceTo, insert: table.replace("| a |", "| changed |"),
    } }).state;
    expect(widths(state)).toEqual([20, 30]);
  });

  it("drops widths on column structure changes rather than applying them to wrong columns", () => {
    let state = resize(create());
    const block = findTableBlocks(state.doc)[0];
    state = state.update({ changes: {
      from: block.from, to: block.sourceTo,
      insert: "| A | B | C |\n| --- | --- | --- |\n| a | b | c |",
    } }).state;
    expect(widths(state)).toEqual([null, null, null]);
  });

  it("does not transfer deleted table widths to the following table", () => {
    let state = resize(create(`${table}\n\n${table}\n`));
    const second = findTableBlocks(state.doc)[1];
    state = state.update({ changes: { from: 0, to: second.from, insert: "" } }).state;
    expect(widths(state)).toEqual([null, null]);
  });

  it("replaces rather than accumulates resize and reset states", () => {
    let state = resize(create());
    state = resize(state, [25, 35]);
    state = resize(state, [null, null]);
    expect(widths(state)).toEqual([null, null]);
    expect(state.field(tableDisplayWidthsField)).toHaveLength(1);
  });
});
