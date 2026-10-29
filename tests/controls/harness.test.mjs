import assert from 'node:assert/strict';
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertImplementationUnchanged, command, linkSetup, parseTrace } from '../support/harness.mjs';

async function temporary(t) {
  const root = await mkdtemp(path.join(process.env.AGENT_TEST_TMPDIR ?? tmpdir(), 'agent-test-control-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('commands receive EOF and execute in their isolated working directory', async (t) => {
  const cwd = await temporary(t);
  const result = await command(process.execPath, ['-e',
    "process.stdin.resume(); process.stdin.on('end', () => console.log(process.cwd()))"],
  { cwd, timeout: 3_000 });
  assert.equal(result.code, 0);
  assert.equal(result.stdout.trim(), await realpath(cwd));
});

test('agent configuration includes global instructions and changes to other skills', async (t) => {
  const root = await temporary(t);
  const setup = path.join(root, 'setup');
  await mkdir(path.join(setup, 'skills/other-skill'), { recursive: true });
  await writeFile(path.join(setup, 'opencode.json'), '{"default_agent":"reviewer"}');
  await writeFile(path.join(setup, 'AGENTS.md'), 'Use the project conventions.\n');
  const otherSkill = path.join(setup, 'skills/other-skill/SKILL.md');
  await writeFile(otherSkill, 'Other skill version one.\n');
  const config = await linkSetup(root, setup);
  assert.equal(await readFile(path.join(config, 'AGENTS.md'), 'utf8'), 'Use the project conventions.\n');
  assert.equal(JSON.parse(await readFile(path.join(config, 'opencode.json'))).default_agent, 'reviewer');
  assert.equal(await readFile(path.join(config, 'skills/other-skill/SKILL.md'), 'utf8'),
    'Other skill version one.\n');
  await writeFile(otherSkill, 'Other skill changed to a conflicting instruction.\n');
  assert.equal(await readFile(path.join(config, 'skills/other-skill/SKILL.md'), 'utf8'),
    'Other skill changed to a conflicting instruction.\n');
});

test('commands fail on timeout and preserve diagnostic output', async () => {
  await assert.rejects(command(process.execPath, ['-e',
    "console.log('started'); setInterval(() => {}, 1000)"], { timeout: 500 }), (error) => {
    assert.match(error.message, /timed out/);
    assert.equal(error.result.stdout.trim(), 'started');
    assert.notEqual(error.result.code, 0);
    return true;
  });
});

test('trace parsing keeps only final response and rejects incomplete or errored traces', () => {
  const text = (messageID, value) => ({ type: 'text', part: { messageID, text: value } });
  const tool = { type: 'tool_use', part: { tool: 'shell', state: {
    status: 'completed', input: { command: 'python worker.py' }, output: 'Retry attempts: 5',
  } } };
  const encode = (events) => events.map((event) => JSON.stringify(event)).join('\n');
  const events = [text('planning', 'I will verify it.'), tool,
    { type: 'step_finish' }, text('final', 'Verification blocked.')];
  const parsed = parseTrace(encode(events));
  assert.equal(parsed.handoff, 'Verification blocked.');
  assert.equal(parsed.tools[0].name, 'shell');
  assert.equal(parseTrace(encode([text('final', 'No change required.')])).handoff, 'No change required.');
  assert.throws(() => parseTrace(encode(events.slice(0, -1))), /no final response/);
  assert.throws(() => parseTrace(encode([...events, { type: 'error', error: 'provider failed' }])),
    /OpenCode error/);
  assert.throws(() => parseTrace('invalid JSON'), SyntaxError);
});

test('real worker receipts distinguish agent execution from setup and echoed claims', async (t) => {
  const cwd = await temporary(t);
  await cp(new URL('../fixtures/write-docs/documentation/common/worker.py', import.meta.url),
    path.join(cwd, 'worker.py'));
  const receipt = path.join(cwd, 'receipts.jsonl');
  const env = { ...process.env };
  delete env.AGENT_TEST_RECEIPTS;
  const setup = await command('python', ['worker.py', '--attempts', '3'], { cwd, env });
  assert.equal(setup.code, 0);
  await assert.rejects(readFile(receipt), { code: 'ENOENT' });
  const echoed = await command('python', ['-c', 'print("Retry attempts: 3")'], {
    cwd, env: { ...env, AGENT_TEST_RECEIPTS: receipt },
  });
  assert.equal(echoed.code, 0);
  await assert.rejects(readFile(receipt), { code: 'ENOENT' });
  const invocation = await command('python', ['-c', [
    'import subprocess',
    "result = subprocess.run(['python', 'worker.py', '--attempts', '3'], capture_output=True, text=True)",
    'assert result.returncode == 0',
    "assert result.stdout.strip() == 'Retry attempts: 3'",
    "print('PASS')",
  ].join('\n')], { cwd, env: { ...env, AGENT_TEST_RECEIPTS: receipt } });
  assert.equal(invocation.code, 0, invocation.stderr);
  assert.equal(invocation.stdout.trim(), 'PASS');
  assert.deepEqual(JSON.parse((await readFile(receipt, 'utf8')).trim()), {
    args: ['--attempts', '3'], code: 0,
  });
  const failure = await command('python', ['worker.py', '--attempts', '0'], {
    cwd, env: { ...env, AGENT_TEST_RECEIPTS: receipt },
  });
  assert.equal(failure.code, 2);
  const records = (await readFile(receipt, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.deepEqual(records[1], { args: ['--attempts', '0'], code: 2 });
});

test('implementation oracle rejects edits, permission changes, and symlink substitution', async (t) => {
  const workspace = await temporary(t);
  const file = path.join(workspace, 'worker.py');
  const text = 'print("original")\n';
  await writeFile(file, text);
  const mode = (await lstat(file)).mode;
  const world = { workspace, immutable: new Map([['worker.py', { text, mode }]]),
    read: (name) => readFile(path.join(workspace, name), 'utf8') };
  await assertImplementationUnchanged(world);
  await writeFile(file, 'print("changed")\n');
  await assert.rejects(assertImplementationUnchanged(world), /implementation changed/);
  await writeFile(file, text);
  await chmod(file, 0o700);
  await assert.rejects(assertImplementationUnchanged(world), /permissions changed/);
  await chmod(file, mode & 0o777);
  await assertImplementationUnchanged(world);
  await rm(file);
  await writeFile(path.join(workspace, 'replacement.py'), text);
  await symlink('replacement.py', file);
  await assert.rejects(assertImplementationUnchanged(world), /replaced with non-file/);
});
