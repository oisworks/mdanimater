import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLUSH_DELAY_MS,
  SyncClient,
} from "../src/rich-editor/adapters/syncClient.js";
import { FakeEditor } from "./helpers/fakeEditor.js";

function setup(text) {
  const editor = new FakeEditor();
  const client = new SyncClient(editor);
  client.receive({ type: "sync", text, seq: 1, lastAppliedId: 0 });
  const type = (spec) => client.localChange(editor.type(spec));
  return { client, editor, type };
}

const insertAt = (line, ch, insert) => ({
  from: { line, ch },
  to: { line, ch },
  insert,
});

describe("SyncClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("loads the document from the first sync", () => {
    const { editor } = setup("# hello");
    expect(editor.text).toBe("# hello");
    expect(editor.sent).toEqual([]);
  });

  it("batches keystrokes into one edit after the input pauses", () => {
    const { editor, type } = setup("ab");
    type({ from: 2, insert: "c" });
    vi.advanceTimersByTime(FLUSH_DELAY_MS - 1);
    type({ from: 3, insert: "d" });
    vi.advanceTimersByTime(FLUSH_DELAY_MS - 1);
    expect(editor.sent).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(editor.sent).toEqual([
      { type: "edit", id: 1, seq: 1, changes: [insertAt(0, 2, "cd")] },
    ]);
  });

  it("flushes pending edits before sending a command", () => {
    const { client, editor, type } = setup("a");
    type({ from: 1, insert: "b" });
    client.command("save");
    expect(editor.sent.map((message) => message.type)).toEqual(["edit", "command"]);
    vi.advanceTimersByTime(FLUSH_DELAY_MS);
    expect(editor.sent).toHaveLength(2);
  });

  it("sends nothing on flush when there is nothing pending", () => {
    const { client, editor } = setup("a");
    client.flush();
    expect(editor.sent).toEqual([]);
  });

  it("bases the next edit on the previous one before it is acknowledged", () => {
    const { client, editor, type } = setup("line");
    type({ from: 4, insert: "\nnext" });
    client.flush();
    type({ from: 9, insert: "!" });
    client.flush();
    expect(editor.sent[1]).toMatchObject({ id: 2, changes: [insertAt(1, 4, "!")] });
  });

  it("applies an external change and keeps unsent typing", () => {
    const { client, editor, type } = setup("hello world");
    type({ from: 11, insert: "!" });
    client.receive({ type: "sync", text: "# hello world", seq: 2, lastAppliedId: 0 });
    expect(editor.text).toBe("# hello world!");
    expect(editor.sent).toEqual([
      { type: "edit", id: 1, seq: 2, changes: [insertAt(0, 13, "!")] },
    ]);
  });

  it("re-sends edits the host rejected, rebased onto the new text", () => {
    const { client, editor, type } = setup("abc");
    type({ from: 3, insert: "d" });
    client.flush();
    client.receive({ type: "sync", text: "Xabc", seq: 2, lastAppliedId: 0 });
    expect(editor.text).toBe("Xabcd");
    expect(editor.sent.at(-1)).toMatchObject({
      id: 2,
      seq: 2,
      changes: [insertAt(0, 4, "d")],
    });
  });

  it("does not re-send edits the host already applied", () => {
    const { client, editor, type } = setup("abc");
    type({ from: 3, insert: "d" });
    client.flush();
    client.receive({ type: "sync", text: "abcdX", seq: 2, lastAppliedId: 1 });
    expect(editor.text).toBe("abcdX");
    expect(editor.sent).toHaveLength(1);
  });

  it("builds on acknowledged edits when an external change arrives later", () => {
    const { client, editor, type } = setup("a");
    type({ from: 1, insert: "b" });
    client.flush();
    client.receive({ type: "ack", lastAppliedId: 1 });
    client.receive({ type: "sync", text: "abc", seq: 2, lastAppliedId: 1 });
    expect(editor.text).toBe("abc");
    expect(editor.sent).toHaveLength(1);
  });

  it("ignores local changes that arrive before the first sync", () => {
    const editor = new FakeEditor();
    const client = new SyncClient(editor);
    client.localChange(editor.type({ from: 0, insert: "x" }));
    client.flush();
    expect(editor.sent).toEqual([]);
  });

  it("ignores messages that are not part of the sync protocol", () => {
    const { client, editor } = setup("a");
    client.receive({ type: "theme", theme: "forest" });
    client.receive(null);
    expect(editor.text).toBe("a");
    expect(editor.sent).toEqual([]);
  });
});
