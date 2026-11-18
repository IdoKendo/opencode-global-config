import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const scenarios = {
  'Catch a second approval even when the approver has permission': {
    fixture: 'test-audit/invoice-approval',
    prompt: 'Support asked whether our tests would catch someone accidentally allowing an invoice to be approved twice. Close the coverage gap if there is one.',
  },
};

// Derive all versions from the evaluator's fixture, never from the submission.
const fixture = new URL('../fixtures/test-audit/invoice-approval/invoices.mjs', import.meta.url);
const permission = "  if (!hasPermission(caller)) throw new ApprovalDenied('Approval denied');";
const repeat = "  if (alreadyApproved(invoice)) throw new ApprovalDenied('Approval denied');";

export async function probeApproval(world, version) {
  const { command } = await import('./harness.mjs');
  const canonical = await readFile(fixture, 'utf8');
  const guards = `${permission}\n${repeat}`;
  assert.ok(canonical.includes(guards), 'update the oracle for the current approval fixture');
  const versions = {
    correct: canonical,
    regressed: canonical.replace(guards, permission),
    reordered: canonical.replace(guards, `${repeat}\n${permission}`)
      .replaceAll('alreadyApproved', 'isFinal').replaceAll('hasPermission', 'canApprove'),
  };
  assert.ok(Object.hasOwn(versions, version));
  const file = path.join(world.workspace, 'invoices.mjs');
  const original = await readFile(file);
  const env = { ...world.env };
  delete env.NODE_TEST_CONTEXT;
  try {
    await writeFile(file, versions[version]);
    const result = await command(process.execPath, ['--test', '--test-reporter=tap'],
      { cwd: world.workspace, env });
    if (version === 'regressed') {
      assert.equal(result.code, 1, 'repeat-approval regression survived');
      assert.match(result.stdout, /^not ok /m, result.stdout + result.stderr);
    } else {
      assert.equal(result.code, 0, `${version} approval failed:\n${result.stdout}${result.stderr}`);
    }
  } finally {
    await writeFile(file, original);
  }
}
