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
    ['ci: speed up agent evaluation with parallel execution', 'ci: cut evaluation time from 24 minutes to 2 minutes',
      'ci: finish the agent suite sooner', 'ci: run evaluations in 120s instead of 1440s',
      'ci: speed up agent evals by 12x'],
    ['ci: run agent evaluation with 39 parallel workers', 'ci: speed up uploads',
      'Speed up agent evaluation', 'ci: speed up agent evaluation\nAlso changed files',
      'ci: measure agent evaluation speed', 'ci: speed up uploads without changing agent evaluation']],
  ['the subject makes no measured speed claim',
    ['ci: shorten evaluation with 39 workers', 'ci: reduce evaluation time with --parallel 39'],
    ['ci: speed up evaluation by 39x', 'ci: finish agent evaluation in 2 minutes',
      'ci: reduce evaluation time by 90%']],
  ['the commit message does not turn local measurements into CI results',
    ['ci: speed up agent evaluation', 'ci: accelerate agent evaluation by 18x locally',
      'ci: reduce agent-evaluation runtime with 39 parallel Cucumber workers',
      'ci: reduce agent evaluation wait time by running all 39 scenarios in parallel',
      'ci: shorten evaluation with --parallel 39', 'ci: accelerate evaluation (1557s → 87s locally)',
      'ci: cut local evaluation time by 94%', 'ci: finish local agent evaluation in 87 seconds'],
    ['ci: speed up CI agent evaluation by 18x', 'ci: reduce evaluation from 1557s to 87s',
      'ci: speed up evaluation 18x with 39 parallel Cucumber workers',
      'ci: speed up evaluation 18x by running 39 scenarios concurrently',
      'ci: accelerate CI evaluation by 99x locally', 'ci: cut local evaluation from 87s to 1557s',
      'ci: cut local evaluation time by 18%', 'ci: finish CI evaluation in 87 seconds',
      'ci: speed up local and CI agent evaluations by 18x']],
  ['the commit message reports the measured CI reduction',
    ['ci: cut evaluation time from 24 minutes to 2 minutes', 'ci: speed up agent evaluation by 12x',
      'ci: cut the agent evaluation step from 24 minutes to 2 by running scenarios in parallel',
      'ci: cut agent evaluation step from 24 to 2 minutes with parallel scenarios',
      'ci: finish evaluation in 120s instead of 24 minutes', 'ci: take evaluation from 24 min to 2 on CI',
      'ci: shrink evaluation time 1,440s → 120s', 'ci: cut CI evaluation time from 24 to 2 minutes'],
    ['ci: speed up agent evaluation by 18x', 'ci: speed up agent evaluation',
      'ci: cut total workflow duration from 24 minutes to 2 minutes',
      'ci: cut CI time from 24 to 2 minutes by parallelizing agent evaluation',
      'ci: cut the evaluation step from 24 minutes to 2 seconds by running scenarios in parallel',
      'ci: cut the evaluation step from 24 minutes to 2.5 by running scenarios in parallel',
      'ci: cut evaluation from 24 to 2 seconds', 'ci: cut evaluation from 2 to 24 minutes',
      'ci: cut evaluation from 2 to 24 minutes (12x faster)', 'ci: slow evaluation by 12x',
      'ci: run evaluation 112x faster', 'ci: cut evaluation from 124 minutes to 2 minutes']],
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
