import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Given, Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';
import { noInstall, selected } from '../support/tool-trace.mjs';
import { onlyChanges } from '../support/workspace.mjs';

const hash = (text) => createHash('sha256').update(text).digest('hex');

Given('a checkout project with independent total and shipping defects', async function () {
  for (const target of ['total', 'shipping']) {
    const result = await this.run(`node verify.mjs ${target}`);
    assert.equal(result.code, 1, `Expected initial ${target} defect`);
    assert.match(result.stderr, new RegExp(`${target}: FAIL:`));
    // Only these production modules are writable; the executable oracle stays protected.
    this.immutable.delete(`${target}.mjs`);
  }
});

Then('empty and populated checkout totals are correct', async function () {
  const result = await this.run('node verify.mjs total');
  assert.equal(result.code, 0, `Total behavior failed: ${result.stderr}`);
});

Then('shipping is free from 5000 cents and costs 500 cents below it', async function () {
  const result = await this.run('node verify.mjs shipping');
  assert.equal(result.code, 0, `Shipping behavior failed: ${result.stderr}`);
});

Then('shipping and unrelated project files remain unchanged', async function () {
  const current = await files(this.workspace);
  const withoutTotal = (entries) => [...entries].filter(([name]) => name !== 'total.mjs')
    .sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(withoutTotal(current), withoutTotal(this.original), 'Unrelated checkout changes');
});

Then('one fix passes its checks while the other implementation is still unchanged', async function () {
  const originals = Object.fromEntries(await Promise.all(['total', 'shipping'].map(async (target) =>
    [target, hash(await this.fixture(`${target}.mjs`))])));
  assert.ok(this.executions.some(({ target, code, hashes }) => {
    if (!['total', 'shipping'].includes(target) || code !== 0) return false;
    const other = target === 'total' ? 'shipping' : 'total';
    return hashes?.[target] !== originals[target] && hashes?.[other] === originals[other];
  }), 'No passing completion gate before the other concern changed');
});

async function finalVerification(world, targets) {
  for (const target of targets) {
    const finalHash = hash(await world.read(`${target}.mjs`));
    assert.ok(world.executions.some((record) => record.target === target && record.code === 0
      && record.hashes?.[target] === finalHash), `No successful verification of final ${target}`);
  }
}

Then('the agent successfully verifies the final total implementation', async function () {
  await finalVerification(this, ['total']);
});

Then('the agent successfully verifies both final implementations', async function () {
  await finalVerification(this, ['total', 'shipping']);
});

Given('a callback dispatcher with logging, metrics, and transport failures', async function () {
  const baseline = await this.run('node verify.mjs --legacy');
  assert.equal(baseline.code, 0, `Legacy dispatch contract: ${baseline.stderr}`);
  this.immutable.delete('dispatch.mjs');
});

Then('atomic-code-changes is selected through normal skill discovery', function () {
  assert.ok(selected(this.tools, 'atomic-code-changes'), 'Missing successful atomic-code-changes selection');
});

Then('object dispatch preserves results, logging, metrics, and failure effects', async function () {
  const result = await this.run('node verify.mjs');
  assert.equal(result.code, 0, `Object dispatch contract failed: ${result.stderr}`);
});

Then('the agent runs the final dispatch contract successfully', async function () {
  const finalDigest = hash(await this.read('dispatch.mjs'));
  assert.ok(this.executions.some((record) => record.kind === 'dispatch-contract'
    && record.mode === 'object' && record.code === 0 && record.digest === finalDigest),
  'No successful agent receipt for final object dispatch');
});

Then('the migration changes only dispatch with no disposable files', async function () {
  await onlyChanges(this, ['dispatch.mjs']);
});

Then('the agent asks for approval of a named Markdown dependency', function () {
  const handoff = this.handoff.trim().replace(/\s*```\s*$/, '');
  // The tracker consumes the final decision. Earlier rationale is for the user.
  const report = JSON.parse(handoff.slice(handoff.lastIndexOf('{')));
  assert.equal(report.status, 'awaiting-decision', 'Dependency change must await a decision');
  assert.equal(report.request, 'approve-dependency', 'Missing dependency approval request');
  assert.ok(['marked', 'markdown-it', 'micromark', 'commonmark', 'remark', 'remark-parse',
    'remark-gfm', 'showdown', 'markdown-wasm'].includes(report.package),
    'Missing supported Markdown package');
});

Then('no dependency installation is attempted and the project remains unchanged', async function () {
  noInstall(this.tools);
  await onlyChanges(this);
});
