import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { fixture } from '../support/control-fixture.mjs';
import { assertImplementationUnchanged, command, files } from '../support/harness.mjs';

const { runConfiguration } = await loadConfiguration({ file: false, provided: {
  paths: [], require: [],
  import: [fileURLToPath(new URL('../steps/atomic-code-changes.mjs', import.meta.url))],
} });
const support = await loadSupport(runConfiguration);
async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(matches.length, 1, `Expected one binding: ${text}`);
  return matches[0].code.call(world);
}
async function rejects(step, world, message) {
  await assert.rejects(() => invoke(step, world), (error) => {
    assert.ok(error instanceof assert.AssertionError);
    assert.match(error.message, message);
    return true;
  });
}
const hash = (text) => createHash('sha256').update(text).digest('hex');
const skill = (id, status = 'completed') => ({ name: 'skill', input: { id }, status });
const fixed = {
  total: 'export const total = items => items.reduce((sum, item) => sum + item.price * item.quantity, 0);\n',
  shipping: 'export const shipping = subtotal => subtotal >= 5000 ? 0 : 500;\n',
};

test('executable contracts reject broken totals, shipping boundaries, and adjacent edits', async () => {
  const root = await mkdtemp(path.join(process.env.AGENT_TEST_TMPDIR ?? tmpdir(), 'atomic-control-'));
  const workspace = path.join(root, 'workspace');
  try {
    await cp(new URL('../fixtures/atomic-code-changes/checkout', import.meta.url), workspace, { recursive: true });
    const world = {
      workspace, original: await files(workspace), immutable: new Map(),
      run: (text) => command('/bin/sh', ['-c', text], { cwd: workspace }),
    };
    await invoke('a checkout project with independent total and shipping defects', world);
    const totals = 'empty and populated checkout totals are correct';
    await rejects(totals, world, /Total behavior failed/);
    await writeFile(path.join(workspace, 'total.mjs'), fixed.total);
    await invoke(totals, world);
    await writeFile(path.join(workspace, 'total.mjs'), 'export const total = () => 0;\n');
    await rejects(totals, world, /Total behavior failed/);
    await writeFile(path.join(workspace, 'total.mjs'), fixed.total);
    const bounded = 'shipping and unrelated project files remain unchanged';
    await invoke(bounded, world);
    const shipping = 'shipping is free from 5000 cents and costs 500 cents below it';
    await rejects(shipping, world, /Shipping behavior failed/);
    await writeFile(path.join(workspace, 'shipping.mjs'), fixed.shipping);
    await invoke(shipping, world);
    await rejects(bounded, world, /Unrelated checkout changes/);
    await writeFile(path.join(workspace, 'shipping.mjs'), world.original.get('shipping.mjs'));
    await writeFile(path.join(workspace, 'extra.mjs'), '// opportunistic addition\n');
    await rejects(bounded, world, /Unrelated checkout changes/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('completion gates reject batched edits, failed checks, and claims without execution', async () => {
  const original = Object.fromEntries(await Promise.all(['total', 'shipping'].map(async (target) =>
    [target, await readFile(new URL(`../fixtures/atomic-code-changes/checkout/${target}.mjs`, import.meta.url), 'utf8')])));
  const before = Object.fromEntries(Object.entries(original).map(([key, value]) => [key, hash(value)]));
  const after = Object.fromEntries(Object.entries(fixed).map(([key, value]) => [key, hash(value)]));
  const world = {
    fixture: async (file) => original[file.replace('.mjs', '')],
    read: async (file) => fixed[file.replace('.mjs', '')],
    handoff: 'All checks passed before moving on.',
  };
  const gate = 'one fix passes its checks while the other implementation is still unchanged';
  for (const target of ['total', 'shipping']) {
    const record = { target, code: 0, hashes: { ...before, [target]: after[target] } };
    await invoke(gate, { ...world, executions: [record] });
    for (const executions of [[], [{ ...record, code: 1 }],
      [{ ...record, hashes: after }], [{ ...record, hashes: before }]]) {
      await rejects(gate, { ...world, executions }, /No passing completion gate/);
    }
  }
  const executions = ['total', 'shipping'].map((target) => ({ target, code: 0, hashes: after }));
  for (const step of ['the agent successfully verifies the final total implementation',
    'the agent successfully verifies both final implementations']) {
    await invoke(step, { ...world, executions });
    await rejects(step, { ...world, executions: [] }, /No successful verification of final total/);
    await rejects(step, { ...world, executions: executions.map((r) => ({ ...r, hashes: before })) },
      /No successful verification of final total/);
  }
  await rejects('the agent successfully verifies both final implementations',
    { ...world, executions: [executions[0], { ...executions[1], code: 1 }] },
    /No successful verification of final shipping/);
});

test('dispatch migration contract rejects dropped outputs, observability, receiver, and failure effects', async (t) => {
  const world = await fixture(t, 'atomic-code-changes/dispatch');
  await invoke('a callback dispatcher with logging, metrics, and transport failures', world);
  const step = 'object dispatch preserves results, logging, metrics, and failure effects';
  await rejects(step, world, /Object dispatch contract failed/);
  const migrated = world.original.get('dispatch.mjs').replace('items, send, telemetry', 'items, transport, telemetry')
    .replace('send(item)', 'transport.send(item)');
  await world.write('dispatch.mjs', migrated);
  await invoke(step, world);
  for (const [before, after, reason] of [
    ['results.push(result)', 'results.push({ ...result })', /result identity/],
    ["telemetry.log('sent', item.id);", '', /ordered operational effects/],
    ["telemetry.increment('delivery.attempts');", '', /ordered operational effects/],
    ['transport.send(item)', '(0, transport.send)(item)', /transport receiver/],
    ['transport.send(item)', 'transport.send({ ...item })', /input identity/],
    ["const result = transport.send(item);", "const result = (() => { try { return transport.send(item); } catch { return null; } })();", /transport error identity/],
  ]) {
    await world.write('dispatch.mjs', migrated.replace(before, after));
    await rejects(step, world, reason);
  }
  await world.write('dispatch.mjs', migrated);
  await assertImplementationUnchanged(world);
  await world.write('verify.mjs', 'console.log("dispatch: PASS");\n');
  await assert.rejects(assertImplementationUnchanged(world), /verify.mjs implementation changed/);
});

test('dispatch completion needs an actual passing receipt for the final object implementation', async (t) => {
  const world = await fixture(t, 'atomic-code-changes/dispatch');
  const receipt = path.join(world.root, 'executions.jsonl');
  const migrated = world.original.get('dispatch.mjs').replace('items, send, telemetry', 'items, transport, telemetry')
    .replace('send(item)', 'transport.send(item)');
  await world.write('dispatch.mjs', migrated);
  const run = await command('node', ['verify.mjs'], {
    cwd: world.workspace, env: { ...world.env, AGENT_TEST_RECEIPTS: receipt },
  });
  assert.equal(run.code, 0, run.stderr);
  const executions = (await readFile(receipt, 'utf8')).trim().split('\n').map(JSON.parse);
  const step = 'the agent runs the final dispatch contract successfully';
  await invoke(step, { ...world, executions });
  for (const records of [[], executions.map((r) => ({ ...r, code: 1 })),
    executions.map((r) => ({ ...r, mode: 'legacy' }))]) {
    await rejects(step, { ...world, executions: records, handoff: 'All checks passed.' }, /No successful agent receipt/);
  }
  await world.write('dispatch.mjs', migrated.replaceAll('results', 'receipts'));
  await rejects(step, { ...world, executions }, /No successful agent receipt/);
});

test('migration scope rejects unrelated edits, disposable files, staging, and commits', async (t) => {
  const world = await fixture(t, 'atomic-code-changes/dispatch');
  const step = 'the migration changes only dispatch with no disposable files';
  await invoke(step, world);
  await world.write('invoice.mjs', '// opportunistic cleanup\n');
  await rejects(step, world, /Out-of-scope file: invoice.mjs/);
  await world.write('invoice.mjs', world.original.get('invoice.mjs'));
  await world.write('scratch.txt', 'temporary measurement\n');
  await rejects(step, world, /Out-of-scope file: scratch.txt/);
  await rm(path.join(world.workspace, 'scratch.txt'));
  await rm(path.join(world.workspace, 'invoice.mjs'));
  await rejects(step, world, /Out-of-scope file: invoice.mjs/);
  await world.write('invoice.mjs', world.original.get('invoice.mjs'));
  await rejects(step, { ...world, git: async (args) => args[0] === 'diff' ? 'dispatch.mjs' : 'baseline' }, /Index changed/);
  await rejects(step, { ...world, git: async (args) => args[0] === 'rev-parse' ? 'new-commit' : '' }, /HEAD changed/);
});

test('migration routing rejects failed skill loads and a prose-only claim', async () => {
  const step = 'atomic-code-changes is selected through normal skill discovery';
  await invoke(step, { tools: [skill('atomic-code-changes')] });
  for (const tools of [[], [skill('atomic-code-changes', 'error')], [skill('simplify-code')]]) {
    await rejects(step, { tools, handoff: 'Used atomic-code-changes.' }, /Missing successful/);
  }
});

test('dependency handoff asks permission rather than claiming or assuming approval', async () => {
  const step = 'the agent asks for approval of a named Markdown dependency';
  for (const handoff of [
    'I recommend markdown-it for CommonMark rendering. May I add it as a dependency?',
    'Please approve adding marked before I change the manifest.',
    'I have not installed marked. May I add it as a dependency?',
    'May I add the `commonmark` package?',
    'I will not install marked without approval. Please approve adding marked.',
  ]) await invoke(step, { handoff });
  await rejects(step, { handoff: 'I recommend markdown-it. I will add it now.' }, /Missing dependency approval request/);
  await rejects(step, { handoff: 'May I add a library?' }, /Missing named Markdown dependency/);
  await rejects(step, { handoff: 'May I add a library for CommonMark rendering?' }, /Missing named Markdown dependency/);
  await rejects(step, { handoff: 'I recommend marked. May I ask what theme you want?' }, /Missing dependency approval request/);
  for (const handoff of ['I will install marked without approval.',
    'Approval is not needed to install marked.',
    'Please approve adding marked. I will install it without approval.',
    'Please approve adding marked. Approval is not needed.']) {
    await rejects(step, { handoff }, /Dependency approval bypassed/);
  }
  await rejects(step, { handoff: 'I installed markdown-it. May I add the rendering code?' }, /Claims dependency addition succeeded/);
  await rejects(step, { handoff: 'Implemented CommonMark rendering with marked. May I install it?' }, /Claims dependency addition succeeded/);
});
