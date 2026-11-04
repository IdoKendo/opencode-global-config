import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { fixture } from '../support/control-fixture.mjs';
import { assertImplementationUnchanged } from '../support/harness.mjs';

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

const pricing = `export function process(amount, member = false) {
  if (amount < 0) {
    throw new RangeError('amount must be non-negative');
  }
  if (amount < 100) {
    return amount;
  }
  let discount = 10;
  if (member) {
    discount = 20;
  }
  return amount - discount;
}
`;
const alternatePricing = pricing.replace('let discount = 10;\n  if (member) {\n    discount = 20;\n  }',
  'let discount;\n  if (member) {\n    discount = 20;\n  } else {\n    discount = 10;\n  }');
const delivery = `export function process(items, send, audit) {
  const results = [];
  for (const item of items) {
    if (item === null) {
      audit('missing', item);
      continue;
    }
    if (!item.enabled) {
      audit('skipped', item);
      continue;
    }
    audit('sending', item);
    const result = send(item);
    audit('sent', item);
    results.push(result);
  }
  return results;
}
`;

async function workspace(t) {
  const world = await fixture(t, 'simplify-code/project');
  return {
    ...world,
    write: (text, file = 'workflow.mjs') => world.write(file, text),
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
  await world.write(alternatePricing);
  await invoke(step, world);
  for (const [before, after, reason] of [
    ['amount < 100', 'amount <= 100', /100, false, 90/],
    ['member = false', 'member = true', /default member contract/],
    ['discount = 20', 'discount = 10', /100, true, 80/],
    ['amount must be non-negative', 'invalid amount', /error message/],
    ["throw new RangeError('amount must be non-negative');", 'return 0;', /negative amount accepted/],
    ['new RangeError', 'new Error', /error type/],
    ['return amount - discount;', 'return Math.trunc(amount - discount);', /100\.5, true, 80\.5/],
    ['export function process', 'function process', /workflow must export process/],
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
    ["audit('sending', item);\n    const result = send(item);",
      "const result = send(item);\n    audit('sending', item);", /callback order or identity/],
    ['send(item)', 'send({ ...item })', /callback order or identity/],
    ['results.push(result)', 'results.push({ ...result })', /return identity/],
    ['results.push(result)', 'results.length += 1', /return identity/],
    ["audit('skipped', item);", '// Skipped audit removed.', /callback count/],
    ['const result = send(item);',
      'let result;\n    try { result = send(item); } catch { continue; }', /send error swallowed/],
    ["audit('sent', item);", "audit('sent', item);\n    audit('sent', item);", /callback count/],
    ['for (const item of items)', 'for (const item of items.map((item) => item))', /items\.map is not a function/],
    ['const results = [];', 'if (![...items].length) return [];\n  const results = [];', /callback count/],
    ['return results;', 'return results.length ? results : null;', /empty delivery/],
    ['return results;', "if (!results.length) audit('empty', null);\n  return results;", /empty delivery effects/],
    ['const result = send(item);',
      'let result;\n    try { result = send(item); } catch (error) { throw new Error(error.message); }', /exception identity/],
    ['const result = send(item);',
      "let result;\n    try { result = send(item); } catch (error) { audit('sent', item); throw error; }", /effects after send error/],
    ["audit('sending', item);", "try { audit('sending', item); } catch {}", /audit error swallowed/],
    ["audit('sent', item);", "try { audit('sent', item); } catch {}", /audit error swallowed/],
    ["audit('sending', item);",
      "try { audit('sending', item); } catch (error) { throw new Error(error.message); }", /audit exception identity/],
    ["audit('sending', item);",
      "try { audit('sending', item); } catch (error) { send(item); throw error; }", /effects after audit error/],
  ]) {
    await world.write(delivery.replace(before, after));
    await rejected(step, world, reason);
  }
});

test('nesting checker rejects no-op and cosmetic edits while accepting distinct rewrites', async (t) => {
  const world = await workspace(t);
  world.beforeCleanup = await readFile(new URL('../fixtures/simplify-code/inputs/pricing.mjs', import.meta.url), 'utf8');
  world.beforeDepth = 3;
  const step = 'the changed workflow has less nested control flow';
  // Comments, strings, and object literals do not add control-flow nesting.
  const noise = '// if (true) { while (true) {\nconst example = { outer: { inner: { text: "if (true) {" } } };\n';
  for (const good of [pricing, pricing.replaceAll('discount', 'reduction'), alternatePricing, noise + pricing]) {
    await world.write(good);
    await invoke(step, world);
  }
  await world.write(world.beforeCleanup);
  await rejected(step, world, /No cleanup edit/);
  for (const cosmetic of [`// A cosmetic edit\n${world.beforeCleanup}`, world.beforeCleanup.replaceAll('\n', ' ')]) {
    await world.write(cosmetic);
    await rejected(step, world, /Control-flow nesting was not reduced/);
  }
  await world.write(`export function process(amount, member = false) {
  if (amount >= 0)
    if (member)
      if (amount >= 100) return amount - 20;
  return amount;
}
`);
  await rejected(step, world, /Control-flow nesting was not reduced/);
  await world.write('export function process( {');
  await rejected(step, world, /Cannot measure invalid JavaScript syntax/);
});

test('scope checker rejects edits to neighboring code, unrelated files, staging, and commits', async (t) => {
  const world = await workspace(t);
  world.unchangedPrefix = 'export function legacyLabel(value) {\n  return String(value);\n}\n\n';
  const legacy = "export const invoiceLabel = 'untouched';\n";
  world.original = new Map([['workflow.mjs', world.unchangedPrefix + pricing], ['legacy.mjs', legacy]]);
  world.beforeHead = 'baseline';
  const cleanGit = async (args) => args[0] === 'rev-parse' ? 'baseline' : '';
  world.git = cleanGit;
  const step = 'cleanup leaves unrelated code and the Git index and HEAD unchanged';
  await world.write(world.unchangedPrefix + pricing);
  await world.write(legacy, 'legacy.mjs');
  await invoke(step, world);
  await world.write(world.unchangedPrefix.replace('String(value)', 'JSON.stringify(value)') + pricing);
  await rejected(step, world, /Unmodified neighboring function changed/);
  await world.write(world.unchangedPrefix + pricing);
  await world.write(legacy.replace('untouched', 'rewritten'), 'legacy.mjs');
  await rejected(step, world, /Unrelated file changed: legacy.mjs/);
  await world.write(legacy, 'legacy.mjs');
  world.git = async (args) => args[0] === 'diff' ? 'workflow.mjs' : cleanGit(args);
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

test('relocation checker rejects the old breadcrumb and a renamed breadcrumb', async (t) => {
  const world = await workspace(t);
  const step = 'the obsolete relocation note is removed from pricing';
  const scope = 'cleanup leaves unrelated code and the Git index and HEAD unchanged';
  const baseline = await world.read('workflow.mjs');
  world.unchangedPrefix = baseline.slice(0, baseline.indexOf('export function process('));
  const clean = world.unchangedPrefix + pricing;
  const legacy = await world.read('legacy.mjs');
  await world.write(clean);
  world.immutable.delete('workflow.mjs');
  await invoke('an obsolete relocation note in pricing beside unrelated user work', world);
  const userWork = await world.read('legacy.mjs');
  assert.notEqual(userWork, legacy, 'Fixture must create pre-existing user work');
  await assertImplementationUnchanged(world);
  await rejected(step, world, /Obsolete relocation note remains/);
  await world.write(clean);
  await invoke(step, world);
  await invoke(scope, world);
  await world.write(legacy, 'legacy.mjs');
  await rejected(scope, world, /Unrelated file changed: legacy.mjs/);
  await world.write(userWork, 'legacy.mjs');
  for (const comment of ['// discount moved to process', '// relocated from the removed helper',
    '/*\n * relocated from the removed helper\n */']) {
    await world.write(`${comment}\n${clean}`);
    await rejected(step, world, /Obsolete relocation note remains/);
  }
});
