import assert from 'node:assert/strict';

export function checkHeading(text) {
  assert.equal(text.trimEnd(), "export const heading = () => '# Report';");
}

export function checkCounts(handoff) {
  const line = handoff.split('\n').filter(line => line.trim().startsWith('{')).at(-1);
  const counts = JSON.parse(line);
  assert.equal(counts.blocksRemoved, 2);
  assert.equal(counts.linesRemoved, 2);
}
