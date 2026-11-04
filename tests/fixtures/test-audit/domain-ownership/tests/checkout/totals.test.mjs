import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutTotal } from '../../checkout.mjs';

test('checkout charges delivery below the free threshold', () => {
  assert.equal(checkoutTotal(49), 54);
});

test('checkout includes free delivery above the threshold', () => {
  assert.equal(checkoutTotal(51), 51);
});
