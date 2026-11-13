// Unified diff patch → the lines a review comment can be attached to.
//
// GitHub and GitLab only accept line comments on lines that appear in the
// pull request's own diff hunks. mdanimater's Rich Diff aligns lines with its own
// algorithm, whose hunks can start and end elsewhere, so the commentable lines
// are read from the patch the provider returns instead.

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * @typedef {object} PatchLine
 * @property {"context" | "add" | "delete"} kind
 * @property {number | null} oldLine Line number in the base, null for added lines.
 * @property {number | null} newLine Line number in the head, null for deleted lines.
 */

/**
 * @param {string | undefined} patch
 * @returns {PatchLine[]}
 */
function parsePatch(patch) {
  const lines = [];
  // Remaining line counts of the current hunk. Text outside a hunk (git file
  // headers, the next file's `---` / `+++`) is skipped until the next header.
  let oldRemaining = 0;
  let newRemaining = 0;
  let oldLine = 0;
  let newLine = 0;

  for (const text of String(patch || "").split(/\r?\n/)) {
    const header = text.match(HUNK_HEADER);
    if (header) {
      oldLine = Number(header[1]);
      oldRemaining = header[2] === undefined ? 1 : Number(header[2]);
      newLine = Number(header[3]);
      newRemaining = header[4] === undefined ? 1 : Number(header[4]);
      continue;
    }
    if (oldRemaining <= 0 && newRemaining <= 0) continue;

    // Some tools strip the space that prefixes an empty context line.
    const marker = text === "" ? " " : text[0];
    if (marker === " ") {
      lines.push({ kind: "context", oldLine, newLine });
      oldLine += 1;
      newLine += 1;
      oldRemaining -= 1;
      newRemaining -= 1;
    } else if (marker === "-") {
      lines.push({ kind: "delete", oldLine, newLine: null });
      oldLine += 1;
      oldRemaining -= 1;
    } else if (marker === "+") {
      lines.push({ kind: "add", oldLine: null, newLine });
      newLine += 1;
      newRemaining -= 1;
    } else if (marker !== "\\") {
      // Not a diff line: the patch is malformed, so stop reading this hunk.
      oldRemaining = 0;
      newRemaining = 0;
    }
  }

  return lines;
}

/**
 * @typedef {{ left: Map<number, PatchLine>, right: Map<number, PatchLine> }} PatchLineIndex
 */

/**
 * Looks patch lines up by the side of the diff and the line number shown there.
 * @param {PatchLine[]} lines
 * @returns {PatchLineIndex}
 */
function indexPatchLines(lines) {
  const left = new Map();
  const right = new Map();
  for (const line of lines) {
    if (line.oldLine !== null) left.set(line.oldLine, line);
    if (line.newLine !== null) right.set(line.newLine, line);
  }
  return { left, right };
}

/**
 * @param {PatchLineIndex} index
 * @returns {{ left: number[], right: number[] }}
 */
function commentableLines(index) {
  const sorted = (map) => [...map.keys()].sort((a, b) => a - b);
  return { left: sorted(index.left), right: sorted(index.right) };
}

module.exports = { parsePatch, indexPatchLines, commentableLines };
