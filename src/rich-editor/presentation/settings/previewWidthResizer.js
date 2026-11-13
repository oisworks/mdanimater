import { ViewPlugin } from "@codemirror/view";
import { normalizePreviewWidthPixels } from "../../domain/settingsModel.js";
import { applyPreviewWidth } from "./themeController.js";

// Keep the grip outside editable content so resizing never becomes a text edit.
export function createPreviewWidthResizer({ getSettings, postMessage, onChange }) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.drag = null;
      this.frame = 0;
      this.handle = document.createElement("div");
      this.handle.className = "mdanimater-width-handle";
      this.handle.tabIndex = 0;
      this.handle.setAttribute("role", "separator");
      this.handle.setAttribute("aria-orientation", "vertical");
      this.handle.setAttribute("aria-label", "Resize text width");
      this.handle.title = "Drag to resize text width. Double-click to fit editor width. Arrow keys adjust; Home resets.";
      this.handle.addEventListener("pointerdown", event => this.start(event));
      this.handle.addEventListener("pointermove", event => this.move(event));
      this.handle.addEventListener("pointerup", event => this.finish(event, true));
      this.handle.addEventListener("pointercancel", event => this.finish(event, false));
      this.handle.addEventListener("lostpointercapture", event => this.finish(event, false));
      this.handle.addEventListener("dblclick", () => this.reset());
      this.handle.addEventListener("keydown", event => this.key(event));
      this.onResize = () => this.schedule();
      this.onBlur = () => this.finish(null, false);
      this.onEscape = event => {
        if (this.drag && event.key === "Escape") {
          event.preventDefault(); this.finish(null, false);
        }
      };
      window.addEventListener("resize", this.onResize);
      window.addEventListener("blur", this.onBlur);
      window.addEventListener("keydown", this.onEscape);
      view.scrollDOM.addEventListener("scroll", this.onResize);
      document.body.appendChild(this.handle);
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(view.contentDOM);
      this.observer.observe(view.dom);
      this.schedule();
    }

    update(update) {
      if (update.geometryChanged) this.schedule();
    }

    schedule() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        const rect = this.view.contentDOM.getBoundingClientRect();
        this.handle.style.left = `${rect.right - 12}px`;
        this.handle.setAttribute("aria-valuemin", String(Math.min(320, Math.round(this.availableWidth()))));
        this.handle.setAttribute("aria-valuemax", String(Math.round(this.availableWidth())));
        this.handle.setAttribute("aria-valuenow", String(Math.round(rect.width)));
        this.handle.setAttribute("aria-valuetext", `${Math.round(rect.width)} pixels`);
      });
    }

    availableWidth() {
      const gutter = this.view.scrollDOM.querySelector(".cm-gutters");
      return Math.max(1, this.view.scrollDOM.clientWidth - (gutter?.getBoundingClientRect().width || 0)
        - (window.innerWidth >= 1440 ? 352 : 0));
    }

    apply(pixels) {
      getSettings().previewWidthPixels = pixels;
      applyPreviewWidth(getSettings().previewWidth, pixels);
      this.view.requestMeasure();
      this.schedule();
      onChange();
    }

    start(event) {
      if (event.button !== 0 || this.drag) return;
      event.preventDefault();
      this.drag = { id: event.pointerId, x: event.clientX,
        width: this.view.contentDOM.getBoundingClientRect().width,
        original: getSettings().previewWidthPixels, moved: false };
      this.handle.setPointerCapture(event.pointerId);
      document.documentElement.dataset.resizingPreview = "true";
    }

    move(event) {
      if (!this.drag || event.pointerId !== this.drag.id) return;
      const delta = event.clientX - this.drag.x;
      if (!this.drag.moved && Math.abs(delta) < 3) return;
      this.drag.moved = true;
      const pixels = normalizePreviewWidthPixels(Math.max(320, Math.min(this.availableWidth(), this.drag.width + delta)));
      this.apply(pixels);
    }

    finish(event, commit) {
      if (!this.drag || (event && event.pointerId !== this.drag.id)) return;
      const drag = this.drag;
      this.drag = null;
      delete document.documentElement.dataset.resizingPreview;
      if (this.handle.hasPointerCapture(drag.id)) this.handle.releasePointerCapture(drag.id);
      if (!commit) this.apply(drag.original);
      else if (drag.moved) postMessage({ type: "setPreviewWidthPixels", value: getSettings().previewWidthPixels });
    }

    reset() {
      this.finish(null, false);
      getSettings().previewWidth = "wide";
      this.apply(0);
      postMessage({ type: "setPreviewWidth", value: "wide" });
    }

    key(event) {
      if (event.key === "Escape" && this.drag) {
        event.preventDefault(); this.finish(null, false); return;
      }
      if (event.key === "Home" || event.key === "Enter") {
        event.preventDefault(); this.reset(); return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const delta = (event.key === "ArrowRight" ? 1 : -1) * (event.shiftKey ? 100 : 20);
      const width = this.view.contentDOM.getBoundingClientRect().width;
      this.apply(normalizePreviewWidthPixels(Math.min(this.availableWidth(), Math.max(320, width + delta))));
      postMessage({ type: "setPreviewWidthPixels", value: getSettings().previewWidthPixels });
    }

    destroy() {
      this.finish(null, false);
      cancelAnimationFrame(this.frame);
      this.observer.disconnect();
      window.removeEventListener("resize", this.onResize);
      window.removeEventListener("blur", this.onBlur);
      window.removeEventListener("keydown", this.onEscape);
      this.view.scrollDOM.removeEventListener("scroll", this.onResize);
      this.handle.remove();
    }
  });
}
