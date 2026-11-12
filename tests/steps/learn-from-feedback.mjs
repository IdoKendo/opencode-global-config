import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';

const recommendation = (world) => JSON.parse(world.handoff.trim()
  .replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));

function consolePolicy(value, enabled) {
  assert.deepEqual(value.rule, { id: 'no-console', currentlyEnabled: enabled,
    proposedSeverity: 'error', allowedMethods: [] }, 'Incorrect console policy');
  assert.equal(value.replacement?.targetCategory, 'application-logger', 'Missing application logger replacement');
  const source = value.replacement.source;
  if (source !== 'console.log') {
    const location = /^(.+):([1-9]\d*)$/.exec(String(source));
    assert.ok(location, 'Missing source location');
    const [, path, line] = location;
    assert.equal(path, 'src/worker.js', 'Replacement references the wrong source');
    const lines = readFileSync(new URL('../fixtures/learn-from-feedback/lint/src/worker.js', import.meta.url), 'utf8').split('\n');
    assert.ok(lines[Number(line) - 1]?.includes('console.log'), 'Source reference does not identify the console call');
  }
  assert.equal(value.deferUntilRepeated, false, 'Single occurrence incorrectly deferred');
}

Then('learn-from-feedback is selected through normal skill discovery', function () {
  assert.ok(this.tools.some((tool) => tool.name === 'skill'
    && tool.input.id === 'learn-from-feedback' && tool.status === 'completed'),
  'Missing successful learn-from-feedback selection');
});

Then('the feedback recommendation enables the existing console rule', function () {
  const value = recommendation(this);
  assert.equal(value.action, 'configure-tool');
  assert.equal(value.target, 'eslint.config.mjs');
  consolePolicy(value, false);
});

Then('the feedback recommendation repairs the missing lint invocation', function () {
  const value = recommendation(this);
  assert.equal(value.action, 'repair-execution');
  assert.equal(value.target, 'package.json');
  consolePolicy(value, true);
  assert.equal(value.execution?.script, 'ci');
  assert.deepEqual(value.execution.current, [['node', '--check', 'src/worker.js']],
    'Incorrect current CI execution path');
  assert.deepEqual(value.execution.proposed.map((argv) => JSON.stringify(argv)).sort(),
    [['npm', 'run', 'lint'], ['node', '--check', 'src/worker.js']].map((argv) => JSON.stringify(argv)).sort(),
    'CI must enforce lint and preserve syntax verification');
});

Then('the feedback recommendation improves investigation guidance and preserves the exception', function () {
  const value = recommendation(this);
  assert.equal(value.action, 'update-guidance');
  assert.equal(value.target, '.opencode/skills/change-investigation/SKILL.md');
  assert.equal(value.deferUntilRepeated, false);
  for (const [line, decision] of [[4, 'adopt'], [7, 'reject']]) {
    assert.ok(value.feedbackDecisions.some((item) => item.source === 'review.md'
      && item.line === line && item.decision === decision), `Incorrect decision for review.md:${line}`);
    assert.ok(!value.feedbackDecisions.some((item) => item.source === 'review.md'
      && item.line === line && item.decision !== decision), 'Conflicting review decisions');
  }
  assert.ok(value.retainedRequirements.some((item) => item.source === 'review.md'
    && item.line === 8 && item.value === 120 && item.unit === 'seconds'),
  'Missing archive timeout requirement');
});

Then('the feedback analysis leaves the workspace and Git history unchanged', async function () {
  assert.deepEqual(await files(this.workspace), this.original, 'Feedback analysis changed files');
  assert.equal(await this.git(['status', '--porcelain']), '', 'Feedback analysis changed the index');
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead, 'Feedback analysis committed');
});
