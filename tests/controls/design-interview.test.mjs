import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { fixture } from '../support/control-fixture.mjs';

const { runConfiguration } = await loadConfiguration({ file: false, provided: {
  paths: [], require: [],
  import: [fileURLToPath(new URL('../steps/design-interview.mjs', import.meta.url))],
} });
const support = await loadSupport(runConfiguration);
async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(matches.length, 1);
  return matches[0].code.call(world);
}

test('distinguish a collision decision from re-asking settled facts or a questionnaire', async () => {
  const ask = (handoff) => invoke('the agent asks one question about handling the existing file', { handoff });
  await ask('When May is exported twice, should we replace the existing file or keep both?');
  await ask('Replace would overwrite May; Keep both would create another copy. Which do you prefer?');
  for (const reply of [
    'Replace or keep both? Which format should we use?',
    'We can replace or keep both. Which folder should receive the existing file?',
    'We can replace or keep both. What is your deadline?',
    'We should replace the existing file rather than keep both.',
  ]) await assert.rejects(ask(reply), assert.AssertionError);
});

test('a tentative timestamp cannot become a confirmed decision', async () => {
  const brief = (confirmed, open) => invoke('the brief confirms Keep both and leaves the suffix undecided',
    { handoff: JSON.stringify({ confirmed, open }) });
  await brief(['Keep both exports'], ['Which suffix should the second file use?']);
  for (const [confirmed, open] of [
    [['Use a timestamp suffix'], ['Whether to keep both']],
    [['Keep both with a timestamp suffix'], ['Suffix formatting']],
    [['Keep both exports'], []],
    [['Keep both exports'], ['Whether to keep both', 'Suffix']],
  ]) await assert.rejects(brief(confirmed, open), assert.AssertionError);
});

test('interview cannot pass on an uninvoked skill or a hidden implementation', async (t) => {
  const loaded = (tools) => invoke('the requested design-interview skill is loaded', { tools });
  const skill = { name: 'skill', input: { id: 'design-interview' }, status: 'completed' };
  await loaded([skill]);
  for (const tools of [[], [{ ...skill, status: 'error' }], [{ ...skill, input: { id: 'write-docs' } }]]) {
    await assert.rejects(loaded(tools), assert.AssertionError);
  }
  const world = await fixture(t, 'design-interview/export');
  const unchanged = () => invoke('the interview leaves the workspace and Git unchanged', world);
  await unchanged();
  await world.write('collision-policy.mjs', 'export const keepBoth = true;');
  await assert.rejects(unchanged(), /Out-of-scope file: collision-policy/);
});
