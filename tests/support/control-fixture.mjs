import { cp, lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { command, files } from './harness.mjs';

export async function fixture(t, name) {
  const root = await mkdtemp(path.join(process.env.AGENT_TEST_TMPDIR ?? tmpdir(), 'control-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await cp(new URL(`../fixtures/${name}`, import.meta.url), workspace,
    { recursive: true });
  const env = { ...process.env };
  delete env.AGENT_TEST_RECEIPTS;
  const original = await files(workspace);
  const immutable = new Map();
  for (const [name, text] of original) {
    if (!name.endsWith('.md')) immutable.set(name, { text, mode: (await lstat(path.join(workspace, name))).mode });
  }
  return {
    root, workspace, original, immutable, beforeHead: 'baseline', tools: [], env,
    read: (name) => readFile(path.join(workspace, name), 'utf8'),
    write: (name, text) => writeFile(path.join(workspace, name), text),
    run: (text) => command('/bin/sh', ['-c', text], { cwd: workspace, env }),
    git: async (args) => args[0] === 'rev-parse' ? 'baseline' : '',
  };
}
