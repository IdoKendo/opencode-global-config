import assert from 'node:assert/strict';

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
  if (target) assert.ok(value.argv.includes(target), `Missing target ${target}`);
  return value.argv;
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
  const preflight = plan.preflight.join(' ');
  assert.match(preflight, /npm ci/);
  assert.match(preflight, /\.env/);
  assert.match(preflight, /opencode|agent|pane/i);
}

export function checkHandoff(plan) {
  for (const pattern of [/src\/retry\.mjs/, /duplicate/i,
    /node[\s\S]*--test[\s\S]*tests\/retry\.test\.mjs/, /diff/i, /stop/i]) {
    assert.match(plan.handoff, pattern);
  }
  assert.match(plan.handoff, /(?:no|not|never|without)[^.\n]*(?:commit|push)/i);
  assert.match(plan.handoff, /(?:no|not|never|without)[^.\n]*external/i);
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
  assert.match(plan.effects, /npm ci/);
  assert.match(plan.effects, /\.env/);
  assert.match(plan.effects, /(?:no|not|without)[^.\n]*(?:agent|terminal|tmux)/i);
}

export function checkMonitor(plan) {
  assert.deepEqual(plan.commands.map((item) => item.argv[1]), ['status', 'capture', 'send', 'wait']);
  for (const item of plan.commands) command(item, item.argv[1], 'billing:retry');
  const followup = plan.commands[2].argv.join(' ');
  assert.match(followup, /tests\/fixtures\/retry\.json/);
  assert.match(followup, /node --test tests\/retry\.test\.mjs/);
  const timeout = Number(flag(plan.commands[3].argv, '--timeout'));
  assert.ok(Number.isFinite(timeout) && timeout > 0, 'Wait must be bounded');
  assert.equal(plan.verified, false);
  assert.match(plan.assessment, /fail|exit(?:s)? 1/i);
  assert.match(plan.waitMeaning, /done|agent.*complet/i);
  assert.match(plan.addWaitMeaning, /(?:window|terminal).*clos/i);
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
    assert.ok(!has(args, '--force', '-f', '--ignore-uncommitted', '--no-hooks', '--no-verify'));
    if (verb === 'merge') assert.equal(flag(args, '--into'), 'release/2026');
    if (row.id === 'merge-keep') assert.ok(has(args, '--keep', '-k') && !has(args, '--cleanup'));
    if (row.id === 'merge-clean') assert.ok(has(args, '--cleanup') && !has(args, '--keep', '-k'));
    if (row.id === 'keep-branch') assert.ok(has(args, '--keep-branch', '-k'));
    if (row.id === 'remove-all') assert.ok(!has(args, '--keep-branch', '-k'));
  }
}

export function checkCleanup(plan) {
  assert.ok(plan.before.some((item) => item.argv[0] === 'git' && item.argv.includes('status')),
    'Missing Git-state inspection before cleanup');
  assert.ok(plan.after.some((item) => item.argv[0] === 'workmux' && item.argv[1] === 'list'),
    'Missing post-cleanup inventory');
  for (const pattern of [/squash/i, /npm test/, /archive-evidence\.sh/,
    /evidence/i, /outside|external|surviv|preserv/i]) assert.match(plan.preparation, pattern);
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
  assert.match(plan.needed, /authoriz|approv|permission|consent/i);
  for (const path of ['src/retry.mjs', 'customer-note.txt']) {
    assert.ok(plan.preserved.some((item) => item.includes(path)), `Missing preserved file ${path}`);
  }
}
