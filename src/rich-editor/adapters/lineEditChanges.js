// Conversions between CodeMirror change sets and the line/character edits of
// the sync protocol (see src/host/syncSession.js).
import { ChangeSet, Text } from "@codemirror/state";

/** @param {string} text LF text */
export function textOf(text) {
  return Text.of(text.split("\n"));
}

/**
 * A change set turning `before` into `after`, touching only the part between
 * their common prefix and suffix.
 *
 * @param {Text} before
 * @param {string} after
 * @returns {ChangeSet}
 */
export function diffText(before, after) {
  const old = before.toString();
  const maxShared = Math.min(old.length, after.length);
  let prefix = 0;
  while (prefix < maxShared && old.charCodeAt(prefix) === after.charCodeAt(prefix)) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < maxShared - prefix &&
    old.charCodeAt(old.length - 1 - suffix) ===
      after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  if (prefix === old.length && prefix === after.length) {
    return ChangeSet.empty(old.length);
  }
  return ChangeSet.of(
    {
      from: prefix,
      to: old.length - suffix,
      insert: after.slice(prefix, after.length - suffix),
    },
    old.length,
  );
}

/**
 * Expresses `changes`, which apply to `base`, as line/character edits.
 *
 * @param {ChangeSet} changes
 * @param {Text} base
 */
export function toLineEdits(changes, base) {
  const edits = [];
  changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    edits.push({
      from: positionOf(base, fromA),
      to: positionOf(base, toA),
      insert: inserted.toString(),
    });
  });
  return edits;
}

function positionOf(doc, offset) {
  const line = doc.lineAt(offset);
  return { line: line.number - 1, ch: offset - line.from };
}
