import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';

const { runConfiguration } = await loadConfiguration({
  file: false,
  provided: { paths: [], require: [],
    import: [fileURLToPath(new URL('../steps/review-agent-history.mjs', import.meta.url))] },
});
await loadSupport(runConfiguration);
const { checkMixed, checkCoverage, checkPartial, report } =
  await import('../steps/review-agent-history.mjs');

const release = {
  topic: 'release-analysis', category: 'new-skill', occurrences: 1, evidence: ['s1/m1'],
  interpretation: 'explicit', quote: 'Please make a reusable release analysis workflow',
  currentCoverage: 'No existing release workflow', target: 'skills/release-analysis/SKILL.md',
  proposal: 'Exclude manual approval waits; report median and p95 duration.',
  benefit: 'Repeatable release comparisons', confidence: 'high',
};
const mixed = { coverage: { status: 'complete' }, findings: [release],
  excluded: ['s3/m1', 's4/m1', 's5/m1'].map((message) => ({ message, reason: 'Synthetic or temporary' })) };
const covered = { findings: [
  { topic: 'doc-inventory', category: 'covered', currentCoverage: 'documentation skill' },
  { topic: 'incident-trigger', category: 'discovery', proposal: 'Add postmortem trigger', target: 'incident-review' },
  { topic: 'external-review', category: 'covered', evidence: ['s8/m2'] },
] };
const partial = { coverage: { status: 'partial', limitations: [
  'page-2 failed; OtherChat unavailable; available 2026-10-13 through 2026-10-20; archives unchecked',
] }, findings: [{ topic: 'doc-inventory', category: 'covered', evidence: ['s9/m1'] }] };

function rejectsMutation(check, good, mutate) {
  check(good);
  const bad = structuredClone(good);
  mutate(bad);
  assert.throws(() => check(bad), assert.AssertionError);
}

test('history screening rejects synthetic recommendations, duplicate counts, and missing provenance', () => {
  rejectsMutation(checkMixed, mixed, (v) => v.findings.push({ ...release, topic: 'pirate-format' }));
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].occurrences = 2; });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].evidence = ['s2/m1']; });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].proposal = ''; });
  rejectsMutation(checkMixed, mixed, (v) => { v.excluded.pop(); });
});
test('coverage checks reject duplicate rules, wrong destinations, and superseded preferences', () => {
  const capitalized = structuredClone(covered);
  capitalized.findings[0].currentCoverage = 'guidance/current.md, Documentation skill';
  checkCoverage(capitalized);
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[0].category = 'new-skill'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[1].category = 'new-skill'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[1].target = 'AGENTS.md'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[2].evidence = ['s8/m1']; });
});
test('partial evidence cannot become full coverage, an empty audit, or invented evidence', () => {
  const namedDates = structuredClone(partial);
  namedDates.coverage.limitations = [
    'Requested October 1–31, 2026. Available October 13–20. page-2 failed; OtherChat denied; archives unchecked',
  ];
  checkPartial(namedDates);
  rejectsMutation(checkPartial, namedDates, (v) => {
    v.coverage.limitations[0] = v.coverage.limitations[0].replace('13–20', '1–31');
  });
  rejectsMutation(checkPartial, partial, (v) => {
    v.coverage.limitations[0] = v.coverage.limitations[0].replace('2026-10-20', '2026-10-31');
  });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.status = 'complete'; });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.limitations = []; });
  rejectsMutation(checkPartial, partial, (v) => { v.findings = []; });
  rejectsMutation(checkPartial, partial, (v) => { v.findings[0].evidence = ['other/m1']; });
});
test('dashboard reports accept plain or fenced JSON and reject malformed output', () => {
  const json = JSON.stringify(partial);
  assert.deepEqual(report(json), partial);
  assert.deepEqual(report('```json\n' + json + '\n```'), partial);
  assert.throws(() => report('Audit complete'), SyntaxError);
});
