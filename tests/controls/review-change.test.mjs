import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { fixture } from '../support/control-fixture.mjs';
import { command } from '../support/harness.mjs';
import {
  reviewReport, checkRequirements, checkQuality, checkUnavailable, checkPreserved,
} from '../support/review-change-assertions.mjs';

const { runConfiguration } = await loadConfiguration({
  file: false, provided: { paths: [], require: [],
    import: [fileURLToPath(new URL('../steps/review-change.mjs', import.meta.url))] },
});
await loadSupport(runConfiguration);
const { prepareReview } = await import('../steps/review-change.mjs');

const good = {
  Requirements: {
    status: 'findings', explanation: 'Compared request.md with the working tree.',
    findings: [{ file: 'shipping.mjs', line: 2, source: 'request.md:3',
      detail: 'At exactly 5000 cents the condition charges 500 instead of free shipping.' }],
  },
  'Code quality': {
    status: 'findings', explanation: 'Compared code with AGENTS.md.',
    findings: [{ file: 'receipt.mjs', line: 2, source: 'AGENTS.md:3',
      detail: 'console.log bypasses the injected logger and structured collector.' }],
  },
};
const unavailable = {
  ...good, Requirements: {
    status: 'unavailable', explanation: 'The original ticket is unavailable.', findings: [],
  },
};

function reject(check, original, mutate) {
  check(original);
  const value = structuredClone(original);
  mutate(value);
  assert.throws(() => check(value), assert.AssertionError);
}

test('review requires separate evidence-backed findings on the correct axes', () => {
  checkRequirements(good);
  checkQuality(good);
  for (const [check, axis] of [[checkRequirements, 'Requirements'], [checkQuality, 'Code quality']]) {
    reject(check, good, (v) => { v[axis].status = 'pass'; });
    reject(check, good, (v) => { v[axis].findings = []; });
    reject(check, good, (v) => { v[axis].findings[0].source = 'guessed convention'; });
    reject(check, good, (v) => { v[axis].findings[0].line = 1; });
    reject(check, good, (v) => { v[axis].findings[0].detail = 'Looks wrong'; });
  }
  const overlapping = structuredClone(good);
  overlapping.Requirements.findings.push({
    file: 'receipt.mjs', line: 2, source: 'request.md:7',
    detail: 'The receipt event no longer reaches the injected logger.',
  });
  checkRequirements(overlapping);
  checkQuality(overlapping);
  reject(checkQuality, good, (v) => { v['Code quality'].findings[0].file = 'shipping.mjs'; });
  const paraphrased = structuredClone(good);
  paraphrased.Requirements.findings[0].detail =
    'The inclusive $50 threshold still incurs a $5 fee; use >= for the boundary.';
  paraphrased['Code quality'].findings[0].detail =
    'Console logging bypasses the collector; restore logger.info for structured events.';
  checkRequirements(paraphrased);
  checkQuality(paraphrased);
});

test('unavailable requirements cannot pass, invent findings, or stop quality review', () => {
  checkUnavailable(unavailable);
  checkQuality(unavailable);
  reject(checkUnavailable, unavailable, (v) => { v.Requirements.status = 'pass'; });
  reject(checkUnavailable, unavailable, (v) => { v.Requirements.findings = good.Requirements.findings; });
  reject(checkUnavailable, unavailable, (v) => { v.Requirements.explanation = 'All criteria satisfied'; });
  reject(checkQuality, unavailable, (v) => { v['Code quality'].status = 'unavailable'; });
});

test('review report accepts JSON fences but rejects collapsed axes', () => {
  assert.deepEqual(reviewReport(JSON.stringify(good)), good);
  assert.deepEqual(reviewReport('```json\n' + JSON.stringify(good) + '\n```'), good);
  const collapsed = { ...good };
  delete collapsed.Requirements;
  assert.throws(() => reviewReport(JSON.stringify(collapsed)), assert.AssertionError);
});

async function repository(t) {
  const world = await fixture(t, 'review-change/common');
  world.git = async (args) => {
    const result = await command('git', args, { cwd: world.workspace, env: {
      ...world.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    } });
    assert.equal(result.code, 0, result.stderr);
    return result.stdout.trim();
  };
  await world.git(['init', '--quiet']);
  await world.git(['add', '.']);
  await world.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Baseline']);
  await prepareReview(world);
  return world;
}

test('Given establishes real staged and unstaged diffs and preserves all user work', async (t) => {
  const world = await repository(t);
  await checkPreserved(world);
  assert.match(await world.git(['diff', 'baseline', '--', 'shipping.mjs']), /^\+  return subtotal > 5000/m);
  assert.match(await world.git(['diff', 'baseline', '--', 'receipt.mjs']), /^\+  console.log/m);
  const shipping = await import(`file://${path.join(world.workspace, 'shipping.mjs')}`);
  assert.equal(shipping.shipping(5000), 500, 'Fixture must contain the missing threshold');
  assert.equal(shipping.shipping(5001), 0);
  await world.write('personal-notes.txt', 'Overwritten');
  await assert.rejects(checkPreserved(world), assert.AssertionError);
});

for (const [label, change] of [
  ['stage user work', (w) => w.git(['add', 'shipping.mjs'])],
  ['change HEAD', (w) => w.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Unauthorized'])],
  ['add a file', (w) => w.write('review.txt', 'Unexpected review artifact')],
  ['edit documentation', (w) => w.write('AGENTS.md', 'Replaced standard')],
]) {
  test(`read-only review rejects attempts to ${label}`, async (t) => {
    const world = await repository(t);
    await checkPreserved(world);
    await change(world);
    await assert.rejects(checkPreserved(world), assert.AssertionError);
  });
}
