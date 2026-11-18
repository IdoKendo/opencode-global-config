import assert from 'node:assert/strict';
import test from 'node:test';
import { approve, ApprovalDenied } from '../invoices.mjs';

const accountant = { role: 'approver' };
const auditor = { role: 'reader' };

test('an approver can approve a pending invoice', () => {
  const invoice = { id: 'A13', status: 'pending' };
  assert.deepEqual(approve(invoice, accountant), { id: 'A13', status: 'approved' });
});

test('an invoice cannot be approved twice', () => {
  const invoice = { id: 'A13', status: 'approved' };
  assert.throws(() => approve(invoice, auditor), ApprovalDenied);
});
