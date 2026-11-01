import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { command, files, testRoot } from '../support/harness.mjs';

async function probe(world, mode) {
  const result = await command('python3', [path.join(testRoot, 'support/simplify-code-probe.py'),
    mode, path.join(world.workspace, 'workflow.py')], { cwd: world.workspace });
  assert.equal(result.code, 0, `${mode} contract failed: ${result.stderr}`);
  return result.stdout.trim();
}

Given(/^uncommitted (pricing|delivery) changes with redundant nested branches$/, async function (kind) {
  assert.equal(this.scenario.simplifyCase, kind);
  const baseline = await this.read('workflow.py');
  this.unchangedPrefix = baseline.slice(0, baseline.indexOf('def process('));
  const changed = await readFile(path.join(testRoot, `fixtures/simplify-code/inputs/${kind}.py`), 'utf8');
  await writeFile(path.join(this.workspace, 'workflow.py'), this.unchangedPrefix + changed);
  // This scenario owns one editable implementation file; all other harness guards remain active.
  this.immutable.delete('workflow.py');
  this.beforeCleanup = await this.read('workflow.py');
  this.beforeDepth = Number(await probe(this, 'structure'));
  assert.equal(this.beforeDepth, 3, 'Fixture must present nested control flow');
  await probe(this, kind);
  assert.equal(await this.git(['diff', '--name-only']), 'workflow.py');
});

Then('the agent selects the simplify-code skill normally', function () {
  assert.ok(this.tools.some(({ name, input, status }) => name === 'skill'
    && (input.id ?? input.name) === 'simplify-code' && status === 'completed'),
  'No successful simplify-code skill selection');
});

Then('the changed workflow has less nested control flow', async function () {
  assert.notEqual(await this.read('workflow.py'), this.beforeCleanup, 'No cleanup edit');
  assert.ok(Number(await probe(this, 'structure')) < this.beforeDepth,
    'Control-flow nesting was not reduced');
});

Then('pricing preserves zero, negative, threshold, and member results', async function () {
  await probe(this, 'pricing');
});

Then('delivery preserves callback order, identity, and exceptions', async function () {
  await probe(this, 'delivery');
});

Then('cleanup leaves unrelated code and the Git index and HEAD unchanged', async function () {
  assert.ok((await this.read('workflow.py')).startsWith(this.unchangedPrefix),
    'Unmodified neighboring function changed');
  const current = await files(this.workspace);
  for (const [name, text] of this.original) {
    if (name !== 'workflow.py') assert.equal(current.get(name), text, `Unrelated file changed: ${name}`);
  }
  assert.equal(await this.git(['diff', '--cached', '--name-only']), '', 'Index changed');
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead, 'HEAD changed');
});
