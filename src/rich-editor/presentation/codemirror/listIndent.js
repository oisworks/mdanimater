// Tab and Shift-Tab on list items: shift the item and renumber ordered lists
// (see src/rich-editor/domain/listIndent.js). Anywhere else, and with more
// than one selection, the keys fall through to indentWithTab.
import { shiftListItems } from "../../domain/listIndent.js";

function shiftListCommand(direction) {
  return ({ state, dispatch }) => {
    if (state.readOnly || state.selection.ranges.length > 1) {
      return false;
    }
    const { from, to } = state.selection.main;
    const firstLine = state.doc.lineAt(from);
    const lastLine = state.doc.lineAt(to);
    const edits = shiftListItems(
      state.doc.toString().split("\n"),
      firstLine.number - 1,
      lastLine.number - 1,
      direction,
    );
    if (edits === null) {
      return false;
    }
    if (edits.length > 0) {
      const changes = edits.map((edit) => {
        const line = state.doc.line(edit.line + 1);
        return { from: line.from + edit.from, to: line.from + edit.to, insert: edit.insert };
      });
      dispatch(
        state.update({
          changes,
          scrollIntoView: true,
          userEvent: direction === "indent" ? "input.indent" : "delete.dedent",
        }),
      );
    }
    return true;
  };
}

export const listIndentKeymap = [
  { key: "Tab", run: shiftListCommand("indent"), shift: shiftListCommand("outdent") },
];
