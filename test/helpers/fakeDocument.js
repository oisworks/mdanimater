import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { applyLineEdits } = require("../../src/host/lineEdits.js");
const { normalizeToLf } = require("../../src/host/lineEndings.js");

// Behaves like a vscode.TextDocument seen through the sync session's document
// port: it keeps its own EOL and reports changes synchronously, the way
// onDidChangeTextDocument fires while workspace.applyEdit is still running.
export class FakeDocument {
  constructor(text, eol = "\n") {
    this.text = text;
    this.eol = eol;
    this.commands = [];
    this.onChange = () => {};
    this.failNextApply = false;
  }

  getText() {
    return this.text;
  }

  async applyEdits(edits) {
    if (this.failNextApply) {
      this.failNextApply = false;
      return false;
    }
    this.text = applyLineEdits(normalizeToLf(this.text), edits).replace(/\n/g, this.eol);
    this.onChange();
    return true;
  }

  async runCommand(name) {
    this.commands.push(name);
  }

  // An edit made somewhere else: another editor, an undo, or an AI agent
  // whose write VS Code has loaded into the document.
  externalEdit(text) {
    this.text = text.replace(/\n/g, this.eol);
    this.onChange();
  }
}
