import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  isRegisteredSetting,
  markdownFileEditorAssociationPatterns,
  nextMarkdownEditorAssociations,
} = require("../src/host/editorAssociations.js");

describe("isRegisteredSetting", () => {
  // VS Code gives every registered setting a default ({} for an object), and
  // none to a key nobody registered.
  const config = (inspected) => ({ inspect: () => inspected });

  it("accepts a setting the editor registers", () => {
    expect(isRegisteredSetting(config({ key: "workbench.diffEditorAssociations", defaultValue: {} }), "diffEditorAssociations")).toBe(true);
    expect(isRegisteredSetting(config({ key: "x", defaultValue: null }), "x")).toBe(true);
  });

  it("rejects a setting the editor does not have, such as diffEditorAssociations in Cursor 1.7", () => {
    expect(isRegisteredSetting(config({ key: "workbench.diffEditorAssociations" }), "diffEditorAssociations")).toBe(false);
    expect(isRegisteredSetting(config(undefined), "diffEditorAssociations")).toBe(false);
  });
});

const ownAssociations = Object.fromEntries(
  markdownFileEditorAssociationPatterns.map((pattern) => [pattern, "mdanimater.editor"]),
);

describe("markdownFileEditorAssociationPatterns", () => {
  it("covers local, remote and virtual Markdown files but not Git diffs", () => {
    expect(markdownFileEditorAssociationPatterns).toEqual([
      "file:/**/*.md",
      "file:/**/*.markdown",
      "vscode-remote:/**/*.md",
      "vscode-remote:/**/*.markdown",
      "vscode-vfs:/**/*.md",
      "vscode-vfs:/**/*.markdown",
    ]);
  });
});

describe("nextMarkdownEditorAssociations", () => {
  it("points Markdown files at the editor and keeps unrelated associations", () => {
    const { associations, changed } = nextMarkdownEditorAssociations(
      { "*.png": "imagePreview.previewEditor" },
      true,
    );

    expect(changed).toBe(true);
    expect(associations).toEqual({ "*.png": "imagePreview.previewEditor", ...ownAssociations });
  });

  it("reports no change when everything is already in place", () => {
    const { changed } = nextMarkdownEditorAssociations(ownAssociations, true);
    expect(changed).toBe(false);
  });

  it("removes its own associations when Markdown should open as text", () => {
    const { associations, changed } = nextMarkdownEditorAssociations(
      { ...ownAssociations, "*.png": "imagePreview.previewEditor" },
      false,
    );

    expect(changed).toBe(true);
    expect(associations).toEqual({ "*.png": "imagePreview.previewEditor" });
  });

  it("leaves an association the user pointed at another editor", () => {
    const current = { "file:/**/*.md": "default" };
    const { associations, changed } = nextMarkdownEditorAssociations(current, false);

    expect(changed).toBe(false);
    expect(associations).toEqual(current);
  });

  it("drops associations left by Richdown, the extension mdanimater was forked from", () => {
    const { associations, changed } = nextMarkdownEditorAssociations(
      {
        "file:/**/*.md": "richdown.richEditor",
        "docs/**/*.mdx": "richdown.richEditor",
        "*.md": "richdown.richEditor",
      },
      false,
    );

    expect(changed).toBe(true);
    expect(associations).toEqual({});
  });

  it("replaces Richdown's associations with its own", () => {
    const richdown = Object.fromEntries(
      markdownFileEditorAssociationPatterns.map((pattern) => [pattern, "richdown.richEditor"]),
    );
    const { associations } = nextMarkdownEditorAssociations(richdown, true);

    expect(associations).toEqual(ownAssociations);
  });

  it("drops the old unscoped patterns it used to write", () => {
    const { associations } = nextMarkdownEditorAssociations(
      { "*.md": "default", "*.markdown": "mdanimater.editor" },
      true,
    );

    expect(associations).toEqual(ownAssociations);
  });

  it("does not modify the object it was given", () => {
    const current = { "*.md": "default" };
    nextMarkdownEditorAssociations(current, true);
    expect(current).toEqual({ "*.md": "default" });
  });
});
