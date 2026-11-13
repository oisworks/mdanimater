// Extension host side of the rich editor's sync protocol.
//
// The VS Code TextDocument is the source of truth. The webview sends its edits
// as line/character changes tagged with the `seq` of the last sync it received.
// When the document changed in the meantime (an AI agent's write that VS Code
// loaded, an undo, another editor), the edit no longer fits: the session drops
// it and sends a new sync, and the webview rebases its unconfirmed edits onto
// that text and sends them again. Both changes therefore survive, instead of
// the last full-text write winning.
//
// Messages, host -> webview:
//   { type: "sync", text, seq, lastAppliedId }  authoritative LF text
//   { type: "ack", lastAppliedId }              edits up to this id are applied
// Messages, webview -> host:
//   { type: "ready" }
//   { type: "edit", id, seq, changes: LineEdit[] }
//   { type: "command", name: "undo" | "redo" | "save" }

const { applyLineEdits } = require("./lineEdits.js");
const { normalizeToLf } = require("./lineEndings.js");

const EDITOR_COMMANDS = new Set(["undo", "redo", "save"]);

/**
 * The slice of vscode.TextDocument the session needs, so it can be tested
 * without VS Code.
 *
 * @typedef {object} DocumentPort
 * @property {() => string} getText
 * @property {(edits: readonly import("./lineEdits.js").LineEdit[]) => PromiseLike<boolean>} applyEdits
 *   Applies the edits as one undo step. Inserted text uses LF; the port
 *   converts it to the document's EOL.
 * @property {(name: string) => PromiseLike<unknown>} runCommand
 */

class SyncSession {
  /**
   * @param {DocumentPort} doc
   * @param {(message: object) => void} post
   * @param {(error: unknown) => void} reportError
   */
  constructor(doc, post, reportError) {
    this.doc = doc;
    this.post = post;
    this.reportError = reportError;
    // The text the webview is known to have once its acknowledged edits apply.
    this.mirror = normalizeToLf(doc.getText());
    this.seq = 0;
    this.lastAppliedId = 0;
    this.queue = Promise.resolve();
  }

  /**
   * Handles webview messages one at a time, in arrival order. A failure is
   * reported and answered with a resync instead of stalling the queue.
   */
  receive(message) {
    this.queue = this.queue
      .then(() => this.handle(message))
      .catch((error) => {
        this.reportError(error);
        this.resync();
      });
    return this.queue;
  }

  /**
   * Call from onDidChangeTextDocument. The change events of the session's own
   * edits leave the text equal to the mirror and are skipped.
   */
  documentChanged() {
    if (normalizeToLf(this.doc.getText()) !== this.mirror) {
      this.resync();
    }
  }

  async handle(message) {
    if (message?.type === "ready") {
      this.resync();
      return;
    }
    if (message?.type === "edit") {
      await this.applyEdit(message.id, message.seq, message.changes);
      return;
    }
    if (message?.type === "command" && EDITOR_COMMANDS.has(message.name)) {
      await this.doc.runCommand(message.name);
    }
  }

  async applyEdit(id, seq, changes) {
    // The webview rebases and re-sends a stale edit once it gets the newer sync.
    if (seq !== this.seq) {
      return;
    }

    let next;
    try {
      if (!Array.isArray(changes)) {
        throw new TypeError("An edit message must carry a change list");
      }
      next = applyLineEdits(this.mirror, changes);
    } catch {
      this.resync();
      return;
    }

    // Update the mirror first, so the change event that applyEdits fires is
    // recognized as the session's own.
    this.mirror = next;
    const applied = await this.doc.applyEdits(changes);
    if (!applied) {
      this.resync();
      return;
    }
    this.lastAppliedId = id;
    this.post({ type: "ack", lastAppliedId: id });
  }

  resync() {
    this.mirror = normalizeToLf(this.doc.getText());
    this.seq += 1;
    this.post({
      type: "sync",
      text: this.mirror,
      seq: this.seq,
      lastAppliedId: this.lastAppliedId,
    });
  }
}

module.exports = {
  SyncSession,
};
