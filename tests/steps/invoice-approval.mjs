import { Given, Then } from '@cucumber/cucumber';
import { probeApproval } from '../support/probe-approval.mjs';

Given('an invoice suite that checks repeat approval using a read-only caller', function () {
  this.immutable.delete('test/invoices.test.mjs');
});
Then('the suite passes when an invoice can be approved only once', async function () {
  await probeApproval(this, 'correct');
});
Then('the suite fails when an approver can approve the same invoice twice', async function () {
  await probeApproval(this, 'regressed');
});
Then('the suite still passes when approval checks run in the opposite order', async function () {
  await probeApproval(this, 'reordered');
});
