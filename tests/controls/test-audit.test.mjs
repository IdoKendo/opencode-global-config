import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { command } from '../support/harness.mjs';

const { runConfiguration } = await loadConfiguration({
  file: false,
  provided: {
    paths: [], require: [],
    import: [fileURLToPath(new URL('../steps/test-audit.mjs', import.meta.url))],
  },
});
const support = await loadSupport(runConfiguration);
async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(matches.length, 1);
  return matches[0].code.call(world);
}
async function fixture(t, variant = 'boundary') {
  const workspace = await mkdtemp(path.join(process.env.AGENT_TEST_TMPDIR ?? tmpdir(), 'audit-control-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  for (const name of ['common', variant]) {
    await cp(fileURLToPath(new URL(`../fixtures/test-audit/${name}`, import.meta.url)),
      workspace, { recursive: true });
  }
  const env = { ...process.env };
  delete env.AGENT_TEST_RECEIPTS;
  return {
    workspace,
    run: (text) => command('/bin/sh', ['-c', text], { cwd: workspace, env }),
    executions: [],
  };
}
async function rejects(step, world, message) {
  await assert.rejects(() => invoke(step, world), (error) => {
    assert.ok(error instanceof assert.AssertionError);
    assert.match(error.message, message);
    return true;
  });
}

const paid = 'the shipping suite protects 5 dollar delivery below 50 and free delivery above 50';
const boundary = 'the shipping suite passes and detects charging delivery at exactly 50 dollars';
const verified = 'the agent verified the final shipping suite';
const removed = 'the redundant shipping suite and its test-only helper are removed';

test('retained checkout tests kill a paid-delivery bug; assertion-free probes do not', async (t) => {
  const world = await fixture(t);
  await invoke(paid, world);
  await writeFile(path.join(world.workspace, 'tests/test_checkout.py'),
    'import unittest\nfrom checkout import checkout_total\n'
    + 'class Tests(unittest.TestCase):\n'
    + '    def test_paid(self): checkout_total(49)\n'
    + '    def test_free(self): checkout_total(51)\n');
  await rejects(paid, world, /Shipping mutation survived/);
});

test('boundary checker rejects the original gap and accepts independent public API coverage', async (t) => {
  const world = await fixture(t);
  await rejects(boundary, world, /Shipping mutation survived/);
  await writeFile(path.join(world.workspace, 'tests/test_boundary.py'),
    'import unittest\nfrom checkout import checkout_total\n'
    + 'class Boundary(unittest.TestCase):\n'
    + '    def test_exact_threshold(self): self.assertEqual(checkout_total(50), 50)\n');
  await invoke(boundary, world);
  const receipt = { ...world.shippingResult, kind: 'shipping-suite' };
  world.executions = [receipt];
  await invoke(verified, world);
  for (const bad of [[], [{ ...receipt, digest: 'stale' }], [{ ...receipt, failures: 1 }]]) {
    world.executions = bad;
    await rejects(verified, world, /No successful agent run/);
  }
});

test('cleanup cannot discard free-delivery protection while retaining paid-delivery tests', async (t) => {
  const world = await fixture(t);
  await invoke(paid, world);
  await writeFile(path.join(world.workspace, 'tests/test_checkout.py'),
    'import unittest\nfrom checkout import checkout_total\n'
    + 'class Tests(unittest.TestCase):\n'
    + '    def test_paid(self): self.assertEqual(checkout_total(49), 54)\n'
    + '    def test_paid_again(self): self.assertEqual(checkout_total(48), 53)\n');
  await rejects(paid, world, /Shipping mutation survived/);
});

test('mutation import errors cannot impersonate a caught behavioral regression', async (t) => {
  const world = await fixture(t, 'prune');
  await rejects(paid, world, /Mutation must fail assertions/);
});

test('cleanup checks reject either a surviving redundant file or a surviving helper', async (t) => {
  const world = await fixture(t, 'prune');
  await rejects(removed, world, /Missing expected rejection/);
  await rm(path.join(world.workspace, 'tests/test_redundant.py'));
  await rejects(removed, world, /Test-only shipping helper remains/);
  await writeFile(path.join(world.workspace, 'shipping.py'),
    'def delivery_charge(total):\n    return 0 if total >= 50 else 5\n');
  await invoke(removed, world);
});

test('a failing retained suite cannot pass solely by killing the mutation', async (t) => {
  const world = await fixture(t);
  await writeFile(path.join(world.workspace, 'shipping.py'), 'def delivery_charge(total):\n    return 9\n');
  await rejects(paid, world, /Shipping suite must pass/);
});
