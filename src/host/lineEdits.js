// Line/character edits sent by the rich editor webview.
//
// The webview reports each change as a range in line/character positions of
// the text it last received, plus the text to insert. Positions are counted on
// the LF text (line breaks are not characters), so they mean the same thing in
// a CRLF document. The extension host applies them to its LF copy of the
// document to check that they fit before handing them to VS Code.

/**
 * @typedef {{ line: number, ch: number }} LinePosition
 * @typedef {{ from: LinePosition, to: LinePosition, insert: string }} LineEdit
 */

/**
 * Applies edits whose positions all refer to the original `text`, which must
 * use LF line breaks. Throws a RangeError for positions outside the text and
 * for reversed or overlapping ranges, and a TypeError for a non-string insert.
 *
 * @param {string} text
 * @param {readonly LineEdit[]} edits
 * @returns {string}
 */
function applyLineEdits(text, edits) {
  const lineStarts = computeLineStarts(text);
  const ranges = edits
    .map((edit) => {
      if (typeof edit.insert !== "string") {
        throw new TypeError("An edit must insert a string");
      }
      return {
        from: toOffset(text, lineStarts, edit.from),
        to: toOffset(text, lineStarts, edit.to),
        insert: edit.insert,
      };
    })
    .sort((a, b) => a.from - b.from);

  let result = "";
  let cursor = 0;
  for (const range of ranges) {
    if (range.to < range.from || range.from < cursor) {
      throw new RangeError("Edits must not be reversed or overlap");
    }
    result += text.slice(cursor, range.from) + range.insert;
    cursor = range.to;
  }
  return result + text.slice(cursor);
}

function computeLineStarts(text) {
  const starts = [0];
  for (let index = text.indexOf("\n"); index !== -1; index = text.indexOf("\n", index + 1)) {
    starts.push(index + 1);
  }
  return starts;
}

function toOffset(text, lineStarts, position) {
  const { line, ch } = position ?? {};
  if (
    !Number.isInteger(line) ||
    !Number.isInteger(ch) ||
    line < 0 ||
    ch < 0 ||
    line >= lineStarts.length
  ) {
    throw new RangeError(`Line ${line} is outside the document`);
  }
  const lineEnd = line + 1 < lineStarts.length ? lineStarts[line + 1] - 1 : text.length;
  const offset = lineStarts[line] + ch;
  if (offset > lineEnd) {
    throw new RangeError(`Character ${ch} is outside line ${line}`);
  }
  return offset;
}

module.exports = {
  applyLineEdits,
};
