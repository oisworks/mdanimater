// Column widths stored in a Markdown table's delimiter row.
//
// Markdown has no syntax for column widths, so, as Pandoc does, the length of
// each delimiter cell is read as that column's width in characters. Two kinds
// of cells mean "no width" so existing tables keep their automatic layout:
// three dashes or fewer (the usual minimal `---`), and a cell exactly as long
// as the column's widest content (what the table-format rule and Prettier
// write when they align a table).

const MIN_DASHES = 4;
const MINIMAL_DASHES = 3;

/**
 * Visible width of text in a monospace editor. A copy of `displayWidth` in
 * src/host/markdownStructure.js, which the formatter uses to pad tables.
 * @param {string} text
 * @returns {number}
 */
export function displayWidth(text) {
  let width = 0;
  for (const character of String(text)) {
    const codePoint = character.codePointAt(0);
    if (codePoint === 0x200d || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)) {
      continue;
    }
    if (codePoint >= 0x300 && codePoint <= 0x36f) {
      continue;
    }
    width += isWideCodePoint(codePoint) ? 2 : 1;
  }
  return width;
}

function isWideCodePoint(codePoint) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) ||
    (codePoint >= 0x2e80 && codePoint <= 0x303e) ||
    (codePoint >= 0x3041 && codePoint <= 0x33ff) ||
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
    (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  );
}

/**
 * The width the table-format rule pads each column to.
 * @param {string[][]} rows Cell source text of the header and body rows.
 * @param {number} columnCount
 * @returns {number[]}
 */
export function columnContentWidths(rows, columnCount) {
  return Array.from({ length: columnCount }, (_, column) =>
    Math.max(MINIMAL_DASHES, ...rows.map((row) => displayWidth(row[column] ?? ""))),
  );
}

/**
 * @param {string} delimiterCell
 * @param {number} contentWidth From columnContentWidths.
 * @returns {number | null} The width in characters, or null for none.
 */
export function parseColumnWidth(delimiterCell, contentWidth) {
  const value = String(delimiterCell || "").trim();
  const dashes = value.replace(/:/g, "").length;
  if (dashes <= MINIMAL_DASHES || value.length === contentWidth) {
    return null;
  }
  return value.length;
}

/**
 * The narrowest width that still reads back as a width.
 * @param {"left" | "center" | "right"} alignment
 * @returns {number}
 */
export function minimumColumnWidth(alignment) {
  return MIN_DASHES + colonCount(alignment);
}

/**
 * @param {"left" | "center" | "right"} alignment
 * @param {number | null} width
 * @param {number} contentWidth From columnContentWidths.
 * @returns {string}
 */
export function formatDelimiterCell(alignment, width, contentWidth) {
  let length = MINIMAL_DASHES + colonCount(alignment);
  if (width !== null && width !== undefined) {
    length = Math.max(minimumColumnWidth(alignment), Math.round(width));
    // A cell as long as the content would read back as "no width".
    if (length === contentWidth) {
      length += 1;
    }
  }
  const dashes = "-".repeat(length - colonCount(alignment));
  if (alignment === "center") return `:${dashes}:`;
  if (alignment === "right") return `${dashes}:`;
  return dashes;
}

/**
 * @param {number} pixels
 * @param {number} characterPixels The rendered width of 1ch.
 * @param {"left" | "center" | "right"} alignment
 * @returns {number}
 */
export function columnWidthFromPixels(pixels, characterPixels, alignment) {
  return Math.max(minimumColumnWidth(alignment), Math.round(pixels / characterPixels));
}

function colonCount(alignment) {
  if (alignment === "center") return 2;
  if (alignment === "right") return 1;
  return 0;
}
