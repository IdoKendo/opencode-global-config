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
  assert.equal(this.handoff.split('?').length - 1, 1, 'Expected one interview question');
  const question = this.handoff.match(/[^.!?\n]*\?/)[0];
  const collision = /replac|overwrit|keep both|collision|already exists|previous (?:file|export)|existing (?:file|export)|same (?:month|name|file)|another copy/i;
  if (!collision.test(question)) {
    assert.match(this.handoff, collision);
    assert.match(question, /which (?:of (?:these|those|the two)|option|policy|behavio[u]?r|approach|outcome|one)|what should happen|which (?:do|would) you (?:prefer|choose)|agree with (?:that|this)|go with (?:that|this)|(?:that|this) work for you/i);
  }
  assert.doesNotMatch(question, /(?:which|what) (?:file )?(?:format|folder|directory|destination)|where (?:do|should|will)|(?:is|should) (?:it|the (?:format|destination)) (?:be )?(?:CSV|Downloads)/i);
});

Then('the brief confirms Keep both and leaves the suffix undecided', function () {
  const { confirmed, open } = JSON.parse(this.handoff.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ''));
  assert.ok([confirmed, open].every((list) => Array.isArray(list) && list.every((s) => typeof s === 'string')));
  const keepBoth = /keep both|preserve both|retain both|separate (?:file|copy)|save (?:another|a new) copy|both (?:copies|files|exports)/i;
  const naming = /suffix|timestamp|naming|name (?:the |each )?(?:new|second|additional) (?:file|copy)/i;
  assert.ok(confirmed.some((s) => keepBoth.test(s)), 'Missing confirmed copy policy');
  assert.ok(open.some((s) => naming.test(s)), 'Missing open suffix decision');
  assert.ok(!confirmed.some((s) => /timestamp/i.test(s) && !/undecided|unresolved|not (?:yet )?(?:chosen|decided|confirmed)|defer|open question|pending/i.test(s)),
    'Timestamp promoted to an agreement');
  assert.ok(!open.some((s) => /whether (?:to |we (?:should |will ))?keep both/i.test(s)), 'Reopened confirmed policy');
});

Then('the interview leaves the workspace and Git unchanged', async function () {
  await onlyChanges(this);
});
