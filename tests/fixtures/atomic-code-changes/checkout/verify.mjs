import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { total } from './total.mjs';
import { shipping } from './shipping.mjs';

const checks = {
  total() {
    assert.equal(total([]), 0);
    assert.equal(total([{ price: 125, quantity: 2 }]), 250);
    assert.equal(total([{ price: 125, quantity: 2 }, { price: 400, quantity: 3 }]), 1450);
  },
  shipping() {
    for (const [subtotal, cost] of [[0, 500], [4999, 500], [5000, 0], [5001, 0]]) {
      assert.equal(shipping(subtotal), cost);
    }
  },
};
const targets = process.argv.slice(2);
if (!targets.length) targets.push(...Object.keys(checks));
const hashes = Object.fromEntries(Object.keys(checks).map((name) => [name,
  createHash('sha256').update(readFileSync(new URL(`./${name}.mjs`, import.meta.url))).digest('hex')]));
for (const target of targets) {
  let code = 0;
  try {
    assert.ok(Object.hasOwn(checks, target), `Unknown check: ${target}`);
    checks[target]();
    console.log(`${target}: PASS`);
  } catch (error) {
    code = 1;
    console.error(`${target}: FAIL: ${error.message}`);
  }
  if (process.env.AGENT_TEST_RECEIPTS) {
    appendFileSync(process.env.AGENT_TEST_RECEIPTS,
      JSON.stringify({ target, code, hashes }) + '\n');
  }
  process.exitCode = Math.max(process.exitCode ?? 0, code);
}
