import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { fixture } from '../support/control-fixture.mjs';

const { runConfiguration } = await loadConfiguration({ file: false, provided: {
  paths: [], require: [],
  import: [fileURLToPath(new URL('../steps/withdrawn-endpoints.mjs', import.meta.url))],
} });
const support = await loadSupport(runConfiguration);
async function step(world, text) {
  const matches = support.stepDefinitions.filter(s => s.matchesStepName(text));
  assert.equal(matches.length, 1);
  await matches[0].code.call(world);
}

test('review closes only with the rehearsal exception and the active CI safeguard', async t => {
  const w = await fixture(t, 'learn-from-feedback/withdrawn-endpoints');
  const ci = 'endpoint CI accepts HTTP in rehearsal and rejects it in production';
  await step(w, ci);
  const check = 'the tracker keeps HTTP for rehearsal only and requests no new safeguard';
  const good = { httpAllowedIn: ['rehearsal'], blockingScript: 'verify:endpoint', followUps: [] };
  w.handoff = JSON.stringify(good);
  await step(w, check);
  for (const wrong of [{ httpAllowedIn: [] }, { blockingScript: null }, { followUps: ['Add a policy test'] }]) {
    w.handoff = JSON.stringify({ ...good, ...wrong });
    await assert.rejects(step(w, check), /Incorrect endpoint review disposition/);
  }
  await w.write('verify-endpoint.mjs', '// check accidentally disabled\n');
  await assert.rejects(step(w, ci), /Production HTTP passed CI/);
});
