import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { branchFees, branchScope } from '../support/probe-review.mjs';
import { fixture } from '../support/control-fixture.mjs';
import { command } from '../support/harness.mjs';

test('branch and dirty checkout charge different fees at the boundary in a diverged repo', async (t) => {
  const step = new URL('../steps/masked-branch.mjs', import.meta.url);
  const { runConfiguration } = await loadConfiguration({ file: false, provided: {
    paths: [], require: [], import: [fileURLToPath(step)],
  } });
  await loadSupport(runConfiguration);
  const { prepareOffer } = await import(step);
  const world = await fixture(t, 'review-change/masked-branch');
  world.git = async (args) => {
    const result = await command('git', args, { cwd: world.workspace, env: {
      ...world.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
    } });
    assert.equal(result.code, 0, result.stderr);
    return result.stdout.trim();
  };
  await world.git(['init', '--quiet']);
  await world.git(['add', '.']);
  await world.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    'commit', '--quiet', '-m', 'Starting offer']);
  await prepareOffer.call(world);
  assert.equal(await world.git(['merge-base', 'release', 'HEAD']), world.offerBase);
  assert.equal(await world.git(['diff', '--name-only', 'release...HEAD']), 'shipping.mjs');
  assert.equal(await world.git(['diff', '--name-only', 'release', 'HEAD']), 'pickup.md\nshipping.mjs');
  for (const [code, expected] of [[await world.git(['show', 'HEAD:shipping.mjs']), 500],
    [await world.read('shipping.mjs'), 0]]) {
    const { shipping } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
    assert.equal(shipping(5000), expected);
    assert.equal(shipping(4999), 500);
    assert.equal(shipping(5001), 0);
  }
});

test('merge card rejects a target-tip comparison and the repaired checkout result', () => {
  const base = 'c4c5cd886e6050ac4b57e1dea4000288f913de70';
  const branch = { baseline: base.slice(0, 9), changedFiles: ['shipping.mjs'], defects: [
    { file: 'shipping.mjs', subtotalCents: 5000, expectedFeeCents: 0, actualFeeCents: 500 },
  ] };
  branchScope(branch, base);
  branchFees(branch);
  for (const wrong of [{ baseline: 'a38c79d' }, { changedFiles: ['pickup.md', 'shipping.mjs'] }]) {
    assert.throws(() => branchScope({ ...branch, ...wrong }, base), assert.AssertionError);
  }
  for (const defects of [[], [{ ...branch.defects[0], actualFeeCents: 0 }],
    [{ ...branch.defects[0], subtotalCents: 5001 }]]) {
    assert.throws(() => branchFees({ ...branch, defects }), assert.AssertionError);
  }
});
