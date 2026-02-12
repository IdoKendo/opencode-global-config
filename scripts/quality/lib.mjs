import fs from "node:fs";
import path from "node:path";

export const repoRoot = process.cwd();

const DEFAULT_EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
]);

export function walkFiles(startDir = repoRoot, options = {}) {
  const excludedDirs = new Set([...(options.excludedDirs || []), ...DEFAULT_EXCLUDED_DIRS]);
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(repoRoot, absolutePath).split(path.sep).join("/");

      if (entry.isDirectory()) {
        if (!excludedDirs.has(entry.name)) {
          walk(absolutePath);
        }
        continue;
      }

      if (entry.isFile()) {
        files.push({ absolutePath, relativePath });
      }
    }
  }

  walk(startDir);
  return files;
}

export function readTextFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

export function loadQualityConfig() {
  const configPath = path.join(repoRoot, "scripts", "quality", "config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}
