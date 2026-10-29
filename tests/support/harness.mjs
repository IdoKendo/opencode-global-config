import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarios } from './scenarios.mjs';

export const testRoot = fileURLToPath(new URL('../', import.meta.url));

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export async function linkSetup(root, setupRoot = repositoryRoot) {
  const config = path.join(root, 'config/opencode');
  await mkdir(path.dirname(config), { recursive: true });
  await symlink(setupRoot, config, 'dir');
  return config;
}

export function command(executable, args, { cwd, env, timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { cwd, env, detached: process.platform !== 'win32' });
    child.stdin.end();
    let stdout = '';
    let stderr = '';
    let failure;
    const stop = (message) => {
      failure = new Error(message);
      if (process.platform === 'win32') child.kill('SIGKILL');
      else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
          if (error.code !== 'ESRCH') failure = error;
        }
      }
    };
    const timer = setTimeout(() => stop(`Command timed out after ${timeout}ms`), timeout);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 20_000_000) stop('Command output exceeded 20 MB');
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.length > 20_000_000) stop('Command stderr exceeded 20 MB');
    });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const result = { stdout, stderr, code, signal };
      if (failure) reject(Object.assign(failure, { result }));
      else resolve(result);
    });
  });
}

export async function files(directory, prefix = '') {
  const result = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const item of await files(absolute, relative)) result.set(...item);
    } else if (entry.isFile()) result.set(relative, await readFile(absolute, 'utf8'));
  }
  return result;
}

export function parseTrace(stdout) {
  const events = stdout.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  const errors = events.filter((event) => event.type === 'error');
  if (errors.length) throw new Error(`OpenCode error: ${JSON.stringify(errors)}`);
  const tools = events.filter((event) => event.type === 'tool_use').map((event) => ({
    name: event.part.tool,
    input: event.part.state.input,
    output: event.part.state.output ?? '',
    status: event.part.state.status,
  }));
  const lastTool = events.findLastIndex((event) => event.type === 'tool_use');
  const finalText = events.findLast((event) => event.type === 'text');
  const handoff = events.slice(lastTool + 1)
    .filter((event) => event.type === 'text'
      && event.part.messageID === finalText?.part.messageID)
    .map((event) => event.part.text).join('\n');
  if (!handoff.trim()) throw new Error('OpenCode produced no final response after its tools');
  return { events, tools, handoff };
}

export async function prepare(world, name) {
  world.scenario = scenarios[name];
  if (!world.scenario) throw new Error(`No fixture for scenario: ${name}`);
  world.model = process.env.AGENT_TEST_MODEL;
  if (!world.model) throw new Error('Set AGENT_TEST_MODEL to an explicit provider/model');
  world.timeout = Number(process.env.AGENT_TEST_TIMEOUT_MS ?? 180_000);
  if (!Number.isSafeInteger(world.timeout) || world.timeout <= 0) {
    throw new Error('AGENT_TEST_TIMEOUT_MS must be a positive integer');
  }
  world.root = await mkdtemp(path.join(process.env.AGENT_TEST_TMPDIR ?? tmpdir(), 'agent-test-'));
  world.workspace = path.join(world.root, 'workspace');
  world.artifact = path.resolve(process.env.AGENT_TEST_ARTIFACTS ?? 'logs/agent-tests',
    `${path.basename(world.root)}-${world.scenario.fixture.replaceAll('/', '-')}`);
  await mkdir(world.artifact, { recursive: true });
  for (const fixture of [...(world.scenario.includes ?? []), world.scenario.fixture]) {
    await cp(path.join(testRoot, 'fixtures', fixture), world.workspace, { recursive: true });
  }
  world.setupRoot = repositoryRoot;
  world.config = await linkSetup(world.root);
  const config = world.config;
  world.env = { ...process.env, PWD: world.workspace, XDG_CONFIG_HOME: path.dirname(config) };
  delete world.env.DEPLOY_TOKEN;
  delete world.env.AGENT_TEST_RECEIPTS;
  // Do not inherit inline configuration, a remote server, or an existing session from the caller.
  for (const key of Object.keys(world.env)) {
    if (key.startsWith('OPENCODE_')) delete world.env[key];
    if (key.startsWith('GIT_')) delete world.env[key];
  }
  world.env.GIT_CONFIG_NOSYSTEM = '1';
  world.env.GIT_CONFIG_GLOBAL = '/dev/null';
  world.run = (shellCommand) => command('/bin/sh', ['-c', shellCommand], {
    cwd: world.workspace, env: world.env,
  });
  world.git = async (args) => {
    const result = await command('git', args, { cwd: world.workspace, env: world.env });
    if (result.code !== 0) throw new Error(result.stderr);
    return result.stdout.trim();
  };
  world.read = (relative) => readFile(path.join(world.workspace, relative), 'utf8');
  world.original = await files(world.workspace);
  world.immutable = new Map();
  for (const [name, text] of world.original) {
    if (!name.endsWith('.md')) {
      const info = await lstat(path.join(world.workspace, name));
      world.immutable.set(name, { text, mode: info.mode });
    }
  }
  world.fixture = async (relative) => {
    if (!world.original.has(relative)) throw new Error(`Missing original fixture: ${relative}`);
    return world.original.get(relative);
  };
  world.docs = async () => [...await files(world.workspace)]
    .filter(([name]) => name.endsWith('.md') && !name.startsWith('.'))
    .map(([path, text]) => ({ path, text }));
  await world.git(['init', '--quiet']);
  await world.git(['add', '.']);
  await world.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Fixture baseline']);
  world.beforeHead = await world.git(['rev-parse', 'HEAD']);
  const version = await command('opencode', ['--version'], { env: world.env });
  if (version.code !== 0) throw new Error(`OpenCode version check failed: ${version.stderr}`);
  const revision = await command('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot });
  const status = await command('git', ['status', '--porcelain'], { cwd: repositoryRoot });
  await writeFile(path.join(world.artifact, 'metadata.json'), JSON.stringify({
    scenario: name, model: world.model, prompt: world.scenario.prompt,
    setupRoot: repositoryRoot, setupRevision: revision.stdout.trim(),
    setupDirty: Boolean(status.stdout.trim()),
    timeout: world.timeout, opencodeVersion: version.stdout.trim(),
  }, null, 2));
}

export async function assertImplementationUnchanged(world) {
  for (const [name, original] of world.immutable) {
    const info = await lstat(path.join(world.workspace, name));
    assert.ok(info.isFile() && !info.isSymbolicLink(), `${name} replaced with non-file`);
    assert.equal(info.mode, original.mode, `${name} permissions changed`);
    assert.equal(await world.read(name), original.text, `${name} implementation changed`);
  }
}

export async function runAgent(world) {
  let result;
  const receipts = path.join(world.root, 'executions.jsonl');
  try {
    result = await command('opencode', ['run', '--standalone', '--auto', '--format', 'json',
      '--model', world.model, world.scenario.prompt], {
      cwd: world.workspace, env: { ...world.env, AGENT_TEST_RECEIPTS: receipts },
      timeout: world.timeout,
    });
  } catch (error) {
    result = error.result;
    throw error;
  } finally {
    if (result) {
      await writeFile(path.join(world.artifact, 'trace.jsonl'), result.stdout);
      await writeFile(path.join(world.artifact, 'stderr.txt'), result.stderr);
    }
  }
  if (result.code !== 0) throw new Error(`OpenCode exited ${result.code}: ${result.stderr}`);
  const trace = parseTrace(result.stdout);
  world.agentEvents = trace.events;
  world.tools = trace.tools;
  world.handoff = trace.handoff;
  const records = await readFile(receipts, 'utf8').catch((error) => {
    if (error.code === 'ENOENT') return '';
    throw error;
  });
  world.executions = records.trim() ? records.trim().split('\n').map(JSON.parse) : [];
  await writeFile(path.join(world.artifact, 'executions.jsonl'), records);
  await assertImplementationUnchanged(world);
}

export async function finish(world, result) {
  try {
    if (world.artifact) {
      await writeFile(path.join(world.artifact, 'result.json'), JSON.stringify(result, null, 2));
      const exists = await lstat(world.workspace).catch((error) => {
        if (error.code === 'ENOENT') return undefined;
        throw error;
      });
      if (exists) {
        await cp(world.workspace, path.join(world.artifact, 'workspace'), {
          recursive: true, filter: (source) => path.basename(source) !== '.git',
        });
      }
      if (world.beforeHead) {
        await writeFile(path.join(world.artifact, 'diff.patch'), await world.git(['diff', 'HEAD']));
      }
    }
  } finally {
    if (world.root) await rm(world.root, { recursive: true, force: true });
  }
}
