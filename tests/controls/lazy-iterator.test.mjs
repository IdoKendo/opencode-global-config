import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from '../support/control-fixture.mjs';
import { readyJobs } from '../fixtures/simplify-code/lazy-iterator-change/jobs.mjs';
import { drain, earlyStop, jobDepth } from '../support/probe-audit.mjs';

test('flatter lazy filtering passes; eager filtering only passes the full drain', async (t) => {
  earlyStop(readyJobs);
  drain(readyJobs);
  const world = await fixture(t, 'simplify-code/lazy-iterator-change');
  const nested = await jobDepth(world);
  function* flat(source) {
    for (const job of source) if (job?.ready && !job.paused) yield job;
  }
  await world.write('jobs.mjs', `export ${flat.toString()}`);
  assert.ok(await jobDepth(world) < nested);
  earlyStop(flat);
  drain(flat);
  function* eager(source) {
    yield* [...source].filter((job) => job?.ready && !job.paused);
  }
  drain(eager);
  assert.throws(() => earlyStop(eager), /read beyond first ready job/);
  assert.throws(() => drain(function* (source) { yield [...flat(source)][0]; }), /1 !== 2/);
});
