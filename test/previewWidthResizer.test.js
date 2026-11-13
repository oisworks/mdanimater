// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { createPreviewWidthResizer } from "../src/rich-editor/presentation/settings/previewWidthResizer.js";

let view, handle, settings, postMessage;
function pointer(type, x) {
  const event = new MouseEvent(type, { clientX: x, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: 1 });
  handle.dispatchEvent(event);
}
beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  settings = { previewWidth: "wide", previewWidthPixels: 0 };
  postMessage = vi.fn();
  view = new EditorView({ doc: "# 見出し\n本文を保持", parent: document.body,
    extensions: [createPreviewWidthResizer({ getSettings: () => settings, postMessage, onChange: vi.fn() })] });
  view.contentDOM.getBoundingClientRect = () => ({left: 0, right: 1000, width: 1000});
  Object.defineProperty(view.scrollDOM, "clientWidth", { value: 1200 });
  handle = document.querySelector(".mdanimater-width-handle");
  let captured = false;
  handle.setPointerCapture = () => { captured = true; };
  handle.hasPointerCapture = () => captured;
  handle.releasePointerCapture = () => { captured = false; };
});
afterEach(() => { view.destroy(); document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe("text width resizing", () => {
  it("previews dragging, saves once on release, and leaves text and selection intact", () => {
    view.dispatch({selection: {anchor: 3}});
    pointer("pointerdown", 1000);
    pointer("pointermove", 800);
    expect(settings.previewWidthPixels).toBe(800);
    expect(postMessage).not.toHaveBeenCalled();
    pointer("pointermove", 700);
    pointer("pointerup", 700);
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({type: "setPreviewWidthPixels", value: 700});
    expect(view.state.doc.toString()).toBe("# 見出し\n本文を保持");
    expect(view.state.selection.main.anchor).toBe(3);
    expect(document.documentElement.dataset.resizingPreview).toBeUndefined();
  });
  it("clamps a long drag and cancels without saving", () => {
    settings.previewWidthPixels = 900;
    pointer("pointerdown", 1000);
    pointer("pointermove", -2000);
    expect(settings.previewWidthPixels).toBe(320);
    pointer("pointercancel", -2000);
    expect(settings.previewWidthPixels).toBe(900);
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("Escape cancels even while focus remains in the editor", () => {
    pointer("pointerdown", 1000);
    pointer("pointermove", 600);
    window.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
    expect(settings.previewWidthPixels).toBe(0);
    expect(postMessage).not.toHaveBeenCalled();
  });
  it("ignores clicks and resets a custom width with a double click", () => {
    settings.previewWidthPixels = 800;
    pointer("pointerdown", 1000);
    pointer("pointerup", 1000);
    expect(postMessage).not.toHaveBeenCalled();
    handle.dispatchEvent(new MouseEvent("dblclick"));
    expect(settings.previewWidthPixels).toBe(0);
    expect(document.documentElement.dataset.previewWidth).toBe("wide");
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({type:"setPreviewWidth", value:"wide"});
  });
  it("supports keyboard adjustment and removes its grip on destruction", () => {
    handle.dispatchEvent(new KeyboardEvent("keydown", {key:"ArrowLeft"}));
    expect(settings.previewWidthPixels).toBe(980);
    view.destroy();
    expect(document.querySelector(".mdanimater-width-handle")).toBeNull();
  });
});
