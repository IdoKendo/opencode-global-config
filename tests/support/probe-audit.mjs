import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const scenarios = {
  'Remove a repeated rounding check while protecting both public import paths': {
    fixture: 'test-audit/public-entry-points',
    prompt: 'The rounding tests look repetitive. Clean up the suite and keep useful regression coverage.',
  },
  'A worker stops reading jobs after taking the first ready job': {
    fixture: 'simplify-code/lazy-iterator',
    prompt: 'Simplify the current working-tree changes in jobs.mjs.',
  },
};

// Redirect each published path separately. Both normally resolve to the same file,
// so mutating that shared implementation cannot tell which path a test exercises.
export async function probeRounding(world, broken) {
  const { command } = await import('./harness.mjs');
  const manifest = path.join(world.workspace, 'package.json');
  const original = await readFile(manifest, 'utf8');
  const pkg = JSON.parse(original);
  const scratch = await mkdtemp(path.join(world.workspace, '.entry-probe-'));
  const calls = path.join(scratch, 'calls');
  try {
    await writeFile(calls, '');
    for (const [key, label] of [['.', 'root'], ['./sdk', 'sdk']]) {
      const shim = path.join(scratch, `${label}.mjs`);
      await writeFile(shim, `import { appendFileSync } from 'node:fs';
import { billableKg as round } from ${JSON.stringify(pathToFileURL(path.resolve(world.workspace, pkg.exports[key])).href)};
export function billableKg(weight) {
  appendFileSync(${JSON.stringify(calls)}, JSON.stringify([${JSON.stringify(label)}, weight]) + '\\n');
  return ${broken === label ? 'Math.floor(weight)' : 'round(weight)'};
}`);
      pkg.exports[key] = './' + path.relative(world.workspace, shim);
    }
    await writeFile(manifest, JSON.stringify(pkg));
    const env = { ...world.env };
    delete env.NODE_TEST_CONTEXT;
    const result = await command(process.execPath, ['--test', '--test-reporter=tap'], { cwd: world.workspace, env });
    if (broken) {
      assert.equal(result.code, 1, `${broken} regression survived`);
      assert.match(result.stdout, /code: 'ERR_ASSERTION'/, result.stdout);
    } else {
      assert.equal(result.code, 0, result.stdout + result.stderr);
      const rows = (await readFile(calls, 'utf8')).split('\n').filter(Boolean).map(JSON.parse);
      for (const label of ['root', 'sdk']) {
        const weights = rows.filter(([entry, kg]) => entry === label && Number.isFinite(kg)
          && !Number.isInteger(kg)).map(([, kg]) => kg);
        assert.ok(weights.length, `Missing fractional example through ${label}`);
        assert.equal(new Set(weights).size, weights.length, `Repeated example through ${label}`);
      }
    }
  } finally {
    await writeFile(manifest, original);
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function jobDepth(world) {
  const { command, testRoot } = await import('./harness.mjs');
  const result = await command(process.execPath, [path.join(testRoot, 'support/simplify-code-probe.mjs'),
    'structure', path.join(world.workspace, 'jobs.mjs')], { cwd: world.workspace });
  assert.equal(result.code, 0, result.stderr);
  return Number(result.stdout.trim());
}

export function earlyStop(readyJobs) {
  const selected = { ready: true };
  const events = [];
  function* queue() {
    try {
      events.push('paused');
      yield { ready: true, paused: true };
      events.push('ready');
      yield selected;
      throw new Error('read beyond first ready job');
    } finally {
      events.push('closed');
    }
  }
  const jobs = readyJobs(queue());
  assert.deepEqual(events, [], 'filter consumed the queue before iteration');
  let taken;
  for (const job of jobs) {
    taken = job;
    break;
  }
  assert.equal(taken, selected);
  assert.deepEqual(events, ['paused', 'ready', 'closed']);
}

export function drain(readyJobs) {
  const first = { ready: true };
  const second = { ready: true };
  const result = [...readyJobs([null, first, { ready: false }, { ready: true, paused: true }, second].values())];
  assert.equal(result.length, 2);
  assert.equal(result[0], first);
  assert.equal(result[1], second);
}
