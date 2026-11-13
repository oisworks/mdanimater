// Editor shortcuts that must go through the sync queue.
//
// VS Code's webview host forwards Ctrl/Cmd shortcuts to the workbench from a
// bubbling listener on `window`. A forwarded Ctrl+Z or Ctrl+S would undo or save
// the document before the typing still waiting in the sync client reached it, so
// these keys are caught in the capture phase and sent as commands after the
// pending edits. Every other Ctrl/Cmd shortcut (closing the tab, switching
// files) still goes to VS Code, but the pending edits are sent first.

/**
 * @param {{ key: string, ctrlKey: boolean, metaKey: boolean, shiftKey: boolean, altKey: boolean }} event
 * @param {boolean} isMac
 * @returns {"undo" | "redo" | "save" | undefined}
 */
export function commandForKey(event, isMac) {
  const primary = isMac
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (!primary || event.altKey) {
    return undefined;
  }

  const key = event.key.toLowerCase();
  if (key === "z") {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y" && !isMac && !event.shiftKey) {
    return "redo";
  }
  if (key === "s" && !event.shiftKey) {
    return "save";
  }
  return undefined;
}

/**
 * @param {EventTarget} target
 * @param {boolean} isMac
 * @param {{
 *   command: (name: string) => void,
 *   shortcut: () => void,
 *   keepsOwnUndo?: (element: EventTarget | null) => boolean,
 * }} handlers `keepsOwnUndo` names the text fields (such as a table cell) whose
 *   undo and redo stay with the browser instead of undoing the document.
 */
export function interceptCommandKeys(
  target,
  isMac,
  { command, shortcut, keepsOwnUndo = () => false },
) {
  target.addEventListener(
    "keydown",
    (event) => {
      const name = commandForKey(event, isMac);
      if (name && name !== "save" && keepsOwnUndo(event.target)) {
        // Keep the default action, so the field undoes its own typing, but
        // stop VS Code from undoing the document as well.
        event.stopImmediatePropagation();
      } else if (name) {
        event.preventDefault();
        event.stopImmediatePropagation();
        command(name);
      } else if (isMac ? event.metaKey : event.ctrlKey) {
        shortcut();
      }
    },
    { capture: true },
  );
}
