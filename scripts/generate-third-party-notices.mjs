// Collect the licenses of packages actually included in the three webview bundles.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const packages = new Map();
for (const entry of ["src/richEditor.js", "src/mermaidLoader.js", "src/richDiff.js"]) {
  const result = await build({ absWorkingDir: root, entryPoints: [entry], bundle: true, format: "iife", write: false, metafile: true });
  for (const input of Object.keys(result.metafile.inputs)) {
    if (!input.startsWith("node_modules/")) continue;
    let directory = path.dirname(path.join(root, input));
    let metadata;
    while (directory !== root) {
      const manifest = path.join(directory, "package.json");
      if (fs.existsSync(manifest)) {
        metadata = JSON.parse(fs.readFileSync(manifest, "utf8"));
        if (metadata.name) break;
      }
      directory = path.dirname(directory);
    }
    if (directory === root) throw new Error(`Missing package metadata: ${input}`);
    packages.set(`${metadata.name}@${metadata.version}`, { directory, metadata });
  }
}
const sections = ["# Third-party notices\n\nmdanimater is derived from Richdown by mytooyo (MIT); see LICENSE and README.md.\n\nThe following packages are included in the webview bundles. License texts are copied from the installed versions pinned in package-lock.json. Regenerate with `node scripts/generate-third-party-notices.mjs`.\n"];
for (const [name, { directory, metadata }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  const files = fs.readdirSync(directory).filter((file) => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(file) && fs.statSync(path.join(directory, file)).isFile());
  if (!files.length) throw new Error(`Missing license text: ${name}`);
  sections.push(`## ${name}\n\nLicense: ${typeof metadata.license === "string" ? metadata.license : JSON.stringify(metadata.license)}\n`);
  for (const file of files.sort()) sections.push(`### ${file}\n\n~~~~text\n${fs.readFileSync(path.join(directory, file), "utf8").trim()}\n~~~~\n`);
}
fs.writeFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), sections.join("\n"));
console.log(`Recorded licenses for ${packages.size} bundled packages.`);
