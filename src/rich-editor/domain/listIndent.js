// Tab and Shift-Tab on Markdown list items, the way Obsidian does them.
//
// Indenting moves the selected lines, and the nested lines of the last
// selected item, one tab deeper; outdenting removes one tab (or up to a tab's
// width of spaces). The outermost moved items are then renumbered for where
// they landed: an item that starts a new nested list becomes 1, an item that
// follows a sibling continues its number, and the list it left closes the
// gap. Nested lists that moved along keep their numbers.

import { countIndentColumns } from "./markdownBlocks.js";

const TAB_SIZE = 4;
const LIST_ITEM = /^([ \t]*)(?:[-*+]|(\d{1,9})([.)]))(?:[ \t]+|$)/;

/**
 * @typedef {{ line: number, from: number, to: number, insert: string }} LineEdit
 * `line` is a zero-based index into `lines`; `from` and `to` are columns on
 * that line as it was before the edit.
 */

/**
 * @param {string[]} lines the document's lines
 * @param {number} firstLine zero-based first selected line
 * @param {number} lastLine zero-based last selected line
 * @param {"indent" | "outdent"} direction
 * @returns {LineEdit[] | null} null when the selection does not start on a
 *   list item, so the caller can fall back to plain indentation
 */
export function shiftListItems(lines, firstLine, lastLine, direction) {
  if (!parseListItem(lines[firstLine])) {
    return null;
  }

  const blockEnd = extendThroughChildren(lines, lastLine);
  const edits = [];
  const shifted = [...lines];
  for (let index = firstLine; index <= blockEnd; index += 1) {
    const edit = shiftIndent(lines[index], direction);
    if (edit) {
      edits.push({ line: index, ...edit });
      shifted[index] = edit.insert + lines[index].slice(edit.to);
    }
  }
  if (edits.length === 0) {
    return [];
  }

  const moved = new Set(edits.map((edit) => edit.line));
  const renumbered = renumberAffectedLists(lines, shifted, firstLine, lastLine, blockEnd, moved);
  return [...edits, ...renumbered].sort((left, right) => left.line - right.line || left.from - right.from);
}

function extendThroughChildren(lines, lastLine) {
  const item = parseListItem(lines[lastLine]);
  if (!item) {
    return lastLine;
  }
  let end = lastLine;
  for (let index = lastLine + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "") {
      continue;
    }
    if (indentColumns(lines[index]) <= item.column) {
      break;
    }
    end = index;
  }
  return end;
}

function shiftIndent(text, direction) {
  if (text.trim() === "") {
    return null;
  }
  if (direction === "indent") {
    return { from: 0, to: 0, insert: "\t" };
  }
  if (text.startsWith("\t")) {
    return { from: 0, to: 1, insert: "" };
  }
  const spaces = /^ */.exec(text)[0].length;
  return spaces > 0 ? { from: 0, to: Math.min(spaces, TAB_SIZE), insert: "" } : null;
}

// Renumbers the ordered lists the moved items now belong to, and the list
// they were moved out of.
function renumberAffectedLists(lines, shifted, firstLine, lastLine, blockEnd, moved) {
  const selectedItems = [];
  for (let index = firstLine; index <= lastLine; index += 1) {
    const item = moved.has(index) && parseListItem(lines[index]);
    if (item) {
      selectedItems.push({ index, column: item.column });
    }
  }
  const outermost = Math.min(...selectedItems.map((item) => item.column));
  const anchors = selectedItems.filter((item) => item.column === outermost).map((item) => item.index);
  const leftList = findFollowingSibling(shifted, blockEnd + 1, parseListItem(lines[firstLine]));
  if (leftList !== null) {
    anchors.push(leftList);
  }

  const numbers = new Map();
  const seenStarts = new Set();
  for (const anchor of anchors) {
    const list = collectList(shifted, anchor);
    if (!list || seenStarts.has(list[0])) {
      continue;
    }
    seenStarts.add(list[0]);
    const first = parseListItem(shifted[list[0]]);
    let number = moved.has(list[0]) ? 1 : first.number;
    for (const index of list) {
      numbers.set(index, number);
      number += 1;
    }
  }

  const edits = [];
  for (const [index, number] of numbers) {
    const item = parseListItem(lines[index]);
    if (item.number !== number) {
      edits.push({ line: index, from: item.numberFrom, to: item.numberTo, insert: String(number) });
    }
  }
  return edits;
}

// The first item after `start` that sat next to the moved block in the list
// it was moved out of, or null.
function findFollowingSibling(lines, start, oldItem) {
  for (let index = start; index < lines.length; index += 1) {
    const text = lines[index];
    if (text.trim() === "") {
      continue;
    }
    const column = indentColumns(text);
    if (column > oldItem.column) {
      continue;
    }
    const item = parseListItem(text);
    return item && column === oldItem.column ? index : null;
  }
  return null;
}

// The line indices of every item in the ordered list that holds the item at
// `index`, or null when that line is not an ordered item.
function collectList(lines, index) {
  const item = parseListItem(lines[index]);
  if (!item || item.number === null) {
    return null;
  }
  const isSibling = (other) =>
    other && other.number !== null && other.column === item.column && other.delimiter === item.delimiter;
  const walk = (step) => {
    const found = [];
    for (let cursor = index + step; cursor >= 0 && cursor < lines.length; cursor += step) {
      const text = lines[cursor];
      if (text.trim() === "") {
        continue;
      }
      const column = indentColumns(text);
      if (column > item.column) {
        continue;
      }
      const other = parseListItem(text);
      if (!isSibling(other)) {
        break;
      }
      found.push(cursor);
    }
    return found;
  };
  return [...walk(-1).reverse(), index, ...walk(1)];
}

function parseListItem(text) {
  const match = LIST_ITEM.exec(text ?? "");
  if (!match) {
    return null;
  }
  const [, indent, digits, delimiter] = match;
  return {
    column: indentColumns(indent),
    number: digits ? Number(digits) : null,
    delimiter: delimiter || "",
    numberFrom: indent.length,
    numberTo: indent.length + (digits ? digits.length : 0),
  };
}

function indentColumns(text) {
  return countIndentColumns(/^[ \t]*/.exec(text)[0]);
}
