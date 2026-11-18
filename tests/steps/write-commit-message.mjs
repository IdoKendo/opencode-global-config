import assert from 'node:assert/strict';
import { Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';

const message = (world) => world.handoff.replace(/^```[^\n]*\n|\n```$/g, '').trim();

Then('write-commit-message is selected through normal skill discovery', function () {
  assert.ok(this.tools.some((tool) => tool.name === 'skill'
    && tool.input.id === 'write-commit-message' && tool.status === 'completed'),
  'Missing successful write-commit-message selection');
});

Then('the commit subject describes faster evaluation', function () {
  const text = message(this);
  assert.match(text, /^ci(?:\([^)]+\))?: /, 'Missing repository commit convention');
  assert.equal(text.split('\n').length, 1, 'Expected only one subject line');
  assert.match(text, /evaluat|agent.*(?:test|suite)/i, 'Missing evaluation scope');
  assert.match(text, /speed|faster|accelerat|(?:reduc|cut|shorten|lower).*?(?:time|duration|runtime|evaluation)|(?:time|duration|runtime).*?(?:reduc|cut|shorten|lower)/i,
    'Missing speed benefit');
});

Then('the commit message does not turn local measurements into CI results', function () {
  const text = message(this);
  if (/\d/.test(text.replace(/\b39\s+(?:parallel\s+)?(?:Cucumber\s+)?(?:workers?|scenarios?)\b/gi, ''))) {
    assert.match(text, /local(?:ly)?/i, 'Unqualified local measurement');
    assert.doesNotMatch(text, /(?:CI|GitHub Actions)\s+(?:is\s+)?(?:\d+\s*[x×]|\d+\s+times)/i,
      'Local result claimed for CI');
  }
});

Then('the commit message reports the measured CI reduction', function () {
  const text = message(this);
  assert.match(text, /(?:24\s*(?:m|min|minutes)\b.*?2\s*(?:m|min|minutes)\b)|(?:24\s*(?:to|→|->)\s*2\s*(?:m|min|minutes)\b)|(?:12\s*(?:x|×|times|fold))/i,
    'Missing measured evaluation improvement');
  assert.doesNotMatch(text, /(?:entire|total|whole|end.to.end)\s+(?:CI|workflow)|workflow\s+(?:duration|runtime)/i,
    'Evaluation timing expanded to whole workflow');
});

Then('the commit suggestion leaves files and Git unchanged', async function () {
  assert.deepEqual(await files(this.workspace), this.original, 'Commit suggestion changed files');
  assert.equal(await this.git(['status', '--porcelain']), '', 'Commit suggestion changed index');
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead, 'Commit suggestion committed');
});
