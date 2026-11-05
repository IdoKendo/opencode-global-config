import assert from 'node:assert/strict';
import { Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';

const plain = (text) => text.replace(/[`*_]/g, '');

Then('learn-from-feedback is selected through normal skill discovery', function () {
  assert.ok(this.tools.some((tool) => tool.name === 'skill'
    && tool.input.id === 'learn-from-feedback' && tool.status === 'completed'),
  'Missing successful learn-from-feedback selection');
});

Then('the feedback recommendation enables the existing console rule', function () {
  const text = plain(this.handoff);
  assert.match(text, /(?:enable|add|set|configur\w*)[^.\n]*no-console|no-console[^.\n]*(?:error|enable)/i,
    'Missing recommendation to enable no-console');
  assert.match(text, /eslint\.config\.mjs/, 'Missing existing configuration destination');
  assert.match(text, /logger/i, 'Missing intended replacement');
  assert.doesNotMatch(text, /(?:wait|only|need|require)[^.\n]*(?:repeat|twice|second occurrence)/i,
    'Single occurrence incorrectly deferred');
});

Then('the feedback recommendation repairs the missing lint invocation', function () {
  const text = plain(this.handoff);
  assert.match(text, /no-console/, 'Missing existing rule');
  assert.match(text, /(?:already|enabled|configured)/i, 'Missing current coverage');
  assert.match(text, /npm run lint/, 'Missing lint invocation recommendation');
  assert.match(text, /(?:npm run ci|["']?ci["']?\s*:|CI script)/i, 'Missing CI execution gap');
  assert.match(text, /node --check|syntax.only|syntax check/i, 'Missing reason CI missed the error');
});

Then('the feedback recommendation improves investigation guidance and preserves the exception', function () {
  const text = plain(this.handoff);
  assert.match(text, /change-investigation/, 'Missing existing skill destination');
  assert.match(text, /callers?/i, 'Missing caller investigation');
  assert.match(text, /lifecycle/i, 'Missing caller contract');
  assert.match(text, /120/, 'Missing legitimate archive exception');
  assert.match(text, /(?:no|not|reject|avoid|do not|don.t)[^.\n]*(?:global|blanket|ban|cap)|(?:ban|cap)[^.\n]*(?:reject|not|unsupported)|(?:global|blanket)[^.\n]*(?:ban|cap)\s+would (?:break|violate)[^.\n]*(?:valid|legitimate|requirement|use case)/i,
    'Missing rejection of blanket timeout ban');
});

Then('the feedback analysis leaves the workspace and Git history unchanged', async function () {
  assert.deepEqual(await files(this.workspace), this.original, 'Feedback analysis changed files');
  assert.equal(await this.git(['status', '--porcelain']), '', 'Feedback analysis changed the index');
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead, 'Feedback analysis committed');
});
