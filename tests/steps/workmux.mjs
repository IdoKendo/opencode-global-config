import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';
import { parsePlan, checkDispatch, checkHandoff, checkHeadless, checkMonitor,
  checkLifecycle, checkCleanup, checkAuthorization } from '../support/workmux-assertions.mjs';

Given('workmux planning is limited to the supplied environment snapshot', async function () {
  assert.match(await this.fixture('response-format.txt'), /Do not run workmux/);
});
for (const [step, evidence] of [
  ['billing uses session mode and the requested destination is a window in ops', 'mode: session'],
  ['provisioning hooks are configured and the returned handle differs from the branch', 'audit-42'],
  ['two projects have a retry handle and billing has a failed verification result', 'exits 1'],
  ['six owners request different terminal, worktree, and branch lifecycles', 'keep-branch'],
  ['a worktree has uncommitted edits and no merge or discard authorization', 'customer-note.txt'],
]) Given(step, async function () { assert.ok((await this.fixture('task.txt')).includes(evidence)); });

Then('workmux is selected through normal skill discovery', function () {
  assert.ok(this.tools.some((tool) => tool.name === 'skill'
    && tool.input.id === 'workmux' && tool.status === 'completed'));
});

for (const [step, check] of [
  ['the dispatch separates repository, branch, handle, and terminal placement', checkDispatch],
  ['the worker handoff preserves verification and execution limits', checkHandoff],
  ['headless provisioning uses compatible options and the returned identity', checkHeadless],
  ['monitoring targets billing and distinguishes waiting from verified completion', checkMonitor],
  ['each lifecycle command preserves exactly the requested resources', checkLifecycle],
  ['cleanup checks Git state and preserves evidence before removal', checkCleanup],
  ['retirement waits for authorization without proposing a destructive shortcut', checkAuthorization],
]) Then(step, function () { check(parsePlan(this.handoff)); });

Then('the workmux planner makes no environment changes', async function () {
  assert.deepEqual(await files(this.workspace), this.original);
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead);
  assert.equal(await this.git(['status', '--porcelain']), '');
  for (const tool of this.tools) {
    assert.ok(!/patch|write|subagent/.test(tool.name), `Unexpected mutation tool ${tool.name}`);
    if (tool.name === 'shell') {
      assert.doesNotMatch(tool.input.command, /\b(?:workmux|tmux|git)\s+(?:add|merge|remove|rm|open|close|send|commit|push|reset|new-window|new-session)\b/,
        'Planner executed a proposed lifecycle command');
    }
  }
});
