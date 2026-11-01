import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';

const plain = (text) => text.replace(/[`*_]/g, '').trim();

Given('the rehearsal requires creating, checking, and moving a local archive', async function () {
  const input = await this.fixture('rehearsal.txt');
  for (const command of ['tar -cf rehearsal.tar sample/', 'tar -tf rehearsal.tar', 'reviewed/']) {
    assert.ok(input.includes(command), `Missing rehearsal input: ${command}`);
  }
});

Given('three retry changes have failed to resolve the upload error', async function () {
  const input = await this.fixture('conversation.txt');
  assert.equal((input.match(/User: Still broken/g) ?? []).length, 3);
  assert.match(input, /transient network error/);
});

Given('rehearsal archives have a 14-day retention policy', async function () {
  assert.match(await this.fixture('policy.txt'), /Rehearsal archives are retained for 14 days/);
});

Then('shape-output is selected through normal skill discovery', function () {
  assert.ok(this.tools.some((tool) => tool.name === 'skill'
    && tool.input.id === 'shape-output' && tool.status === 'completed'),
  'Missing successful shape-output selection');
});

Then('shape-output is not selected for the factual answer', function () {
  assert.ok(!this.tools.some((tool) => tool.name === 'skill' && tool.input.id === 'shape-output'),
    'Unnecessary shape-output selection for a factual answer');
});

Then('the response gives numbered archive actions in dependency order', function () {
  const text = plain(this.handoff);
  const items = text.split(/^\s*\d+[.)]\s+/m).slice(1);
  assert.ok(items.length >= 3, 'Expected separate numbered archive actions');
  assert.ok(items.length <= 5, 'Expected at most five actions in this short procedure');
  const create = items.findIndex((item) => /tar -cf rehearsal\.tar sample\//.test(item));
  const inspect = items.findIndex((item) => /tar -tf rehearsal\.tar/.test(item));
  const move = items.findIndex((item) => /mv rehearsal\.tar reviewed\//.test(item)
    || /\bmove\b[^.!?]*rehearsal\.tar[^.!?]*reviewed\//i.test(item));
  assert.ok(create >= 0 && inspect > create && move > inspect,
    'Create, inspect, and move must be separate ordered actions');
  assert.doesNotMatch(text, /\b\d+\s*(?:seconds?|minutes?|hours?)\b/i,
    'Unsupported duration estimate');
});

Then('the response starts with useful guidance and ends without pleasantries', function () {
  const text = plain(this.handoff);
  assert.ok(text.length > 0, 'Missing response');
  assert.doesNotMatch(text, /^(?:Great question|Let me\b|I['’]ll\b|Sure[!,]|Looking at your|To answer your question)/i,
    'Announcement instead of answer');
  assert.doesNotMatch(text, /(?:Let me know if|Hope (?:this|that) helps|Happy to clarify|Feel free to ask)/i,
    'Unnecessary closing pleasantry');
});

Then('the response questions the transient-error assumption and asks one diagnostic question', function () {
  const text = plain(this.handoff);
  assert.match(text, /(?:assum\w*|hypothesis|not|isn['’]t|may not|might not|rather than)[^.!?\n]*transient|transient[^.!?\n]*(?:assum\w*|wrong|unproven|unsupported|not|may|might)/i,
    'Missing reconsideration of the transient-error assumption');
  assert.equal((text.match(/\?/g) ?? []).length, 1, 'Expected one diagnostic question');
  assert.match(text, /(?:error|status)[^?]*\?/i, 'Question must request missing error evidence');
  assert.doesNotMatch(text, /\b(?:increase|double|raise|bump|set|change)\b[^.!?\n]*(?:retry|retries|delay|timeout)|(?:retry|retries|delay|timeout)[^.!?\n]*\b(?:to|=)\s*\d+/i,
    'Another speculative retry change');
});

Then('the response answers 14 days without inventing actions or estimates', function () {
  const text = plain(this.handoff);
  assert.match(text.split('\n').find((line) => line.trim()) ?? '', /\b14(?:[ -]days?)\b/i,
    'Lead with the retention answer');
  assert.doesNotMatch(text, /^\s*(?:\d+[.)]|[-+])\s+|\b(?:next(?: step)?|run|execute|you (?:should|must|need to)|please|minutes?|hours?)\b|\?/im,
    'Invented action, estimate, or follow-up');
  assert.doesNotMatch(text, /Hope (?:this|that) helps|Let me know|Happy to clarify/i,
    'Unnecessary closing pleasantry');
});
