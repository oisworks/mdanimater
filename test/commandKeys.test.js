import { describe, expect, it } from "vitest";
import {
  commandForKey,
  interceptCommandKeys,
} from "../src/rich-editor/adapters/commandKeys.js";

const key = (name, { ctrl = false, meta = false, shift = false, alt = false } = {}) => ({
  key: name,
  ctrlKey: ctrl,
  metaKey: meta,
  shiftKey: shift,
  altKey: alt,
});

describe("commandForKey", () => {
  it.each([
    [key("z", { ctrl: true }), false, "undo"],
    [key("Z", { ctrl: true, shift: true }), false, "redo"],
    [key("y", { ctrl: true }), false, "redo"],
    [key("s", { ctrl: true }), false, "save"],
    [key("z", { meta: true }), true, "undo"],
    [key("z", { meta: true, shift: true }), true, "redo"],
    [key("s", { meta: true }), true, "save"],
  ])("maps %o (mac: %s) to %s", (event, isMac, expected) => {
    expect(commandForKey(event, isMac)).toBe(expected);
  });

  it.each([
    [key("z"), false],
    [key("z", { meta: true }), false],
    [key("z", { ctrl: true }), true],
    [key("y", { meta: true }), true],
    [key("s", { ctrl: true, shift: true }), false],
    [key("z", { ctrl: true, alt: true }), false],
  ])("leaves %o (mac: %s) alone", (event, isMac) => {
    expect(commandForKey(event, isMac)).toBeUndefined();
  });
});

describe("interceptCommandKeys", () => {
  const press = (target, init) => {
    const event = Object.assign(new Event("keydown", { cancelable: true, bubbles: true }), init);
    target.dispatchEvent(event);
    return event;
  };

  function setup(keepsOwnUndo) {
    const target = new EventTarget();
    const run = [];
    const host = [];
    interceptCommandKeys(target, false, {
      keepsOwnUndo,
      command: (name) => run.push(name),
      shortcut: () => run.push("flush"),
    });
    target.addEventListener("keydown", () => host.push("forwarded"));
    return { host, run, target };
  }

  it("runs the command and stops the event from reaching the webview host", () => {
    const { host, run, target } = setup();
    const event = press(target, key("s", { ctrl: true }));
    expect(run).toEqual(["save"]);
    expect(event.defaultPrevented).toBe(true);
    expect(host).toEqual([]);
  });

  it("lets other keys through untouched", () => {
    const { host, run, target } = setup();
    const event = press(target, key("a"));
    expect(run).toEqual([]);
    expect(host).toEqual(["forwarded"]);
    expect(event.defaultPrevented).toBe(false);
  });

  it("flushes before other shortcuts (such as closing the tab) but still lets them through", () => {
    const { host, run, target } = setup();
    const event = press(target, key("w", { ctrl: true }));
    expect(run).toEqual(["flush"]);
    expect(host).toEqual(["forwarded"]);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    [key("z", { ctrl: true }), "undo"],
    [key("Z", { ctrl: true, shift: true }), "redo"],
    [key("y", { ctrl: true }), "redo"],
  ])("runs %o as %s in VS Code", (init, name) => {
    const { host, run, target } = setup();
    const event = press(target, init);
    expect(run).toEqual([name]);
    expect(event.defaultPrevented).toBe(true);
    expect(host).toEqual([]);
  });

  it("leaves undo to a text field that keeps its own, without telling VS Code", () => {
    const { host, run, target } = setup(() => true);
    const undo = press(target, key("z", { ctrl: true }));
    const redo = press(target, key("y", { ctrl: true }));
    expect(run).toEqual([]);
    expect(host).toEqual([]);
    expect(undo.defaultPrevented).toBe(false);
    expect(redo.defaultPrevented).toBe(false);
  });

  it("still saves through VS Code from a text field that keeps its own undo", () => {
    const { run, target } = setup(() => true);
    press(target, key("s", { ctrl: true }));
    expect(run).toEqual(["save"]);
  });

  it("asks about the element the key was pressed in", () => {
    const fields = [];
    const { target } = setup((field) => {
      fields.push(field);
      return false;
    });
    press(target, key("z", { ctrl: true }));
    expect(fields).toEqual([target]);
  });
});
