import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { fixture } from '../support/control-fixture.mjs';

const { runConfiguration } = await loadConfiguration({ file: false, provided: {
  paths: [], require: [], import: [fileURLToPath(new URL('../steps/release-inventory.mjs', import.meta.url))],
} });
const support = await loadSupport(runConfiguration);
async function step(w, name) {
  const matches = support.stepDefinitions.filter(s => s.matchesStepName(name));
  assert.equal(matches.length, 1);
  await matches[0].code.call(w);
}

// Exercise the report's actual command boundary with a reference implementation
// and plausible partial repairs to the submitted-rows table.
const reference = `
import { readFileSync } from 'node:fs';
import path from 'node:path';
const read = name => JSON.parse(readFileSync(path.join(process.argv[2], name + '.json')));
const rows = read('submissions');
const result = {};
for (const {id, targets} of read('manifest')) {
  const required = Object.entries(targets);
  const ready = required.length > 0 && required.every(([unit, rev]) =>
    rows.some(r => r.release === id && r.unit === unit && r.revision === rev && r.verdict === 'pass'));
  result[id] = ready ? 'ready' : 'blocked';
}
console.log(JSON.stringify(result));
`;
const current = 'the current inventory clears cobalt and blocks saffron';
const heldOut = 'a new inventory distinguishes full approval from failed, stale, absent and empty evidence';
const revision = 'a manifest revision changes readiness even when no submission changes';

test('inventory rejects the green table and a fix specific to the inbox', async t => {
  const w = await fixture(t, 'build-the-tool/release-inventory');
  await step(w, 'the desk shows only green submissions but saffron still lacks a worker approval');
  await assert.rejects(step(w, current), assert.AssertionError);
  await w.write('desk.mjs', `console.log('{"cobalt":"ready","saffron":"blocked"}')`);
  await step(w, current);
  await assert.rejects(step(w, heldOut), assert.AssertionError);
  await w.write('desk.mjs', reference);
  for (const name of [current, heldOut, revision]) await step(w, name);
});

test('inventory rejects partial joins, vacuous approval and frozen revision decisions', async t => {
  const w = await fixture(t, 'build-the-tool/release-inventory');
  for (const predicate of ['r.release === id && ', 'r.unit === unit && ', 'r.revision === rev && ', " && r.verdict === 'pass'",
    'required.length > 0 && ']) {
    await w.write('desk.mjs', reference.replace(predicate, ''));
    await assert.rejects(step(w, heldOut), assert.AssertionError, predicate);
  }
  await w.write('desk.mjs', reference.replace('r.revision === rev', "r.revision === (unit === 'index' ? 'c' : rev)"));
  await step(w, heldOut);
  await assert.rejects(step(w, revision), assert.AssertionError);
});
