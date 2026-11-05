import assert from 'node:assert/strict';
import { Given, Then } from '@cucumber/cucumber';
import { files } from '../support/harness.mjs';

export function report(text) {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));
}

export function checkMixed(value) {
  assert.equal(value.coverage.status, 'complete');
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
  assert.match(finding.proposal, /median/i);
  assert.match(finding.proposal, /p95/i);
  for (const id of ['s3/m1', 's4/m1', 's5/m1']) {
    assert.ok(value.excluded.some((item) => item.message === id && item.reason), `Missing exclusion ${id}`);
  }
}

export function checkCoverage(value) {
  const byTopic = Object.fromEntries(value.findings.map((item) => [item.topic, item]));
  assert.equal(byTopic['doc-inventory']?.category, 'covered');
  assert.match(byTopic['doc-inventory'].currentCoverage, /documentation/i);
  assert.equal(byTopic['incident-trigger']?.category, 'discovery');
  assert.match(byTopic['incident-trigger'].proposal, /postmortem/i);
  assert.match(byTopic['incident-trigger'].target, /incident-review/);
  assert.equal(byTopic['external-review']?.category, 'covered');
  assert.ok(byTopic['external-review'].evidence.includes('s8/m2'), 'Missing preference reversal');
  assert.deepEqual(value.findings.filter((item) => !['covered', 'insufficient'].includes(item.category))
    .map((item) => item.topic), ['incident-trigger']);
}

export function checkPartial(value) {
  assert.equal(value.coverage.status, 'partial');
  const limits = value.coverage.limitations.join(' ');
  assert.match(limits, /page-2/);
  assert.match(limits, /OtherChat/);
  const isoDates = /2026-10-13/.test(limits) && /2026-10-20/.test(limits);
  const namedDates = /\bOctober\s+13\s*(?:–|—|-|through|to)\s*(?:October\s+)?20\b/i.test(limits)
    && /\b2026\b/.test(limits);
  assert.ok(isoDates || namedDates, 'Missing available October 13–20, 2026 interval');
  assert.match(limits, /archiv/i);
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
Then('only the ordinary release request becomes a new skill suggestion', function () {
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
