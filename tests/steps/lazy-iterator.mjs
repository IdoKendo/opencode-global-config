import assert from 'node:assert/strict';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { command, testRoot } from '../support/harness.mjs';
import { jobDepth } from '../support/probe-audit.mjs';

Given('a working-tree change with nested checks for ready jobs', async function () {
  await copyFile(path.join(testRoot, 'fixtures/simplify-code/lazy-iterator-change/jobs.mjs'),
    path.join(this.workspace, 'jobs.mjs'));
  this.immutable.delete('jobs.mjs');
  this.jobDepth = await jobDepth(this);
});
Then('the job filter uses less nested control flow', async function () {
  assert.ok(await jobDepth(this) < this.jobDepth, 'Filter nesting was not reduced');
});

async function exercise(world, check) {
  const probe = new URL('../support/probe-audit.mjs', import.meta.url);
  const result = await command(process.execPath, ['--input-type=module', '-e',
    `import { ${check} } from ${JSON.stringify(probe.href)};
     import { readyJobs } from './jobs.mjs'; ${check}(readyJobs);`], { cwd: world.workspace });
  assert.equal(result.code, 0, result.stderr);
}

Then('taking one ready job reads only through that job and closes the source', async function () {
  await exercise(this, 'earlyStop');
});
Then('draining the filter returns all ready jobs in source order', async function () {
  await exercise(this, 'drain');
});
