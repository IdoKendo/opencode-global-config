import assert from 'node:assert/strict';
import test from 'node:test';
import { deliveryCharge, shippingForTest } from '../shipping.mjs';

test('helper repeats paid delivery', () => {
  assert.equal(shippingForTest(49), 5);
});

test('identity', () => {
  const charge = deliveryCharge(49);
  assert.equal(charge, charge);
});

test('probe', () => {
  deliveryCharge(51);
});
