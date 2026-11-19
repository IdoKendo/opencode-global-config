import assert from 'node:assert/strict';

export const scenarios = {
  'Review the proposed shipping fee even when the checkout already fixes it': {
    fixture: 'review-change/masked-branch',
    prompt: 'Is the shipping-offer branch ready to merge into release? Review its commits against '
      + 'the offer in request.md. Leave my checkout as you found it. Use the review card in request.md.',
  },
};

export function card(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1'));
}

export async function branchScope(report, world) {
  assert.match(report.baseline, /^[a-f0-9]{4,64}$/i);
  const resolved = await world.git(['rev-parse', '--verify', `${report.baseline}^{commit}`]);
  assert.equal(resolved, world.offerBase, 'Review must start at the branch point');
  assert.deepEqual(report.changedFiles, ['shipping.mjs']);
}

export function branchFees(report) {
  assert.deepEqual(report.defects.map(({ file, subtotalCents, expectedFeeCents, actualFeeCents }) =>
    ({ file, subtotalCents, expectedFeeCents, actualFeeCents })), [
    { file: 'shipping.mjs', subtotalCents: 5000, expectedFeeCents: 0, actualFeeCents: 500 },
  ]);
}
