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

Then('the shared change description uses platform-neutral terminology', function () {
  assert.doesNotMatch(plain(this.handoff), /\b(?:PRs?|MRs?|pull[ -]?requests?|merge[ -]?requests?|GitHub|GitLab)\b/i,
    'Unrequested provider-specific terminology in shared change description');
});

Then('the requested GitLab description preserves the MR description heading', function () {
  const text = plain(this.handoff);
  assert.match(text, /^ {0,3}#{1,6}\s+MR description(?:\s+#+)?\s*$/im,
    'Missing explicitly requested MR description heading');
  assert.doesNotMatch(text, /\b(?:PRs?|pull[ -]?requests?|GitHub)\b/i,
    'Wrong provider terminology for requested GitLab description');
});

Then('the response is a complete Markdown change description with local performance evidence', function () {
  const markdown = this.handoff.trim().replace(/^```(?:markdown|md)\s*\n([\s\S]*)\n```$/, '$1');
  const text = plain(markdown);
  assert.doesNotMatch(text, /(?:would you like|want me|shall I|should I)[^?\n]*(?:description|draft|write|prepare|produce)|I can (?:write|draft|prepare)/i,
    'Artifact deferred to another turn');
  assert.match(text, /(?:request[- ](?:local|scoped)|per[- ]request)[^.\n]*index|index[^.\n]*request/i,
    'Missing change summary');
  assert.match(text, /\blocal(?:ly)?\b/i, 'Missing local evidence level');
  const labeled = /\b(?:before|baseline)\b[^\n]*\b240\s*ms\b/i.test(text)
    && /\bafter\b[^\n]*\b180\s*ms\b/i.test(text);
  const rows = text.split('\n').filter((line) => line.includes('|')).map((line) =>
    line.replace(/^\s*\||\|\s*$/g, '').split('|').map((cell) => cell.trim()));
  const header = rows.find((row) => row.some((cell) => /^(?:before|baseline)$/i.test(cell))
    && row.some((cell) => /^after$/i.test(cell)));
  const table = header && rows.some((row) =>
    /^240\s*ms$/i.test(row[header.findIndex((cell) => /^(?:before|baseline)$/i.test(cell))] ?? '')
    && /^180\s*ms$/i.test(row[header.findIndex((cell) => /^after$/i.test(cell))] ?? ''));
  const arrow = /\b240\s*ms\s*(?:→|->|to)\s*180\s*ms\b/i.test(text);
  assert.ok(labeled || table || arrow, 'Missing or reversed before/after timing');
  for (const [pattern, label] of [
    [/\bmedian\b/i, 'median statistic'], [/\b10\s+(?:measured\s+)?(?:samples|runs)\b/i, 'sample count'],
    [/\bper\s+(?:version|variant)\b|\beach\s+(?:version|variant)\b|\b(?:samples|runs)\s+each\b/i, 'samples per version'],
    [/\b(?:100,?000|100k)\s+(?:input\s+)?records\b/i, 'input size'],
    [/\bseed\s*[:=]?\s*17\b/i, 'fixed seed'], [/\b(?:one|1|single)[ -]worker\b/i, 'worker count'],
    [/\bNode(?:\.js)?\s*(?:v)?24\b/i, 'Node version'], [/\bmacOS\b[^\n,.]*\barm64\b/i, 'platform'],
    [/\b(?:one|1)\s+warm[- ]?up\b/i, 'warm-up condition'],
    [/\bsame\s+(?:laptop|machine|host)\b/i, 'same host'],
  ]) assert.match(text, pattern, `Missing benchmark condition: ${label}`);
});

Then('the change description names the missing CI and production credentials without claiming success', function () {
  const text = plain(this.handoff);
  for (const [area, token] of [['CI', 'CI_RUN_TOKEN'], ['production', 'PROD_READ_TOKEN']]) {
    assert.match(text, new RegExp(`\\b${area}\\b[^\\n]*(?:not (?:been )?(?:run|checked|verified)|unverified|blocked|unavailable|missing|pending)`, 'i'),
      `Missing ${area} verification limit`);
    assert.ok(this.handoff.includes(token), `Missing prerequisite: ${token}`);
  }
  for (const clause of text.split(/[.!?;\n]+/)) {
    if (/\b(?:CI|production|runtime|end-to-end)\b/i.test(clause)) {
      // Remove negated claims, not unrelated phrases such as "no failures".
      const asserted = clause
        .replace(/\b(?:not|never)\s+(?:(?:been|yet|fully|successfully)\s+)*(?:passed|verified|validated|faster|improved|reduced)\b/gi, '')
        .replace(/\bno\s+(?:(?:CI|production|runtime|end-to-end)\s+)*(?:speedup|gains?|improvement|reduction|verification|validation)\b/gi, '')
        .replace(/\b(?:speedup|gains?|improvement|reduction)\s+(?:is|are|remains?|has been|have been)\s+(?:not (?:yet )?(?:established|measured|verified)|unverified|unmeasured)\b/gi, '');
      assert.doesNotMatch(asserted, /\b(?:pass(?:ed)?|verif(?:ied|ication complete)|validat(?:ed|ion complete)|faster|speedup|gain(?:s)?|improv(?:ed|ement)|reduc(?:ed|tion))\b/i,
        'Unsupported CI, production, or runtime success claim');
    }
  }
});
