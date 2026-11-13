// Webview side of the sync protocol (see src/host/syncSession.js).
//
// The client tracks three versions of the document:
//
//   acked ──unacked edits──▶ sentDoc ──pending──▶ the editor's document
//
// `acked` is the host's text as of the last sync plus the edits it confirmed.
// When the host's text changes underneath unconfirmed edits, the client applies
// the host's change to the editor, rebases its own edits onto the new text and
// sends them again, so both changes survive.
import { ChangeSet, Text } from "@codemirror/state";
import { diffText, textOf, toLineEdits } from "./lineEditChanges.js";

export const FLUSH_DELAY_MS = 500;

/**
 * @typedef {object} SyncClientHost
 * @property {(message: object) => void} send
 * @property {(text: string) => void} reset Replaces the whole document (first load).
 * @property {(changes: ChangeSet) => void} applyRemote Applies the host's
 *   changes; they must not be reported back through localChange.
 */

export class SyncClient {
  /** @param {SyncClientHost} host */
  constructor(host) {
    this.host = host;
    this.loaded = false;
    this.seq = 0;
    this.nextId = 1;
    this.acked = Text.empty;
    this.unacked = [];
    this.sentDoc = Text.empty;
    this.pending = null;
    this.timer = undefined;
  }

  /** Handles a host message; anything outside the sync protocol is ignored. */
  receive(message) {
    if (message?.type === "ack") {
      this.acknowledge(message.lastAppliedId);
    } else if (message?.type === "sync") {
      if (this.loaded) {
        this.rebase(message.text, message.seq, message.lastAppliedId);
      } else {
        this.load(message.text, message.seq);
      }
    }
  }

  /** Records a change the user made; it is sent once typing pauses. */
  localChange(changes) {
    if (!this.loaded || changes.empty) {
      return;
    }
    this.pending = this.pending ? this.pending.compose(changes) : changes;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), FLUSH_DELAY_MS);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.pending) {
      return;
    }

    const edit = { id: this.nextId, changes: this.pending };
    this.nextId += 1;
    this.host.send({
      type: "edit",
      id: edit.id,
      seq: this.seq,
      changes: toLineEdits(edit.changes, this.sentDoc),
    });
    this.unacked = [...this.unacked, edit];
    this.sentDoc = edit.changes.apply(this.sentDoc);
    this.pending = null;
  }

  /** Sends pending edits first, so the host runs the command on current text. */
  command(name) {
    this.flush();
    this.host.send({ type: "command", name });
  }

  load(text, seq) {
    this.loaded = true;
    this.seq = seq;
    this.acked = textOf(text);
    this.sentDoc = this.acked;
    this.host.reset(text);
  }

  acknowledge(lastAppliedId) {
    while (this.unacked.length > 0 && this.unacked[0].id <= lastAppliedId) {
      this.acked = this.unacked[0].changes.apply(this.acked);
      this.unacked = this.unacked.slice(1);
    }
  }

  // The host's text changed under us. The edits it has not applied were
  // dropped (their seq is now stale), so merge them with the host's change and
  // send them again.
  rebase(text, seq, lastAppliedId) {
    this.acknowledge(lastAppliedId);
    const local = [
      ...this.unacked.map((edit) => edit.changes),
      ...(this.pending ? [this.pending] : []),
    ].reduce((all, changes) => all.compose(changes), ChangeSet.empty(this.acked.length));
    const remote = diffText(this.acked, text);

    this.host.applyRemote(remote.map(local));

    this.seq = seq;
    this.acked = textOf(text);
    this.sentDoc = this.acked;
    this.unacked = [];
    this.pending = null;
    const rebased = local.map(remote, true);
    if (!rebased.empty) {
      this.pending = rebased;
      this.flush();
    }
  }
}
