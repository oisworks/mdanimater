// CodeMirror stores its document with LF line breaks, so text that arrives from
// the extension host has to be normalized before it is compared or applied.
// A stray "\r" reaching a CodeMirror change is split as a line break, which
// silently inserts an extra blank line into the user's document.
// The extension host keeps its own CommonJS copy in src/host/lineEndings.js.
export function normalizeLineEndings(text) {
  return String(text ?? "").replace(/\r\n?/g, "\n");
}
