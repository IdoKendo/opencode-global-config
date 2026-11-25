import assert from 'node:assert/strict';
import { copyFile, mkdir, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { checkHandoff, checkMarkup, checkPartial, checkProvider, checkRename } from '../support/change-overview.mjs';

const report = '.git/reviewer-report/overview.html';
const pr = 'https://github.com/acme/receiver/pull/17';
const mr = 'https://gitlab.com/acme/tools/platform/receiver/-/merge_requests/32';

async function setup(world, { missing = false, tracking = false } = {}) {
  const local = name => path.join(world.workspace, name);
  const bin = local('.git/bin');
  await mkdir(bin);
  for (const cli of ['gh', 'glab']) {
    await writeFile(path.join(bin, cli),
      `#!/bin/sh\nexec "${process.execPath}" "${local('provider.mjs')}" ${cli} "$@"\n`, { mode: 0o755 });
  }
  world.env.PATH = bin + path.delimiter + world.env.PATH;
  const commit = message => world.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
    'commit', '-qm', message]);
  const content = 'receiver header\n<retired>\nunchanged record\nreceiver footer\n';
  await writeFile(local('before.txt'), content);
  await world.git(['add', 'before.txt']);
  await commit('Receiver baseline');
  const base = await world.git(['rev-parse', 'HEAD']);
  await world.git(['switch', '-qc', 'topic']);
  await rename(local('before.txt'), local('after.txt'));
  await writeFile(local('after.txt'), content.replace('<retired>', '<input>'));
  await world.git(['add', '-A']);
  await commit('Rename and revise receiver');
  world.head = await world.git(['rev-parse', 'HEAD']);
  await writeFile(local('.git/fixture.json'), JSON.stringify({
    base: missing ? '1'.repeat(40) : base, head: missing ? '2'.repeat(40) : world.head, missing,
  }));
  if (tracking) {
    await world.git(['remote', 'add', 'origin', 'git@gitlab.com:acme/other.git']);
    await world.git(['remote', 'add', 'review', 'git@github.com:acme/receiver.git']);
    await world.git(['update-ref', 'refs/remotes/review/published-topic', world.head]);
    await world.git(['branch', '--set-upstream-to=review/published-topic']);
  } else {
    await world.git(['switch', '-q', '--detach', base]);
    await world.git(['remote', 'add', 'origin', 'git@github.com:unrelated/repository.git']);
  }
}

Given('a receiver change tracking a differently named GitHub branch with a GitLab origin', async function () {
  await setup(this, { tracking: true });
});
Given('a receiver merge request in a nested GitLab group outside the checkout origin', async function () {
  await setup(this);
});
Given('a GitHub change with missing local commits and only one of two patches available', async function () {
  await setup(this, { missing: true });
});

Then(/^the handoff links the local overview and (explains the receiver change|flags the evidence limit)$/, async function (goal) {
  const page = await realpath(path.join(this.workspace, report));
  await copyFile(page, path.join(this.artifact, 'overview.html'));
  checkHandoff(this.handoff, page, goal.startsWith('flags'));
  this.page = await this.read(report);
});
Then('the page links pull request 17 using only GitHub evidence', async function () {
  checkProvider(this.page, await this.read('.git/calls'), pr, 'gh');
  assert.match(this.page, /\+&lt;input&gt;/);
});
Then('the page links the renamed file and its old-side question using only GitLab evidence', async function () {
  checkProvider(this.page, await this.read('.git/calls'), mr, 'glab');
  checkRename(this.page, mr, this.head);
});
Then('source and summary markup are readable as literal text', function () {
  checkMarkup(this.page);
});
Then('the page retains the available hunk and warns about the incomplete diff', function () {
  checkPartial(this.page);
});
