import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { repoRoot, walkFiles } from "./lib.mjs";

function runCommand(command, args) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8",
  });
}

const runtimeFiles = walkFiles().filter((file) => file.relativePath.startsWith("plugin/") && /\.(?:js|mjs|cjs|ts|tsx)$/.test(file.relativePath));
const jsFiles = runtimeFiles.filter((file) => /\.(?:js|mjs|cjs)$/.test(file.relativePath));
const tsFiles = runtimeFiles.filter((file) => /\.(?:ts|tsx)$/.test(file.relativePath));

const errors = [];

for (const jsFile of jsFiles) {
  const result = runCommand("node", ["--check", jsFile.absolutePath]);
  if (result.status !== 0) {
    errors.push({
      file: jsFile.relativePath,
      output: (result.stderr || result.stdout || "Syntax check failed").trim(),
    });
  }
}

if (tsFiles.length > 0) {
  const hasTsconfig = fs.existsSync(`${repoRoot}/tsconfig.json`);
  if (!hasTsconfig) {
    errors.push({
      file: "tsconfig.json",
      output: "Runtime TS files found but tsconfig.json is missing.",
    });
  } else {
    const tscVersion = runCommand("npx", ["--no-install", "tsc", "-v"]);
    if (tscVersion.status !== 0) {
      errors.push({
        file: "tsconfig.json",
        output: "Runtime TS files found but TypeScript binary is unavailable. Run `npm ci` and try again.",
      });
    } else {
      const typecheck = runCommand("npx", ["--no-install", "tsc", "--noEmit", "--pretty", "false", "-p", "tsconfig.json"]);
      if (typecheck.status !== 0) {
        errors.push({
          file: "tsconfig.json",
          output: (typecheck.stderr || typecheck.stdout || "Typecheck failed").trim(),
        });
      }
    }
  }
}

const hasEslintConfig = fs.existsSync(`${repoRoot}/.eslintrc`) || fs.existsSync(`${repoRoot}/.eslintrc.json`) || fs.existsSync(`${repoRoot}/eslint.config.js`);
if (hasEslintConfig) {
  const eslintVersion = runCommand("npx", ["--no-install", "eslint", "-v"]);
  if (eslintVersion.status === 0) {
    const lintTargets = runtimeFiles.map((file) => file.relativePath);
    if (lintTargets.length > 0) {
      const lint = runCommand("npx", ["--no-install", "eslint", ...lintTargets]);
      if (lint.status !== 0) {
        errors.push({
          file: "eslint",
          output: (lint.stderr || lint.stdout || "Lint failed").trim(),
        });
      }
    }
  } else {
    console.warn("Runtime quality gate warning: ESLint config found, but eslint binary is unavailable.");
  }
}

if (errors.length > 0) {
  console.error(`Runtime quality gate failed: ${errors.length} issue(s).`);
  for (const error of errors) {
    console.error(`- ${error.file}`);
    console.error(error.output);
  }
  process.exit(1);
}

console.log(`Runtime quality gate passed: ${runtimeFiles.length} runtime file(s) checked.`);
