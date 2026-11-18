import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fixture } from '../support/control-fixture.mjs';
import { checkConfig, checkRelease } from '../support/probe-lookup.mjs';

test('only reading the pinned page supplies lookup evidence', async (t) => {
  const world = await fixture(t, 'find-docs/pinned');
  const log = path.join(world.root, 'receipts.jsonl');
  world.env.AGENT_TEST_RECEIPTS = log;
  const run = async (args) => {
    const result = await world.run(`./bin/ctx7 ${args}`);
    assert.equal(result.code, 0, result.stderr);
    return result.stdout;
  };
  const records = async () => (await readFile(log, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.match(await run('library ParcelQuill spooling'), /v2\.4/);
  await assert.rejects(readFile(log), { code: 'ENOENT' });
  assert.match(await run('docs /parcelquill/collector spooling'), /capacityBytes/);
  assert.throws(() => checkRelease([]), /No successful retrieval/);
  const latestOnly = await records();
  assert.throws(() => checkRelease(latestOnly), /No successful retrieval/);
  assert.match(await run('docs /parcelquill/collector/v2.4 spooling'), /limitKiB/);
  checkRelease(await records());
});

test('configuration is graded independently of a successful lookup', () => {
  checkConfig('```json\n{"journal":{"limitKiB":512,"medium":"volume"}}\n```');
  for (const wrong of [
    { spool: { backend: 'disk', capacityBytes: 524288 } },
    { journal: { medium: 'volume', limitKiB: 524288 } },
    { journal: { medium: 'memory', limitKiB: 512 } },
  ]) assert.throws(() => checkConfig(JSON.stringify(wrong)), assert.AssertionError);
});
