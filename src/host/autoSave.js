// Auto save for documents open in the mdanimater editor.
//
// VS Code does not reload a document with unsaved changes when its file
// changes on disk; it reports a conflict on the next save instead. An AI agent
// writing the file while the user types would therefore end in a "the content
// of the file is newer" prompt. Saving a second after the document stops
// changing keeps it saved almost all the time, so the agent's write lands on a
// saved document, which VS Code reloads, and the webview rebases the typing it
// has not sent yet onto that text (see syncSession.js).

const DEFAULT_DELAY_MS = 1000;

/**
 * @typedef {{ uri: { toString(): string }, isDirty: boolean, isClosed: boolean }} SavableDocument
 */

/**
 * @param {object} options
 * @param {number} [options.delayMs]
 * @param {(document: SavableDocument) => boolean} options.isEnabled The setting.
 * @param {(document: SavableDocument) => boolean} options.canSave False while
 *   saving would skip a decision the user still has to make (pending Copilot edits).
 * @param {(document: SavableDocument) => PromiseLike<boolean>} options.save
 * @param {(error: unknown) => void} options.reportError
 */
function createAutoSaver({ delayMs = DEFAULT_DELAY_MS, isEnabled, canSave, save, reportError }) {
  // Document uri -> { document, timer } for saves waiting for the delay.
  const pending = new Map();
  // Uris of documents whose auto save is running, so save participants can
  // tell it apart from a save the user asked for.
  const saving = new Set();

  function shouldSave(document) {
    return !document.isClosed && document.isDirty && isEnabled(document) && canSave(document);
  }

  async function saveNow(document) {
    const key = document.uri.toString();
    const entry = pending.get(key);
    if (entry) {
      clearTimeout(entry.timer);
      pending.delete(key);
    }
    if (!shouldSave(document)) {
      return;
    }
    saving.add(key);
    try {
      await save(document);
    } catch (error) {
      reportError(error);
    } finally {
      saving.delete(key);
    }
  }

  return {
    /** Call from onDidChangeTextDocument for a document open in mdanimater. */
    documentChanged(document) {
      if (!shouldSave(document)) {
        return;
      }
      const key = document.uri.toString();
      clearTimeout(pending.get(key)?.timer);
      const timer = setTimeout(() => {
        void saveNow(document);
      }, delayMs);
      pending.set(key, { document, timer });
    },

    /** Saves a document waiting for its delay at once (the editor is closing). */
    async flush(document) {
      if (pending.has(document.uri.toString())) {
        await saveNow(document);
      }
    },

    isAutoSaving(document) {
      return saving.has(document.uri.toString());
    },

    dispose() {
      for (const { timer } of pending.values()) {
        clearTimeout(timer);
      }
      pending.clear();
    },
  };
}

module.exports = {
  createAutoSaver,
};
