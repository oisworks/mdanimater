import { describe, expect, it } from "vitest";
import { shiftListItems } from "../src/rich-editor/domain/listIndent.js";

// Applies the edits (columns on the original lines) and returns the text, or
// null when shiftListItems leaves the key to plain indentation.
function shift(text, firstLine, lastLine, direction) {
  const lines = text.split("\n");
  const edits = shiftListItems(lines, firstLine, lastLine, direction);
  if (edits === null) {
    return null;
  }
  const next = [...lines];
  for (const edit of [...edits].reverse()) {
    const line = next[edit.line];
    next[edit.line] = line.slice(0, edit.from) + edit.insert + line.slice(edit.to);
  }
  return next.join("\n");
}

describe("shiftListItems", () => {
  it("nests a continued item under the previous one as 1", () => {
    const text = "6. 創立費（費用）\n\t1. 定義\n\t2. ";
    expect(shift(text, 2, 2, "indent")).toBe("6. 創立費（費用）\n\t1. 定義\n\t\t1. ");
  });

  it("continues the parent list's numbers when outdented", () => {
    const text = "6. 創立費（費用）\n\t1. 定義\n\t\t1. ";
    expect(shift(text, 2, 2, "outdent")).toBe("6. 創立費（費用）\n\t1. 定義\n\t2. ");
  });

  it("closes the gap in the list an item leaves", () => {
    expect(shift("1. a\n2. b\n3. c", 1, 1, "indent")).toBe("1. a\n\t1. b\n2. c");
  });

  it("renumbers the items after an outdented item", () => {
    const text = "6. a\n\t1. b\n\t2. c\n7. d";
    expect(shift(text, 2, 2, "outdent")).toBe("6. a\n\t1. b\n7. c\n8. d");
  });

  it("continues a sibling's number when nested after it", () => {
    const text = "1. a\n\t1. b\n2. c";
    expect(shift(text, 2, 2, "indent")).toBe("1. a\n\t1. b\n\t2. c");
  });

  it("moves an item's nested lines with it", () => {
    const text = "- a\n- b\n\t- c\n\n\t  more\n- d";
    expect(shift(text, 1, 1, "indent")).toBe("- a\n\t- b\n\t\t- c\n\n\t\t  more\n- d");
  });

  it("keeps the numbers of a nested list that moves along", () => {
    const text = "1. a\n2. b\n\t5. c\n\t6. d\n3. e";
    const expected = "1. a\n\t1. b\n\t\t5. c\n\t\t6. d\n2. e";
    expect(shift(text, 1, 1, "indent")).toBe(expected);
    expect(shift(text, 1, 3, "indent")).toBe(expected);
  });

  it("shifts every selected line and skips blank ones", () => {
    expect(shift("- a\n- b\n\n- c", 1, 3, "indent")).toBe("- a\n\t- b\n\n\t- c");
  });

  it("removes up to a tab's width of spaces when outdenting", () => {
    expect(shift("- a\n      - b", 1, 1, "outdent")).toBe("- a\n  - b");
  });

  it("changes nothing when outdenting an item that is not indented", () => {
    expect(shift("1. a\n2. b", 1, 1, "outdent")).toBe("1. a\n2. b");
  });

  it("leaves bullet lists' markers alone", () => {
    expect(shift("- a\n- b", 1, 1, "indent")).toBe("- a\n\t- b");
  });

  it("keeps lists with another delimiter separate", () => {
    expect(shift("1) a\n\t3. b\n2) c", 2, 2, "indent")).toBe("1) a\n\t3. b\n\t1) c");
  });

  it("returns null when the selection does not start on a list item", () => {
    expect(shift("text\n- a", 0, 1, "indent")).toBeNull();
    expect(shift("", 0, 0, "indent")).toBeNull();
  });
});
