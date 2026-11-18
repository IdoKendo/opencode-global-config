import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from '../support/control-fixture.mjs';
import { probeRounding } from '../support/probe-audit.mjs';

test('deduplication must preserve independent protection on each import path', async (t) => {
  const world = await fixture(t, 'test-audit/public-entry-points');
  const file = 'test/units.test.mjs';
  const original = await world.read(file);
  await assert.rejects(probeRounding(world), /one 2.25 kg example through root/);
  const cleaned = original.slice(0, original.indexOf("test('a fractional"))
    + original.slice(original.indexOf("test('integrations"));
  await world.write(file, cleaned);
  await probeRounding(world);
  for (const [entry, invocation] of [['sdk', 'sdkWeight'], ['root', 'billableKg']]) {
    await probeRounding(world, entry);
    // Still calls through the public path, but can no longer detect a wrong result.
    await world.write(file, cleaned.replace(`assert.equal(${invocation}(2.25), 3)`, `${invocation}(2.25)`));
    await probeRounding(world);
    await assert.rejects(probeRounding(world, entry), new RegExp(`${entry} regression survived`));
    await world.write(file, cleaned);
  }
});
