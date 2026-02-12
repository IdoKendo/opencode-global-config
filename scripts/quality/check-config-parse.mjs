import { readTextFile, walkFiles } from "./lib.mjs";

function stripJsoncComments(input) {
  let output = "";
  let inString = false;
  let isEscaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const nextChar = i + 1 < input.length ? input[i + 1] : "";

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        output += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      output += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "/" && nextChar === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === "\"") {
      inString = true;
    }

    output += char;
  }

  return output;
}

function removeTrailingCommas(input) {
  let output = "";
  let inString = false;
  let isEscaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inString) {
      output += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === "\\") {
        isEscaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = i + 1;
      while (lookahead < input.length && /\s/.test(input[lookahead])) {
        lookahead += 1;
      }
      const nextToken = input[lookahead];
      if (nextToken === "}" || nextToken === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
}

function parseJsonFile(content, isJsonc) {
  if (!isJsonc) {
    JSON.parse(content);
    return;
  }

  const withoutComments = stripJsoncComments(content);
  const normalized = removeTrailingCommas(withoutComments);
  JSON.parse(normalized);
}

const files = walkFiles().filter((file) => file.relativePath.endsWith(".json") || file.relativePath.endsWith(".jsonc"));
const failures = [];

for (const file of files) {
  try {
    const content = readTextFile(file.absolutePath);
    parseJsonFile(content, file.relativePath.endsWith(".jsonc"));
  } catch (error) {
    failures.push({
      file: file.relativePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

if (failures.length > 0) {
  console.error(`Config parse gate failed: ${failures.length} invalid file(s).`);
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.error}`);
  }
  process.exit(1);
}

console.log(`Config parse gate passed: ${files.length} file(s) validated.`);
