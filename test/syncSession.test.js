import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { FakeDocument } from "./helpers/fakeDocument.js";

// syncSession.js runs in the extension host as CommonJS, so it is loaded the
// same way here.
const require = createRequire(import.meta.url);
const { SyncSession } = require("../src/host/syncSession.js");

function setup(text, eol = "\n") {
  const doc = new FakeDocument(text.replace(/\n/g, eol), eol);
  const posted = [];
  const errors = [];
  const session = new SyncSession(
    doc,
    (message) => posted.push(message),
    (error) => errors.push(error),
  );
  doc.onChange = () => session.documentChanged();
  return { doc, errors, posted, session };
}

const insertAt = (line, ch, insert) => ({
  from: { line, ch },
  to: { line, ch },
  insert,
});

describe("SyncSession", () => {
  it("sends the LF document when the webview is ready", async () => {
    const { posted, session } = setup("# a\nb", "\r\n");
    await session.receive({ type: "ready" });
    expect(posted).toEqual([{ type: "sync", text: "# a\nb", seq: 1, lastAppliedId: 0 }]);
  });

  it("applies an edit in the document's own EOL and acknowledges without echoing", async () => {
    const { doc, posted, session } = setup("a\nb", "\r\n");
    await session.receive({ type: "ready" });
    await session.receive({ type: "edit", id: 1, seq: 1, changes: [insertAt(1, 1, "!\nc")] });
    expect(doc.getText()).toBe("a\r\nb!\r\nc");
    expect(posted.slice(1)).toEqual([{ type: "ack", lastAppliedId: 1 }]);
  });

  it("ignores edits based on an outdated sync, so they cannot overwrite a newer change", async () => {
    const { doc, posted, session } = setup("a");
    await session.receive({ type: "ready" });
    doc.externalEdit("ab");
    await session.receive({ type: "edit", id: 1, seq: 1, changes: [insertAt(0, 0, "X")] });
    expect(doc.getText()).toBe("ab");
    expect(posted.slice(1)).toEqual([{ type: "sync", text: "ab", seq: 2, lastAppliedId: 0 }]);
  });

  it("sends a sync with the last applied edit id after an external change", async () => {
    const { doc, posted, session } = setup("a");
    await session.receive({ type: "ready" });
    await session.receive({ type: "edit", id: 7, seq: 1, changes: [insertAt(0, 1, "b")] });
    doc.externalEdit("abc");
    expect(posted.at(-1)).toEqual({ type: "sync", text: "abc", seq: 2, lastAppliedId: 7 });
  });

  it("does not resync for a change event that leaves the text as it was", async () => {
    const { doc, posted, session } = setup("a\nb", "\r\n");
    await session.receive({ type: "ready" });
    doc.externalEdit("a\nb");
    expect(posted).toHaveLength(1);
  });

  it("resyncs when the document refuses the edit", async () => {
    const { doc, posted, session } = setup("a");
    await session.receive({ type: "ready" });
    doc.failNextApply = true;
    await session.receive({ type: "edit", id: 1, seq: 1, changes: [insertAt(0, 0, "X")] });
    expect(doc.getText()).toBe("a");
    expect(posted.at(-1)).toEqual({ type: "sync", text: "a", seq: 2, lastAppliedId: 0 });
  });

  it("resyncs when the edit does not fit the document", async () => {
    const { doc, posted, session } = setup("a");
    await session.receive({ type: "ready" });
    await session.receive({ type: "edit", id: 1, seq: 1, changes: [insertAt(5, 0, "X")] });
    expect(doc.getText()).toBe("a");
    expect(posted.at(-1)).toEqual({ type: "sync", text: "a", seq: 2, lastAppliedId: 0 });
  });

  it("resyncs when an edit message has no change list", async () => {
    const { doc, posted, session } = setup("a");
    await session.receive({ type: "ready" });
    await session.receive({ type: "edit", id: 1, seq: 1 });
    expect(doc.getText()).toBe("a");
    expect(posted.at(-1)).toEqual({ type: "sync", text: "a", seq: 2, lastAppliedId: 0 });
  });

  it("runs commands through the document", async () => {
    const { doc, session } = setup("a");
    await session.receive({ type: "ready" });
    await session.receive({ type: "command", name: "undo" });
    expect(doc.commands).toEqual(["undo"]);
  });

  it("ignores unknown commands and message types", async () => {
    const { doc, posted, session } = setup("a");
    await session.receive({ type: "ready" });
    await session.receive({ type: "command", name: "deleteFile" });
    await session.receive({ type: "somethingElse" });
    expect(doc.commands).toEqual([]);
    expect(posted).toHaveLength(1);
  });

  it("processes messages strictly in arrival order", async () => {
    const { doc, session } = setup("");
    await session.receive({ type: "ready" });
    const textAtCommand = [];
    doc.runCommand = async (name) => {
      textAtCommand.push(`${name}:${doc.getText()}`);
    };
    await Promise.all([
      session.receive({ type: "edit", id: 1, seq: 1, changes: [insertAt(0, 0, "a")] }),
      session.receive({ type: "edit", id: 2, seq: 1, changes: [insertAt(0, 1, "b")] }),
      session.receive({ type: "command", name: "save" }),
    ]);
    expect(textAtCommand).toEqual(["save:ab"]);
  });

  it("reports a failure, resyncs and keeps handling later messages", async () => {
    const { doc, errors, posted, session } = setup("a");
    await session.receive({ type: "ready" });
    const failure = new Error("disk full");
    doc.runCommand = async () => {
      throw failure;
    };
    await session.receive({ type: "command", name: "save" });
    expect(errors).toEqual([failure]);
    expect(posted.at(-1)).toMatchObject({ type: "sync", seq: 2 });

    await session.receive({ type: "edit", id: 1, seq: 2, changes: [insertAt(0, 1, "b")] });
    expect(doc.getText()).toBe("ab");
  });
});
