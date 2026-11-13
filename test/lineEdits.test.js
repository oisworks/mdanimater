import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

// lineEdits.js runs in the extension host as CommonJS, so it is loaded the
// same way here.
const require = createRequire(import.meta.url);
const { applyLineEdits } = require("../src/host/lineEdits.js");

const edit = (fromLine, fromCh, toLine, toCh, insert) => ({
  from: { line: fromLine, ch: fromCh },
  to: { line: toLine, ch: toCh },
  insert,
});

describe("applyLineEdits", () => {
  it("inserts text inside a line", () => {
    expect(applyLineEdits("abcd", [edit(0, 2, 0, 2, "XY")])).toBe("abXYcd");
  });

  it("replaces text spanning lines", () => {
    expect(applyLineEdits("abc\ndef\nghi", [edit(0, 1, 2, 1, "-")])).toBe("a-hi");
  });

  it("applies multiple edits relative to the original text", () => {
    const edits = [edit(1, 0, 1, 3, "x\ny"), edit(0, 0, 0, 0, "# ")];
    expect(applyLineEdits("one\ntwo", edits)).toBe("# one\nx\ny");
  });

  it("does not mutate its inputs", () => {
    const edits = Object.freeze([Object.freeze(edit(0, 0, 0, 1, ""))]);
    expect(applyLineEdits("ab", edits)).toBe("b");
  });

  it("rejects positions outside the text", () => {
    expect(() => applyLineEdits("ab", [edit(1, 0, 1, 0, "x")])).toThrow(RangeError);
    expect(() => applyLineEdits("ab", [edit(0, 3, 0, 3, "x")])).toThrow(RangeError);
    expect(() => applyLineEdits("a\nb", [edit(0, 2, 0, 2, "x")])).toThrow(RangeError);
    expect(() => applyLineEdits("ab", [edit(-1, 0, 0, 0, "x")])).toThrow(RangeError);
    expect(() => applyLineEdits("ab", [edit(0, 0.5, 0, 1, "x")])).toThrow(RangeError);
  });

  it("rejects reversed or overlapping ranges", () => {
    expect(() => applyLineEdits("abcd", [edit(0, 3, 0, 1, "")])).toThrow(RangeError);
    expect(() =>
      applyLineEdits("abcd", [edit(0, 0, 0, 2, ""), edit(0, 1, 0, 3, "")]),
    ).toThrow(RangeError);
  });

  it("rejects an edit whose insert is not a string", () => {
    expect(() =>
      applyLineEdits("ab", [{ ...edit(0, 0, 0, 0, ""), insert: 42 }]),
    ).toThrow(TypeError);
  });
});
