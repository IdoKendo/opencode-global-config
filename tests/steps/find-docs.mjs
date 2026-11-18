import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';
import { checkConfig, checkRelease } from '../support/probe-lookup.mjs';

Given('an offline ParcelQuill reference covering releases 2.4 and 3.0', async function () {
  const bin = path.join(this.workspace, 'bin');
  await access(path.join(bin, 'ctx7'), constants.X_OK);
  this.env.PATH = `${bin}${path.delimiter}${this.env.PATH}`;
});

Then('the agent has retrieved the 2.4 reference page', function () {
  checkRelease(this.executions);
});

Then('the answer sets journal.medium to "volume" and journal.limitKiB to 512 for a 512 KiB spool', function () {
  checkConfig(this.handoff);
});
