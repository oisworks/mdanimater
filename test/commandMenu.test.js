import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { openCommandMenu } = require("../src/host/commandMenu");
const manifest = require("../package.json");
// openGitDiff is an existing alias of openRichDiff, not a second menu action.
const actionIds = manifest.contributes.commands.map(item => item.command)
  .filter(id => !["mdanimater.openMenu", "mdanimater.openGitDiff"].includes(id));

describe("the single mdanimater menu", () => {
  it.each(actionIds)("keeps %s reachable and forwards the selected resource", async command => {
    const resource = { resourceUri: { scheme: "file", path: "/selected.md" } };
    const vscode = {
      window: { showQuickPick: vi.fn(async items => {
        expect(items.map(item => item.command)).toEqual(actionIds);
        return items.find(item => item.command === command);
      }) },
      commands: { executeCommand: vi.fn(async () => "completed") },
    };
    expect(await openCommandMenu(vscode, resource)).toBe("completed");
    expect(vscode.commands.executeCommand).toHaveBeenCalledExactlyOnceWith(command, resource);
  });

  it("does nothing when the menu is dismissed", async () => {
    const vscode = {
      window: { showQuickPick: vi.fn(async () => undefined) },
      commands: { executeCommand: vi.fn() },
    };
    await openCommandMenu(vscode);
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });
});
