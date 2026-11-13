# Changelog

## 0.3.3 - 2026-11-13

- Drag the right edge of the text area to resize it and remember the width. Smaller windows still fit the content; double-click the edge to restore automatic width. The grip also supports arrow keys and Home to reset.

## 0.3.2 - 2026-11-12

- Fit Markdown content to the available editor width by default, including ultrawide windows, while reserving space for the outline. Keep the previous centered layout available as **Fixed width**.

## 0.3.1 - 2026-11-11

- Unify the Command Palette and editor toolbar entry points into **mdanimater: Open Menu**, with editing mode, Rich Diff, export, formatting and configuration actions inside it.
- Keep automatic Markdown editing and Git diff rendering enabled by default. All features ship in one VSIX; no per-feature installation or activation is required.
- Keep individual command IDs callable by existing shortcuts and the Source Control context menu.

## 0.3.0 - 2026-11-11

- Unify the product, package, extension identity (`oisworks.mdanimater`), command/setting IDs, editor IDs, configuration filename, lint suppression syntax, schemas, labels and distribution artifacts under mdanimater.
- This is a breaking rename: install the new extension and migrate settings, keybindings, editor associations, configuration files and lint comments using docs/CONFIGURATION.md. Old identifiers are no longer supported.
- Check naming in source, documentation, generated bundles and extracted VSIX files before distribution.

## 0.2.6

- Open Markdown Git diffs as rendered Rich Diff, including Source Control comparisons with their original staged or historical revisions. Add a Source Diff button and an automatic routing setting.
- Align table columns across rows and matching revisions, honor alignment and saved widths, and keep changed cells colored. Preserve fenced table examples as code.
- Include unsaved document text when opening and refreshing a working-tree comparison.

All notable changes to mdanimater will be documented in this file. mdanimater is a fork of Richdown 0.9.1; the entries from 0.9.1 down are Richdown's own history.

## mdanimater 0.2.5 - 2026-11-10

- Change the then-current extension ID and align its display name, command labels, settings title, lockfile, tests and VSIX filename. That historical identity is superseded by 0.3.0.
- At the time, retain legacy command/settings/editor IDs, configuration filenames and lint syntax for compatibility. This exception is removed in 0.3.0.
- Document installation and the new `editor.defaultFormatter` ID. Keep Richdown attribution and bundled dependency licenses.

## mdanimater 0.2.4 - 2026-11-10

- Prepare the public distribution with updated repository links and preserved Richdown attribution. At the time, retain existing command and setting identifiers; those are replaced in 0.3.0.
- Include bundled dependency license texts and make registry deployment manual and opt-in.

## mdanimater 0.2.3 - 2026-11-08

- Keep empty list items rendered after pressing Enter at the start of existing content, including when the preceding marker has no trailing space. Apply list styling only to parsed list markers so code and setext headings remain unchanged.
- Add regression coverage for Enter in bullet, nested and numbered lists and for literal marker lookalikes.

## mdanimater 0.2.2 - 2026-11-08

- Fix Japanese heading input duplicating preedit text when existing warning decorations overlap. Update CodeMirror view from 6.43.0 to 6.43.15 (and its required state dependency), preserving the IME's native text-node selection through decoration updates.
- Add a regression test for nested heading warnings and verify native Japanese IME input, conversion, commit and saving in Cursor. Keep the list rendering and deferred lint updates from 0.2.1.

## mdanimater 0.2.1 - 2026-11-08

- Keep list bullets and numbering rendered while editing, so focusing an item no longer shifts its text to the left.
- Defer incoming lint decorations until IME composition finishes, preventing warning updates from disrupting Japanese heading input. Pending warning positions follow edits and only the latest result is displayed.
- Preserve literal list-like text inside code blocks.

## mdanimater 0.1.0 - 2026-10-10

- Introduced the fork's original product name and identifiers, later superseded by the unified namespace in 0.3.0. Remove Markdown associations left by Richdown.
- Typing in the rich editor and changes from AI agents or other tools to the same document are merged instead of one overwriting the other: the webview sends its edits as diffs and rebases them onto newer text from VS Code.
- Save an open file one second after it stops changing (on by default), so an agent's write lands on a saved file that VS Code reloads instead of ending in a save conflict. These saves do not run format-on-save.
- Undo, redo and save go to VS Code, so the rich editor and the text editor share one undo history. Table cells and the search field keep their own native undo.
- Fixed `mdanimater: Toggle Markdown Open Mode` failing in Cursor, which has no `workbench.diffEditorAssociations` setting to write. The setting is now only written where the editor has it.
- Table columns can be resized by dragging the right edge of a header cell. Widths are stored in the delimiter row as the length of each cell; double-click the edge to reset every column.

## 0.9.1 - 2026-10-07

- Added a Markdown formatter. `Richdown: Format Document` (also `Shift+Alt+F` in the Richdown editor, and VS Code's Format Document when Richdown is the Markdown formatter) converts setext headings, normalizes heading spacing, list markers and ordered list numbers, aligns tables with East Asian wide characters counted as two columns, adds blank lines around headings, code blocks, lists and tables, and cleans up whitespace. Set `richdown.formatOnSave` to format on save.
- Added Markdown lint rules. Problems appear in the Problems panel and as squiggles with hover messages in the Richdown editor. An overview ruler at the editor's right edge marks where every problem is in the whole document; click a mark to scroll there, or press F8 / Shift+F8 to move to the next or previous problem. Turn checking off with `richdown.lint.enabled`, or silence a rule in a document with `<!-- richdown-lint-disable-next-line rule-name -->`.
- Each formatter and lint rule can be turned on or off, or given options and a severity, in a `.richdownrc.json` file, which VS Code completes and validates. `Richdown: Create Formatter and Lint Configuration` creates one that lists every rule.

## 0.9.0 - 2026-10-02

- Fixed `<br>` tags inside table cells showing as literal text in rich tables, Richdown Diff, and HTML/PDF export; they now render as line breaks.
- Links inside Richdown and Richdown Diff to `#heading` anchors and `#L12` lines now scroll to the target instead of only opening the file.
- Markdown file links opened by AI extensions such as Claude Code and Codex now open in Richdown at the linked line with the match highlighted. Those extensions open files with `showTextDocument`, which always uses the text editor, so Richdown takes such new text editors over and carries their position. Ordinary opens still go straight to Richdown. "Reopen Editor With > Text Editor" keeps a file in the text editor.
- Added the `richdown.jumpToOpenedPosition` setting (off by default) to also jump to VS Code Search results and Copilot Chat links. VS Code passes the position only to text editors, so in this mode every Markdown file opens in the text editor first and switches to Richdown right away, which causes a visible flicker, and Richdown does not add its `workbench.editorAssociations` entries.
- Added a banner for pending GitHub Copilot edits to the open file, with Keep, Undo, and Review Changes. Copilot's inline diff and Keep/Undo controls exist only in the text editor, so Review Changes reopens the file there, and Richdown takes it back once every edit is kept or undone.

## 0.8.4 - 2026-08-20

- Fixed Richdown failing to open any Markdown file after 0.8.3. The line-ending module added in that release was excluded from the packaged extension, so the extension host threw while loading and the rich editor never started.

## 0.8.3 - 2026-08-18

- Fixed typing in the rich editor on Windows inserting stray blank lines and jumping the caret. Documents that use CRLF line endings — the default for new files on Windows — are now translated to the editor's LF text and written back with the document's own line endings, so an edit is no longer echoed back as an external change.

## 0.8.2 - 2026-07-30

- Fixed the Git change markers beside the line numbers not appearing for edits inside a rendered block. A change in a rich table, Mermaid diagram, Gherkin board, `<details>` section, or front matter card now marks the whole block instead of showing nothing.

## 0.8.1 - 2026-07-22

- Made rich tables wrap long cell text within the editor width instead of forcing horizontal scrolling; scrolling now only appears when many columns cannot fit even after wrapping.
- Reclaimed cell space previously reserved for the hover Actions button so narrow columns stay readable; the button now overlays the cell corner while hovered.
- Fixed the table +Row/+Column toolbar buttons wrapping their labels in narrow windows, and kept wide tables from stretching the whole editor horizontally.
- Removed the fixed 720px width and 460px height caps on image previews so images align with the surrounding content width; smaller images keep their natural size.

## 0.8.0 - 2026-07-17

- Added completions matching the standard VS Code editor. Richdown runs VS Code's registered completion providers against the real document and shows their suggestions inline — including ones contributed by other extensions, such as model names in agent files and Markdown link path/anchor suggestions. Like VS Code, completions open inside link targets, on front matter keys and values, or with Ctrl+Space — never while typing ordinary text.
- Added YAML front matter rendering: documents that start with a `---` fenced header now show a clean metadata card with keys, values, and tag chips instead of raw delimiter lines. Clicking the card edits the YAML source with proper YAML syntax parsing, and the card returns when the caret leaves the block.

## 0.7.5 - 2026-07-16

- Fixed "open Markdown with Richdown by default" not taking effect for files opened over a remote connection (WSL, SSH, Dev Containers, Codespaces, and web/virtual workspaces). The editor associations now cover the `vscode-remote` and `vscode-vfs` schemes in addition to local files.

## 0.7.4 - 2026-07-15

- Fixed underscores in table cells and other rich inline previews being mistaken for emphasis inside identifiers.
- Improved expanded `<details>` spacing, nested list layout, wide-table handling, and fenced-code language labels and syntax highlighting.
- Made Mermaid preview heights follow each rendered diagram's aspect ratio and available editor width, with viewport-aware limits for tall diagrams.
- Made rich tables easier to operate with visible row and column controls, keyboard cell navigation, accessible action menus, edit cancellation, and multi-cell tabular paste.
- Fixed rich-table edge cases for escaped and inline-code pipes, indented or outer-pipe-free rows, whitespace preservation, and predictable Tab and Escape focus behavior.

## 0.7.3 - 2026-07-15

- Fixed Markdown block rendering inside expanded `<details>` previews, including code fences, headings, lists, quotes, images, and tables.

## 0.7.2 - 2026-07-15

- Added automatic refresh for Markdown files changed on disk by AI agents and other external tools while they are open in Richdown.

## 0.7.1 - 2026-07-10

- Fixed packaged VSIX builds so the export runtime is included and Richdown commands register correctly after activation.

## 0.7.0 - 2026-07-09

- Added HTML export for local Markdown files as a standalone Richdown preview using the same rich table, Mermaid, Gherkin, image, task, code, and theme UI as the editor.
- Added PDF export for local Markdown files by printing the standalone Richdown preview through an installed Chromium-based browser.

## 0.6.0 - 2026-07-08

- Added clearer colorized Mermaid rendering for inline diagram previews.
- Added a setting to turn Mermaid colorization on or off.
- Added Mermaid preview support for Azure DevOps-style `::: mermaid` blocks.
- Added Gherkin fenced code block support with switchable BDD board and source views.

## 0.5.0 - 2026-06-14

- Added inline color swatches after Markdown inline code color values.
- Added Git change markers beside line numbers for added, changed, and deleted lines.
- Added stronger Richdown search match highlighting for the active search query.

## 0.3.0 - 2026-05-16

- Added `Richdown: Open Rich Diff` for viewing Markdown changes with Richdown-rendered side-by-side diffs.
- Added a Source Control context menu entry for opening Markdown changes in Richdown Diff.
- Added rich diff rendering for headings, lists, task checkboxes, blockquotes, thematic breaks, tables, images, links, and syntax-highlighted code blocks with copy controls.
- Kept the VS Code native diff viewer available as `Richdown: Open Git Diff`.

## 0.2.0 - 2026-05-16

- Added `Richdown: Open Git Diff` for opening the VS Code Git diff of the current Markdown file.
- Added an editor title diff button for Markdown files.
- Kept Markdown files in Source Control Changes on VS Code's native diff viewer while regular local Markdown files open directly in Richdown without a reopen flicker.

## 0.1.0 - 2026-05-15

- Initial Richdown release.
- Added a custom Markdown editor with inline rich preview behavior.
- Added editable rich tables with cell editing, row and column actions, and inline Markdown rendering inside cells.
- Added Mermaid diagram previews with lazy loading, zoom, pan, fit, and modal viewing.
- Added syntax-highlighted fenced code blocks with copy controls.
- Added configurable themes, preview width, and empty-line hint visibility.
- Added image previews, clickable links, task checkboxes, details previews, and slash-command Markdown insertion.
- Increased the Large Mermaid preview area for detailed diagrams.
