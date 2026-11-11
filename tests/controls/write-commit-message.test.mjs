import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';

const { runConfiguration } = await loadConfiguration({ file: false, provided: {
  paths: [], require: [],
  import: [fileURLToPath(new URL('../steps/write-commit-message.mjs', import.meta.url))],
} });
const support = await loadSupport(runConfiguration);
async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(matches.length, 1);
  return matches[0].code.call(world);
}

for (const [step, good, bad] of [
  ['the commit subject describes faster evaluation',
    ['ci: speed up agent evaluation with parallel execution', 'ci: cut evaluation time from 24 minutes to 2 minutes'],
    ['ci: run agent evaluation with 39 parallel workers', 'ci: speed up uploads',
      'Speed up agent evaluation', 'ci: speed up agent evaluation\nAlso changed files']],
  ['the commit message does not turn local measurements into CI results',
    ['ci: speed up agent evaluation', 'ci: accelerate agent evaluation by 18x locally',
      'ci: reduce agent-evaluation runtime with 39 parallel Cucumber workers'],
    ['ci: speed up CI agent evaluation by 18x', 'ci: reduce evaluation from 1557s to 87s',
      'ci: speed up evaluation 18x with 39 parallel Cucumber workers']],
  ['the commit message reports the measured CI reduction',
    ['ci: cut evaluation time from 24 minutes to 2 minutes', 'ci: speed up agent evaluation by 12x',
      'ci: cut agent evaluation step from 24 to 2 minutes with parallel scenarios'],
    ['ci: speed up agent evaluation by 18x', 'ci: speed up agent evaluation',
      'ci: cut total workflow duration from 24 minutes to 2 minutes',
      'ci: cut evaluation from 24 to 2 seconds', 'ci: cut evaluation from 2 to 24 minutes']],
]) {
  test(step, async () => {
    for (const handoff of good) await invoke(step, { handoff });
    for (const handoff of bad) await assert.rejects(() => invoke(step, { handoff }), assert.AssertionError);
  });
}

test('commit-message discovery requires a successful selection', async () => {
  const step = 'write-commit-message is selected through normal skill discovery';
  const selected = { name: 'skill', input: { id: 'write-commit-message' }, status: 'completed' };
  await invoke(step, { tools: [selected] });
  for (const tools of [[], [{ ...selected, status: 'error' }],
    [{ ...selected, input: { id: 'shape-output' } }]]) {
    await assert.rejects(() => invoke(step, { tools }), /Missing successful/);
  }
});
