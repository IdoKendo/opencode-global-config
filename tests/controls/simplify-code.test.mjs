import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';

const { runConfiguration } = await loadConfiguration({
  file: false,
  provided: { paths: [], require: [],
    import: [fileURLToPath(new URL('../steps/simplify-code.mjs', import.meta.url))] },
});
const support = await loadSupport(runConfiguration);
async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(matches.length, 1, `Expected one binding for ${text}`);
  return matches[0].code.call(world);
}

const pricing = `def process(amount, member=False):
    if amount < 0:
        raise ValueError("amount must be non-negative")
    if amount < 100:
        return amount
    discount = 10
    if member:
        discount = 20
    return amount - discount
`;
const delivery = `def process(items, send, audit):
    results = []
    for item in items:
        if item is None:
            audit("missing", item)
            continue
        if not item["enabled"]:
            audit("skipped", item)
            continue
        audit("sending", item)
        result = send(item)
        audit("sent", item)
        results.append(result)
    return results
`;

async function workspace(t) {
  const directory = await mkdtemp(path.join(process.env.AGENT_TEST_TMPDIR ?? tmpdir(), 'simplify-control-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return {
    workspace: directory,
    read: (file) => readFile(path.join(directory, file), 'utf8'),
    write: (text, file = 'workflow.py') => writeFile(path.join(directory, file), text),
  };
}

async function rejected(step, world, message) {
  await assert.rejects(() => invoke(step, world), (error) => {
    assert.ok(error instanceof assert.AssertionError, String(error));
    assert.match(error.message, message);
    return true;
  });
}

test('pricing checker accepts different readable rewrites and rejects boundary/API/error drift', async (t) => {
  const world = await workspace(t);
  const step = 'pricing preserves zero, negative, threshold, and member results';
  await world.write(pricing);
  await invoke(step, world);
  await world.write(pricing.replace('discount = 10\n    if member:\n        discount = 20',
    'if member:\n        discount = 20\n    else:\n        discount = 10'));
  await invoke(step, world);
  for (const [before, after, reason] of [
    ['amount < 100', 'amount <= 100', /100, False, 90/],
    ['member=False', 'member=True', /default member contract/],
    ['discount = 20', 'discount = 10', /100, True, 80/],
    ['amount must be non-negative', 'invalid amount', /error message/],
    ['raise ValueError("amount must be non-negative")', 'return 0', /negative amount accepted/],
  ]) {
    await world.write(pricing.replace(before, after));
    await rejected(step, world, reason);
  }
});

test('delivery checker rejects reordered, copied, dropped, and swallowed effects', async (t) => {
  const world = await workspace(t);
  const step = 'delivery preserves callback order, identity, and exceptions';
  await world.write(delivery);
  await invoke(step, world);
  for (const [before, after, reason] of [
    ['audit("sending", item)\n        result = send(item)',
      'result = send(item)\n        audit("sending", item)', /callback order or identity/],
    ['result = send(item)', 'result = send(dict(item))', /callback order or identity/],
    ['results.append(result)', 'results.append(object())', /return identity/],
    ['audit("skipped", item)', 'pass', /callback count/],
    ['result = send(item)', 'try:\n            result = send(item)\n        except RuntimeError:\n            continue', /send error swallowed/],
    ['audit("sent", item)', 'audit("sent", item)\n        audit("sent", item)', /callback count/],
  ]) {
    await world.write(delivery.replace(before, after));
    await rejected(step, world, reason);
  }
});

test('nesting checker rejects no-op and cosmetic edits while accepting distinct rewrites', async (t) => {
  const world = await workspace(t);
  world.beforeCleanup = await readFile(new URL('../fixtures/simplify-code/inputs/pricing.py', import.meta.url), 'utf8');
  world.beforeDepth = 3;
  const step = 'the changed workflow has less nested control flow';
  for (const good of [pricing, pricing.replace('discount', 'reduction')]) {
    await world.write(good);
    await invoke(step, world);
  }
  await world.write(world.beforeCleanup);
  await rejected(step, world, /No cleanup edit/);
  await world.write(`# A cosmetic edit\n${world.beforeCleanup}`);
  await rejected(step, world, /Control-flow nesting was not reduced/);
});

test('scope checker rejects edits to neighboring code, unrelated files, staging, and commits', async (t) => {
  const world = await workspace(t);
  world.unchangedPrefix = 'def legacy_label(value):\n    return str(value)\n\n';
  world.original = new Map([['workflow.py', world.unchangedPrefix + pricing], ['legacy.py', 'untouched\n']]);
  world.beforeHead = 'baseline';
  const cleanGit = async (args) => args[0] === 'rev-parse' ? 'baseline' : '';
  world.git = cleanGit;
  const step = 'cleanup leaves unrelated code and the Git index and HEAD unchanged';
  await world.write(world.unchangedPrefix + pricing);
  await world.write('untouched\n', 'legacy.py');
  await invoke(step, world);
  await world.write(world.unchangedPrefix.replace('str(value)', 'repr(value)') + pricing);
  await rejected(step, world, /Unmodified neighboring function changed/);
  await world.write(world.unchangedPrefix + pricing);
  await world.write('rewritten\n', 'legacy.py');
  await rejected(step, world, /Unrelated file changed: legacy.py/);
  await world.write('untouched\n', 'legacy.py');
  world.git = async (args) => args[0] === 'diff' ? 'workflow.py' : cleanGit(args);
  await rejected(step, world, /Index changed/);
  world.git = async (args) => args[0] === 'rev-parse' ? 'new-commit' : cleanGit(args);
  await rejected(step, world, /HEAD changed/);
});

test('skill selection requires a completed load, not a mention or failed request', async () => {
  const step = 'the agent selects the simplify-code skill normally';
  const tool = { name: 'skill', input: { id: 'simplify-code' }, status: 'completed' };
  await invoke(step, { tools: [tool] });
  for (const tools of [[], [{ ...tool, status: 'error' }],
    [{ ...tool, input: { id: 'write-docs' } }], [{ ...tool, name: 'read' }]]) {
    await rejected(step, { tools }, /No successful simplify-code skill selection/);
  }
});
