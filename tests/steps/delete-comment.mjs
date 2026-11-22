import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';
import { checkCounts, checkDelayRename, checkHeading } from '../support/comment-cleanup.mjs';

Given('the export helper is in scope for comment cleanup', function () {
  this.immutable.delete('export.mjs');
});

Then('the heading helper keeps its literal and loses only its redundant comments', async function () {
  checkHeading(await this.read('export.mjs'));
  assert.equal(await this.read('compat.mjs'), await this.fixture('compat.mjs'));
});

Then('the cleanup reports two blocks and two physical lines removed', function () {
  checkCounts(this.handoff);
});

Then('the fallback and its retirement condition remain intact', async function () {
  assert.equal(await this.git(['status', '--porcelain']), '');
  assert.equal(await this.read('compat.mjs'), await this.fixture('compat.mjs'));
});

Then('the timer and its milliseconds comment remain unchanged', async function () {
  assert.equal(await this.read('retry.mjs'), await this.fixture('retry.mjs'));
});

Then('the report recommends renaming the delay parameter to show its unit', function () {
  checkDelayRename(this.handoff);
});
