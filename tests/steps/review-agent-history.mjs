import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';
import { readFileSync } from 'node:fs';
import { files } from '../support/harness.mjs';

function corpus(scenario) {
  return JSON.parse(readFileSync(new URL(
    `../fixtures/review-agent-history/${scenario}/history.json`, import.meta.url), 'utf8'));
}

function provenance(value, scenario) {
  const { messages } = corpus(scenario);
  for (const finding of value.findings) {
    const sources = messages.filter((item) => item.topic === finding.topic
      && item.date >= '2026-10-01' && item.date <= '2026-10-31');
    assert.ok(Array.isArray(finding.evidence) && finding.evidence.length > 0);
    for (const id of [...finding.evidence, ...(finding.supersededEvidence ?? [])]) {
      assert.ok(sources.some((item) => item.id === id), `Unsubstantiated reference ${id}`);
    }
    for (const { message, quote } of finding.proposalRequirements ?? []) {
      assert.ok(sources.some((item) => item.id === message && quote?.trim() && item.text.includes(quote)),
        'Requirement must quote its in-scope source');
    }
  }
}

function complete(value) {
  const range = { start: '2026-10-01', end: '2026-10-31', timezone: 'UTC' };
  assert.equal(value.coverage.status, 'complete');
  assert.deepEqual(value.coverage.requested, range);
  assert.deepEqual(value.coverage.available, range);
  assert.equal(value.coverage.paginationExhausted, true);
  assert.equal(value.coverage.archivedChecked, true);
  assert.deepEqual(value.coverage.pendingCursors, []);
  assert.deepEqual(value.coverage.unavailableSources, []);
}

function requirements(finding, message, clauses) {
  const quotes = (finding.proposalRequirements ?? []).filter((item) => item.message === message);
  for (const clause of clauses) {
    assert.ok(quotes.some((item) => item.quote.includes(clause)), `Missing source requirement: ${clause}`);
  }
}

function guidance(finding, path, field) {
  const inventory = readFileSync(new URL(
    '../fixtures/review-agent-history/common/guidance/current.md', import.meta.url), 'utf8');
  const section = inventory.split(/^## /m).find((entry) => entry.includes(`Path: ${path}\n`));
  const heading = section?.split('\n')[0];
  const text = section?.split('\n').find((line) => line.startsWith(`${field}: `))?.slice(field.length + 2);
  assert.ok(finding.guidanceReferences?.some((item) => item.quote?.trim() && text?.includes(item.quote)
    && ((item.path === path && item.section?.toLowerCase() === field.toLowerCase())
      || (item.path === 'guidance/current.md' && item.section === heading))),
    `Missing guidance reference: ${path}`);
}

export function report(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));
}

export function checkMixed(value) {
  provenance(value, 'mixed');
  complete(value);
  const actionable = value.findings.filter((item) => !['covered', 'insufficient'].includes(item.category));
  assert.deepEqual(actionable.map((item) => item.topic), ['release-analysis']);
  const finding = actionable[0];
  assert.equal(finding.category, 'new-skill');
  assert.equal(finding.occurrences, 1, 'Forks are not independent occurrences');
  assert.ok(finding.evidence.includes('s1/m1'), 'Missing original evidence');
  assert.equal(finding.interpretation, 'explicit');
  for (const field of ['quote', 'currentCoverage', 'target', 'proposal', 'benefit', 'confidence']) {
    assert.ok(finding[field]?.trim(), `Missing ${field}`);
  }
  assert.ok(corpus('mixed').messages.find(({ id }) => id === 's1/m1').text.includes(finding.quote),
    'Finding must quote original evidence');
  requirements(finding, 's1/m1', [
    'compare successful deployments', 'exclude manual approval waits', 'report median and p95 duration',
  ]);
  for (const [id, kind] of [['s3/m1', 'synthetic'], ['s4/m1', 'temporary'], ['s5/m1', 'automated']]) {
    assert.ok(value.excluded.some((item) => item.message === id && item.kind === kind && item.reason?.trim()),
      `Missing exclusion or incorrect basis for ${id}`);
  }
}

export function checkCoverage(value) {
  complete(value);
  provenance(value, 'coverage');
  const byTopic = Object.fromEntries(value.findings.map((item) => [item.topic, item]));
  assert.equal(Object.keys(byTopic).length, value.findings.length, 'Conflicting or duplicate topics');
  assert.equal(byTopic['doc-inventory']?.category, 'covered');
  guidance(byTopic['doc-inventory'], 'skills/documentation/SKILL.md', 'Body');
  assert.equal(byTopic['incident-trigger']?.category, 'discovery');
  guidance(byTopic['incident-trigger'], 'skills/incident-review/SKILL.md', 'Description');
  requirements(byTopic['incident-trigger'], 's7/m1', [
    'When I ask for a postmortem, use our incident review skill too',
  ]);
  assert.ok(byTopic['incident-trigger'].proposal?.trim(), 'Missing discovery proposal');
  assert.equal(byTopic['incident-trigger'].target, 'skills/incident-review/SKILL.md');
  assert.equal(byTopic['incident-trigger'].targetSection.toLowerCase(), 'description');
  assert.equal(byTopic['external-review']?.category, 'covered');
  guidance(byTopic['external-review'], 'skills/review-workflow/SKILL.md', 'Body');
  assert.ok(byTopic['external-review'].evidence.includes('s8/m2'), 'Missing preference reversal');
  assert.deepEqual(byTopic['external-review'].supersededEvidence, ['s8/m1']);
  assert.deepEqual(value.findings.filter((item) => !['covered', 'insufficient'].includes(item.category))
    .map((item) => item.topic), ['incident-trigger']);
}

export function checkPartial(value) {
  provenance(value, 'partial');
  assert.equal(value.coverage.status, 'partial');
  assert.ok(value.coverage.limitations?.some((item) => item.trim()), 'Missing coverage explanation');
  assert.deepEqual(value.coverage.requested,
    { start: '2026-10-01', end: '2026-10-31', timezone: 'UTC' });
  assert.deepEqual(value.coverage.available,
    { start: '2026-10-13', end: '2026-10-20', timezone: 'UTC' });
  assert.equal(value.coverage.paginationExhausted, false);
  assert.deepEqual(value.coverage.pendingCursors, ['page-2']);
  assert.deepEqual(value.coverage.unavailableSources, ['OtherChat']);
  assert.equal(value.coverage.archivedChecked, false);
  assert.ok(value.findings.length > 0, 'Available evidence must still be reviewed');
  for (const finding of value.findings) {
    assert.equal(finding.topic, 'doc-inventory');
    assert.equal(finding.category, 'covered');
    assert.deepEqual(finding.evidence, ['s9/m1']);
  }
}

Given(/^a history export with (?:ordinary feedback mixed with generated and forked messages|covered guidance and a reversed preference|a failed page and an unavailable chat source)$/, async function () {
  const data = JSON.parse(await this.fixture('history.json'));
  assert.ok(data.messages.length > 0);
});

Then('the history audit selects review-agent-history', function () {
  assert.ok(this.tools.some((tool) => tool.name === 'skill'
    && tool.input.id === 'review-agent-history' && tool.status === 'completed'));
});
Then('only the original release request within the message-date window becomes a new skill suggestion', function () {
  checkMixed(report(this.handoff));
});
Then('the audit distinguishes covered guidance from a discovery failure and a reversal', function () {
  checkCoverage(report(this.handoff));
});
Then('the audit reports partial coverage without inventing missing conversations', function () {
  checkPartial(report(this.handoff));
});
Then('the history review leaves the workspace unchanged', async function () {
  assert.deepEqual(await files(this.workspace), this.original);
  assert.equal(await this.git(['rev-parse', 'HEAD']), this.beforeHead);
  assert.equal(await this.git(['status', '--porcelain']), '');
  assert.ok(!this.tools.some((tool) => /patch|write|subagent/.test(tool.name)),
    'Audit attempted a write or delegation');
});
