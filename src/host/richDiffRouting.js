// Keep the exact revisions supplied by Source Control (including staged and
// historical comparisons), instead of silently replacing them with HEAD.
function getGitDiffInput(input) {
  const allowed = new Set(['git', 'file', 'vscode-remote']);
  const markdown = uri => uri && /\.(md|markdown)$/i.test(uri.path || uri.fsPath || '');
  if (!markdown(input?.original) || !markdown(input?.modified)) return undefined;
  if (!allowed.has(input.original.scheme) || !allowed.has(input.modified.scheme)) return undefined;
  if (input.original.scheme !== 'git' && input.modified.scheme !== 'git') return undefined;
  return { original: input.original, modified: input.modified };
}

function diffKey(input) {
  return JSON.stringify([input.original.toString(), input.modified.toString()]);
}

function revisionLabel(uri) {
  if (uri.scheme !== 'git') return 'Working Tree';
  try {
    const { ref } = JSON.parse(uri.query);
    if (ref === '' || ref === '~') return 'Index';
    if (typeof ref === 'string' && ref) return ref;
  } catch {
    // Third-party Git providers may not use the built-in query format.
  }
  return 'Git revision';
}

function createRichDiffRouting({ tabGroups, isEnabled, openComparison, reportError }) {
  // VS Code can replace Tab API objects while loading a diff. Identify a tab
  // by its group and revisions rather than relying on object identity.
  const seen = new Set();
  const nativeOpens = new Set();
  function tabKey(tab) {
    const input = getGitDiffInput(tab?.input);
    return input ? JSON.stringify([tab.group?.viewColumn, diffKey(input)]) : undefined;
  }
  function remember(tab) {
    const key = tabKey(tab);
    if (key) seen.add(key);
  }
  // Existing tabs remain where the user left them when the extension starts.
  for (const group of tabGroups.all) group.tabs.forEach(remember);

  async function route() {
    const liveKeys = new Set(tabGroups.all.flatMap(group => group.tabs.map(tabKey)));
    for (const key of seen) if (!liveKeys.has(key)) seen.delete(key);
    const tab = tabGroups.activeTabGroup?.activeTab;
    const input = getGitDiffInput(tab?.input);
    if (!input) return;
    const key = tabKey(tab);
    if (seen.has(key)) return;
    seen.add(key);
    if (!isEnabled() || tab.isDirty || nativeOpens.has(diffKey(input))) return;
    const isCurrent = () => {
      const active = tabGroups.activeTabGroup?.activeTab;
      return tabKey(active) === key && !active.isDirty;
    };
    try {
      const opened = await openComparison(input, tab.label, isCurrent);
      const current = tabGroups.all.flatMap(group => group.tabs).find(candidate => tabKey(candidate) === key);
      if (opened && current && !current.isDirty) await tabGroups.close(current, true);
    } catch (error) {
      // Leave the original diff accessible on read/provider errors.
      reportError(error);
    }
  }

  async function openNative(input, open) {
    const key = diffKey(input);
    nativeOpens.add(key);
    try {
      await open();
      for (const group of tabGroups.all) {
        for (const tab of group.tabs) {
          const candidate = getGitDiffInput(tab.input);
          if (candidate && diffKey(candidate) === key) remember(tab);
        }
      }
    } finally {
      nativeOpens.delete(key);
    }
  }

  const noteClosed = tabs => tabs.forEach(tab => seen.delete(tabKey(tab)));
  return { route, openNative, noteClosed };
}

module.exports = { getGitDiffInput, revisionLabel, createRichDiffRouting };
