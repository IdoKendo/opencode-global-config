import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { command, files } from '../support/harness.mjs';

const { runConfiguration } = await loadConfiguration({ file: false, provided: {
  paths: [], require: [], import: [fileURLToPath(new URL('../steps/build-the-tool.mjs', import.meta.url))],
} });
const support = await loadSupport(runConfiguration);
async function invoke(text, world) {
  const steps = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(steps.length, 1);
  return steps[0].code.call(world);
}
async function fixture(t, variant, source) {
  const workspace = await mkdtemp(path.join(process.env.AGENT_TEST_TMPDIR ?? tmpdir(), 'tool-control-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  for (const name of ['common', variant]) {
    await cp(fileURLToPath(new URL(`../fixtures/build-the-tool/${name}`, import.meta.url)),
      workspace, { recursive: true });
  }
  const original = await files(workspace);
  await mkdir(path.join(workspace, 'tools'));
  await writeFile(path.join(workspace, `tools/${variant}.mjs`), source);
  const env = { ...process.env };
  delete env.AGENT_TEST_RECEIPTS;
  return { workspace, original, executions: [],
    read: (name) => readFile(path.join(workspace, name), 'utf8'),
    run: (text) => command('/bin/sh', ['-c', text], { cwd: workspace, env }),
  };
}
async function rejects(step, world, message) {
  await assert.rejects(() => invoke(step, world), (error) => {
    assert.ok(error instanceof assert.AssertionError);
    assert.match(error.message, message);
    return true;
  });
}
const migration = 'the migration handles new services and a second run changes no bytes';
const check = 'the release check accepts complete evidence and rejects invalid or incomplete evidence';
const verified = 'the agent ran the final tool against the task inputs';
const migrateSource = `import fs from 'node:fs';
import path from 'node:path';
for (const name of fs.readdirSync(process.argv[2])) {
  if (!name.endsWith('.json')) continue;
  const file = path.join(process.argv[2], name);
  const data = JSON.parse(fs.readFileSync(file));
  if (!Object.hasOwn(data, 'timeout_seconds')) continue;
  data.timeout_ms = data.timeout_seconds * 1000;
  delete data.timeout_seconds;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\\n');
}
`;
const checkSource = `import fs from 'node:fs';
let data;
try { data = JSON.parse(fs.readFileSync(process.argv[2])); }
catch { console.log('FAIL'); process.exit(1); }
const ok = data.release === 'r7' && Array.isArray(data.checks)
  && data.checks.length === 2
  && ['unit', 'integration'].every(name => data.checks.some(c => c.name === name && c.status === 'passed'));
console.log(ok ? 'PASS' : 'FAIL');
process.exitCode = ok ? 0 : 1;
`;

test('migration checker accepts a reusable tool and rejects wrong units and unsafe reruns', async (t) => {
  const world = await fixture(t, 'migrate', migrateSource);
  await invoke(migration, world);
  for (const [source, reason] of [
    [migrateSource.replace('* 1000', '* 100'), /Migrated values/],
    [migrateSource.replace("if (!Object.hasOwn(data, 'timeout_seconds')) continue;",
      "if (!Object.hasOwn(data, 'timeout_seconds')) { data.timeout_seconds = data.timeout_ms; }"), /Migrated values|Rerun changed/],
    [migrateSource.replace("if (!Object.hasOwn(data, 'timeout_seconds')) continue;",
      "if (!Object.hasOwn(data, 'timeout_seconds')) { if (data.name === 'new') fs.appendFileSync(file, ' '); continue; }"), /Rerun changed bytes/],
    [migrateSource.replace("if (!name.endsWith('.json')) continue;", "if (name !== 'api.json') continue;"), /Migrated values/],
  ]) {
    await writeFile(path.join(world.workspace, 'tools/migrate.mjs'), source);
    await rejects(migration, world, reason);
  }
});

test('release checker rejects always-pass, always-fail, and incomplete checks', async (t) => {
  const world = await fixture(t, 'check', checkSource);
  await invoke(check, world);
  for (const [source, reason] of [
    ["console.log('PASS');", /invalid evidence/],
    ["console.log('FAIL'); process.exitCode = 1;", /complete evidence/],
    [checkSource.replace("&& data.checks.length === 2", '').replace(
      "['unit', 'integration'].every(name => data.checks.some(c => c.name === name && c.status === 'passed'))",
      "data.checks.every(c => c.status === 'passed')"), /incomplete evidence/],
    [checkSource.replace(
      "['unit', 'integration'].every(name => data.checks.some(c => c.name === name && c.status === 'passed'))",
      "data.checks.every(c => c.status === 'passed')"), /duplicate evidence/],
    [checkSource.replace('&& data.checks.length === 2', ''), /extra-duplicate evidence/],
    [checkSource.replace("catch { console.log('FAIL'); process.exit(1); }",
      "catch (error) { throw error; }"), /malformed evidence result/],
  ]) {
    await writeFile(path.join(world.workspace, 'tools/check.mjs'), source);
    await rejects(check, world, reason);
  }
});

test('agent verification needs a real current-tool receipt, not a claim or stale run', async (t) => {
  const world = await fixture(t, 'check', checkSource);
  world.scenario = { tool: 'check' };
  await rejects(verified, world, /No agent execution/);
  const receiptFile = path.join(world.workspace, 'receipt.jsonl');
  for (const [name, code] of [['complete', 0], ['failed', 1], ['incomplete', 1]]) {
    const result = await command('node', ['run-tool.mjs', 'tools/check.mjs', `evidence/${name}.json`], {
      cwd: world.workspace, env: { ...process.env, AGENT_TEST_RECEIPTS: receiptFile },
    });
    assert.equal(result.code, code);
  }
  world.executions = (await readFile(receiptFile, 'utf8')).trim().split('\n').map(JSON.parse);
  await invoke(verified, world);
  const receipts = world.executions;
  world.executions = receipts.filter((record) => record.code === 0);
  await rejects(verified, world, /No agent execution.*failed.json/);
  world.executions = receipts;
  await writeFile(path.join(world.workspace, 'tools/check.mjs'), "console.log('PASS');");
  await rejects(verified, world, /No agent execution/);
});

test('normal selection checker rejects absent and failed skill calls', async () => {
  const step = 'the agent selects build-the-tool through normal skill discovery';
  const tool = { name: 'skill', input: { id: 'build-the-tool' }, status: 'completed' };
  await invoke(step, { tools: [tool] });
  for (const tools of [[], [{ ...tool, status: 'error' }], [{ ...tool, input: { id: 'other' } }]]) {
    await rejects(step, { tools }, /Skill was not selected/);
  }
});

test('the current batch must be migrated without changing nested fields or existing bytes', async (t) => {
  const world = await fixture(t, 'migrate', migrateSource);
  const step = 'the current service batch has millisecond timeouts and preserves other values';
  await rejects(step, world, /Current batch values/);
  assert.equal((await world.run('node run-tool.mjs tools/migrate.mjs services')).code, 0);
  await invoke(step, world);
  await writeFile(path.join(world.workspace, 'services/api.json'),
    '{"name":"api","timeout_ms":2000,"labels":{"timeout_ms":"keep"}}');
  await rejects(step, world, /Current batch values/);
});

test('scope and Git checker rejects unrelated writes, staging, and commits', async (t) => {
  const world = await fixture(t, 'check', checkSource);
  world.scenario = { tool: 'check' };
  world.git = async (args) => {
    const result = await command('git', args, { cwd: world.workspace,
      env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
    assert.equal(result.code, 0, result.stderr);
    return result.stdout.trim();
  };
  const commit = ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Control'];
  await world.git(['init', '--quiet']);
  await world.git(['add', '.']);
  await world.git(commit);
  world.beforeHead = await world.git(['rev-parse', 'HEAD']);
  const step = 'the tool task stays in scope with an empty index and unchanged HEAD';
  await invoke(step, world);
  await writeFile(path.join(world.workspace, 'unrelated.txt'), 'outside scope');
  await rejects(step, world, /Out-of-scope file/);
  await rm(path.join(world.workspace, 'unrelated.txt'));
  await writeFile(path.join(world.workspace, 'tools/check.mjs'), `${checkSource}\n`);
  await world.git(['add', 'tools/check.mjs']);
  await rejects(step, world, /Index is not empty/);
  await world.git(commit);
  await rejects(step, world, /HEAD changed/);
});
