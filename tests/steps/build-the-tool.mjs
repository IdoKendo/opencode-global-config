import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';

const digest = (text) => createHash('sha256').update(text).digest('hex');
const quote = (text) => `'${text.replaceAll("'", "'\\''")}'`;
const run = (world, tool, input) => world.run(`node run-tool.mjs tools/${tool}.mjs ${quote(input)}`);

Given('a batch of service timeouts in seconds and one migrated service', function () {
  for (const name of this.immutable.keys()) {
    if (/^services\/.*\.json$/.test(name)) this.immutable.delete(name);
  }
});
Given('release r7 evidence with complete, failed, and missing checks', function () {
  assert.ok(this.original.has('evidence/incomplete.json'));
});

Then('the current service batch has millisecond timeouts and preserves other values', async function () {
  const expected = {
    'api.json': { name: 'api', timeout_ms: 2000, labels: { timeout_seconds: 'keep' } },
    'worker.json': { name: 'worker', timeout_ms: 500, enabled: true },
    'cache.json': { name: 'cache', timeout_ms: 0, enabled: false },
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.deepEqual(JSON.parse(await this.read(`services/${name}`)), value, 'Current batch values');
  }
  assert.equal(await this.read('services/current.json'), this.original.get('services/current.json'));
});

Then('the migration handles new services and a second run changes no bytes', async function () {
  const directory = await mkdtemp(path.join(this.workspace, '.migration-probe-'));
  try {
    await writeFile(path.join(directory, 'new.json'),
      '{"name":"new","timeout_seconds":1.25,"nested":{"timeout_seconds":9}}\n');
    await writeFile(path.join(directory, 'current.json'), '{ "timeout_ms": 23 }\n');
    await writeFile(path.join(directory, 'notes.txt'), 'timeout_seconds: preserve\n');
    const first = await run(this, 'migrate', directory);
    assert.equal(first.code, 0, `Migration command failed: ${first.stderr}`);
    const after = await files(directory);
    assert.deepEqual(JSON.parse(after.get('new.json')),
      { name: 'new', timeout_ms: 1250, nested: { timeout_seconds: 9 } }, 'Migrated values');
    assert.equal(after.get('current.json'), '{ "timeout_ms": 23 }\n', 'Migrated values changed existing units');
    assert.equal(after.get('notes.txt'), 'timeout_seconds: preserve\n');
    const second = await run(this, 'migrate', directory);
    assert.equal(second.code, 0, 'Rerun failed');
    assert.deepEqual(await files(directory), after, 'Rerun changed bytes');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

Then('the release check accepts complete evidence and rejects invalid or incomplete evidence', async function () {
  const directory = await mkdtemp(path.join(this.workspace, '.evidence-probe-'));
  const unit = { name: 'unit', status: 'passed' };
  const integration = { name: 'integration', status: 'passed' };
  // Expectations come from the release contract, not the generated checker.
  const cases = [
    ['complete', { release: 'r7', checks: [integration, unit] }, 0],
    ['invalid', { release: 'r7', checks: [unit, { ...integration, status: 'failed' }] }, 1],
    ['incomplete', { release: 'r7', checks: [unit] }, 1],
    ['empty', { release: 'r7', checks: [] }, 1],
    ['duplicate', { release: 'r7', checks: [unit, unit] }, 1],
    ['extra-duplicate', { release: 'r7', checks: [unit, integration, unit] }, 1],
    ['wrong-release', { release: 'r6', checks: [unit, integration] }, 1],
    ['missing-checks', { release: 'r7' }, 1],
    ['malformed', '{', 1],
    ['unreadable', undefined, 1],
  ];
  try {
    for (const [name, data, code] of cases) {
      const input = path.join(directory, `${name}.json`);
      if (data !== undefined) await writeFile(input, typeof data === 'string' ? data : JSON.stringify(data));
      const before = await files(directory);
      const result = await run(this, 'check', input);
      assert.equal(result.code, code, `${name} evidence exit status: ${result.stderr}`);
      assert.match(result.stdout, code === 0 ? /\bPASS\b/ : /\bFAIL\b/, `${name} evidence result`);
      assert.doesNotMatch(result.stderr, /SyntaxError|TypeError|ReferenceError/, `${name} evidence crashed`);
      assert.deepEqual(await files(directory), before, 'Evidence check changed inputs');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

Then('the agent ran the final tool against the task inputs', async function () {
  const tool = `tools/${this.scenario.tool}.mjs`;
  const hash = digest(await this.read(tool));
  const cases = this.scenario.tool === 'migrate' ? [['services', 0]]
    : [['evidence/complete.json', 0], ['evidence/failed.json', 1], ['evidence/incomplete.json', 1]];
  for (const [input, code] of cases) {
    assert.ok(this.executions.some((record) => record.kind === 'project-tool'
      && record.tool === tool && record.input === input && record.code === code && record.digest === hash),
    `No agent execution of final ${tool} on ${input} with exit ${code}`);
  }
});

Then('the tool task stays in scope with an empty index and unchanged HEAD', async function () {
  const current = await files(this.workspace);
  for (const [name, text] of current) {
    const writable = name.startsWith('tools/')
      || (this.scenario.tool === 'migrate' && /^services\/.*\.json$/.test(name));
    if (!writable) assert.equal(text, this.original.get(name), `Out-of-scope file: ${name}`);
  }
  for (const name of this.original.keys()) assert.ok(current.has(name), `Removed input: ${name}`);
  assert.equal(await this.git(['diff', '--cached', '--name-only']), '', 'Index is not empty');
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead, 'HEAD changed');
});

Then('the agent selects build-the-tool through normal skill discovery', function () {
  assert.ok(this.tools.some((tool) => /(?:^|[._])skill$/.test(tool.name)
    && tool.input?.id === 'build-the-tool' && tool.status === 'completed'), 'Skill was not selected');
});

Then('the tool handoff identifies its command, result, and remaining release limitation', function () {
  assert.match(this.handoff, /tools\/check\.mjs/);
  assert.match(this.handoff, /evidence\//);
  assert.match(this.handoff, /pass|exit\s*0/i);
  assert.match(this.handoff, /fail|reject|exit\s*1/i);
  assert.match(this.handoff, /production|deploy|human/i);
});
