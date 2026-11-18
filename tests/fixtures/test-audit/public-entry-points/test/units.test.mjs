import assert from 'node:assert/strict';
import test from 'node:test';
import { billableKg } from 'parcel-units';
import { billableKg as sdkWeight } from 'parcel-units/sdk';

test('partial kilograms round up', () => {
  assert.equal(billableKg(2.25), 3);
});

test('a fractional parcel uses a whole billing unit', () => {
  assert.equal(billableKg(2.25), 3);
});

test('integrations get rounded billable kilograms', () => {
  assert.equal(sdkWeight(2.25), 3);
});
