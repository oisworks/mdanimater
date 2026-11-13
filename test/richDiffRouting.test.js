import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const { getGitDiffInput, revisionLabel, createRichDiffRouting } = require("../src/host/richDiffRouting");
const uri = (scheme, ref = "HEAD", path = "/notes.md") => ({
  scheme, path, query: JSON.stringify({ ref }),
  toString: () => `${scheme}:${path}?${ref}`,
});
const input = (left = "HEAD", right = "file") => ({
  original: uri("git", left), modified: uri(right, ""),
});
function setup(existing = []) {
  const group = { tabs: existing, activeTab: existing[0] };
  const tabGroups = { all: [group], activeTabGroup: group, close: vi.fn() };
  const openComparison = vi.fn(async (_input, _title, isCurrent) => isCurrent());
  const isEnabled = vi.fn(() => true);
  const reportError = vi.fn();
  const routing = createRichDiffRouting({ tabGroups, openComparison, isEnabled, reportError });
  const activate = (comparison = input()) => {
    const tab = { input: comparison, label: "notes.md (comparison)", isDirty: false };
    group.tabs.push(tab);
    group.activeTab = tab;
    return tab;
  };
  return { ...routing, group, tabGroups, openComparison, isEnabled, reportError, activate };
}

describe("Git diff routing", () => {
  it.each([input(), input("", "file"), input("HEAD", "git"), input("abc123", "git"), input("HEAD", "vscode-remote")])("keeps the actual original and modified revisions", async comparison => {
    const s = setup();
    const tab = s.activate(comparison);
    await s.route();
    await s.route();
    expect(s.openComparison).toHaveBeenCalledExactlyOnceWith(comparison, tab.label, expect.any(Function));
    expect(s.tabGroups.close).toHaveBeenCalledWith(tab, true);
  });
  it.each([
    undefined,
    { uri: uri("file") },
    { original: uri("file"), modified: uri("file") },
    { original: uri("chat-editing-snapshot"), modified: uri("file") },
    { original: uri("git", "HEAD", "/a.js"), modified: uri("file", "", "/a.js") },
  ])("does not intercept unrelated editors", async comparison => {
    expect(getGitDiffInput(comparison)).toBeUndefined();
    const s = setup();
    s.activate(comparison || {});
    await s.route();
    expect(s.openComparison).not.toHaveBeenCalled();
  });
  it("leaves restored and dirty tabs alone and honors the setting", async () => {
    const existing = { input: input() };
    const s = setup([existing]);
    await s.route();
    s.activate().isDirty = true;
    await s.route();
    s.isEnabled.mockReturnValue(false);
    s.activate();
    await s.route();
    expect(s.openComparison).not.toHaveBeenCalled();
  });
  it("routes a preview tab again when its revisions change", async () => {
    const s = setup();
    const tab = s.activate();
    await s.route();
    tab.input = input("abc123", "git");
    await s.route();
    expect(s.openComparison).toHaveBeenCalledTimes(2);
  });
  it("does not reopen Source Diff as a rich diff", async () => {
    const s = setup();
    const comparison = input();
    await s.openNative(comparison, async () => {
      s.activate(comparison);
      await s.route();
    });
    await s.route();
    expect(s.openComparison).not.toHaveBeenCalled();
    s.group.tabs = [];
    await s.route();
    s.activate(comparison);
    await s.route();
    expect(s.openComparison).toHaveBeenCalledTimes(1);
  });
  it("keeps the text diff on read failure", async () => {
    const s = setup();
    s.openComparison.mockRejectedValue(new Error("provider unavailable"));
    s.activate();
    await s.route();
    expect(s.reportError).toHaveBeenCalled();
    expect(s.tabGroups.close).not.toHaveBeenCalled();
  });
  it("does not steal focus if the user switches tabs during a read", async () => {
    const s = setup();
    s.openComparison.mockImplementation(async (_input, _title, isCurrent) => {
      s.activate(input("other"));
      return isCurrent();
    });
    s.activate();
    await s.route();
    expect(s.tabGroups.close).not.toHaveBeenCalled();
  });
  it("survives VS Code replacing the Tab object while a revision loads", async () => {
    const s = setup();
    const original = s.activate();
    const replacement = { ...original };
    s.openComparison.mockImplementation(async (_input, _title, isCurrent) => {
      s.group.tabs = [replacement];
      s.group.activeTab = replacement;
      await s.route();
      return isCurrent();
    });
    await s.route();
    expect(s.openComparison).toHaveBeenCalledTimes(1);
    expect(s.tabGroups.close).toHaveBeenCalledExactlyOnceWith(replacement, true);
  });
  it("labels working, staged and historical revisions", () => {
    expect(revisionLabel(uri("file"))).toBe("Working Tree");
    expect(revisionLabel(uri("git", ""))).toBe("Index");
    expect(revisionLabel(uri("git", "~"))).toBe("Index");
    expect(revisionLabel(uri("git", "abc123"))).toBe("abc123");
    expect(revisionLabel({ scheme: "git", query: "bad" })).toBe("Git revision");
  });
});
