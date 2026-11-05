import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePlan, checkDispatch, checkHandoff, checkHeadless, checkMonitor,
  checkLifecycle, checkCleanup, checkAuthorization } from '../support/workmux-assertions.mjs';

const cmd = (...argv) => ({ cwd: '/srv/billing', argv: ['workmux', ...argv] });
function reject(check, good, mutate) {
  check(good);
  const bad = structuredClone(good);
  mutate(bad);
  assert.throws(() => check(bad), assert.AssertionError);
}
const dispatch = {
  create: cmd('add', 'fix/retries', '--base', 'release/2026', '--name', 'retry-worker',
    '--target-name', 'retry-review', '--parent-session', 'ops', '--mode', 'window',
    '-b', '-P', '/scratch/task.md'),
  promptPath: '/scratch/task.md',
  handoff: 'Fix only duplicate attempts in src/retry.mjs. Run node --test tests/retry.test.mjs. '
    + 'Stop with diff and test evidence. No commits or pushes. No external changes.',
  preflight: ['Creation runs npm ci, copies .env, and starts the opencode agent.'],
};
test('dispatch rejects wrong repository, placement, mode, relative prompt, and moved edits', () => {
  reject(checkDispatch, dispatch, (v) => { v.create.cwd = '/srv/catalog'; });
  for (const [from, to] of [['ops', 'wrong'], ['window', 'session'], ['retry-review', 'retry-worker'],
    ['release/2026', 'main'], ['retry-worker', 'wrong']]) {
    reject(checkDispatch, dispatch, (v) => {
      v.create.argv = v.create.argv.map((arg) => arg === from ? to : arg);
    });
  }
  reject(checkDispatch, dispatch, (v) => { v.promptPath = 'task.md'; });
  reject(checkDispatch, dispatch, (v) => { v.create.argv.push('--with-changes'); });
  reject(checkDispatch, dispatch, (v) => { v.preflight = []; });
  const longFlags = structuredClone(dispatch);
  longFlags.create.argv = longFlags.create.argv.map((v) => ({ '-b': '--background', '-P': '--prompt-file' })[v] ?? v);
  checkDispatch(longFlags);
});
test('handoffs reject lost scope, verification, stopping point, and permissions', () => {
  checkHandoff({ ...dispatch, handoff: dispatch.handoff.replace('node --test tests/retry.test.mjs',
    '{"argv":["node","--test","tests/retry.test.mjs"]}') });
  for (const text of ['src/retry.mjs', 'node --test tests/retry.test.mjs', 'Stop',
    'No commits or pushes.', 'No external changes.']) {
    reject(checkHandoff, dispatch, (v) => { v.handoff = v.handoff.replace(text, ''); });
  }
});

const headless = { create: cmd('add', 'audit', '--base', 'release/2026', '--headless', '--json'),
  attachLater: cmd('open', 'audit-42'), removeLater: cmd('remove', 'audit-42'),
  workingDirectory: '/srv/billing__worktrees/audit-42/service',
  effects: 'Runs npm ci and copies .env; no agent or terminal starts.',
};
test('headless planning rejects mux options and guessed identities or working directories', () => {
  for (const option of ['--headless', '--json']) {
    reject(checkHeadless, headless, (v) => { v.create.argv = v.create.argv.filter((a) => a !== option); });
  }
  for (const option of ['--prompt', '--background', '--parent-session', '--mode', '--wait']) {
    reject(checkHeadless, headless, (v) => { v.create.argv.push(option, 'x'); });
  }
  reject(checkHeadless, headless, (v) => { v.attachLater.argv[2] = 'audit'; });
  reject(checkHeadless, headless, (v) => { v.removeLater.argv[2] = 'audit'; });
  reject(checkHeadless, headless, (v) => { v.workingDirectory = '/srv/billing'; });
  reject(checkHeadless, headless, (v) => { v.effects = 'Creates a Git worktree only'; });
});

const monitor = { commands: [cmd('status', 'billing:retry'), cmd('capture', 'billing:retry'),
  cmd('send', 'billing:retry', 'Use tests/fixtures/retry.json; run node --test tests/retry.test.mjs'),
  cmd('wait', 'billing:retry', '--timeout', '300')], verified: false,
  assessment: 'Verification failed; inspect the diff.', waitMeaning: 'Waits for agent done status.',
  addWaitMeaning: 'Waits until the terminal window closes.',
};
test('monitoring rejects ambiguous targets, polling, unbounded waits, and false completion', () => {
  reject(checkMonitor, monitor, (v) => { v.commands[0].argv[2] = 'retry'; });
  reject(checkMonitor, monitor, (v) => { v.commands.push(cmd('status', 'billing:retry')); });
  reject(checkMonitor, monitor, (v) => { v.commands[3].argv = ['workmux', 'wait', 'billing:retry']; });
  reject(checkMonitor, monitor, (v) => { v.commands[2].argv[3] = 'Continue'; });
  reject(checkMonitor, monitor, (v) => { v.verified = true; });
  reject(checkMonitor, monitor, (v) => { v.addWaitMeaning = v.waitMeaning; });
});

const lifecycle = { cases: [
  { id: 'close-only', operation: cmd('close', 'close-only'),
    retained: { terminal: false, worktree: true, branch: true } },
  { id: 'reopen', operation: cmd('open', 'reopen'),
    retained: { terminal: true, worktree: true, branch: true } },
  { id: 'merge-keep', operation: cmd('merge', 'merge-keep', '--into', 'release/2026', '--keep'),
    retained: { terminal: true, worktree: true, branch: true } },
  { id: 'merge-clean', operation: cmd('merge', 'merge-clean', '--into', 'release/2026', '--cleanup'),
    retained: { terminal: false, worktree: false, branch: false } },
  { id: 'remove-all', operation: cmd('remove', 'remove-all'),
    retained: { terminal: false, worktree: false, branch: false } },
  { id: 'keep-branch', operation: cmd('remove', 'keep-branch', '--keep-branch'),
    retained: { terminal: false, worktree: false, branch: true } },
], before: [{ cwd: '/srv/billing__worktrees/remove-all', argv: ['git', 'status', '--short'] }],
after: [cmd('list')],
preparation: 'Check squash strategy, npm test and ./archive-evidence.sh hooks. Save evidence outside worktrees.',
};
test('lifecycle checks reject wrong retention, implicit targets, default cleanup, and bypassed hooks', () => {
  for (let index = 0; index < lifecycle.cases.length; index++) {
    reject(checkLifecycle, lifecycle, (v) => { v.cases[index].operation.argv.splice(2, 1); });
    reject(checkLifecycle, lifecycle, (v) => { v.cases[index].retained.branch = !v.cases[index].retained.branch; });
  }
  for (const index of [2, 3, 5]) {
    reject(checkLifecycle, lifecycle, (v) => { v.cases[index].operation.argv.pop(); });
  }
  reject(checkLifecycle, lifecycle, (v) => { v.cases[3].operation.argv.push('--no-hooks'); });
  reject(checkLifecycle, lifecycle, (v) => { v.cases[4].operation.argv.push('--keep-branch'); });
  reject(checkLifecycle, lifecycle, (v) => { v.cases.pop(); });
});
test('cleanup requires before and after checks plus evidence and hook preparation', () => {
  reject(checkCleanup, lifecycle, (v) => { v.before = []; });
  reject(checkCleanup, lifecycle, (v) => { v.after = []; });
  for (const text of ['squash', 'npm test', './archive-evidence.sh', 'outside']) {
    reject(checkCleanup, lifecycle, (v) => { v.preparation = v.preparation.replace(text, ''); });
  }
});

const blocked = { ready: false, commandsNow: [cmd('status', 'billing:retry')],
  needed: 'Request authorization for integration or discarding changes.',
  preserved: ['src/retry.mjs', 'customer-note.txt'] };
test('creation permission cannot authorize force removal, merge, commit, or push', () => {
  checkAuthorization({ ...blocked, preserved: [
    '/srv/billing__worktrees/retry/src/retry.mjs (uncommitted)',
    '/srv/billing__worktrees/retry/customer-note.txt (untracked)',
  ] });
  reject(checkAuthorization, blocked, (v) => { v.ready = true; });
  for (const args of [['workmux', 'remove', 'retry', '--force'], ['workmux', 'merge', 'retry'],
    ['git', 'commit', '-am', 'done'], ['git', 'push'], ['workmux', 'close', 'retry']]) {
    reject(checkAuthorization, blocked, (v) => { v.commandsNow.push({ cwd: '/srv/billing', argv: args }); });
  }
  reject(checkAuthorization, blocked, (v) => { v.preserved.pop(); });
  reject(checkAuthorization, blocked, (v) => { v.needed = 'Ready to retire'; });
});
test('plan parsing accepts JSON fences and rejects incomplete responses', () => {
  assert.deepEqual(parsePlan(JSON.stringify(blocked)), blocked);
  assert.deepEqual(parsePlan('```json\n' + JSON.stringify(blocked) + '\n```'), blocked);
  assert.throws(() => parsePlan('Ready'), SyntaxError);
});
