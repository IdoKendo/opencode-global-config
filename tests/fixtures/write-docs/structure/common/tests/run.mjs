import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const config = JSON.parse(await readFile('tests/config.json', 'utf8'));
const feature = await readFile('tests/features/documents.feature', 'utf8');
const workspace = await mkdtemp(path.join(tmpdir(), 'document-check-'));
try {
  await copyFile(config.input, path.join(workspace, 'document.md'));
  const text = await readFile(path.join(workspace, 'document.md'), 'utf8');
  const checks = [...feature.matchAll(/Then the document contains "([^"]+)"/g)];
  assert.ok(checks.length > 0);
  for (const [, expected] of checks) assert.ok(text.includes(expected), `Missing ${expected}`);
  console.log('Document checks passed');
} finally {
  await rm(workspace, { recursive: true, force: true });
}
