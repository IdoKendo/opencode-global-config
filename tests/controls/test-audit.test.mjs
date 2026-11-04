import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { command, files } from '../support/harness.mjs';

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
  for (const name of variant === 'domain-ownership' ? [variant] : ['common', variant]) {
    await cp(fileURLToPath(new URL(`../fixtures/test-audit/${name}`, import.meta.url)),
      workspace, { recursive: true });
  }
  const env = { ...process.env };
  delete env.AGENT_TEST_RECEIPTS;
  delete env.NODE_TEST_CONTEXT;
  return {
    workspace, env,
    original: await files(workspace),
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
const imports = "import assert from 'node:assert/strict';\nimport test from 'node:test';\n"
  + "import { checkoutTotal } from '../checkout.mjs';\n";

test('retained checkout tests kill a paid-delivery bug; assertion-free probes do not', async (t) => {
  const world = await fixture(t);
  await invoke(paid, world);
  await writeFile(path.join(world.workspace, 'tests/checkout.test.mjs'), imports
    + "test('paid', () => { checkoutTotal(49); });\n"
    + "test('free', () => { checkoutTotal(51); });\n");
  await rejects(paid, world, /Shipping mutation survived/);
});

test('boundary checker rejects the original gap and accepts independent public API coverage', async (t) => {
  const world = await fixture(t);
  await rejects(boundary, world, /Shipping mutation survived/);
  await writeFile(path.join(world.workspace, 'tests/boundary.test.mjs'), imports
    + "test('exact threshold', () => { assert.equal(checkoutTotal(50), 50); });\n");
  await invoke(boundary, world);
  const receiptPath = path.join(world.workspace, 'executions.jsonl');
  const result = await command(process.execPath, ['run-tests.mjs'], {
    cwd: world.workspace, env: { ...world.env, AGENT_TEST_RECEIPTS: receiptPath },
  });
  assert.equal(result.code, 0, result.stderr);
  world.executions = (await readFile(receiptPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(world.executions.length, 1);
  const [receipt] = world.executions;
  assert.equal(receipt.tests, 3);
  await invoke(verified, world);
  for (const bad of [[], [{ ...receipt, digest: 'stale' }], [{ ...receipt, failures: 1 }]]) {
    world.executions = bad;
    await rejects(verified, world, /No successful agent run/);
  }
});

test('cleanup cannot discard free-delivery protection while retaining paid-delivery tests', async (t) => {
  const world = await fixture(t);
  await invoke(paid, world);
  await writeFile(path.join(world.workspace, 'tests/checkout.test.mjs'), imports
    + "test('paid', () => { assert.equal(checkoutTotal(49), 54); });\n"
    + "test('paid again', () => { assert.equal(checkoutTotal(48), 53); });\n");
  await rejects(paid, world, /Shipping mutation survived/);
});

test('mutation import and runtime errors cannot impersonate a caught behavioral regression', async (t) => {
  const world = await fixture(t, 'prune');
  await rejects(paid, world, /Mutation must fail assertions/);
  const runtime = await fixture(t);
  await writeFile(path.join(runtime.workspace, 'tests/runtime.test.mjs'), imports
    + "test('runtime failure', () => { if (checkoutTotal(49) !== 54) throw new Error('delivery failed'); });\n");
  await rejects(paid, runtime, /Mutation must fail assertions/);
});

test('cleanup checks reject either a surviving redundant file or a surviving helper', async (t) => {
  const world = await fixture(t, 'prune');
  await rejects(removed, world, /Missing expected rejection/);
  await rm(path.join(world.workspace, 'tests/redundant.test.mjs'));
  await rejects(removed, world, /Test-only shipping helper remains/);
  await writeFile(path.join(world.workspace, 'shipping.mjs'),
    'export function deliveryCharge(total) { return total >= 50 ? 0 : 5; }\n');
  await invoke(removed, world);
});

test('a failing or incomplete retained suite cannot pass solely by killing the mutation', async (t) => {
  const world = await fixture(t);
  await writeFile(path.join(world.workspace, 'shipping.mjs'),
    'export function deliveryCharge(total) { return 9; }\n');
  await rejects(paid, world, /Shipping suite must pass/);
  await writeFile(path.join(world.workspace, 'shipping.mjs'),
    'export function deliveryCharge(total) { return total >= 50 ? 0 : 5; }\n');
  for (const mode of ['skip', 'todo']) {
    await writeFile(path.join(world.workspace, 'tests/checkout.test.mjs'), imports
      + `test.${mode}('paid', () => { assert.equal(checkoutTotal(49), 54); });\n`
      + `test.${mode}('free', () => { assert.equal(checkoutTotal(51), 51); });\n`);
    await rejects(paid, world, /Checkout tests must not be skipped/);
  }
});

const ownedBoundary = 'checkout owns executable coverage for free delivery at exactly 50 dollars';
const ownedImports = "import assert from 'node:assert/strict';\nimport test from 'node:test';\n"
  + "import { checkoutTotal } from '../../checkout.mjs';\n";
const boundaryCase = "test('checkout includes free delivery at the threshold', () => {"
  + ' assert.equal(checkoutTotal(50), 50); });\n';

async function addOwnedCase(world, body = boundaryCase, name = 'tests/checkout/delivery.test.mjs') {
  await mkdir(path.dirname(path.join(world.workspace, name)), { recursive: true });
  await writeFile(path.join(world.workspace, name), ownedImports + body);
}

test('checkout ownership accepts executable coverage and a real final runner receipt', async (t) => {
  const world = await fixture(t, 'domain-ownership');
  await rejects(ownedBoundary, world, /No checkout coverage was added/);
  await addOwnedCase(world);
  await invoke(ownedBoundary, world);
  const receiptPath = path.join(path.dirname(world.workspace), `${path.basename(world.workspace)}.jsonl`);
  t.after(() => rm(receiptPath, { force: true }));
  const result = await command(process.execPath, ['run-tests.mjs'], {
    cwd: world.workspace, env: { ...world.env, AGENT_TEST_RECEIPTS: receiptPath },
  });
  assert.equal(result.code, 0, result.stderr);
  world.executions = (await readFile(receiptPath, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(world.executions.length, 1);
  assert.equal(world.executions[0].tests, 3);
  await invoke(verified, world);
  for (const bad of [[], [{ ...world.executions[0], digest: 'stale' }]]) {
    world.executions = bad;
    await rejects(verified, world, /No successful agent run/);
  }
});

test('executable migration coverage must belong to checkout in paths and suite names', async (t) => {
  for (const [name, body, reason] of [
    ['tests/copper-migration/delivery.test.mjs', boundaryCase, /outside checkout owner/],
    ['tests/checkout/copper-migration.test.mjs', boundaryCase, /Temporary change-named coverage artifact/],
    ['tests/checkout/delivery.test.mjs', boundaryCase.replace('checkout includes', 'Copper migration includes'),
      /Temporary change-named test or suite/],
  ]) {
    const world = await fixture(t, 'domain-ownership');
    await addOwnedCase(world, body, name);
    const healthy = await world.run('node run-tests.mjs');
    assert.equal(healthy.code, 0, healthy.stderr);
    await rejects(ownedBoundary, world, reason);
  }
});

test('checkout placement alone cannot replace executable boundary protection', async (t) => {
  for (const body of [
    "test('threshold probe', () => { checkoutTotal(50); });\n",
    "import { deliveryCharge } from '../../shipping.mjs';\n"
      + "test('helper threshold', () => { assert.equal(deliveryCharge(50), 0); });\n",
  ]) {
    const world = await fixture(t, 'domain-ownership');
    await addOwnedCase(world, body);
    await rejects(ownedBoundary, world, /Shipping mutation survived/);
  }
});

test('checkout boundary rejects skipped cases, unhealthy baselines, and runtime-error mutation kills', async (t) => {
  for (const [body, reason] of [
    [boundaryCase.replace('test(', 'test.skip('), /Checkout tests must not be skipped/],
    [boundaryCase.replace('test(', 'test.todo('), /Checkout tests must not be skipped/],
    [boundaryCase.replace('checkoutTotal(50), 50', 'checkoutTotal(50), 55'), /Shipping suite must pass/],
    ["test('threshold', () => { if (checkoutTotal(50) !== 50) throw new Error('wrong total'); });\n",
      /Mutation must fail assertions/],
  ]) {
    const world = await fixture(t, 'domain-ownership');
    await addOwnedCase(world, body);
    await rejects(ownedBoundary, world, reason);
  }
});
