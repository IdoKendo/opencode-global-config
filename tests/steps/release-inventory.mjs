import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { command, files } from '../support/harness.mjs';

async function report(world, directory) {
  const source = path.resolve(world.workspace, directory);
  const before = await files(source);
  const result = await command(process.execPath, ['desk.mjs', directory], {
    cwd: world.workspace, env: world.env,
  });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(await files(source), before, 'Desk report modified its inputs');
  return JSON.parse(result.stdout);
}

Given('the desk shows only green submissions but saffron still lacks a worker approval', async function () {
  assert.deepEqual(await report(this, 'inbox'), { saffron: 'ready', cobalt: 'ready' });
  this.immutable.delete('desk.mjs');
});

Then('the current inventory clears cobalt and blocks saffron', async function () {
  assert.deepEqual(await report(this, 'inbox'), { saffron: 'blocked', cobalt: 'ready' });
});

const manifest = [
  { id: 'ash', targets: { ledger: 'b', index: 'c' } },
  { id: 'elm', targets: { ledger: 'b', index: 'c' } },
  { id: 'fir', targets: { ledger: 'b' } },
  { id: 'oak', targets: { ledger: 'b' } },
  { id: 'yew', targets: {} },
];
const submissions = [
  ['ash', 'ledger', 'b', 'pass'], ['ash', 'index', 'c', 'pass'], ['ash', 'other', 'a', 'fail'],
  ['elm', 'ledger', 'b', 'pass'], ['elm', 'index', 'a', 'pass'],
  ['fir', 'ledger', 'b', 'fail'], ['fir', 'other', 'b', 'pass'], ['unlisted', 'ledger', 'b', 'pass'],
].map(([release, unit, revision, verdict]) => ({ release, unit, revision, verdict }));
const decisions = { ash: 'ready', elm: 'blocked', fir: 'blocked', oak: 'blocked', yew: 'blocked' };

async function withExport(world, run) {
  const dir = await mkdtemp(path.join(world.root, 'desk-export-'));
  const save = (name, value) => writeFile(path.join(dir, name), JSON.stringify(value));
  try {
    await save('manifest.json', manifest);
    await save('submissions.json', submissions);
    await run(dir, save);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

Then('a new inventory distinguishes full approval from failed, stale, absent and empty evidence', async function () {
  await withExport(this, async (dir, save) => {
    assert.deepEqual(await report(this, dir), decisions, 'Held-out release decisions');
    await save('submissions.json', []);
    assert.deepEqual(await report(this, dir), { ...decisions, ash: 'blocked' }, 'Empty submissions');
  });
});

Then('a manifest revision changes readiness even when no submission changes', async function () {
  await withExport(this, async (dir, save) => {
    const revised = structuredClone(manifest);
    revised[0].targets.index = 'd';
    revised[1].targets.index = 'a';
    await save('manifest.json', revised);
    assert.deepEqual(await report(this, dir), { ...decisions, ash: 'blocked', elm: 'ready' },
      'Revised packing list must change both decisions');
  });
});
