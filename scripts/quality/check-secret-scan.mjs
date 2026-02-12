import { readTextFile, walkFiles } from "./lib.mjs";

const TEXT_FILE_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".jsonc",
  ".yaml",
  ".yml",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".sh",
]);

const secretPatterns = [
  {
    name: "JWT",
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  },
  {
    name: "Token assignment",
    regex: /\b(?:api[_-]?key|token|secret|access[_-]?token)\b\s*[:=]\s*["'][A-Za-z0-9_\-\.]{16,}["']/gi,
  },
  {
    name: "Private key block",
    regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
  },
];

const candidateFiles = walkFiles().filter(({ relativePath }) => {
  if (relativePath.startsWith("scripts/quality/")) return false;
  const extensionMatch = /\.[^.]+$/.exec(relativePath);
  if (!extensionMatch) return false;
  return TEXT_FILE_EXTENSIONS.has(extensionMatch[0]);
});

const violations = [];

for (const { absolutePath, relativePath } of candidateFiles) {
  const content = readTextFile(absolutePath);
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        violations.push({
          file: relativePath,
          line: index + 1,
          pattern: pattern.name,
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`Secret scan gate failed: ${violations.length} finding(s).`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} (${violation.pattern})`);
  }
  process.exit(1);
}

console.log(`Secret scan gate passed: scanned ${candidateFiles.length} text file(s).`);
