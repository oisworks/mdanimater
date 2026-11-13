// The `workbench.editorAssociations` entries that make Markdown files open in
// the mdanimater editor.
//
// VS Code matches editor-association globs that contain a path separator against
// `${resource.scheme}:${resource.path}`, so a scheme-qualified pattern only applies
// to that scheme. Local files use `file:`; WSL, SSH, Dev Containers, and Codespaces
// use `vscode-remote:`; web/virtual workspaces use `vscode-vfs:`. Covering the remote
// schemes keeps "open by default" working when connected to WSL and other remotes,
// while still excluding Source Control diff resources (which use the `git:` scheme).

const richEditorViewType = "mdanimater.editor";
// Richdown, the extension mdanimater was forked from, wrote the same associations
// with its own editor. Installing mdanimater leaves them behind.
const forkedFromViewType = "richdown.richEditor";
// Unscoped patterns earlier versions wrote; they also matched Git diffs.
const legacyMarkdownEditorAssociationPatterns = ["*.md", "*.markdown"];
const markdownFileEditorAssociationSchemes = ["file", "vscode-remote", "vscode-vfs"];
const markdownFileEditorAssociationExtensions = ["md", "markdown"];
const markdownFileEditorAssociationPatterns = markdownFileEditorAssociationSchemes.flatMap(
  (scheme) => markdownFileEditorAssociationExtensions.map((extension) => `${scheme}:/**/*.${extension}`),
);

/**
 * @param {Record<string, string>} current The current editorAssociations.
 * @param {boolean} useRichEditor Whether Markdown files open in mdanimater.
 * @returns {{ associations: Record<string, string>, changed: boolean }}
 */
function nextMarkdownEditorAssociations(current, useRichEditor) {
  const associations = { ...current };
  let changed = false;

  for (const [pattern, viewType] of Object.entries(associations)) {
    if (viewType === forkedFromViewType) {
      delete associations[pattern];
      changed = true;
    }
  }

  for (const pattern of legacyMarkdownEditorAssociationPatterns) {
    if (associations[pattern] === richEditorViewType || associations[pattern] === "default") {
      delete associations[pattern];
      changed = true;
    }
  }

  for (const pattern of markdownFileEditorAssociationPatterns) {
    if (useRichEditor) {
      if (associations[pattern] !== richEditorViewType) {
        associations[pattern] = richEditorViewType;
        changed = true;
      }
    } else if (associations[pattern] === richEditorViewType) {
      delete associations[pattern];
      changed = true;
    }
  }

  return { associations, changed };
}

/**
 * Whether the running editor has a setting. Writing one it does not have
 * throws ("... is not a registered configuration"): Cursor 1.7, for one, has
 * no workbench.diffEditorAssociations. VS Code gives every registered setting
 * a default value ({} for an object), and none to an unknown key.
 * @param {{ inspect(key: string): { defaultValue?: unknown } | undefined }} config
 * @param {string} key
 * @returns {boolean}
 */
function isRegisteredSetting(config, key) {
  return config.inspect(key)?.defaultValue !== undefined;
}

module.exports = {
  isRegisteredSetting,
  markdownFileEditorAssociationPatterns,
  markdownFileEditorAssociationSchemes,
  nextMarkdownEditorAssociations,
  richEditorViewType,
};
