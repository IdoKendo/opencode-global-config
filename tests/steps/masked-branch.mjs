import { Given, Then } from '@cucumber/cucumber';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { branchFees, branchScope, card } from '../support/probe-review.mjs';
import { reviewState } from '../support/review-change-assertions.mjs';

export async function prepareOffer() {
  const write = (name, value) => writeFile(path.join(this.workspace, name), value);
  const commit = async (message) => {
    await this.git(['add', '.']);
    await this.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
      '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message]);
  };
  this.offerBase = await this.git(['rev-parse', 'HEAD']);
  await this.git(['branch', 'shipping-offer']);
  await this.git(['switch', '-C', 'release']);
  await write('pickup.md', 'Curbside pickup is available on Saturdays.\n');
  await commit('Publish pickup hours');
  await this.git(['switch', 'shipping-offer']);
  const original = await this.read('shipping.mjs');
  const proposal = original.replace('return 500;', 'return subtotalCents > 5000 ? 0 : 500;');
  await write('shipping.mjs', proposal);
  await commit('Introduce order shipping offer');
  const local = proposal.replace(' > ', ' >= ');
  await write('shipping.mjs', local);
  this.immutable.get('shipping.mjs').text = local;
  this.beforeReview = await reviewState(this);
}

Given('release advanced after shipping-offer branched and a local edit fixes the offer', prepareOffer);

Then('the review attributes only the shipping change to the branch since divergence', function () {
  branchScope(card(this.handoff), this.offerBase);
});

Then('the review reports that a qualifying order of 5000 cents still costs 500 cents to ship', function () {
  branchFees(card(this.handoff));
});
