// One discoverable entry point; individual commands remain callable by shortcuts.
const actions = [
  { label: 'Open Review Comments', command: 'mdanimater.openReviewComments' },
  { label: 'Refresh Review Comments', command: 'mdanimater.refreshReviewComments' },
  { label: 'Toggle Markdown Open Mode', command: 'mdanimater.toggle' },
  { label: 'Open Rich Diff', command: 'mdanimater.openRichDiff' },
  { label: 'Export HTML', command: 'mdanimater.exportHtml' },
  { label: 'Export PDF', command: 'mdanimater.exportPdf' },
  { label: 'Format Document', command: 'mdanimater.formatDocument' },
  { label: 'Create Formatter and Lint Configuration', command: 'mdanimater.createConfig' },
];

async function openCommandMenu(vscode, resource) {
  const selected = await vscode.window.showQuickPick(actions, {
    title: 'mdanimater',
    placeHolder: 'Choose an action',
  });
  if (selected) {
    return vscode.commands.executeCommand(selected.command, resource);
  }
}

module.exports = { openCommandMenu };
