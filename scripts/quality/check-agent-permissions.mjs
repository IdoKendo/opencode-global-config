import { loadQualityConfig, readTextFile, walkFiles } from "./lib.mjs";

function getFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return null;

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return null;
  return lines.slice(1, endIndex);
}

function parseBashPermissionRules(frontmatterLines) {
  let inPermission = false;
  let permissionIndent = -1;
  let inBash = false;
  let bashIndent = -1;
  const rules = [];

  for (const line of frontmatterLines) {
    if (!line.trim()) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (!inPermission && trimmed === "permission:") {
      inPermission = true;
      permissionIndent = indent;
      continue;
    }

    if (inPermission && indent <= permissionIndent && trimmed.endsWith(":")) {
      inPermission = false;
      inBash = false;
    }

    if (inPermission && !inBash && trimmed === "bash:") {
      inBash = true;
      bashIndent = indent;
      continue;
    }

    if (inBash && indent <= bashIndent) {
      inBash = false;
      continue;
    }

    if (!inBash) continue;

    const ruleMatch = line.match(/^\s*"([^"]+)"\s*:\s*(allow|deny)\s*$/);
    if (ruleMatch) {
      rules.push({ commandPattern: ruleMatch[1], access: ruleMatch[2] });
    }
  }

  return rules;
}

function isBroadWildcardAllow(commandPattern) {
  if (commandPattern === "*") return true;
  if (/^\S+\s+\*$/.test(commandPattern)) return true;
  return false;
}

const config = loadQualityConfig();
const exemptions = new Set(
  (config.agentPermissionExemptions || []).map((entry) => `${entry.file}::${entry.pattern}`),
);

const agentFiles = walkFiles().filter((file) => file.relativePath.startsWith("agent/") && file.relativePath.endsWith(".md"));
const violations = [];

for (const agentFile of agentFiles) {
  const content = readTextFile(agentFile.absolutePath);
  const frontmatterLines = getFrontmatter(content);
  if (!frontmatterLines) continue;

  const rules = parseBashPermissionRules(frontmatterLines);
  for (const rule of rules) {
    if (rule.access !== "allow") continue;
    if (!isBroadWildcardAllow(rule.commandPattern)) continue;

    const exemptionKey = `${agentFile.relativePath}::${rule.commandPattern}`;
    if (exemptions.has(exemptionKey)) continue;

    violations.push({
      file: agentFile.relativePath,
      pattern: rule.commandPattern,
    });
  }
}

if (violations.length > 0) {
  console.error(`Agent permission gate failed: ${violations.length} broad wildcard allow rule(s).`);
  for (const violation of violations) {
    console.error(`- ${violation.file}: \"${violation.pattern}\"`);
  }
  console.error("Add explicit exemptions in scripts/quality/config.json only if required.");
  process.exit(1);
}

console.log(`Agent permission gate passed: scanned ${agentFiles.length} agent file(s).`);
