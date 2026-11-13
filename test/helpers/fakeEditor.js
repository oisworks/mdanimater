import { ChangeSet, Text } from "@codemirror/state";
import { textOf } from "../../src/rich-editor/adapters/lineEditChanges.js";

// Plays the CodeMirror view behind a SyncClient: a document the user types
// into, which also receives the host's changes.
export class FakeEditor {
  constructor() {
    this.doc = Text.empty;
    this.sent = [];
  }

  send(message) {
    this.sent.push(message);
  }

  reset(text) {
    this.doc = textOf(text);
  }

  applyRemote(changes) {
    this.doc = changes.apply(this.doc);
  }

  // Applies a local edit and returns the change set to hand to the client.
  type(spec) {
    const changes = ChangeSet.of(spec, this.doc.length);
    this.doc = changes.apply(this.doc);
    return changes;
  }

  get text() {
    return this.doc.toString();
  }
}
