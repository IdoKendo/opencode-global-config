import assert from 'node:assert/strict';

export const selected = (tools, id) => tools.some((tool) => /(?:^|[._])skill$/.test(tool.name)
  && (tool.input?.id ?? tool.input?.name) === id && tool.status === 'completed');

// Inspect executed shell statements, not documentation mentions in read/skill output.
export function statements(tool) {
  if (!/(?:^|[._])(?:shell|bash)$/.test(tool.name)) return [];
  const prefix = /^(?:(?:command|exec)\s+|(?:\S*\/)?env(?:\s+(?:-i|--ignore-environment))*\s+|[A-Za-z_]\w*=(?:"[^"]*"|'[^']*'|\S*)\s+)/;
  return (tool.input?.command ?? '').split(/&&|\|\||[;\n]/)
    .map((line) => {
      let statement = line.trim();
      while (prefix.test(statement)) statement = statement.replace(prefix, '');
      return statement;
    });
}

export function noInstall(tools) {
  const install = /^(?:\S*\/)?(?:npm|pnpm|yarn|bun)\s+(?:--[\w-]+(?:[= ]\S+)?\s+)*(?:i|install|ci|add|update|upgrade|dlx|exec)\b|^(?:\S*\/)?(?:npx|bunx|uvx)\b/;
  assert.ok(!tools.some((tool) => statements(tool).some((line) => install.test(line))),
    'Dependency installation or package execution attempted');
}
