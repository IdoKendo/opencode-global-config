import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { testRoot } from '../support/harness.mjs';
import { selected } from '../support/tool-trace.mjs';
import {
  reviewReport, checkRequirements, checkQuality, checkUnavailable, reviewState, checkPreserved,
} from '../support/review-change-assertions.mjs';

export async function prepareReview(world) {
  await world.git(['tag', 'baseline']);
  for (const name of ['receipt.mjs', 'shipping.mjs']) {
    const text = await readFile(path.join(testRoot, 'fixtures/review-change/inputs', name), 'utf8');
    await writeFile(path.join(world.workspace, name), text);
    world.immutable.get(name).text = text;
  }
  await world.git(['add', 'receipt.mjs']);
  await writeFile(path.join(world.workspace, 'personal-notes.txt'), 'Untracked user draft: keep this.\n');
  assert.equal(await world.git(['diff', '--cached', '--name-only']), 'receipt.mjs');
  assert.equal(await world.git(['diff', '--name-only']), 'shipping.mjs');
  world.beforeReview = await reviewState(world);
}

Given('a staged receipt change and an unstaged shipping boundary change', async function () {
  await prepareReview(this);
});
Then('the review selects review-change from the ordinary request', function () {
  assert.ok(selected(this.tools, 'review-change'), 'Review skill was not selected');
});
Then('requirements identify the missing free shipping boundary', function () {
  checkRequirements(reviewReport(this.handoff));
});
Then('code quality identifies the receipt logging standard violation', function () {
  checkQuality(reviewReport(this.handoff));
});
Then('requirements are unavailable rather than passed', function () {
  checkUnavailable(reviewReport(this.handoff));
});
Then('the review preserves every file and the Git state', async function () {
  await checkPreserved(this);
});
