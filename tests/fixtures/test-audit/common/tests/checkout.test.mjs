import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutTotal } from '../checkout.mjs';

test('paid delivery', () => {
  assert.equal(checkoutTotal(49), 54);
});

test('free delivery', () => {
  assert.equal(checkoutTotal(51), 51);
});
