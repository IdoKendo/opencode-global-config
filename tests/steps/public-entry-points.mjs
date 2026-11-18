import { Given, Then } from '@cucumber/cucumber';
import { probeRounding } from '../support/probe-audit.mjs';

Given('a rounding package tested twice through its root and once through its SDK', function () {
  this.immutable.delete('test/units.test.mjs');
});
Then('the rounding example runs only once through each public path', async function () {
  await probeRounding(this);
});
Then('the suite detects a wrong result at either path independently', async function () {
  for (const entry of ['root', 'sdk']) await probeRounding(this, entry);
});
