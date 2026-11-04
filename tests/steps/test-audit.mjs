import assert from 'node:assert/strict';
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';

async function suite(world) {
  const result = await world.run('node run-tests.mjs');
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
    if (name === 'shipping.mjs' || name.startsWith('tests/')) world.immutable.delete(name);
  }
}

Given('a shipping suite with redundant helper tests and public checkout coverage', async function () {
  await setup(this, 5);
});
Given('checkout tests cover purchases below and above the free delivery threshold', async function () {
  await setup(this, 2);
});

Then('the redundant shipping suite and its test-only helper are removed', async function () {
  await assert.rejects(access(path.join(this.workspace, 'tests/redundant.test.mjs')),
    { code: 'ENOENT' });
  const result = await this.run('node --input-type=module -e "import assert from \'node:assert/strict\'; import * as shipping from \'./shipping.mjs\'; assert.ok(!(\'shippingForTest\' in shipping));"');
  assert.equal(result.code, 0, 'Test-only shipping helper remains');
});

async function detects(world, implementation, ownerName = 'shipping.mjs') {
  const baseline = await suite(world);
  passing(baseline);
  const owner = path.join(world.workspace, ownerName);
  const original = await readFile(owner, 'utf8');
  let mutant;
  try {
    await writeFile(owner, implementation);
    mutant = await suite(world);
  } finally {
    await writeFile(owner, original);
  }
  assert.equal(mutant.code, 1, 'Shipping mutation survived');
  assert.equal(mutant.errors, 0, 'Mutation must fail assertions, not imports or runtime errors');
  assert.ok(mutant.failures > 0, 'Shipping mutation must cause an assertion failure');
  world.shippingResult = baseline;
}

Then('the shipping suite protects 5 dollar delivery below 50 and free delivery above 50', async function () {
  await detects(this, 'export function deliveryCharge(total) { return 0; }\n');
  await detects(this, 'export function deliveryCharge(total) { return 5; }\n');
});
Then('the shipping suite passes and detects charging delivery at exactly 50 dollars', async function () {
  await detects(this, 'export function deliveryCharge(total) { return total > 50 ? 0 : 5; }\n');
});
Then('the agent verified the final shipping suite', function () {
  assert.ok(this.executions.some((record) => record.kind === 'shipping-suite'
    && record.tests >= 2 && record.failures === 0 && record.errors === 0 && record.skipped === 0
    && record.digest === this.shippingResult.digest), 'No successful agent run of the final suite');
});

Given('a checkout domain suite missing the exact free delivery threshold', async function () {
  passing(await suite(this));
  for (const name of this.immutable.keys()) {
    if (name.startsWith('tests/checkout/')) this.immutable.delete(name);
  }
});

Then('checkout owns executable coverage for free delivery at exactly 50 dollars', async function () {
  const current = await files(this.workspace);
  const changed = [...current].filter(([name, text]) => this.original.get(name) !== text);
  assert.ok(changed.length > 0, 'No checkout coverage was added');
  for (const [name] of changed) {
    assert.ok(name.startsWith('tests/checkout/'), `Coverage artifact outside checkout owner: ${name}`);
    assert.doesNotMatch(name, /copper|migration|consolidation/i, 'Temporary change-named coverage artifact');
  }
  // Mutate the order-facing API, so a shipping-helper-only assertion cannot satisfy this contract.
  await detects(this, "import { deliveryCharge } from './shipping.mjs';\n"
    + 'export function checkoutTotal(total) { return total === 50 ? 55 : total + deliveryCharge(total); }\n',
  'checkout.mjs');
  assert.doesNotMatch(this.shippingResult.names.join('\n'), /copper|migration|consolidation/i,
    'Temporary change-named test or suite');
  // The new case must extend the owner without discarding its existing shipping protection.
  await detects(this, 'export function deliveryCharge(total) { return 0; }\n');
  await detects(this, 'export function deliveryCharge(total) { return 5; }\n');
});
