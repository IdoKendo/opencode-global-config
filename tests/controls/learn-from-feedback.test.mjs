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
  return matches[0].code.call(world);
}

const lint = { action: 'configure-tool', target: 'eslint.config.mjs', deferUntilRepeated: false,
  rule: { id: 'no-console', currentlyEnabled: false, proposedSeverity: 'error', allowedMethods: [] },
  replacement: { source: 'console.log', targetCategory: 'application-logger' } };
const gap = { ...lint, action: 'repair-execution', target: 'package.json',
  rule: { ...lint.rule, currentlyEnabled: true },
  execution: { script: 'ci', current: [['node', '--check', 'src/worker.js']],
    proposed: [['npm', 'run', 'lint'], ['node', '--check', 'src/worker.js']] } };
const judgment = { action: 'update-guidance', target: '.opencode/skills/change-investigation/SKILL.md',
  deferUntilRepeated: false,
  feedbackDecisions: [{ source: 'review.md', line: 4, decision: 'adopt' },
    { source: 'review.md', line: 7, decision: 'reject' }],
  retainedRequirements: [{ source: 'review.md', line: 8, value: 120, unit: 'seconds' }] };
const cases = [
  ['the feedback recommendation enables the existing console rule', lint, [
    (v) => { v.action = 'new-tool'; },
    (v) => { v.target = 'AGENTS.md'; },
    (v) => { v.rule.id = 'no-debugger'; },
    (v) => { v.rule.proposedSeverity = 'off'; },
    (v) => { v.rule.allowedMethods = ['log']; },
    (v) => { v.replacement.targetCategory = 'standard-output'; },
    (v) => { v.replacement.source = 'src/worker.js:99'; },
    (v) => { v.replacement.source = 'src/other.js:1'; },
    (v) => { v.deferUntilRepeated = true; },
  ]],
  ['the feedback recommendation repairs the missing lint invocation', gap, [
    (v) => { v.action = 'configure-tool'; },
    (v) => { v.rule.currentlyEnabled = false; },
    (v) => { v.target = 'eslint.config.mjs'; },
    (v) => { v.execution.script = 'test'; },
    (v) => { v.execution.current = [['npm', 'run', 'lint']]; },
    (v) => { v.execution.proposed.shift(); },
    (v) => { v.execution.proposed.pop(); },
    (v) => { v.execution.proposed[0] = ['npm', 'run', 'missing']; },
  ]],
  ['the feedback recommendation improves investigation guidance and preserves the exception', judgment, [
    (v) => { v.action = 'new-tool'; },
    (v) => { v.target = 'AGENTS.md'; },
    (v) => { v.deferUntilRepeated = true; },
    (v) => { v.feedbackDecisions[0].decision = 'already-covered'; },
    (v) => { v.feedbackDecisions[1].decision = 'adopt'; },
    (v) => { v.feedbackDecisions.push({ source: 'review.md', line: 7, decision: 'adopt' }); },
    (v) => { v.retainedRequirements = []; },
    (v) => { v.retainedRequirements[0].value = 30; },
    (v) => { v.retainedRequirements[0].unit = 'milliseconds'; },
  ]],
];

for (const [step, good, mutations] of cases) {
  test(step, async () => {
    for (const explanation of [undefined, 'Use the existing safeguard.',
      'Address the execution path rather than adding a duplicate policy.']) {
      const json = JSON.stringify({ ...good, explanation });
      await invoke(step, { handoff: json });
      await invoke(step, { handoff: `\`\`\`json\n${json}\n\`\`\`` });
    }
    for (const mutate of mutations) {
      const bad = structuredClone(good);
      mutate(bad);
      await assert.rejects(() => invoke(step, { handoff: JSON.stringify(bad) }), assert.AssertionError);
    }
    await assert.rejects(() => invoke(step, { handoff: 'I will remember next time.' }), SyntaxError);
});
}

test('feedback accepts source locations and either order of independent CI checks', async () => {
  await invoke(cases[0][0], { handoff: JSON.stringify({ ...lint,
    replacement: { ...lint.replacement, source: 'src/worker.js:1' } }) });
  await invoke(cases[1][0], { handoff: JSON.stringify({ ...gap,
    execution: { ...gap.execution, proposed: [...gap.execution.proposed].reverse() } }) });
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
