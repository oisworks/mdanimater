import { describe, expect, it } from "vitest";
import { diffText, textOf } from "../src/rich-editor/adapters/lineEditChanges.js";
import { normalizeLineEndings } from "../src/rich-editor/domain/textChange.js";

describe("normalizeLineEndings", () => {
  it("strips the carriage returns of a Windows document", () => {
    expect(normalizeLineEndings("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("treats missing text as empty", () => {
    expect(normalizeLineEndings(undefined)).toBe("");
  });

  it("reports no change for a CRLF copy of the editor document", () => {
    // Without normalization the change against a CRLF sync is a lone "\r",
    // which CodeMirror applies as an extra line break while the caret is
    // remapped against the longer CRLF offsets.
    const editorText = "a\nbc";
    const hostText = "a\r\nbc";

    expect(diffText(textOf(editorText), hostText).empty).toBe(false);
    expect(diffText(textOf(editorText), normalizeLineEndings(hostText)).empty).toBe(true);
  });
});
