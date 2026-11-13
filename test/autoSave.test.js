import { createRequire } from "node:module";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createAutoSaver } = require("../src/host/autoSave.js");

function createDocument(path, { isDirty = true } = {}) {
  return { uri: { toString: () => `file://${path}` }, isDirty, isClosed: false };
}

function setup(options = {}) {
  const saved = [];
  const errors = [];
  const autoSaver = createAutoSaver({
    delayMs: 1000,
    isEnabled: () => true,
    canSave: () => true,
    save: vi.fn(async (document) => {
      saved.push(document);
      document.isDirty = false;
      return true;
    }),
    reportError: (error) => errors.push(error),
    ...options,
  });
  return { autoSaver, saved, errors };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createAutoSaver", () => {
  it("saves once, a second after the document stops changing", async () => {
    const { autoSaver, saved } = setup();
    const document = createDocument("/a.md");

    autoSaver.documentChanged(document);
    await vi.advanceTimersByTimeAsync(600);
    autoSaver.documentChanged(document);
    await vi.advanceTimersByTimeAsync(600);
    expect(saved).toEqual([]);

    await vi.advanceTimersByTimeAsync(400);
    expect(saved).toEqual([document]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(saved).toHaveLength(1);
  });

  it("does not schedule a save for a document that is already saved", async () => {
    const { autoSaver, saved } = setup();
    // VS Code reloading the file after another program wrote it changes the
    // document without making it dirty.
    autoSaver.documentChanged(createDocument("/a.md", { isDirty: false }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual([]);
  });

  it("checks again when the timer fires", async () => {
    const { autoSaver, saved } = setup();
    const savedByHand = createDocument("/saved.md");
    const closed = createDocument("/closed.md");

    autoSaver.documentChanged(savedByHand);
    autoSaver.documentChanged(closed);
    savedByHand.isDirty = false;
    closed.isClosed = true;
    await vi.advanceTimersByTimeAsync(1000);

    expect(saved).toEqual([]);
  });

  it("does nothing while the setting is off", async () => {
    const { autoSaver, saved } = setup({ isEnabled: () => false });
    autoSaver.documentChanged(createDocument("/a.md"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual([]);
  });

  it("leaves a document with unreviewed Copilot edits to the user", async () => {
    const { autoSaver, saved } = setup({ canSave: () => false });
    autoSaver.documentChanged(createDocument("/a.md"));
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual([]);
  });

  it("keeps one timer per document", async () => {
    const { autoSaver, saved } = setup();
    const first = createDocument("/a.md");
    const second = createDocument("/b.md");

    autoSaver.documentChanged(first);
    await vi.advanceTimersByTimeAsync(500);
    autoSaver.documentChanged(second);
    await vi.advanceTimersByTimeAsync(500);
    expect(saved).toEqual([first]);
    await vi.advanceTimersByTimeAsync(500);
    expect(saved).toEqual([first, second]);
  });

  it("saves a pending document at once when flushed", async () => {
    const { autoSaver, saved } = setup();
    const pending = createDocument("/a.md");
    autoSaver.documentChanged(pending);

    await autoSaver.flush(pending);
    expect(saved).toEqual([pending]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toHaveLength(1);
  });

  it("does not save on flush when nothing is pending", async () => {
    const { autoSaver, saved } = setup();
    await autoSaver.flush(createDocument("/a.md"));
    expect(saved).toEqual([]);
  });

  it("reports the document as auto saving only while its save runs", async () => {
    let finishSave;
    const document = createDocument("/a.md");
    const { autoSaver } = setup({
      save: () =>
        new Promise((resolve) => {
          finishSave = resolve;
        }),
    });

    expect(autoSaver.isAutoSaving(document)).toBe(false);
    autoSaver.documentChanged(document);
    await vi.advanceTimersByTimeAsync(1000);
    expect(autoSaver.isAutoSaving(document)).toBe(true);
    expect(autoSaver.isAutoSaving(createDocument("/other.md"))).toBe(false);

    finishSave(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(autoSaver.isAutoSaving(document)).toBe(false);
  });

  it("reports a failed save and saves again after the next change", async () => {
    const document = createDocument("/a.md");
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("The content of the file is newer"))
      .mockResolvedValueOnce(true);
    const { autoSaver, errors } = setup({ save });

    autoSaver.documentChanged(document);
    await vi.advanceTimersByTimeAsync(1000);
    expect(errors.map((error) => error.message)).toEqual(["The content of the file is newer"]);
    expect(autoSaver.isAutoSaving(document)).toBe(false);

    autoSaver.documentChanged(document);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("cancels every pending save on dispose", async () => {
    const { autoSaver, saved } = setup();
    autoSaver.documentChanged(createDocument("/a.md"));
    autoSaver.dispose();
    await vi.advanceTimersByTimeAsync(2000);
    expect(saved).toEqual([]);
  });
});
