import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';
import { onlyChanges } from '../support/workspace.mjs';

Given('the export contract fixes CSV as the format and Downloads as the destination', async function () {
  assert.match(await this.read('README.md'), /CSV file to Downloads/);
});

Then('the requested design-interview skill is loaded', function () {
  assert.ok(this.tools.some(({ name, input, status }) =>
    name === 'skill' && input.id === 'design-interview' && status === 'completed'));
});

Then('the agent asks one question about handling the existing file', function () {
  const { questions } = tracker(this.handoff);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].field, 'collisionPolicy');
  assert.deepEqual([...questions[0].choices].sort(), ['Keep both', 'Replace']);
});

function tracker(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1'));
}

Then('the brief confirms Keep both and leaves the suffix undecided', function () {
  const { confirmed, open } = tracker(this.handoff);
  assert.deepEqual(confirmed, [{ field: 'collisionPolicy', value: 'Keep both' }]);
  assert.deepEqual(open, ['suffix']);
});

Then('the interview leaves the workspace and Git unchanged', async function () {
  await onlyChanges(this);
});
