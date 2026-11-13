import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Product identity, commands, settings and editor IDs share one namespace.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readRepoFile = (relativePath) =>
  readFileSync(path.join(repoRoot, relativePath), "utf8");
const manifest = JSON.parse(readRepoFile("package.json"));
const contributes = manifest.contributes;
const commandIds = contributes.commands.map((command) => command.command);
const settingKeys = [contributes.configuration]
  .flat()
  .flatMap((section) => Object.keys(section.properties));
// Commands and settings are wired in extension.js and the formatter/linter host.
const hostSource = ["extension.js", "src/host/markdownQuality.js"]
  .map(readRepoFile)
  .join("\n");

describe("package.json", () => {
  it("offers one palette and toolbar entry with no companion extensions required", () => {
    const palette = contributes.menus.commandPalette;
    const visible = commandIds.filter(id => palette.find(item => item.command === id)?.when !== "false");
    expect(visible).toEqual(["mdanimater.openMenu"]);
    expect(contributes.menus["editor/title"].map(item => item.command)).toEqual(["mdanimater.openMenu"]);
    expect(manifest.extensionDependencies ?? []).toEqual([]);
    expect(manifest.extensionPack ?? []).toEqual([]);
    const properties = contributes.configuration.properties;
    expect(properties["mdanimater.openMarkdownAsRichEditor"].default).toBe(true);
    expect(properties["mdanimater.openGitDiffAsRichDiff"].default).toBe(true);
  });

  it("ships the oisworks.mdanimater identity and product name", () => {
    expect(`${manifest.publisher}.${manifest.name}`).toBe("oisworks.mdanimater");
    expect(manifest.name).toBe("mdanimater");
    expect(manifest.displayName).toBe("mdanimater");
    expect(manifest.publisher).toBe("oisworks");
    expect(manifest.repository.url).toBe("git+https://github.com/oisworks/mdanimater.git");
  });

  it("keeps the lockfile and installation instructions aligned with the package", () => {
    const lock = JSON.parse(readRepoFile("package-lock.json"));
    for (const entry of [lock, lock.packages[""]]) {
      expect(entry.name).toBe(manifest.name);
      expect(entry.version).toBe(manifest.version);
    }
    const readme = readRepoFile("README.md");
    expect(readme).toContain(`拡張機能 ID は \`${manifest.publisher}.${manifest.name}\``);
    expect(readme).toContain(`${manifest.name}-<version>.vsix`);
    expect(readme).toContain(`"editor.defaultFormatter": "${manifest.publisher}.${manifest.name}"`);
  });

  it("uses one namespace for command, setting and editor IDs and labels", () => {
    expect(commandIds.length).toBeGreaterThan(0);
    for (const id of [...commandIds, ...settingKeys]) {
      expect(id).toMatch(/^mdanimater\./);
    }
    for (const command of contributes.commands) {
      expect(command.title).toMatch(/^mdanimater: /);
    }
    expect(contributes.customEditors.map((editor) => editor.viewType)).toEqual(["mdanimater.editor"]);
    expect(contributes.customEditors[0].displayName).toBe("mdanimater Markdown Editor");
    expect([contributes.configuration].flat().map((section) => section.title)).toEqual(["mdanimater"]);
  });

  it("never mentions Richdown in what VS Code shows", () => {
    const shown = JSON.stringify({
      description: manifest.description,
      commands: contributes.commands,
      configuration: contributes.configuration,
      customEditors: contributes.customEditors,
    });
    expect(shown).not.toMatch(/richdown/i);
  });

  it("activates on and shows only commands it defines", () => {
    const activationCommands = manifest.activationEvents
      .filter((event) => event.startsWith("onCommand:"))
      .map((event) => event.slice("onCommand:".length));
    const menuCommands = Object.values(contributes.menus)
      .flat()
      .map((item) => item.command);
    for (const id of [...activationCommands, ...menuCommands]) {
      expect(commandIds).toContain(id);
    }
    expect(manifest.activationEvents).toContain("onCustomEditor:mdanimater.editor");
  });

  it("auto saves documents open in mdanimater by default", () => {
    const properties = Object.assign({}, ...[contributes.configuration].flat().map((section) => section.properties));
    expect(properties["mdanimater.autoSave"]).toMatchObject({ type: "boolean", default: true });
  });

  it("validates .mdanimaterrc.json with a schema that exists", () => {
    expect(contributes.languages).toEqual([{ id: "jsonc", filenames: [".mdanimaterrc.json"] }]);
    for (const validation of contributes.jsonValidation) {
      expect(validation.fileMatch).toBe(".mdanimaterrc.json");
      expect(existsSync(path.join(repoRoot, validation.url))).toBe(true);
    }
  });
});

describe("the extension host", () => {
  it("registers every contributed command", () => {
    for (const id of commandIds) {
      const quoted = id.replace(".", "\\.");
      expect(hostSource).toMatch(new RegExp(`registerCommand\\(\\s*['"]${quoted}['"]`));
    }
  });

  it("reads its settings from the mdanimater section", () => {
    const sections = [...hostSource.matchAll(/getConfiguration\(\s*['"]([^'"]+)['"]/g)]
      .map((match) => match[1]);
    expect(sections).toContain("mdanimater");
    expect(sections.every((section) => ["mdanimater", "workbench", "workbench.editor", "editor"].includes(section))).toBe(true);
    expect(hostSource).not.toMatch(/getConfiguration\(\s*['"]richdown['"]/);
    expect(hostSource).not.toMatch(/['"`]richdown\.[A-Za-z]/);
  });
});
