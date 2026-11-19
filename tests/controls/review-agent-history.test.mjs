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
  proposalRequirements: [{ message: 's1/m1', quote: 'compare successful deployments, exclude manual approval waits, and report median and p95 duration' }],
  benefit: 'Repeatable release comparisons', confidence: 'high',
};
const october = { start: '2026-10-01', end: '2026-10-31', timezone: 'UTC' };
const coverage = { status: 'complete', requested: october, available: october, archivedChecked: true,
  paginationExhausted: true, pendingCursors: [], unavailableSources: [] };
const mixed = { coverage, findings: [release],
  excluded: [['s3/m1', 'synthetic'], ['s4/m1', 'temporary'], ['s5/m1', 'automated']]
    .map(([message, kind]) => ({ message, kind, reason: 'Not durable feedback' })) };
const covered = { coverage, findings: [
  { topic: 'doc-inventory', category: 'covered', currentCoverage: 'Existing guidance meets this request.',
    evidence: ['s6/m1'], guidanceReferences: [{ path: 'skills/documentation/SKILL.md', section: 'Body',
      quote: 'Link to authoritative sources instead of copying inventories.' }] },
  { topic: 'incident-trigger', category: 'discovery', proposal: 'Expand activation vocabulary.',
    target: 'skills/incident-review/SKILL.md', targetSection: 'description',
    evidence: ['s7/m1', 's7/m2'], guidanceReferences: [{ path: 'skills/incident-review/SKILL.md', section: 'Description',
      quote: 'incident retrospective' }],
    proposalRequirements: [{ message: 's7/m1', quote: 'When I ask for a postmortem, use our incident review skill too.' }] },
  { topic: 'external-review', category: 'covered', evidence: ['s8/m2'], supersededEvidence: ['s8/m1'],
    guidanceReferences: [{ path: 'skills/review-workflow/SKILL.md', section: 'Body',
      quote: 'Default to local review unless the user requests an external reviewer.' }] },
] };
const partial = { coverage: { status: 'partial', limitations: [
  'Only the accessible portion could be reviewed.',
], requested: { start: '2026-10-01', end: '2026-10-31', timezone: 'UTC' },
available: { start: '2026-10-13', end: '2026-10-20', timezone: 'UTC' },
paginationExhausted: false, pendingCursors: ['page-2'], archivedChecked: false,
unavailableSources: ['OtherChat'] }, findings: [{ topic: 'doc-inventory', category: 'covered', evidence: ['s9/m1'] }] };

function rejectsMutation(check, good, mutate) {
  check(good);
  const bad = structuredClone(good);
  mutate(bad);
  assert.throws(() => check(bad), assert.AssertionError);
}

test('history screening rejects synthetic recommendations, duplicate counts, and missing provenance', () => {
  rejectsMutation(checkMixed, mixed, (v) => v.findings.push({ topic: 'pirate-format',
    category: 'new-skill', evidence: ['s3/m1'] }));
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].occurrences = 2; });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].evidence = ['s2/m1']; });
  rejectsMutation(checkMixed, mixed, (v) => {
    v.findings.push({ topic: 'rollback-drill', category: 'new-skill', evidence: ['s2/m2'] });
  });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].evidence.push('s2/m2'); });
  rejectsMutation(checkMixed, mixed, (v) => {
    v.findings[0].proposalRequirements.push({ message: 's2/m2', quote: 'record the recovery time' });
  });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].proposal = ''; });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].quote = 'Do the opposite.'; });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].evidence.push('invented/m1'); });
  for (const quote of [
    'compare successful deployments',
    'exclude manual approval waits',
    'report median and p95 duration',
  ]) {
    rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].proposalRequirements[0].quote = quote; });
  }
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].proposalRequirements[0].message = 's2/m1'; });
  rejectsMutation(checkMixed, mixed, (v) => { v.findings[0].proposalRequirements[0].quote += ' invented'; });
  rejectsMutation(checkMixed, mixed, (v) => { v.excluded.pop(); });
  rejectsMutation(checkMixed, mixed, (v) => { v.excluded[0].kind = 'temporary'; });
});
test('coverage checks reject duplicate rules, wrong destinations, and superseded preferences', () => {
  rejectsMutation(checkCoverage, covered, (v) => {
    v.findings[0].guidanceReferences[0].path = 'skills/incident-review/SKILL.md';
  });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[0].category = 'new-skill'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[1].category = 'new-skill'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[1].target = 'AGENTS.md'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[1].targetSection = 'Body'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[0].guidanceReferences[0].section = 'Absent'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[0].guidanceReferences[0].quote = 'Invented'; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[1].proposalRequirements = []; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[2].evidence = ['s8/m1']; });
  rejectsMutation(checkCoverage, covered, (v) => { v.findings[2].supersededEvidence = []; });
  rejectsMutation(checkCoverage, covered, (v) => { v.coverage.status = 'partial'; });
});
test('partial evidence cannot become full coverage, an empty audit, or invented evidence', () => {
  rejectsMutation(checkPartial, partial, (v) => {
    v.coverage.available.end = '2026-10-31';
  });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.pendingCursors = []; });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.unavailableSources = []; });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.archivedChecked = true; });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.paginationExhausted = true; });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.status = 'complete'; });
  rejectsMutation(checkPartial, partial, (v) => { v.coverage.limitations = []; });
  rejectsMutation(checkPartial, partial, (v) => { v.findings = []; });
  rejectsMutation(checkPartial, partial, (v) => { v.findings[0].evidence = ['other/m1']; });
});
test('guidance references resolve inventory sections to their owning skills', () => {
  const value = structuredClone(covered);
  const headings = ['Documentation skill', 'Incident review skill', 'Review workflow'];
  value.findings.forEach((finding, index) => {
    Object.assign(finding.guidanceReferences[0], { path: 'guidance/current.md', section: headings[index] });
  });
  checkCoverage(value);
  rejectsMutation(checkCoverage, value, (v) => {
    v.findings[0].guidanceReferences[0].section = 'Incident review skill';
  });
  rejectsMutation(checkCoverage, value, (v) => {
    v.findings[0].guidanceReferences[0].path = 'guidance/missing.md';
  });
});
test('audit contracts accept paraphrased explanations with the same structured evidence', () => {
  const paraphrased = structuredClone(mixed);
  paraphrased.findings[0].proposal = 'Implement the requested comparison and distribution summary.';
  paraphrased.findings[0].currentCoverage = 'No applicable owner exists.';
  paraphrased.excluded.forEach((item) => { item.reason = 'Not durable user feedback.'; });
  checkMixed(paraphrased);
  const reworded = structuredClone(covered);
  reworded.findings[0].currentCoverage = 'The existing owner already addresses this.';
  reworded.findings[1].proposal = 'Recognize the alternate request phrasing.';
  checkCoverage(reworded);
  const dates = structuredClone(partial);
  dates.coverage.limitations = ['Retrieval and source availability constrain this audit.'];
  checkPartial(dates);
});
test('dashboard reports accept plain or fenced JSON and reject malformed output', () => {
  const json = JSON.stringify(partial);
  assert.deepEqual(report(json), partial);
  assert.deepEqual(report('```json\n' + json + '\n```'), partial);
  assert.throws(() => report('Audit complete'), SyntaxError);
});
