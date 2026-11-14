// Column resizing for the rich table preview.
//
// Dragging the handle on a header cell's right edge resizes that column the
// way a spreadsheet does: the other columns keep the width they had when the
// drag started and the table grows or shrinks. The drag only changes the DOM;
// the widths reach display-only editor state on release. Markdown and its
// undo history are unchanged.
import { columnWidthFromPixels } from "../../domain/tableColumnWidths.js";

const CHARACTER_PROBE_LENGTH = 10;
const FALLBACK_CHARACTER_PIXELS = 8;

/**
 * One <col> per column. Widths go there rather than on the cells: `ch`
 * resolves against the element's own font, and the bold header cells would
 * make the same width wider than the body cells.
 * @param {number} columnCount
 * @returns {HTMLTableColElement}
 */
export function createColumnGroup(columnCount) {
  const colgroup = document.createElement("colgroup");
  for (let index = 0; index < columnCount; index += 1) {
    colgroup.appendChild(document.createElement("col"));
  }
  return colgroup;
}

/**
 * Sizes each column with a width in characters and leaves the others to the
 * automatic layout.
 * @param {HTMLTableElement} table Built with createColumnGroup.
 * @param {(number | null)[]} widths
 */
export function applyColumnWidths(table, widths) {
  table.classList.toggle(
    "has-column-widths",
    widths.some((width) => width !== null),
  );
  table.querySelectorAll("col").forEach((col, index) => {
    const width = widths[index] ?? null;
    col.style.width = width === null ? "" : `${width}ch`;
    if (!col.getAttribute("style")) {
      col.removeAttribute("style");
    }
  });
  for (const cell of table.querySelectorAll(".cm-rich-table-cell")) {
    const width = widths[Number(cell.dataset.columnIndex)] ?? null;
    cell.classList.toggle("has-column-width", width !== null);
  }
}

/**
 * @param {object} options
 * @param {HTMLElement} options.wrapper The table widget; a drag is dropped
 *   when it leaves the DOM (the table was redrawn).
 * @param {number} options.columnIndex
 * @param {() => (number | null)[]} options.getWidths The stored widths.
 * @param {() => ("left" | "center" | "right")[]} options.getAlignments
 * @param {(widths: number[]) => void} options.onResize
 * @param {() => void} options.onReset
 * @returns {HTMLElement}
 */
export function createColumnResizeHandle({
  wrapper,
  columnIndex,
  getWidths,
  getAlignments,
  onResize,
  onReset,
}) {
  const handle = document.createElement("div");
  handle.className = "cm-rich-table-column-resizer";
  handle.setAttribute("aria-hidden", "true");
  handle.title = "Drag to resize the column. Double-click to reset all widths.";
  handle.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    startDrag({
      wrapper,
      table: handle.closest("table"),
      columnIndex,
      startX: event.clientX,
      storedWidths: getWidths(),
      alignments: getAlignments(),
      onResize,
    });
  });
  handle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  handle.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onReset();
  });
  return handle;
}

function startDrag({ wrapper, table, columnIndex, startX, storedWidths, alignments, onResize }) {
  // Measured on the first move, so a plain click changes nothing.
  let startWidths = null;
  let characterPixels = FALLBACK_CHARACTER_PIXELS;
  let widths = null;

  const finish = () => {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("mouseup", onUp, true);
    document.removeEventListener("keydown", onKeydown, true);
    wrapper.classList.remove("is-resizing-column");
  };
  const cancel = () => {
    finish();
    applyColumnWidths(table, storedWidths);
  };
  const onMove = (event) => {
    if (!wrapper.isConnected) {
      finish();
      return;
    }
    if (!startWidths) {
      characterPixels = measureCharacterPixels(table);
      startWidths = measureColumnWidths(table, characterPixels, alignments);
      wrapper.classList.add("is-resizing-column");
    }
    const startPixels = startWidths[columnIndex] * characterPixels;
    widths = startWidths.map((width, index) =>
      index === columnIndex
        ? columnWidthFromPixels(
            startPixels + event.clientX - startX,
            characterPixels,
            alignments[index],
          )
        : width,
    );
    applyColumnWidths(table, widths);
  };
  const onUp = () => {
    finish();
    if (!widths || !wrapper.isConnected) {
      return;
    }
    onResize(widths);
  };
  const onKeydown = (event) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    cancel();
  };

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("mouseup", onUp, true);
  document.addEventListener("keydown", onKeydown, true);
}

function measureColumnWidths(table, characterPixels, alignments) {
  const headerCells = [...table.querySelectorAll("thead .cm-rich-table-cell")];
  return headerCells.map((cell, index) =>
    columnWidthFromPixels(
      cell.getBoundingClientRect().width,
      characterPixels,
      alignments[index],
    ),
  );
}

// 1ch in the table's own font, so the stored widths match what is drawn.
function measureCharacterPixels(table) {
  const probe = document.createElement("span");
  probe.className = "cm-rich-table-ch-probe";
  probe.style.cssText =
    `position:absolute;visibility:hidden;width:${CHARACTER_PROBE_LENGTH}ch;`;
  table.appendChild(probe);
  const pixels = probe.getBoundingClientRect().width / CHARACTER_PROBE_LENGTH;
  probe.remove();
  return pixels > 0 ? pixels : FALLBACK_CHARACTER_PIXELS;
}
