import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { indexPatchLines, parsePatch } = require("../src/host/review/patchHunks.js");
const {
  findPatchLine,
  toGitHubPosition,
  toGitLabPosition,
} = require("../src/host/review/commentPosition.js");

// Line 1 is context, old line 2 was replaced by new line 2, new line 3 was
// added, and line 4 (old 3) is context again.
const index = indexPatchLines(
  parsePatch(["@@ -1,3 +1,4 @@", " a", "-b", "+B", "+c", " d"].join("\n")),
);
const file = { path: "docs/guide.md", previousPath: "docs/guide.md" };
const renamed = { path: "docs/new.md", previousPath: "docs/old.md" };
const diffRefs = { baseSha: "base1", startSha: "start1", headSha: "head1" };

describe("findPatchLine", () => {
  it("finds lines on the side that was clicked", () => {
    expect(findPatchLine(index, "left", 2)?.kind).toBe("delete");
    expect(findPatchLine(index, "right", 2)?.kind).toBe("add");
    expect(findPatchLine(index, "left", 3)?.kind).toBe("context");
    expect(findPatchLine(index, "right", 4)?.kind).toBe("context");
  });

  it("returns null outside the hunks and for invalid input", () => {
    expect(findPatchLine(index, "right", 99)).toBeNull();
    expect(findPatchLine(index, "middle", 1)).toBeNull();
    expect(findPatchLine(index, "left", 1.5)).toBeNull();
    expect(findPatchLine(index, "left", "1")).toBeNull();
    expect(findPatchLine(index, "left", 0)).toBeNull();
  });
});

describe("toGitHubPosition", () => {
  it("puts added lines on the right", () => {
    expect(toGitHubPosition(findPatchLine(index, "right", 3), file, "head1")).toEqual({
      path: "docs/guide.md",
      commit_id: "head1",
      line: 3,
      side: "RIGHT",
    });
  });

  it("puts deleted lines on the left", () => {
    expect(toGitHubPosition(findPatchLine(index, "left", 2), file, "head1")).toEqual({
      path: "docs/guide.md",
      commit_id: "head1",
      line: 2,
      side: "LEFT",
    });
  });

  it("puts unchanged lines on the right even when clicked on the left", () => {
    expect(toGitHubPosition(findPatchLine(index, "left", 3), file, "head1")).toEqual({
      path: "docs/guide.md",
      commit_id: "head1",
      line: 4,
      side: "RIGHT",
    });
  });

  it("uses the new path of a renamed file", () => {
    expect(toGitHubPosition(findPatchLine(index, "left", 2), renamed, "head1").path).toBe(
      "docs/new.md",
    );
  });

  it("returns null when there is no line", () => {
    expect(toGitHubPosition(null, file, "head1")).toBeNull();
  });
});

describe("toGitLabPosition", () => {
  const shas = { base_sha: "base1", start_sha: "start1", head_sha: "head1" };

  it("gives added lines only a new line", () => {
    expect(toGitLabPosition(findPatchLine(index, "right", 3), renamed, diffRefs)).toEqual({
      position_type: "text",
      ...shas,
      old_path: "docs/old.md",
      new_path: "docs/new.md",
      new_line: 3,
    });
  });

  it("gives deleted lines only an old line", () => {
    expect(toGitLabPosition(findPatchLine(index, "left", 2), file, diffRefs)).toEqual({
      position_type: "text",
      ...shas,
      old_path: "docs/guide.md",
      new_path: "docs/guide.md",
      old_line: 2,
    });
  });

  it("gives unchanged lines both numbers", () => {
    expect(toGitLabPosition(findPatchLine(index, "right", 4), file, diffRefs)).toEqual({
      position_type: "text",
      ...shas,
      old_path: "docs/guide.md",
      new_path: "docs/guide.md",
      old_line: 3,
      new_line: 4,
    });
  });

  it("returns null when there is no line", () => {
    expect(toGitLabPosition(null, file, diffRefs)).toBeNull();
  });
});
