import assert from 'node:assert/strict';
import { files } from './harness.mjs';

export function reviewReport(text) {
  const value = JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1'));
  for (const name of ['Requirements', 'Code quality']) {
    assert.ok(value[name], `Missing separate ${name} result`);
    assert.ok(['pass', 'findings', 'unavailable'].includes(value[name].status));
    assert.ok(Array.isArray(value[name].findings));
    assert.ok(value[name].explanation?.trim(), `Missing ${name} evidence or limitation`);
  }
  return value;
}

export function checkRequirements(value) {
  const result = value.Requirements;
  assert.equal(result.status, 'findings');
  const finding = result.findings.find((item) => item.file === 'shipping.mjs');
  assert.ok(finding, 'Missing shipping requirement finding');
  assert.ok([2].includes(finding.line), 'Finding must locate the changed condition');
  assert.match(finding.source, /request\.md/);
  assert.match(finding.detail, /5000|5,000|50(?:\.00)?/);
  assert.match(finding.detail, /exact|equal|boundary|threshold|inclusiv|>=/i);
  assert.match(finding.detail, /500|5(?:\.00)?|charg|paid|fee/i);
}

export function checkQuality(value) {
  const result = value['Code quality'];
  assert.equal(result.status, 'findings');
  const finding = result.findings.find((item) => item.file === 'receipt.mjs');
  assert.ok(finding, 'Quality review must continue and identify logging violation');
  assert.equal(finding.line, 2);
  assert.match(finding.source, /AGENTS\.md/);
  assert.match(finding.detail, /console/i);
  assert.match(finding.detail, /logger|structured|collector/i);
}

export function checkUnavailable(value) {
  assert.equal(value.Requirements.status, 'unavailable');
  assert.deepEqual(value.Requirements.findings, [], 'Do not invent requirements');
  assert.match(value.Requirements.explanation, /unavailable|missing|cannot|not (?:available|provided|found)|no .*(?:spec|request|ticket|criteria)/i);
}

export async function reviewState(world) {
  return {
    files: await files(world.workspace),
    head: await world.git(['rev-parse', 'HEAD']),
    index: await world.git(['ls-files', '--stage']),
    status: await world.git(['status', '--porcelain=v1', '--untracked-files=all']),
    refs: await world.git(['show-ref']),
  };
}

export async function checkPreserved(world) {
  assert.deepEqual(await reviewState(world), world.beforeReview,
    'Review changed files, index, HEAD, refs, or untracked work');
}
