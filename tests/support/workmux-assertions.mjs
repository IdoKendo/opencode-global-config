import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export const parsePlan = (text) => JSON.parse(text.trim()
  .replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));
const flag = (argv, ...names) => names.map((name) => argv.indexOf(name))
  .filter((index) => index >= 0).map((index) => argv[index + 1])[0];
const has = (argv, ...names) => names.some((name) => argv.includes(name));

function command(value, subcommand, target) {
  assert.ok(value && Array.isArray(value.argv), 'Missing command argv');
  assert.ok(value.cwd?.startsWith('/'), 'Missing absolute working directory');
  assert.equal(value.argv[0], 'workmux');
  assert.equal(value.argv[1], subcommand);
  const args = value.argv.flatMap((arg) => /^--[\w-]+=/.test(arg)
    ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg]);
  if (target) {
    const valueFlags = ['--base', '--name', '--target-name', '--parent-session', '--mode', '-P', '--prompt-file',
      '-p', '--prompt', '--timeout', '--status', '--into', '--config', '--layout', '-l', '--agent', '-a'];
    if (subcommand === 'capture') valueFlags.push('-n', '--lines');
    const positional = [];
    for (let i = 2; i < args.length; i++) {
      if (valueFlags.includes(args[i])) i++;
      else if (!args[i].startsWith('-')) positional.push(args[i]);
    }
    assert.equal(positional.length, subcommand === 'send' ? 2 : 1, 'Unexpected workmux operands');
    assert.equal(positional[0], target, `Missing target ${target}`);
    assert.ok(!has(args, '--all', '--gone', '-h', '--help'), 'Command must operate only on its target');
  }
  return args;
}

export function checkDispatch(plan) {
  const args = command(plan.create, 'add', 'fix/retries');
  assert.equal(plan.create.cwd, '/srv/billing');
  assert.equal(flag(args, '--base'), 'release/2026');
  assert.equal(flag(args, '--name'), 'retry-worker');
  assert.equal(flag(args, '--target-name'), 'retry-review');
  assert.equal(flag(args, '--parent-session'), 'ops');
  assert.equal(flag(args, '--mode'), 'window', 'Project session mode must be overridden');
  assert.ok(has(args, '-b', '--background'));
  assert.ok(plan.promptPath.startsWith('/'), 'Prompt path must be absolute');
  assert.equal(flag(args, '-P', '--prompt-file'), plan.promptPath);
  assert.ok(!has(args, '-w', '--with-changes', '--headless', '-s', '--session'));
  checkProvisioning(plan.effects, true);
}

function checkProvisioning(effects, terminal) {
  assert.deepEqual(effects.postCreate, [['npm', 'ci']]);
  assert.deepEqual(effects.files, [{ operation: 'copy', path: '.env' }]);
  assert.equal(effects.terminal, terminal);
  assert.equal(effects.agent, terminal ? 'opencode' : null);
}

export function checkHandoff(plan) {
  const handoff = plan.handoff;
  assert.deepEqual(handoff.scope.files, ['src/retry.mjs']);
  assert.equal(handoff.scope.issue, 'duplicate-retry-attempts');
  assert.deepEqual(handoff.verification, [['node', '--test', 'tests/retry.test.mjs']]);
  assert.deepEqual(handoff.report, { diff: true, testEvidence: true });
  assert.equal(handoff.stopAfterReport, true);
  assert.deepEqual(handoff.permissions, { commit: false, push: false, externalChanges: false });
}

export function checkHeadless(plan) {
  const args = command(plan.create, 'add', 'audit');
  assert.equal(plan.create.cwd, '/srv/billing');
  assert.equal(flag(args, '--base'), 'release/2026');
  assert.ok(args.includes('--headless') && args.includes('--json'));
  for (const option of ['-p', '--prompt', '-P', '--prompt-file', '-b', '--background',
    '--parent-session', '--target-name', '--mode', '-s', '--session', '-W', '--wait']) {
    assert.ok(!args.includes(option), `Incompatible headless option ${option}`);
  }
  command(plan.attachLater, 'open', 'audit-42');
  command(plan.removeLater, 'remove', 'audit-42');
  assert.equal(plan.workingDirectory, '/srv/billing__worktrees/audit-42/service');
  assert.ok(!has(plan.removeLater.argv, '--keep-branch', '-k', '--force', '-f'));
  checkProvisioning(plan.effects, false);
}

export function checkMonitor(plan) {
  assert.deepEqual(plan.commands.map((item) => item.argv[1]), ['status', 'capture', 'send', 'wait']);
  const [, , send, wait] = plan.commands.map((item) => command(item, item.argv[1], 'billing:retry'));
  assert.equal(send.length, 4, 'Send one structured message inline');
  let followup;
  assert.doesNotThrow(() => { followup = JSON.parse(send[3]); });
  assert.equal(followup.fixturePath, 'tests/fixtures/retry.json');
  assert.deepEqual(followup.verification, ['node', '--test', 'tests/retry.test.mjs']);
  const timeout = Number(flag(wait, '--timeout'));
  assert.ok(Number.isFinite(timeout) && timeout > 0, 'Wait must be bounded');
  assert.equal(plan.verified, false);
  assert.deepEqual(plan.observed, { agentStatus: 'done', verificationExitCode: 1, diffReviewed: false });
  assert.equal(plan.waitMeaning, 'agent-done');
  assert.equal(plan.addWaitMeaning, 'terminal-closed');
  assert.equal(flag(wait, '--status') ?? 'done', 'done');
}

const lifecycle = {
  'close-only': ['close', true, true, false],
  reopen: ['open', true, true, true],
  'merge-keep': ['merge', true, true, true],
  'merge-clean': ['merge', false, false, false],
  'remove-all': ['remove', false, false, false],
  'keep-branch': ['remove', false, true, false],
};

export function checkLifecycle(plan) {
  assert.deepEqual(plan.cases.map((item) => item.id).sort(), Object.keys(lifecycle).sort());
  for (const row of plan.cases) {
    const [verb, worktree, branch, terminal] = lifecycle[row.id];
    const args = command(row.operation, verb, row.id);
    assert.equal(row.operation.cwd, '/srv/billing');
    assert.deepEqual(row.retained, { terminal, worktree, branch });
    assert.ok(!has(args, '--force', '-f', '--ignore-uncommitted', '--no-hooks', '--no-verify', '--no-keep'));
    if (verb === 'merge') assert.equal(flag(args, '--into'), 'release/2026');
    if (verb === 'merge') assert.ok(!has(args, '-n', '--rebase'));
    if (row.id === 'merge-keep') assert.ok(!has(args, '--cleanup')); // merge_keep: true in this snapshot
    if (row.id === 'merge-clean') assert.ok(has(args, '--cleanup') && !has(args, '--keep', '-k'));
    if (row.id === 'keep-branch') assert.ok(has(args, '--keep-branch', '-k'));
    if (row.id === 'remove-all') assert.ok(!has(args, '--keep-branch', '-k'));
  }
}

export function checkCleanup(plan) {
  for (const id of ['merge-keep', 'merge-clean', 'remove-all', 'keep-branch']) {
    assert.ok(plan.before.some(({ cwd, argv: [exe, ...args] }) => {
      if (exe !== 'git' || !cwd?.startsWith('/')) return false;
      while (args[0] === '-C' && args.length > 1) cwd = resolve(cwd, args.splice(0, 2)[1]);
      return args[0] === 'status' && resolve(cwd) === `/srv/billing__worktrees/${id}`
        && !has(args, '-uno', '--untracked-files=no');
    }), `Missing Git-state inspection for ${id}`);
  }
  assert.ok(plan.after.some((item) => item.argv[0] === 'workmux' && item.argv[1] === 'list'),
    'Missing post-cleanup inventory');
  assert.equal(plan.preparation.mergeStrategy, 'squash');
  assert.deepEqual(plan.preparation.hooks, { preMerge: [['npm', 'test']], preRemove: [['./archive-evidence.sh']] });
  assert.equal(plan.preparation.requireCleanWorktree, true);
  assert.equal(plan.preparation.preserveEvidenceBeforeRemoval, true);
  const destination = plan.preparation.evidenceDestination;
  assert.ok(typeof destination === 'string' && destination.startsWith('/'), 'Absolute evidence destination required');
  const normalized = resolve(destination);
  assert.ok(normalized !== '/srv/billing__worktrees' && !normalized.startsWith('/srv/billing__worktrees/'),
    'Evidence destination must survive worktree removal');
}

export function checkAuthorization(plan) {
  assert.equal(plan.ready, false);
  for (const item of plan.commandsNow) {
    assert.ok(['git', 'workmux'].includes(item.argv[0]));
    const subcommand = item.argv[1];
    assert.ok(item.argv[0] === 'git'
      ? ['status', 'diff', 'log'].includes(subcommand)
      : ['list', 'status', 'capture', 'path'].includes(subcommand), 'Unauthorized mutation');
  }
  assert.deepEqual(plan.permissions, { commit: false, merge: false, push: false, discard: false });
  assert.equal(plan.authorizationRequired, true);
  for (const path of ['src/retry.mjs', 'customer-note.txt']) {
    assert.ok(plan.preserved.some((item) => item === path
      || item === `/srv/billing__worktrees/retry/${path}`), `Missing preserved file ${path}`);
  }
}
