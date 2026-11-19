import assert from 'node:assert/strict';
import { Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';

const message = (world) => world.handoff.replace(/^```[^\n]*\n|\n```$/g, '').trim();

// Compare measurements in the subject itself. Either endpoint may supply a shared unit.
const unitSeconds = new Map([
  [0.001, ['ms', 'millisecond', 'milliseconds']], [1, ['s', 'sec', 'secs', 'second', 'seconds']],
  [60, ['m', 'min', 'mins', 'minute', 'minutes']], [3600, ['h', 'hr', 'hrs', 'hour', 'hours']],
  [86400, ['d', 'day', 'days']],
].flatMap(([scale, units]) => units.map((unit) => [unit, scale])));
const number = String.raw`\b(\d+(?:,\d{3})*(?:\.\d+)?)`;
const unit = `(${[...unitSeconds.keys()].join('|')})`;
const quantity = `${number}\\s*${unit}?\\b`;
const seconds = (value, u) => Number(value.replaceAll(',', '')) * unitSeconds.get(u.toLowerCase());
function measurements(text) {
  const pairs = [];
  const factors = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*[- ]?(?:x\b|×|times\b|fold\b)/gi)]
    .map((match) => Number(match[1]));
  const ranges = new RegExp(`${quantity}\\s*(to|→|->|instead of|down from|rather than)\\s*${quantity}`, 'gi');
  const durations = [...text.matchAll(new RegExp(`${number}\\s*${unit}\\b`, 'gi'))]
    .map(([, value, u]) => seconds(value, u));
  for (const [, a, u, direction, b, v] of text.matchAll(ranges)) {
    if (!u && !v) continue;
    const pair = [seconds(a, u ?? v), seconds(b, v ?? u)];
    pairs.push(/from|instead|rather/i.test(direction) ? pair.reverse() : pair);
  }
  return { pairs, factors, durations };
}

function assertTimings(text, before, after, factor) {
  const { pairs, factors } = measurements(text);
  assert.ok(pairs.length + factors.length > 0, 'Missing measured evaluation improvement');
  for (const pair of pairs) assert.deepEqual(pair, [before, after], 'Wrong before/after timing');
  for (const value of factors) assert.equal(value, factor, 'Wrong speedup');
  assert.doesNotMatch(text, /\b(?:slow(?:er|down)?|slowed|longer|regress(?:ed|ion)?)\b/i);
}

Then('write-commit-message is selected through normal skill discovery', function () {
  assert.ok(this.tools.some((tool) => tool.name === 'skill'
    && tool.input.id === 'write-commit-message' && tool.status === 'completed'),
  'Missing successful write-commit-message selection');
});

Then('the commit subject describes faster evaluation', function () {
  const text = message(this);
  assert.match(text, /^ci(?:\([^)]+\))?: /, 'Missing repository commit convention');
  assert.equal(text.split('\n').length, 1, 'Expected only one subject line');
  assert.match(text, /evaluat|\bevals?\b|agent.*(?:test|suite)/i, 'Missing evaluation scope');
  const { pairs } = measurements(text);
  assert.ok(pairs.some(([before, after]) => before > after)
    || /\b(?:speed(?:s|ing)? up|speedup|faster|sooner|quicker|accelerat\w*|less time|shorter)\b/i.test(text)
    || /\b(?:reduc|cut|shorten|lower|shrink)\w*\b.*(?:time|duration|latency|wait|evaluat)/i.test(text),
  'Missing speed benefit');
  assert.doesNotMatch(text, /\b(?:without changing|unchanged|no faster|not faster)\b[^;]*evaluat/i);
});

Then('the subject makes no measured speed claim', function () {
  const text = message(this);
  const { factors, durations } = measurements(text);
  assert.ok(!factors.length && !durations.length && !/\d\s*%/.test(text),
    'No performance measurement was supplied');
});

Then('the commit message does not turn local measurements into CI results', function () {
  const text = message(this);
  const { pairs, factors, durations } = measurements(text);
  const percentages = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  if (!durations.length && !factors.length && !percentages.length) return;
  if (pairs.length || factors.length) assertTimings(text, 1557, 87, 18);
  for (const duration of durations) assert.ok([1557, 87].includes(duration), 'Wrong local duration');
  for (const percent of percentages) assert.ok(Math.abs(percent - (1 - 87 / 1557) * 100) <= 0.5,
    'Wrong local time reduction');
  assert.match(text, /\blocal(?:ly)?\b/i, 'Unqualified local measurement');
  assert.doesNotMatch(text, /\b(?:local(?:ly)?\s+(?:and|&)\s+(?:in\s+)?CI|CI\s+(?:and|&)\s+local(?:ly)?)\b/i);
  assert.doesNotMatch(text, /(?:CI|GitHub Actions)\s+(?:is\s+)?(?:\d+\s*[x×]|\d+\s+times)/i,
    'Local result claimed for CI');
});

Then('the commit message reports the measured CI reduction', function () {
  const text = message(this);
  assertTimings(text, 24 * 60, 2 * 60, 12);
  assert.doesNotMatch(text, /(?:entire|total|whole|end.to.end)\s+(?:CI|workflow)|(?:workflow|CI)\s+(?:time|duration|runtime)\b/i,
    'Evaluation timing expanded to whole workflow');
});

Then('the commit suggestion leaves files and Git unchanged', async function () {
  assert.deepEqual(await files(this.workspace), this.original, 'Commit suggestion changed files');
  assert.equal(await this.git(['status', '--porcelain']), '', 'Commit suggestion changed index');
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead, 'Commit suggestion committed');
});
