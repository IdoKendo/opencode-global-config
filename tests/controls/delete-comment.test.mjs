import assert from 'node:assert/strict';
import test from 'node:test';
import { checkCounts, checkDelayRename, checkHeading } from '../support/comment-cleanup.mjs';

test('distinguish comment removal from damage to the literal or retained narration', () => {
  const source = "export const heading = () => '# Report';";
  checkHeading(source);
  assert.throws(() => checkHeading(source.replace('# ', '')));
  assert.throws(() => checkHeading(source + ' // return the heading'));
});

test('inline cleanup contributes a block but no physical line', () => {
  checkCounts('Cleanup complete\n{"blocksRemoved":2,"linesRemoved":2}');
  assert.throws(() => checkCounts('{"blocksRemoved":2,"linesRemoved":3}'));
  assert.throws(() => checkCounts('{"blocksRemoved":1,"linesRemoved":2}'));
});

test('the follow-up identifies the parameter and expresses milliseconds through its name', () => {
  const report = (from, to) => JSON.stringify({ edits: [{ from, to }] });
  checkDelayRename(report('delay', 'retryDelayMs'));
  checkDelayRename(report('delay', 'milliseconds'));
  assert.throws(() => checkDelayRename(report('task', 'delayMs')));
  assert.throws(() => checkDelayRename(report('delay', 'delaySeconds')));
  assert.throws(() => checkDelayRename(report('delay', 'toMilliseconds(delay)')));
});
