// A clicked diff line → where GitHub and GitLab should attach the comment.
//
// The position follows the line's kind in the provider's patch, not in mdanimater's
// own diff: a line mdanimater shows as replaced can be context in the provider's
// hunks, and the provider rejects a position that disagrees with its diff.

/** @typedef {import("./patchHunks").PatchLine} PatchLine */
/** @typedef {import("./patchHunks").PatchLineIndex} PatchLineIndex */

/**
 * @typedef {object} ReviewFile
 * @property {string} path Path in the head commit.
 * @property {string} previousPath Path in the base; the same as `path` unless renamed.
 */

/**
 * @param {PatchLineIndex} index
 * @param {unknown} side "left" (base) or "right" (head), as sent by the webview.
 * @param {unknown} lineNumber 1-based line number on that side.
 * @returns {PatchLine | null}
 */
function findPatchLine(index, side, lineNumber) {
  if (side !== "left" && side !== "right") return null;
  if (!Number.isInteger(lineNumber) || lineNumber < 1) return null;
  return index[side].get(lineNumber) || null;
}

/**
 * Body fields of `POST /repos/{owner}/{repo}/pulls/{n}/comments`, without `body`.
 * @param {PatchLine | null} line
 * @param {ReviewFile} file
 * @param {string} headSha
 */
function toGitHubPosition(line, file, headSha) {
  if (!line) return null;
  // GitHub takes LEFT for deleted lines and RIGHT for added and unchanged ones.
  const onLeft = line.kind === "delete";
  return {
    path: file.path,
    commit_id: headSha,
    line: onLeft ? line.oldLine : line.newLine,
    side: onLeft ? "LEFT" : "RIGHT",
  };
}

/**
 * `position` of `POST /projects/:id/merge_requests/:iid/discussions`.
 * @param {PatchLine | null} line
 * @param {ReviewFile} file
 * @param {{ baseSha: string, startSha: string, headSha: string }} diffRefs
 */
function toGitLabPosition(line, file, diffRefs) {
  if (!line) return null;
  // GitLab takes new_line for added lines, old_line for deleted ones, and both
  // for unchanged ones.
  return {
    position_type: "text",
    base_sha: diffRefs.baseSha,
    start_sha: diffRefs.startSha,
    head_sha: diffRefs.headSha,
    old_path: file.previousPath,
    new_path: file.path,
    ...(line.oldLine !== null ? { old_line: line.oldLine } : {}),
    ...(line.newLine !== null ? { new_line: line.newLine } : {}),
  };
}

module.exports = { findPatchLine, toGitHubPosition, toGitLabPosition };
