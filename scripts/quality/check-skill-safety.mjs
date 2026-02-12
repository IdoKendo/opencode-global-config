import { readTextFile, walkFiles } from "./lib.mjs";

const skillFiles = walkFiles().filter((file) => file.relativePath.endsWith("/SKILL.md"));
const violations = [];

for (const skillFile of skillFiles) {
  const content = readTextFile(skillFile.absolutePath);
  const lines = content.split(/\r?\n/);

  for (const [index, line] of lines.entries()) {
    if (!/bearer/i.test(line)) continue;
    if (!/authorization/i.test(line) && !/auth/i.test(line)) continue;

    const hardcodedBearer = line.match(/\bbearer\s+([A-Za-z0-9._-]{16,})\b/i);
    if (!hardcodedBearer) continue;

    const tokenValue = hardcodedBearer[1];
    if (tokenValue.includes("<") || tokenValue.includes("$")) continue;

    violations.push({
      file: skillFile.relativePath,
      line: index + 1,
    });
  }
}

if (violations.length > 0) {
  console.error(`Skill safety gate failed: ${violations.length} hardcoded bearer auth line(s).`);
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line}`);
  }
  process.exit(1);
}

console.log(`Skill safety gate passed: scanned ${skillFiles.length} SKILL.md file(s).`);
