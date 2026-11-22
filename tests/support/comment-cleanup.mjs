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

export function checkDelayRename(handoff) {
  const line = handoff.split('\n').filter(line => line.trim().startsWith('{')).at(-1);
  const { edits } = JSON.parse(line);
  assert.ok(edits.some(({ from, to }) =>
    from === 'delay' && /^(?:[a-z_$][\w$]*)?(?:ms|millis|milliseconds)$/i.test(to)),
  'Expected a rename of delay that makes milliseconds explicit');
}
