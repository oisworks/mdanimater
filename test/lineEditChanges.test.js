import { createRequire } from "node:module";
import { ChangeSet, Text } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import {
  diffText,
  textOf,
  toLineEdits,
} from "../src/rich-editor/adapters/lineEditChanges.js";

const require = createRequire(import.meta.url);
const { applyLineEdits } = require("../src/host/lineEdits.js");

describe("diffText", () => {
  it.each([
    ["abc", "abc"],
    ["abc", "abXc"],
    ["abc", "c"],
    ["", "new\ntext"],
    ["line1\nline2\nline3", "line1\nchanged\nline3"],
    ["aaa", "aa"],
  ])("turns %j into %j", (before, after) => {
    const changes = diffText(textOf(before), after);
    expect(changes.apply(textOf(before)).toString()).toBe(after);
  });

  it("touches only the differing middle part", () => {
    const changes = diffText(textOf("hello world"), "hello brave world");
    const touched = [];
    changes.iterChanges((fromA, toA, _fromB, _toB, inserted) =>
      touched.push([fromA, toA, inserted.toString()]),
    );
    expect(touched).toEqual([[6, 6, "brave "]]);
  });

  it("returns an empty change set for equal text", () => {
    expect(diffText(textOf("same"), "same").empty).toBe(true);
  });
});

describe("toLineEdits", () => {
  it("produces edits the host applies to the same result", () => {
    const base = textOf("# title\n- one\n- two");
    const changes = ChangeSet.of(
      [
        { from: 2, to: 7, insert: "Heading" },
        { from: 10, insert: "first\n- " },
      ],
      base.length,
    );
    const edits = toLineEdits(changes, base);
    expect(applyLineEdits(base.toString(), edits)).toBe(changes.apply(base).toString());
    expect(edits[0]).toEqual({
      from: { line: 0, ch: 2 },
      to: { line: 0, ch: 7 },
      insert: "Heading",
    });
  });

  it("returns nothing for an empty change set", () => {
    expect(toLineEdits(ChangeSet.empty(3), Text.of(["abc"]))).toEqual([]);
  });
});
