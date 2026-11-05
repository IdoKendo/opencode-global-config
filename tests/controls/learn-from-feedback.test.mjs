import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';

const { runConfiguration } = await loadConfiguration({ file: false, provided: {
  paths: [], require: [],
  import: [fileURLToPath(new URL('../steps/learn-from-feedback.mjs', import.meta.url))],
} });
const support = await loadSupport(runConfiguration);
async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(matches.length, 1);
  const { parameters } = await matches[0].getInvocationParameters({ step: { text }, world });
  return matches[0].code.apply(world, parameters);
}

const cases = [
  ['the feedback recommendation enables the existing console rule',
    'Enable no-console in eslint.config.mjs. Use the application logger.',
    ['no-console', 'eslint.config.mjs', 'logger']],
  ['the feedback recommendation repairs the missing lint invocation',
    'no-console is already enabled. The CI script uses node --check only. Add npm run lint.',
    ['no-console', 'already enabled', 'CI script', 'node --check', 'npm run lint']],
  ['the feedback recommendation improves investigation guidance and preserves the exception',
    'Update change-investigation to read callers and lifecycle requirements. '
      + 'Reject the global cap: archives need 120 seconds.',
    ['change-investigation', 'callers', 'lifecycle', '120', 'Reject']],
];

for (const [step, good, required] of cases) {
  test(step, async () => {
    await invoke(step, { handoff: good });
    await invoke(step, { handoff: `**Recommendation:** ${good}` });
    for (const phrase of required) {
      await assert.rejects(() => invoke(step, { handoff: good.replace(phrase, 'omitted') }),
        assert.AssertionError);
    }
    await assert.rejects(() => invoke(step, { handoff: 'I will remember next time.' }),
      assert.AssertionError);
  });
}

test('harm-based rejection preserves the valid exception without endorsing the cap', async () => {
  const step = cases[2][0];
  const context = 'Update change-investigation to read callers and lifecycle requirements. '
    + 'Archive exports legitimately require 120 seconds. ';
  await invoke(step, {
    handoff: context + 'A global 30-second timeout cap would break that valid use case.',
  });
  for (const advice of [
    'A global 30-second cap is appropriate.',
    'Apply the global cap even though it would break the valid archive use case.',
    'A global cap would preserve that valid use case.',
    '',
  ]) {
    await assert.rejects(() => invoke(step, { handoff: context + advice }),
      /Missing rejection of blanket timeout ban/);
  }
});

test('a single correction cannot be deferred until it repeats', async () => {
  await assert.rejects(() => invoke(cases[0][0], {
    handoff: cases[0][1] + ' Wait for a second occurrence.',
  }), /Single occurrence incorrectly deferred/);
});

test('discovery requires successful selection of the intended skill', async () => {
  const step = 'learn-from-feedback is selected through normal skill discovery';
  const selected = { name: 'skill', input: { id: 'learn-from-feedback' }, status: 'completed' };
  await invoke(step, { tools: [selected] });
  for (const tools of [[], [{ ...selected, status: 'error' }],
    [{ ...selected, input: { id: 'build-the-tool' } }]]) {
    await assert.rejects(() => invoke(step, { tools }), /Missing successful/);
  }
});
