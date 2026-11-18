import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from '../support/control-fixture.mjs';
import { probeApproval } from '../support/probe-approval.mjs';

test('a rejection through the wrong guard misses the regression; an authorized repeat detects it', async (t) => {
  const world = await fixture(t, 'test-audit/invoice-approval');
  const file = 'test/invoices.test.mjs';
  const original = await world.read(file);
  await probeApproval(world, 'correct');
  await assert.rejects(probeApproval(world, 'regressed'), /regression survived/);
  await probeApproval(world, 'reordered');

  const repaired = original.replace('approve(invoice, auditor)', 'approve(invoice, accountant)');
  await world.write(file, repaired);
  for (const version of ['correct', 'regressed', 'reordered']) await probeApproval(world, version);

  // This detects the mutant but also demands a private predicate name.
  await world.write(file, repaired + `
import { readFileSync } from 'node:fs';
test('approval inspects the invoice', () => {
  assert.match(readFileSync(new URL('../invoices.mjs', import.meta.url), 'utf8'), /alreadyApproved/);
});
`);
  await probeApproval(world, 'correct');
  await probeApproval(world, 'regressed');
  await assert.rejects(probeApproval(world, 'reordered'), /reordered approval failed/);

  await world.write(file, original.replace("status: 'pending'", "status: 'approved'"));
  await assert.rejects(probeApproval(world, 'correct'), /correct approval failed/);
});
