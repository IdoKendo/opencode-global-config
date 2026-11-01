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
