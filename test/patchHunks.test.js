import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { parsePatch, indexPatchLines, commentableLines } = require(
  "../src/host/review/patchHunks.js",
);

describe("parsePatch", () => {
  it("numbers context, added, and deleted lines", () => {
    const patch = ["@@ -2,3 +2,3 @@ # Title", " keep", "-old", "+new", " tail"].join("\n");
    expect(parsePatch(patch)).toEqual([
      { kind: "context", oldLine: 2, newLine: 2 },
      { kind: "delete", oldLine: 3, newLine: null },
      { kind: "add", oldLine: null, newLine: 3 },
      { kind: "context", oldLine: 4, newLine: 4 },
    ]);
  });

  it("restarts numbering at each hunk", () => {
    const patch = [
      "@@ -1,2 +1,2 @@",
      "-a",
      "+A",
      " b",
      "@@ -10,2 +10,3 @@",
      " j",
      "+k",
      " l",
    ].join("\n");
    expect(parsePatch(patch)).toEqual([
      { kind: "delete", oldLine: 1, newLine: null },
      { kind: "add", oldLine: null, newLine: 1 },
      { kind: "context", oldLine: 2, newLine: 2 },
      { kind: "context", oldLine: 10, newLine: 10 },
      { kind: "add", oldLine: null, newLine: 11 },
      { kind: "context", oldLine: 11, newLine: 12 },
    ]);
  });

  it("reads hunk headers that omit a count of one", () => {
    expect(parsePatch("@@ -5 +5 @@\n-x\n+y")).toEqual([
      { kind: "delete", oldLine: 5, newLine: null },
      { kind: "add", oldLine: null, newLine: 5 },
    ]);
  });

  it("reads a new file and a deleted file", () => {
    expect(parsePatch("@@ -0,0 +1,2 @@\n+a\n+b")).toEqual([
      { kind: "add", oldLine: null, newLine: 1 },
      { kind: "add", oldLine: null, newLine: 2 },
    ]);
    expect(parsePatch("@@ -1,2 +0,0 @@\n-a\n-b")).toEqual([
      { kind: "delete", oldLine: 1, newLine: null },
      { kind: "delete", oldLine: 2, newLine: null },
    ]);
  });

  it("skips the no-newline marker", () => {
    const patch = ["@@ -1 +1 @@", "-a", "\\ No newline at end of file", "+b"].join("\n");
    expect(parsePatch(patch)).toEqual([
      { kind: "delete", oldLine: 1, newLine: null },
      { kind: "add", oldLine: null, newLine: 1 },
    ]);
  });

  it("ignores git file headers around hunks", () => {
    const patch = [
      "diff --git a/doc.md b/doc.md",
      "index 1111111..2222222 100644",
      "--- a/doc.md",
      "+++ b/doc.md",
      "@@ -1 +1 @@",
      "-a",
      "+b",
      "diff --git a/other.md b/other.md",
      "--- a/other.md",
      "+++ b/other.md",
    ].join("\n");
    expect(parsePatch(patch)).toEqual([
      { kind: "delete", oldLine: 1, newLine: null },
      { kind: "add", oldLine: null, newLine: 1 },
    ]);
  });

  it("reads CRLF patches and blank context lines", () => {
    // Some tools strip the single space that prefixes an empty context line.
    const patch = "@@ -1,3 +1,3 @@\r\n a\r\n\r\n-c\r\n+C\r\n";
    expect(parsePatch(patch)).toEqual([
      { kind: "context", oldLine: 1, newLine: 1 },
      { kind: "context", oldLine: 2, newLine: 2 },
      { kind: "delete", oldLine: 3, newLine: null },
      { kind: "add", oldLine: null, newLine: 3 },
    ]);
  });

  it("returns no lines for an empty or missing patch", () => {
    expect(parsePatch("")).toEqual([]);
    expect(parsePatch(undefined)).toEqual([]);
  });

  it("stops a hunk at a line it does not recognize", () => {
    expect(parsePatch("@@ -1,3 +1,3 @@\n a\n?garbage\n b")).toEqual([
      { kind: "context", oldLine: 1, newLine: 1 },
    ]);
  });
});

describe("indexPatchLines", () => {
  it("finds a patch line by side and line number", () => {
    const lines = parsePatch("@@ -1,2 +1,2 @@\n a\n-b\n+B");
    const index = indexPatchLines(lines);
    expect(index.left.get(1)).toEqual({ kind: "context", oldLine: 1, newLine: 1 });
    expect(index.right.get(1)).toEqual({ kind: "context", oldLine: 1, newLine: 1 });
    expect(index.left.get(2)?.kind).toBe("delete");
    expect(index.right.get(2)?.kind).toBe("add");
    expect(index.left.get(3)).toBeUndefined();
  });
});

describe("commentableLines", () => {
  it("lists the line numbers on each side, in order", () => {
    const index = indexPatchLines(
      parsePatch("@@ -3,3 +3,1 @@\n x\n-y\n-z\n@@ -1 +0,0 @@\n-a"),
    );
    expect(commentableLines(index)).toEqual({ left: [1, 3, 4, 5], right: [3] });
  });
});
