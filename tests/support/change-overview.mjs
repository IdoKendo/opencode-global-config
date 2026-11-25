import assert from 'node:assert/strict';

const limit = /\b(?:partial|incomplete|missing|unavailable|omitted|only one|only 1|not available|could not|couldn.t)\b/i;

export function checkHandoff(text, location, partial) {
  assert.ok(text.includes(location), `Missing report path: ${location}`);
  const takeaway = text.replaceAll(location, '');
  if (partial) {
    assert.match(takeaway, /patch|diff|file|hunk/i);
    assert.match(takeaway, limit);
  } else {
    assert.match(takeaway, /(?:before\.txt[\s\S]*after\.txt|retired[\s\S]*(?:input|replac)|renam\w*[\s\S]*receiver|receiver[\s\S]*renam)/i);
    assert.doesNotMatch(takeaway, /\b(?:no|not|never)\s+(?:file\s+)?renam/i);
  }
}

export function checkProvider(page, calls, url, cli) {
  assert.ok(page.includes(`href="${url}"`), url);
  assert.deepEqual([...new Set(calls.trim().split('\n').map(s => JSON.parse(s)[0]))], [cli]);
}

export function checkRename(page, url, head) {
  assert.ok(page.includes(`href="${url.split('/-/')[0]}/-/blob/${head}/after.txt"`));
  assert.match(page, /href="[^"]*#note_912"[^>]*>before\.txt:2 \((?:old|left) side\)/i);
  assert.ok(page.includes(`href="${url}#note_912"`));
}

export function checkMarkup(page) {
  for (const word of ['legacy', 'input', 'retired', 'overview', 'change', 'test']) {
    assert.ok(page.includes(`&lt;${word}&gt;`), `Missing literal <${word}>`);
    assert.ok(!page.includes(`<${word}>`), `Raw <${word}>`);
  }
  assert.ok(page.includes('Why remove &lt;retired&gt;?'));
}

export function checkPartial(page) {
  assert.ok(page.includes('+available hunk'));
  assert.ok(page.includes('other.txt'));
  const warning = page.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/i)?.[1] ?? '';
  assert.match(warning, /diff|patch/i);
  assert.match(warning, limit);
}
