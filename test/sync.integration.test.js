import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncClient } from "../src/rich-editor/adapters/syncClient.js";
import { FakeDocument } from "./helpers/fakeDocument.js";
import { FakeEditor } from "./helpers/fakeEditor.js";

const require = createRequire(import.meta.url);
const { SyncSession } = require("../src/host/syncSession.js");
const { normalizeToLf } = require("../src/host/lineEndings.js");

// Connects a SyncClient and a SyncSession through queues, so each test decides
// when messages are delivered.
function connect(initial, eol) {
  const doc = new FakeDocument(initial.replace(/\n/g, eol), eol);
  const toWebview = [];
  const session = new SyncSession(
    doc,
    (message) => toWebview.push(message),
    (error) => {
      throw error;
    },
  );
  doc.onChange = () => session.documentChanged();

  const editor = new FakeEditor();
  const client = new SyncClient(editor);
  let delivered = 0;

  const deliverToHost = async () => {
    while (delivered < editor.sent.length) {
      await session.receive(editor.sent[delivered++]);
    }
  };
  const deliverToWebview = () => {
    while (toWebview.length > 0) client.receive(toWebview.shift());
  };
  const settle = async () => {
    for (let round = 0; round < 10; round += 1) {
      client.flush();
      await deliverToHost();
      deliverToWebview();
    }
  };

  return { client, doc, editor, deliverToHost, deliverToWebview, settle };
}

describe("webview and host sync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(["\n", "\r\n"])(
    "keeps both an AI agent's change and the user's typing (eol %j)",
    async (eol) => {
      const { client, doc, editor, deliverToHost, deliverToWebview, settle } =
        connect("# Title\n- one", eol);
      editor.sent.push({ type: "ready" });
      await deliverToHost();
      deliverToWebview();

      // The user types; the edit is sent but not delivered yet...
      client.localChange(editor.type({ from: editor.doc.length, insert: "\n- two" }));
      client.flush();
      // ...while an AI agent rewrites the first line, and the user keeps typing.
      doc.externalEdit("# New title\n- one");
      client.localChange(editor.type({ from: editor.doc.length, insert: "!" }));

      await deliverToHost();
      deliverToWebview();
      await settle();

      expect(editor.text).toBe("# New title\n- one\n- two!");
      expect(normalizeToLf(doc.getText())).toBe(editor.text);
      expect(doc.getText().includes("\r\n")).toBe(eol === "\r\n");
    },
  );

  it("saves only after the typing before it has reached the document", async () => {
    const { client, doc, editor, deliverToHost, deliverToWebview } = connect("a", "\n");
    editor.sent.push({ type: "ready" });
    await deliverToHost();
    deliverToWebview();

    const seen = [];
    doc.runCommand = async () => {
      seen.push(doc.getText());
    };
    client.localChange(editor.type({ from: 1, insert: "bc" }));
    client.command("save");
    await deliverToHost();
    expect(seen).toEqual(["abc"]);
  });
});
