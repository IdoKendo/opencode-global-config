import { Before, After, When, setDefaultTimeout } from '@cucumber/cucumber';
import { prepare, runAgent, finish } from './harness.mjs';

setDefaultTimeout(Number(process.env.AGENT_TEST_TIMEOUT_MS ?? 180_000) + 30_000);

Before(async function ({ pickle }) {
  await prepare(this, pickle.name);
});

When(/^the user asks the agent to .+$/, async function () {
  await runAgent(this);
});

After(async function ({ result }) {
  await finish(this, result);
  if (this.artifact) this.log(`Artifacts: ${this.artifact}`);
});
