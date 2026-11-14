// Widths belong to this editor view, not to Markdown or its undo history.
import { StateEffect, StateField } from "@codemirror/state";
import { findTableBlocks } from "../../domain/markdownBlocks.js";

export const setTableDisplayWidths = StateEffect.define();
export const tableDisplayWidthsField = StateField.define({
  create: () => [],
  update(entries, transaction) {
    if (transaction.docChanged && entries.length) {
      const tables = findTableBlocks(transaction.newDoc);
      entries = entries.flatMap((entry) => {
        let deleted = false;
        transaction.changes.iterChanges((from, to, _newFrom, _newTo, inserted) => {
          if (from <= entry.from && to >= entry.to && inserted.length === 0) deleted = true;
        });
        if (deleted) return [];
        const from = transaction.changes.mapPos(entry.from, 1);
        const replacementFrom = transaction.changes.mapPos(entry.from, -1);
        const table = tables.find((candidate) =>
          candidate.from === from || candidate.from === replacementFrom,
        );
        // A changed column structure must not inherit widths for wrong columns.
        return table && table.columnCount === entry.widths.length
          ? [{ from: table.from, to: table.sourceTo, widths: entry.widths }]
          : [];
      });
    }
    for (const effect of transaction.effects) {
      if (effect.is(setTableDisplayWidths)) {
        entries = entries.filter((entry) => entry.from !== effect.value.from);
        entries = [...entries, { ...effect.value, widths: [...effect.value.widths] }];
      }
    }
    return entries;
  },
});

export function getTableDisplayWidths(state, tableBlock) {
  const entry = state.field(tableDisplayWidthsField, false)?.find(
    (candidate) => candidate.from === tableBlock.from,
  );
  return entry?.widths.length === tableBlock.columnCount
    ? entry.widths
    : tableBlock.columnWidths;
}
