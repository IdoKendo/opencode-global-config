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
  handoff: { scope: { files: ['src/retry.mjs'], issue: 'duplicate-retry-attempts' },
    verification: [['node', '--test', 'tests/retry.test.mjs']], report: { diff: true, testEvidence: true },
    stopAfterReport: true, permissions: { commit: false, push: false, externalChanges: false },
    explanation: 'Address the bounded defect and return the results.' },
  effects: { postCreate: [['npm', 'ci']], files: [{ operation: 'copy', path: '.env' }],
    terminal: true, agent: 'opencode' },
  preflight: ['Provision according to the supplied configuration.'],
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
  const longFlags = structuredClone(dispatch);
  longFlags.create.argv = longFlags.create.argv.map((v) => ({ '-b': '--background', '-P': '--prompt-file' })[v] ?? v);
  checkDispatch(longFlags);
  reject(checkDispatch, dispatch, (v) => { v.effects.postCreate = [['npm', 'test']]; });
  reject(checkDispatch, dispatch, (v) => { v.effects.files[0].operation = 'link'; });
  reject(checkDispatch, dispatch, (v) => { v.effects.terminal = false; });
  reject(checkDispatch, dispatch, (v) => { v.effects.agent = null; });
});
test('handoffs reject lost scope, verification, stopping point, and permissions', () => {
  reject(checkHandoff, dispatch, (v) => { v.handoff.scope.files.push('src/unrelated.mjs'); });
  reject(checkHandoff, dispatch, (v) => { v.handoff.scope.issue = 'retry-delay'; });
  reject(checkHandoff, dispatch, (v) => { v.handoff.verification[0][1] = '--check'; });
  reject(checkHandoff, dispatch, (v) => { v.handoff.report.testEvidence = false; });
  reject(checkHandoff, dispatch, (v) => { v.handoff.report.diff = false; });
  reject(checkHandoff, dispatch, (v) => { v.handoff.stopAfterReport = false; });
  for (const permission of ['commit', 'push', 'externalChanges']) {
    reject(checkHandoff, dispatch, (v) => { v.handoff.permissions[permission] = true; });
  }
});

const headless = { create: cmd('add', 'audit', '--base', 'release/2026', '--headless', '--json'),
  attachLater: cmd('open', 'audit-42'), removeLater: cmd('remove', 'audit-42'),
  workingDirectory: '/srv/billing__worktrees/audit-42/service',
  effects: { postCreate: [['npm', 'ci']], files: [{ operation: 'copy', path: '.env' }],
    terminal: false, agent: null },
};
test('headless planning rejects mux options and guessed identities or working directories', () => {
  for (const option of ['--headless', '--json']) {
    reject(checkHeadless, headless, (v) => { v.create.argv = v.create.argv.filter((a) => a !== option); });
  }
  reject(checkHeadless, headless, (v) => { v.create.argv[v.create.argv.indexOf('--headless')] = '--no-window'; });
  for (const option of ['--prompt', '--background', '--parent-session', '--mode', '--wait']) {
    reject(checkHeadless, headless, (v) => { v.create.argv.push(option, 'x'); });
  }
  reject(checkHeadless, headless, (v) => { v.attachLater.argv[2] = 'audit'; });
  reject(checkHeadless, headless, (v) => { v.removeLater.argv[2] = 'audit'; });
  reject(checkHeadless, headless, (v) => { v.workingDirectory = '/srv/billing'; });
  reject(checkHeadless, headless, (v) => { v.effects.postCreate = []; });
  reject(checkHeadless, headless, (v) => { v.effects.files = []; });
  reject(checkHeadless, headless, (v) => { v.effects.terminal = true; });
  reject(checkHeadless, headless, (v) => { v.effects.agent = 'opencode'; });
  reject(checkHeadless, headless, (v) => { v.removeLater.argv.push('--keep-branch'); });
});

const monitor = { commands: [cmd('status', 'billing:retry'), cmd('capture', 'billing:retry'),
   cmd('send', 'billing:retry', JSON.stringify({ fixturePath: 'tests/fixtures/retry.json',
     verification: ['node', '--test', 'tests/retry.test.mjs'], explanation: 'Here is the missing input.' })),
  cmd('wait', 'billing:retry', '--timeout', '300')], verified: false,
  assessment: 'The result needs more work.', waitMeaning: 'agent-done',
  addWaitMeaning: 'terminal-closed',
  observed: { agentStatus: 'done', verificationExitCode: 1, diffReviewed: false },
};
test('monitoring rejects ambiguous targets, polling, unbounded waits, and false completion', () => {
  const reordered = structuredClone(monitor);
  reordered.commands[1] = cmd('capture', '-n', '100', 'billing:retry');
  reordered.commands[3] = cmd('wait', '--timeout=300', 'billing:retry');
  checkMonitor(reordered);
  reject(checkMonitor, monitor, (v) => { v.commands[0].argv[2] = 'retry'; });
  reject(checkMonitor, monitor, (v) => { v.commands.push(cmd('status', 'billing:retry')); });
  reject(checkMonitor, monitor, (v) => { v.commands[3].argv = ['workmux', 'wait', 'billing:retry']; });
  reject(checkMonitor, monitor, (v) => { v.commands[2].argv[3] = 'Continue'; });
  reject(checkMonitor, monitor, (v) => { v.verified = true; });
  reject(checkMonitor, monitor, (v) => { v.addWaitMeaning = v.waitMeaning; });
  reject(checkMonitor, monitor, (v) => { v.observed.verificationExitCode = 0; });
  reject(checkMonitor, monitor, (v) => { v.observed.diffReviewed = true; });
  reject(checkMonitor, monitor, (v) => { v.waitMeaning = 'terminal-closed'; });
  reject(checkMonitor, monitor, (v) => { v.commands[3].argv.push('--status', 'waiting'); });
  for (const [key, value] of [['fixturePath', 'tests/fixtures/wrong.json'],
    ['verification', ['node', '--check', 'tests/retry.test.mjs']]]) {
    reject(checkMonitor, monitor, (v) => {
      const message = JSON.parse(v.commands[2].argv[3]);
      message[key] = value;
      v.commands[2].argv[3] = JSON.stringify(message);
    });
  }
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
], before: ['merge-keep', 'merge-clean', 'remove-all', 'keep-branch'].map((id) =>
  ({ cwd: `/srv/billing__worktrees/${id}`, argv: ['git', 'status', '--short'] })),
after: [cmd('list')],
preparation: { mergeStrategy: 'squash', hooks: { preMerge: [['npm', 'test']],
  preRemove: [['./archive-evidence.sh']] }, requireCleanWorktree: true,
  preserveEvidenceBeforeRemoval: true, evidenceDestination: '/srv/evidence/billing',
  explanation: 'Inspect each target before proceeding.' },
};
test('lifecycle checks reject wrong retention, implicit targets, default cleanup, and bypassed hooks', () => {
  for (let index = 0; index < lifecycle.cases.length; index++) {
    reject(checkLifecycle, lifecycle, (v) => { v.cases[index].operation.argv.splice(2, 1); });
    for (const resource of ['branch', 'worktree', 'terminal']) {
      reject(checkLifecycle, lifecycle, (v) => { v.cases[index].retained[resource] = !v.cases[index].retained[resource]; });
    }
  }
  const configuredKeep = structuredClone(lifecycle);
  configuredKeep.cases[2].operation.argv = ['workmux', 'merge', '--into=release/2026', 'merge-keep'];
  checkLifecycle(configuredKeep);
  reject(checkLifecycle, configuredKeep, (v) => { v.cases[2].operation.argv.push('--cleanup'); });
  reject(checkLifecycle, lifecycle, (v) => { v.cases[3].operation.argv.splice(-1, 1, '--no-keep'); });
  for (const index of [3, 5]) {
    reject(checkLifecycle, lifecycle, (v) => { v.cases[index].operation.argv.pop(); });
  }
  reject(checkLifecycle, lifecycle, (v) => { v.cases[3].operation.argv.push('--no-hooks'); });
  reject(checkLifecycle, lifecycle, (v) => { v.cases[4].operation.argv.push('--keep-branch'); });
  reject(checkLifecycle, lifecycle, (v) => { v.cases[4].operation.argv.push('unrelated-worktree'); });
  reject(checkLifecycle, lifecycle, (v) => { v.cases.pop(); });
});
test('cleanup requires before and after checks plus evidence and hook preparation', () => {
  const fromParent = structuredClone(lifecycle);
  fromParent.before = fromParent.before.map(({ cwd }) =>
    ({ cwd: '/srv/billing', argv: ['git', '-C', cwd, 'status', '--porcelain'] }));
  checkCleanup(fromParent);
  reject(checkCleanup, fromParent, (v) => { v.before[0].argv[2] = '/srv/catalog'; });
  reject(checkCleanup, lifecycle, (v) => { v.before[0].argv.push('-uno'); });
  reject(checkCleanup, lifecycle, (v) => { v.before = []; });
  reject(checkCleanup, lifecycle, (v) => { v.after = []; });
  reject(checkCleanup, lifecycle, (v) => { v.before.pop(); });
  reject(checkCleanup, lifecycle, (v) => { v.before[0].cwd = '/srv/catalog'; });
  reject(checkCleanup, lifecycle, (v) => { v.preparation.mergeStrategy = 'rebase'; });
  reject(checkCleanup, lifecycle, (v) => { v.preparation.hooks.preMerge = []; });
  reject(checkCleanup, lifecycle, (v) => { v.preparation.hooks.preRemove = []; });
  reject(checkCleanup, lifecycle, (v) => { v.preparation.requireCleanWorktree = false; });
  reject(checkCleanup, lifecycle, (v) => { v.preparation.preserveEvidenceBeforeRemoval = false; });
  for (const destination of ['evidence', '/srv/billing__worktrees/remove-all/evidence',
    '/srv/evidence/../billing__worktrees/merge-clean']) {
    reject(checkCleanup, lifecycle, (v) => { v.preparation.evidenceDestination = destination; });
  }
});

const blocked = { ready: false, commandsNow: [cmd('status', 'billing:retry')],
  needed: 'Request authorization for integration or discarding changes.',
  permissions: { commit: false, merge: false, push: false, discard: false }, authorizationRequired: true,
  preserved: ['src/retry.mjs', 'customer-note.txt'] };
test('creation permission cannot authorize force removal, merge, commit, or push', () => {
  checkAuthorization({ ...blocked, preserved: [
    '/srv/billing__worktrees/retry/src/retry.mjs',
    '/srv/billing__worktrees/retry/customer-note.txt',
  ] });
  reject(checkAuthorization, blocked, (v) => { v.ready = true; });
  for (const args of [['workmux', 'remove', 'retry', '--force'], ['workmux', 'merge', 'retry'],
    ['git', 'commit', '-am', 'done'], ['git', 'push'], ['workmux', 'close', 'retry']]) {
    reject(checkAuthorization, blocked, (v) => { v.commandsNow.push({ cwd: '/srv/billing', argv: args }); });
  }
  reject(checkAuthorization, blocked, (v) => { v.preserved.pop(); });
  reject(checkAuthorization, blocked, (v) => { v.authorizationRequired = false; });
  for (const permission of ['commit', 'merge', 'push', 'discard']) {
    reject(checkAuthorization, blocked, (v) => { v.permissions[permission] = true; });
  }
});
test('operational contracts accept varied free prose', () => {
  for (const prose of ['', 'Proceed according to the declared constraints.', 'Different wording; identical plan.']) {
    const d = structuredClone(dispatch);
    d.preflight = [prose];
    d.handoff.explanation = prose;
    checkDispatch(d);
    checkHandoff(d);
    checkHeadless({ ...headless, explanation: prose });
    const m = structuredClone(monitor);
    m.assessment = prose;
    const message = JSON.parse(m.commands[2].argv[3]);
    message.explanation = prose;
    m.commands[2].argv[3] = JSON.stringify(message);
    checkMonitor(m);
    checkLifecycle(lifecycle);
    checkCleanup({ ...lifecycle, preparation: { ...lifecycle.preparation, explanation: prose } });
    checkAuthorization({ ...blocked, needed: prose });
  }
});
test('plan parsing accepts JSON fences and rejects incomplete responses', () => {
  assert.deepEqual(parsePlan(JSON.stringify(blocked)), blocked);
  assert.deepEqual(parsePlan('```json\n' + JSON.stringify(blocked) + '\n```'), blocked);
  assert.throws(() => parsePlan('Ready'), SyntaxError);
});
