import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Check both the repository and an extracted VSIX with the same rule.
const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const excluded = new Set([".git", "node_modules", ".vscode-test", "coverage", "tasks", "articles", "examples", ".claude"]);
const obsolete = new RegExp(`\\b(?:${["ide", "an"].join("")}(?:rc)?|${["md", "animator"].join("")})\\b`, "i");
const failures = [];
let inspected = 0;

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (excluded.has(entry.name) || entry.name.endsWith(".vsix")) continue;
    const filename = path.join(directory, entry.name);
    const relative = path.relative(root, filename);
    if (obsolete.test(relative)) failures.push(`${relative}: obsolete filename`);
    if (entry.isDirectory()) {
      walk(filename);
    } else if (entry.isFile()) {
      const buffer = readFileSync(filename);
      if (buffer.includes(0)) continue;
      inspected++;
      if (obsolete.test(buffer.toString("utf8"))) failures.push(`${relative}: obsolete product name or identifier`);
    }
  }
}

walk(root);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Product naming verified in ${inspected} text files.`);
}
