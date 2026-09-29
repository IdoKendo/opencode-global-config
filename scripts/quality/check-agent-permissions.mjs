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

function parsePermissionScalar(value) {
  const match = value.match(/^("(?:\\.|[^"\\])*"|'(?:''|[^'])*'|[^'"#][^#]*?)(?:\s+#.*)?$/);
  if (!match) throw new Error(`Invalid permission value: ${value}`);
  const scalar = match[1].trim();
  if (scalar.startsWith('"')) return JSON.parse(scalar);
  if (scalar.startsWith("'")) return scalar.slice(1, -1).replace(/''/g, "'");
  if (!scalar || /^[\[\]{}&*!|>]/.test(scalar)) {
    throw new Error(`Expected a string permission value: ${value}`);
  }
  return scalar;
}

function parseShellPermissionRules(frontmatterLines) {
  let inPermissions = false;
  let itemIndent = -1;
  let rule = null;
  const rules = [];

  function finishRule() {
    if (!rule) return;
    if (!rule.action) throw new Error("Permission rule is missing action");
    if (rule.action === "shell") {
      if (!rule.resource || !["allow", "deny", "ask"].includes(rule.effect)) {
        throw new Error("Shell permission rule requires resource and an allow, deny, or ask effect");
      }
      rules.push(rule);
    }
    rule = null;
  }

  // Support conventional block YAML; reject unsupported rule syntax rather than skip it.
  for (const line of frontmatterLines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0 && /^permissions:/.test(trimmed)) {
      finishRule();
      if (!/^permissions:\s*(?:#.*)?$/.test(trimmed) && !/^permissions:\s*\[\]\s*(?:#.*)?$/.test(trimmed)) {
        throw new Error("Permissions must use a block YAML array");
      }
      inPermissions = !/^permissions:\s*\[\]/.test(trimmed);
      itemIndent = -1;
      continue;
    }

    if (!inPermissions) continue;
    const isItem = /^-\s+/.test(trimmed);
    if (indent === 0 && !isItem) {
      finishRule();
      inPermissions = false;
      continue;
    }

    if (isItem) {
      finishRule();
      if (itemIndent !== -1 && indent !== itemIndent) throw new Error("Invalid permission rule indentation");
      itemIndent = indent;
      rule = {};
    } else if (!rule || indent !== itemIndent + 2) {
      throw new Error("Invalid permission field indentation");
    }

    const field = (isItem ? trimmed.replace(/^-\s+/, "") : trimmed).match(/^(action|resource|effect):\s*(.+)$/);
    if (!field || Object.hasOwn(rule, field[1])) {
      throw new Error(`Invalid or duplicate permission field: ${trimmed}`);
    }
    rule[field[1]] = parsePermissionScalar(field[2]);
  }

  finishRule();
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

const agentFiles = walkFiles().filter((file) => file.relativePath.startsWith("agents/") && file.relativePath.endsWith(".md"));
const violations = [];
const parseErrors = [];

for (const agentFile of agentFiles) {
  const content = readTextFile(agentFile.absolutePath);
  const frontmatterLines = getFrontmatter(content);
  if (!frontmatterLines) continue;

  let rules;
  try {
    rules = parseShellPermissionRules(frontmatterLines);
  } catch (error) {
    parseErrors.push(`${agentFile.relativePath}: ${error.message}`);
    continue;
  }
  for (const rule of rules) {
    if (rule.effect !== "allow") continue;
    if (!isBroadWildcardAllow(rule.resource)) continue;

    const exemptionKey = `${agentFile.relativePath}::${rule.resource}`;
    if (exemptions.has(exemptionKey)) continue;

    violations.push({
      file: agentFile.relativePath,
      pattern: rule.resource,
    });
  }
}

if (violations.length > 0 || parseErrors.length > 0) {
  console.error(`Agent permission gate failed: ${violations.length} broad wildcard allow rule(s).`);
  for (const error of parseErrors) console.error(`- ${error}`);
  for (const violation of violations) {
    console.error(`- ${violation.file}: \"${violation.pattern}\"`);
  }
  console.error("Add explicit exemptions in scripts/quality/config.json only if required.");
  process.exit(1);
}

console.log(`Agent permission gate passed: scanned ${agentFiles.length} agent file(s).`);
