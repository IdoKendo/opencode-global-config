import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';

const { runConfiguration } = await loadConfiguration({
  file: false,
  provided: { paths: [], require: [],
    import: [fileURLToPath(new URL('../steps/shape-output.mjs', import.meta.url))] },
});
const support = await loadSupport(runConfiguration);

async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((step) => step.matchesStepName(text));
  assert.equal(matches.length, 1, `Expected one binding for ${text}`);
  const { parameters } = await matches[0].getInvocationParameters({ step: { text }, world });
  return matches[0].code.apply(world, parameters);
}

async function rejects(step, good, bad, message) {
  await invoke(step, { handoff: good });
  await assert.rejects(() => invoke(step, { handoff: bad }), (error) => {
    assert.ok(error instanceof assert.AssertionError);
    assert.match(error.message, message);
    return true;
  });
}

test('archive guidance rejects collapsed, reordered, missing, and invented actions', async () => {
  const step = 'the response gives numbered archive actions in dependency order';
  const actions = ['Run `tar -cf rehearsal.tar sample/`.', 'Run `tar -tf rehearsal.tar`.',
    'Run `mv rehearsal.tar reviewed/`.'];
  const numbered = (rows) => rows.map((row, index) => `${index + 1}. ${row}`).join('\n');
  const good = numbered(actions);
  for (const bad of [actions.join(' '), numbered(actions.slice(0, 2))]) {
    await rejects(step, good, bad, /separate numbered archive actions/);
  }
  for (const rows of [[actions[1], actions[0], actions[2]],
    [actions[0], 'Check disk space.', actions[2]],
    [actions[0] + actions[1], 'Check disk space.', actions[2]]]) {
    await rejects(step, good, numbered(rows), /separate ordered actions/);
  }
  await rejects(step, good, good + '\nThis takes 2 minutes.', /Unsupported duration/);
  await rejects(step, good, numbered([...actions, 'Check space.', 'Read logs.', 'Clean up.']), /at most five/);
});

test('diagnostic reset rejects another guess or an unfocused question set', async () => {
  const step = 'the response questions the transient-error assumption and asks one diagnostic question';
  const good = 'The transient-network assumption may be wrong. What exact error and status code does the upload return?';
  await rejects(step, good, 'What exact error does the upload return?', /Missing reconsideration/);
  await rejects(step, good, good + ' What OS is this?', /one diagnostic question/);
  await rejects(step, good, good.replace('?', '.'), /one diagnostic question/);
  await rejects(step, good, good.replace('What exact error and status code does the upload return?',
    'Should we try again?'), /missing error evidence/);
  await rejects(step, good, good + ' Increase the retry count to 16.', /speculative retry change/);
});

test('answer boundaries reject filler without requiring one exact phrasing', async () => {
  const step = 'the response starts with useful guidance and ends without pleasantries';
  for (const good of ['1. Create the archive.', 'Check the exact upload error.']) {
    await rejects(step, good, 'Let me explain. ' + good, /Announcement/);
    await rejects(step, good, good + ' Hope this helps.', /closing pleasantry/);
    await rejects(step, good, '', /Missing response/);
  }
});

test('factual answers reject wrong retention and manufactured work', async () => {
  const step = 'the response answers 14 days without inventing actions or estimates';
  for (const good of ['14 days.', 'Rehearsal archives are retained for **14 days**.']) {
    await rejects(step, good, '90 days.', /Lead with the retention answer/);
    for (const suffix of [' Next: delete old archives.', ' Run cleanup.', ' This takes 2 minutes.',
      ' Want me to clean up?', '\n1. Open the archive folder.']) {
      await rejects(step, good, good + suffix, /Invented action/);
    }
    await rejects(step, good, good + ' Hope this helps.', /closing pleasantry/);
  }
});

test('skill routing requires a completed selection of the intended skill', async () => {
  const step = 'shape-output is selected through normal skill discovery';
  const selected = { name: 'skill', input: { id: 'shape-output' }, status: 'completed' };
  await invoke(step, { tools: [selected] });
  for (const tools of [[], [{ ...selected, status: 'error' }],
    [{ ...selected, input: { id: 'write-docs' } }]]) {
    await assert.rejects(() => invoke(step, { tools }), (error) =>
      error instanceof assert.AssertionError && /Missing successful/.test(error.message));
  }
  const factual = 'shape-output is not selected for the factual answer';
  await invoke(factual, { tools: [] });
  await invoke(factual, { tools: [{ ...selected, input: { id: 'write-docs' } }] });
  await assert.rejects(() => invoke(factual, { tools: [selected] }), (error) =>
    error instanceof assert.AssertionError && /Unnecessary shape-output selection/.test(error.message));
});

const performance = `## Summary
Replace repeated linear lookups with a request-local index.

## Local performance
Median before: 240 ms; after: 180 ms.
10 measured samples per version, after one warm-up run.
100,000 input records, fixed seed 17, one worker.
Node.js 24 on macOS arm64, same laptop for both versions.

## Verification
Existing result tests passed locally.
CI: not run; CI_RUN_TOKEN is unavailable.
Production: not checked; PROD_READ_TOKEN is unavailable.
No end-to-end improvement is established.
`;

test('shared descriptions accept neutral variants and reject provider labels in titles or prose', async () => {
  const step = 'the shared change description uses platform-neutral terminology';
  for (const title of ['Change description', 'Performance update', 'Summary of changes']) {
    await invoke(step, { handoff: `# ${title}\n${performance}` });
  }
  await invoke(step, { handoff: performance + '\nThis update reduces repeated lookups.' });
  for (const label of ['PR', 'MR', 'pull request', 'merge request', 'pullrequest',
    'mergerequest', 'GitHub', 'GitLab']) {
    for (const bad of [`# ${label} description\n${performance}`,
      performance + `\nThis ${label} change reduces repeated lookups.`]) {
      // These mutations still satisfy the evidence contract; only terminology should reject them.
      await invoke('the response is a complete Markdown change description with local performance evidence',
        { handoff: bad });
      await invoke('the change description names the missing CI and production credentials without claiming success',
        { handoff: bad });
      await rejects(step, performance, bad, /Unrequested provider-specific terminology/);
    }
  }
});

test('explicit GitLab templates preserve the requested heading and reject provider substitution', async () => {
  const step = 'the requested GitLab description preserves the MR description heading';
  const good = `# MR description\n${performance}`;
  for (const handoff of [good, `### mr description\n${performance}`,
    `## **MR description** ##\n${performance}`]) {
    await invoke(step, { handoff });
    await invoke('the response is a complete Markdown change description with local performance evidence',
      { handoff });
    await invoke('the change description names the missing CI and production credentials without claiming success',
      { handoff });
  }
  for (const heading of ['# Change description', '# Summary', '# Merge request',
    'MR description', 'This MR description replaces repeated lookups.']) {
    await rejects(step, good, `${heading}\n${performance}`,
      /Missing explicitly requested MR description heading/);
  }
  for (const label of ['GitHub', 'PR', 'pull request']) {
    await rejects(step, good, good + `\nPaste this MR description into the ${label} review.`,
      /Wrong provider terminology/);
  }
});

test('change description checker preserves timing direction and benchmark conditions in prose or tables', async () => {
  const step = 'the response is a complete Markdown change description with local performance evidence';
  await invoke(step, { handoff: performance });
  await invoke(step, { handoff: performance.replace(/^## .*\n/gm, '') });
  const table = performance.replace('Median before: 240 ms; after: 180 ms.',
    '| Metric | Before | After |\n| --- | --- | --- |\n| Median | 240 ms | 180 ms |');
  await invoke(step, { handoff: table });
  await invoke(step, { handoff: performance.replace('Median before: 240 ms; after: 180 ms.',
    'Median: 240 ms → 180 ms.') });
  await invoke(step, { handoff: performance.replace('request-local', 'per-request')
    .replace('macOS arm64', 'macOS (arm64)').replace('10 measured samples', '10 measured runs') });
  await invoke(step, { handoff: `\`\`\`markdown\n${performance.trim()}\n\`\`\`` });
  for (const [before, after, reason] of [
    ['Median before: 240 ms; after: 180 ms.', 'Median before: 180 ms; after: 240 ms.', /before\/after timing/],
    ['Median', 'Elapsed', /median statistic/], ['10 measured samples', '5 samples', /sample count/],
    ['per version', 'in total', /samples per version/],
    ['100,000 input records', '10,000 input records', /input size/], ['seed 17', 'seed 19', /fixed seed/],
    ['one worker', 'four workers', /worker count/], ['Node.js 24', 'Node.js 22', /Node version/],
    ['macOS arm64', 'Linux arm64', /platform/], ['one warm-up run', 'no warm-up run', /warm-up condition/],
    ['same laptop', 'different laptops', /same host/],
    ['request-local index', 'cache', /Missing change summary/],
  ]) await rejects(step, performance, performance.replace(before, after), reason);
  await rejects(step, table, table.replace('| 240 ms | 180 ms |', '| 180 ms | 240 ms |'), /before\/after timing/);
  await rejects(step, performance, performance.replace('Median before: 240 ms; after: 180 ms.',
    'Median: 180 ms → 240 ms.'), /before\/after timing/);
  await rejects(step, performance, 'I can write the change description for you.', /Artifact deferred/);
  await rejects(step, performance, performance + '\nWould you like me to prepare the change description?', /Artifact deferred/);
});

test('change description limitations reject missing prerequisites and inflated CI or runtime claims', async () => {
  const step = 'the change description names the missing CI and production credentials without claiming success';
  await invoke(step, { handoff: performance });
  await invoke(step, { handoff: performance.replace('CI: not run', 'CI has not been verified') });
  for (const token of ['CI_RUN_TOKEN', 'PROD_READ_TOKEN']) {
    await rejects(step, performance, performance.replace(token, 'credentials'), /Missing prerequisite/);
  }
  for (const [before, after, reason] of [
    ['CI: not run; CI_RUN_TOKEN is unavailable.', 'CI results: see CI_RUN_TOKEN.', /Missing CI verification limit/],
    ['Production: not checked; PROD_READ_TOKEN is unavailable.', 'Production results: see PROD_READ_TOKEN.', /Missing production verification limit/],
  ]) await rejects(step, performance, performance.replace(before, after), reason);
  for (const claim of ['CI passed.', 'Production is 25% faster.', 'End-to-end runtime improved by 25%.',
    'CI passed with no failures.', 'Production improved without errors.',
    'CI has not been verified but production improved.']) {
    await rejects(step, performance, performance + claim, /Unsupported CI, production, or runtime success claim/);
  }
});
