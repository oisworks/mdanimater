// Git change positions share their data with the gutter, not with diagnostics.
import { EditorView, ViewPlugin } from "@codemirror/view";

export function createGitDiffOverviewRuler(getChanges) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.dom = document.createElement("div");
      this.dom.className = "cm-git-diff-ruler";
      this.dom.setAttribute("aria-label", "Git changes");
      this.dom.addEventListener("mousedown", (event) => {
        const marker = event.target.closest?.("[data-pos]");
        if (!marker) return;
        event.preventDefault();
        view.dispatch({ effects: EditorView.scrollIntoView(Number(marker.dataset.pos), { y: "center" }) });
      });
      view.dom.appendChild(this.dom);
      this.measure();
    }
    update(update) {
      if (update.docChanged || update.geometryChanged || update.heightChanged ||
          getChanges(update.startState) !== getChanges(update.state)) this.measure();
    }
    measure() {
      this.view.requestMeasure({
        key: this,
        read: (view) => {
          const entries = getChanges(view.state).map((change) => {
            const line = view.state.doc.line(Math.min(change.line, view.state.doc.lines));
            const block = view.lineBlockAt(line.from);
            return { pos: line.from, type: change.type, top: block.top, height: block.height };
          });
          return {
            markers: layoutGitRulerMarkers(entries, view.contentHeight, view.scrollDOM.clientHeight),
            // Lint retains its own rightmost 8px lane.
            right: 8 + Math.max(0, view.scrollDOM.offsetWidth - view.scrollDOM.clientWidth),
          };
        },
        write: ({ markers, right }) => {
          this.dom.style.right = `${right}px`;
          this.dom.hidden = markers.length === 0;
          this.dom.replaceChildren(...markers.map((marker) => {
            const mark = document.createElement("div");
            mark.className = `cm-git-diff-ruler-mark cm-git-diff-ruler-${marker.type}`;
            mark.style.top = `${marker.top}px`;
            mark.style.height = `${marker.height}px`;
            mark.dataset.pos = String(marker.pos);
            mark.title = `Git: ${marker.type}`;
            return mark;
          }));
        },
      });
    }
    destroy() { this.dom.remove(); }
  });
}

// Separate lanes preserve distinct change kinds even at coincident positions.
export function layoutGitRulerMarkers(entries, contentHeight, rulerHeight) {
  if (!(rulerHeight > 0)) return [];
  const scale = rulerHeight / Math.max(contentHeight, rulerHeight, 1);
  const markers = [];
  for (const type of ["added", "modified", "deleted"]) {
    let previous = null;
    for (const entry of entries.filter((item) => item.type === type).sort((a, b) => a.top - b.top)) {
      const height = Math.min(rulerHeight, Math.max(3, entry.height * scale));
      const top = Math.max(0, Math.min(entry.top * scale, rulerHeight - height));
      if (previous && top <= previous.top + previous.height) {
        previous.height = Math.max(previous.height, top + height - previous.top);
      } else {
        previous = { pos: entry.pos, type, top, height };
        markers.push(previous);
      }
    }
  }
  return markers;
}
