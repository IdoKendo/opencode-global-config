import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';

async function suite(world) {
  const result = await world.run('python run_tests.py');
  const record = JSON.parse(result.stdout.trim().split('\n').at(-1));
  return { ...record, code: result.code };
}

function passing(record) {
  assert.equal(record.code, 0, 'Shipping suite must pass');
  assert.ok(record.tests >= 2, 'Missing checkout tests');
  assert.equal(record.failures, 0);
  assert.equal(record.errors, 0);
  assert.equal(record.skipped, 0, 'Checkout tests must not be skipped');
}

async function setup(world, count) {
  const baseline = await suite(world);
  passing(baseline);
  assert.equal(baseline.tests, count);
  // Only this family permits edits to the audited owner and its tests.
  for (const name of world.immutable.keys()) {
    if (name === 'shipping.py' || name.startsWith('tests/')) world.immutable.delete(name);
  }
}

Given('a shipping suite with redundant helper tests and public checkout coverage', async function () {
  await setup(this, 5);
});
Given('checkout tests cover purchases below and above the free delivery threshold', async function () {
  await setup(this, 2);
});

Then('the redundant shipping suite and its test-only helper are removed', async function () {
  await assert.rejects(access(path.join(this.workspace, 'tests/test_redundant.py')),
    { code: 'ENOENT' });
  const result = await this.run('python -c "import shipping; assert not hasattr(shipping, \'shipping_for_test\')"');
  assert.equal(result.code, 0, 'Test-only shipping helper remains');
});

async function detects(world, implementation) {
  const baseline = await suite(world);
  passing(baseline);
  const owner = path.join(world.workspace, 'shipping.py');
  const original = await readFile(owner, 'utf8');
  let mutant;
  try {
    await writeFile(owner, implementation);
    // Avoid stale Python bytecode when replacing an equal-sized file within one second.
    await world.run('python -c "import shutil; shutil.rmtree(\'__pycache__\', ignore_errors=True)"');
    mutant = await suite(world);
  } finally {
    await writeFile(owner, original);
    await world.run('python -c "import shutil; shutil.rmtree(\'__pycache__\', ignore_errors=True)"');
  }
  assert.equal(mutant.code, 1, 'Shipping mutation survived');
  assert.equal(mutant.errors, 0, 'Mutation must fail assertions, not imports or runtime errors');
  assert.ok(mutant.failures > 0, 'Shipping mutation must cause an assertion failure');
  world.shippingResult = baseline;
}

Then('the shipping suite protects 5 dollar delivery below 50 and free delivery above 50', async function () {
  await detects(this, 'def delivery_charge(total):\n    return 0\n');
  await detects(this, 'def delivery_charge(total):\n    return 5\n');
});
Then('the shipping suite passes and detects charging delivery at exactly 50 dollars', async function () {
  await detects(this, 'def delivery_charge(total):\n    return 0 if total > 50 else 5\n');
});
Then('the agent verified the final shipping suite', function () {
  assert.ok(this.executions.some((record) => record.kind === 'shipping-suite'
    && record.tests >= 2 && record.failures === 0 && record.errors === 0 && record.skipped === 0
    && record.digest === this.shippingResult.digest), 'No successful agent run of the final suite');
});
