import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from '../support/control-fixture.mjs';

// Load bindings, not hooks: these controls never create an agent or run a model.
const { runConfiguration } = await loadConfiguration({
  file: false,
  provided: {
    paths: [],
    import: [fileURLToPath(new URL('../steps/write-docs.mjs', import.meta.url))],
    require: [],
  },
});
const support = await loadSupport(runConfiguration);

async function invoke(text, world) {
  const matches = support.stepDefinitions.filter((definition) => definition.matchesStepName(text));
  assert.equal(matches.length, 1, `Expected one binding for ${text}`);
  const definition = matches[0];
  const { parameters } = await definition.getInvocationParameters({ step: { text }, world });
  return definition.code.apply(world, parameters);
}

function world({ docs = {}, originals = {}, ...rest } = {}) {
  return {
    workspace: '/offline/write-docs',
    docs,
    async read(file) {
      assert.ok(Object.hasOwn(docs, file), `Control missing document: ${file}`);
      return docs[file];
    },
    async fixture(file) {
      assert.ok(Object.hasOwn(originals, file), `Control missing original: ${file}`);
      return originals[file];
    },
    async git(args) {
      if (args.join(' ') === 'diff --cached --name-only') return '';
      if (args.join(' ') === 'diff --name-only') return 'docs/retries.md\n';
      if (args.join(' ') === 'rev-parse HEAD') return 'original-head\n';
      throw new Error(`Unexpected git request: ${args}`);
    },
    beforeHead: 'original-head',
    tools: [],
    executions: [],
    handoff: '',
    ...rest,
  };
}

// Every mutation is paired with a successful independent example at the same binding.
// Checking AssertionError plus its operator/message excludes accidental TypeErrors
// and missing mock data from counting as useful rejection evidence.
async function control(step, good, bad, expected) {
  await invoke(step, world(good));
  await assert.rejects(() => invoke(step, world(bad)), (error) => {
    assert.ok(error instanceof assert.AssertionError);
    assert.equal(error.code, 'ERR_ASSERTION');
    if (typeof expected === 'string') assert.equal(error.operator, expected);
    else assert.match(error.message, expected);
    return true;
  });
}

test('STE checks distinguish prose from labels and reject specific rule violations', async () => {
  const good = 'Start the backup with the blue `Commence` button. Wait 30 seconds. Check the status.';
  const input = (text) => ({ docs: { 'document.md': text } });
  const style = 'the procedure omits unapproved general verbs and passive instructions';
  for (const [bad, expected] of [
    [good.replace('Start', 'Commence'), /Unapproved general verb/],
    [good.replace('Start the backup with', 'Utilize'), /Unapproved general verb/],
    [good.replace('Check the status.', 'The status must be checked.'), /Passive instruction/],
    ['', /Missing procedure prose/],
  ]) await control(style, input(good), input(bad), expected);
  const length = 'each procedure sentence has at most 20 words';
  const boundary = 'Use the blue button on the main control panel to start the backup before you check the status shown here.';
  await control(length, input(boundary), input(boundary.replace('shown here.', 'shown below here.')),
    /Procedure sentence has 21 words/);
  const facts = 'the procedure retains the backup, button label, and wait time';
  for (const [before, after] of [['backup', 'report'], ['blue', 'red'], ['`Commence`', '`Start`'],
    ['30 seconds', '60 seconds'], ['Check the status', 'Check the log']]) {
    await control(facts, input(good), input(good.replace(before, after)),
      before === '`Commence`' ? /Missing/ : 'match');
  }
  await control(facts, input(good), input(
    'Start the backup with the blue `Commence` button. Check the status. Wait 30 seconds.'),
  /Check status only after the wait/);
});

test('prose limit is inclusive and counts indentation', async () => {
  const step = 'every ordinary prose source line is at most 100 characters';
  for (const prefix of ['', '  - ']) {
    const line = prefix + 'x'.repeat(100 - prefix.length);
    await control(step, { docs: { 'document.md': line } },
      { docs: { 'document.md': `${line}x` } }, /Overlong prose \(101\)/);
  }
});

test('wrapping preserves prose and list content, order, and nesting', async () => {
  const original = 'Keep the cache warm for readers.\n\n- Start the worker\n  - Check its output\n- Stop the worker\n';
  const wrapped = 'Keep the cache\n warm for readers.\n\n- Start the\n  worker\n  - Check its\n    output\n- Stop the worker\n';
  const input = (text) => ({ docs: { 'document.md': text }, originals: { 'document.md': original } });
  await control('paragraph and list text is unchanged after normalizing wrapping whitespace',
    input(wrapped), input(wrapped.replace('warm', 'cold')), 'deepStrictEqual');
  for (const corrupted of [
    wrapped.replace('  - Check', '- Check'),
    wrapped.replace('- Start', '1. Start'),
    wrapped.replace('    output', '\noutput'),
    wrapped.replace('Start the', 'Stop the').replace('- Stop the worker', '- Start the worker'),
  ]) {
    await control('the list item order and nesting are unchanged',
      input(wrapped), input(corrupted), 'deepStrictEqual');
  }
  await invoke('the list item order and nesting are unchanged', world(input(
    wrapped.replace('  - Check', '    - Check').replace('    output', '      output'))));
  await invoke('the list item order and nesting are unchanged', world(input(
    wrapped.replace('    output', ' output')))); // Markdown permits lazy paragraph continuation.
});

test('long protected constructs survive verbatim while prose can wrap', async () => {
  const protectedText = [
    `| Setting | ${'value '.repeat(25)}|`,
    '```text', `client ${'-'.repeat(105)}> server`, '```',
    '```javascript', `console.log("${'payload'.repeat(18)}");`, '```',
    `[Full reference](https://example.org/${'segment/'.repeat(18)})`,
  ].join('\n');
  const original = `Read the following examples carefully.\n\n${protectedText}`;
  const valid = `Read the following\nexamples carefully.\n\n${protectedText}`;
  const input = (text) => ({ docs: { 'document.md': text }, originals: { 'document.md': original } });
  await invoke('every ordinary prose source line is at most 100 characters', world(input(valid)));
  for (const [before, after] of [
    ['| Setting |', '| Option |'], ['client ', 'caller '],
    ['console.log(', 'console.error('], ['example.org', 'example.net'],
    ['Full reference', 'Wrong reference'],
  ]) {
    await control('the table, diagram, code block, and URL are unchanged',
      input(valid), input(valid.replace(before, after)), 'deepStrictEqual');
  }
});

test('editing preserves factual caveats and removes filler', async () => {
  const valid = 'CacheBox has a TTL of 60 seconds. Expiration happens on the next read. No background timer removes expired entries.';
  const input = (text) => ({ docs: { 'document.md': text } });
  for (const [step, before, after, expected] of [
    ['the document still names CacheBox and its TTL of 60 seconds', '60', '90', 'match'],
    ['it still states that expiration is handled on the next read', 'next read', 'next write', 'match'],
    ['it still states that no background timer removes expired entries', 'No background', 'A background', 'match'],
    ['it omits "seamlessly", "obviously", and "simply"', 'CacheBox', 'CacheBox seamlessly', /Retained filler/],
  ]) await control(step, input(valid), input(valid.replace(before, after)), expected);
  await control('it still states that expiration is handled on the next read',
    input('Expired entries are removed on the next read.'),
    input('Expired entries are not removed on the next read.'), 'match');
  for (const connector of ['by', 'through']) {
    await control('it still states that expiration is handled on the next read',
      input(`Expired entries are removed on the next read, not\n${connector} a background timer.`),
      input(`Expired entries are not removed on the next read, not ${connector} a background timer.`), 'match');
  }
});

test('project conventions require the named sections and sentence-case headings', async () => {
  const step = 'the guide uses sentence-case headings and "Usage" and "Examples" sections';
  const good = '# Worker usage\n\n## Usage\n\n## Examples\n';
  const input = (text) => ({ docs: { 'docs/usage.md': text } });
  for (const [before, after, expected] of [
    ['## Usage', '## Attempts option', /Missing project section: Usage/],
    ['## Examples', '', /Missing project section: Examples/],
    ['# Worker usage', '# worker usage', /Heading lacks sentence case/],
    ['# Worker usage', '# Worker Usage', /Title-case heading/],
  ]) await control(step, input(good), input(good.replace(before, after)), expected);
});

test('source references must resolve to real validation, not nearby mentions', async () => {
  const source = [
    '// Worker entry point',
    'const attempts = 5;',
    'function unrelated() {',
    "  const text = '} attempts <= 0n; attempts must be positive';",
    '  return attempts;',
    '}',
    'function positiveInteger(value) {',
    '  const attempts = BigInt(value);',
    '  if (attempts <= 0n) {',
    "    throw new RangeError('attempts must be positive');",
    '  }',
    '  return attempts;',
    '}',
    'function main() {',
    "  return positiveInteger('3');",
    '}',
    '// attempts <= 0n; attempts must be positive',
    'try {',
    '  main();',
    '} catch (error) {',
    '  console.error(error.message);',
    '  process.exitCode = 2;',
    '  // attempts validation failure',
    '}',
    'try {',
    '  unrelated();',
    '} catch (error) {',
    '  console.error(error.message);',
    '}',
    "const message = 'console.error(error.message)';",
  ].join('\n');
  const input = (reference, code = source) => ({ docs: {
    'worker.mjs': code, 'docs/usage.md': `Positive integers only. See ${reference}.`,
  } });
  const step = 'source references use file paths and line numbers that locate the documented behavior';
  const integerSource = source.replace('  const attempts = BigInt(value);',
    "  if (!/^[+-]?\\d+$/.test(value.trim())) {\n"
    + "    throw new SyntaxError('attempts must be an integer');\n"
    + '  }\n  const attempts = BigInt(value);');
  const optionSource = source.replace("  return positiveInteger('3');",
    "  const option = '--attempts';\n  if (option === '--attempts') {\n"
    + "    return positiveInteger('3');\n  }");
  for (const [reference, code] of [
    ['worker.mjs:8-9 and worker.mjs:12-13', integerSource],
    ['worker.mjs:9-10 and worker.mjs:16', optionSource],
  ]) await invoke(step, world(input(reference, code)));
  await control(step, input('worker.mjs:9-10 and worker.mjs:21'), input('worker.mjs:21'),
    /References must locate validation/);
  for (const [reference, expected] of [
    ['worker.mjs:2', /References must locate validation/],
    ['worker.mjs:1', /Reference does not locate attempts behavior/],
    ['worker.mjs:999', '=='], ['worker.mjs:4-3', '=='],
    ['other/worker.mjs:9-10', 'strictEqual'],
    ['worker.mjs', /Missing worker.mjs:line/],
    ['worker.mjs:3', /References must locate validation/],
    ['worker.mjs:3-6', /References must locate validation/],
    ['worker.mjs:4', /Reference does not locate attempts behavior/],
    ['worker.mjs:17', /Reference does not locate attempts behavior/],
    ['worker.mjs:9-10 and worker.mjs:23', /Reference does not locate attempts behavior/],
    ['worker.mjs:9-10 and worker.mjs:27', /Reference does not locate attempts behavior/],
    ['worker.mjs:9-10 and worker.mjs:28', /Reference does not locate attempts behavior/],
    ['worker.mjs:9-10 and worker.mjs:30', /Reference does not locate attempts behavior/],
  ]) {
    await control(step, input('worker.mjs:9-10'), input(reference), expected);
  }
  for (const reference of ['worker.mjs:7', 'worker.mjs:10', 'worker.mjs:14', 'worker.mjs:15',
    'worker.mjs:9–10 and worker.mjs:2', 'worker.mjs:9-10 and worker.mjs:20',
    'worker.mjs:9-10 and worker.mjs:22']) {
    await control(step, input(reference), input('worker.mjs:2'), /References must locate validation/);
  }
  for (const code of [source.replace('throw new RangeError', 'console.log'),
    source.replace('attempts <= 0n) {', 'attempts > 0n) {')]) {
    await control(step, input('worker.mjs:9-10'), input('worker.mjs:9-10', code),
      /References must locate validation/);
  }
});

test('command highlighting requires a shell language for Node commands', async () => {
  await control('command examples appear in syntax-highlighted code blocks',
    { docs: { 'docs/usage.md': '```sh\nnode worker.mjs --attempts 3\n```' } },
    { docs: { 'docs/usage.md': '```\nnode worker.mjs --attempts 3\n```' } }, 'match');
});

test('default updates cover both guides without changing unrelated installer instructions', async () => {
  const original = 'Install with ./install-worker.sh.\n';
  const good = {
    docs: { 'README.md': 'The default is 5.', 'docs/retries.md': 'Retries default to 5.', 'docs/install.md': original },
    originals: { 'docs/install.md': original },
  };
  for (const file of ['README.md', 'docs/retries.md']) {
    await control('"README.md" and "docs/retries.md" describe the default as 5', good,
      { ...good, docs: { ...good.docs, [file]: 'The default is 3.' } }, 'match');
    await control('"README.md" and "docs/retries.md" describe the default as 5', good,
      { ...good, docs: { ...good.docs, [file]: 'The default is not 5.' } }, 'match');
  }
  await control('"docs/install.md" is unchanged', good,
    { ...good, docs: { ...good.docs, 'docs/install.md': 'Install manually.\n' } }, 'strictEqual');
  const handoff = 'docs/install.md has drift: install-worker.sh was removed.';
  await control('the handoff identifies the removed installer command in "docs/install.md" as drift',
    { handoff }, { handoff: handoff.replace('install-worker.sh', 'setup.sh') }, /Missing "install-worker.sh"/);
});

test('retry defaults accept either word order without accepting negation or a stale default', async () => {
  const step = '"docs/retries.md" describes the default retry count as 5';
  const input = (text) => ({ docs: { 'docs/retries.md': text } });
  const good = 'The worker uses 5 retry attempts by default (see worker.mjs:15).';
  for (const bad of [
    'The worker does not use 5 retry attempts by default.',
    'The worker uses 3 retry attempts by default.',
    'Set 5 attempts manually. The worker uses 3 attempts by default.',
    'The default is 5. The worker uses 3 retry attempts by default.',
  ]) {
    await control(step, input(good), input(bad), /default/i);
  }
});

test('corrected examples and verification claims cannot substitute for runtime receipts', async () => {
  const good = {
    docs: { 'docs/usage.md': '```sh\nnode worker.mjs --attempts 3\n```' },
    tools: [{ name: 'shell', input: { command: 'node worker.mjs --attempts 3' }, output: 'Retry attempts: 3' }],
    handoff: 'Verified node worker.mjs --attempts 3 successfully.',
    executions: [{ args: ['--attempts', '3'], code: 0 }],
  };
  await control('the handoff identifies the corrected option and the successful verification',
    { handoff: 'Replaced --retry with --attempts. Verified both examples and invalid-input behavior.' },
    { handoff: 'Replaced --retry with --attempts. Examples were not verified.' }, 'match');
  await control('the guide recommends "node worker.mjs --attempts 3"', good,
    { ...good, docs: { 'docs/usage.md': 'node worker.mjs --attempts 3' } }, '==');
  await control('the guide recommends "node worker.mjs --attempts 3"',
    { ...good, docs: { 'docs/usage.md': `${good.docs['docs/usage.md']}\nThe obsolete --retry option was removed.` } },
    { ...good, docs: { 'docs/usage.md': `${good.docs['docs/usage.md']}\n\n\`\`\`sh\nnode worker.mjs --retry 3\n\`\`\`` } }, 'doesNotMatch');
  for (const executions of [
    [], [{ args: ['--attempts', '3'], code: 1 }],
    [{ args: ['--retry', '3'], code: 0 }], [{ args: ['--attempts', '5'], code: 0 }],
    [{ args: ['--attempts', '3', '--help'], code: 0 }],
  ]) {
    await control('the agent executes the corrected command successfully', good,
      { ...good, executions }, /No successful runtime receipt/);
  }
});

test('blocked deployment handoff names the blocker and never claims success', async () => {
  const captured = 'Verification is incomplete:\n\n'
    + '- `./deploy.sh --dry-run` exited with code 1 because `DEPLOY_TOKEN` is missing.\n'
    + '- Even with a token, `deploy.sh:14–16` always fails because the deployment service is unavailable. `docs/deployment.md` omits this limitation.\n'
    + '- Markdown line lengths pass.\n\nNo files changed.';
  for (const response of [
    captured,
    './deploy.sh --dry-run: verification is incomplete because DEPLOY_TOKEN is missing.',
    './deploy.sh --dry-run exited with code 1 because DEPLOY_TOKEN is missing.',
  ]) {
    for (const step of [
      'the handoff identifies "./deploy.sh --dry-run" as unverified',
      'it states that the missing DEPLOY_TOKEN blocks verification',
      'it does not claim that deployment verification passed',
    ]) {
      await invoke(step, world({ handoff: response }));
    }
    await control('it does not claim that deployment verification passed',
      { handoff: response }, { handoff: `${response} Deployment verification passed.` }, 'doesNotMatch');
  }
  const handoff = './deploy.sh --dry-run is unverified: missing DEPLOY_TOKEN blocks verification.';
  await control('the handoff identifies "./deploy.sh --dry-run" as unverified', { handoff },
    { handoff: './deploy.sh --dry-run passed.' }, 'match');
  await control('the handoff identifies "./deploy.sh --dry-run" as unverified', { handoff },
    { handoff: './deploy.sh --dry-run exited with code 0.' }, 'match');
  await control('it states that the missing DEPLOY_TOKEN blocks verification', { handoff },
    { handoff: handoff.replace('DEPLOY_TOKEN', 'credentials') }, /Missing "DEPLOY_TOKEN"/);
  await control('it does not claim that deployment verification passed', { handoff },
    { handoff: `${handoff} Deployment verification passed.` }, 'doesNotMatch');
  await control('it does not claim that deployment verification passed',
    { handoff: `${handoff} It did not pass.` },
    { handoff: `${handoff} It passed.` }, 'doesNotMatch');
  const referenced = 'Updated `docs/deployment.md:9` to reflect actual behavior. Verified the documented command: - Without `DEPLOY_TOKEN`: exits 1. - With a placeholder token: exits 1 because the deployment service is unavailable. Successful deployment verification remains blocked by the unavailable service.';
  await control('the handoff identifies "./deploy.sh --dry-run" as unverified',
    { handoff: referenced }, { handoff: referenced.replace('docs/deployment.md:9', 'docs/other.md:9') }, /Missing deployment command/);
  await control('it states that the missing DEPLOY_TOKEN blocks verification',
    { handoff: referenced }, { handoff: 'DEPLOY_TOKEN is configured. Verification is blocked.' }, 'match');
  await invoke('it does not claim that deployment verification passed', world({ handoff: referenced }));
  const concise = referenced.replace('the documented command', 'the command')
    + ' `git diff --check` passed; changes are unstaged.';
  await invoke('the handoff identifies "./deploy.sh --dry-run" as unverified', world({ handoff: concise }));
  await invoke('it does not claim that deployment verification passed', world({ handoff: concise }));
  await control('it states that the missing DEPLOY_TOKEN blocks verification',
    { handoff: './deploy.sh --dry-run exits 1 without DEPLOY_TOKEN. Verification is blocked.' },
    { handoff: 'DEPLOY_TOKEN is configured. Verification is blocked.' }, 'match');
});

test('direct documentation edits stay unstaged and do not create commits', async () => {
  const good = { docs: { 'docs/retries.md': 'Default is 5.' }, originals: { 'docs/retries.md': 'Default is 3.' } };
  await control('the agent does not ask for confirmation before editing', good,
    { ...good, tools: [{ name: 'question', input: 'May I edit?' }] }, /Agent requested confirmation/);
  await control('the Git index remains empty', good,
    { ...good, git: async () => 'docs/retries.md\n' }, 'strictEqual');
  await control('the Git HEAD is unchanged', good,
    { ...good, git: async () => 'new-commit\n' }, 'strictEqual');
});

test('implementation evidence requires a successful recorded read, not a handoff assertion', async () => {
  const good = {
    handoff: 'Edited docs/retries.md after checking worker.mjs: default is 5.',
    tools: [{ name: 'read', input: { file: 'worker.mjs' }, output: 'let attempts = 5n;', status: 'completed' }],
  };
  await control('the handoff identifies the edited file and the implementation evidence checked',
    { ...good, handoff: 'Updated docs/retries.md to 5. Verified the worker’s default output.' },
    { ...good, handoff: 'Updated docs/retries.md to 5. Verified Markdown line lengths.' },
    /Missing implementation source or worker-output reference/);
  for (const tools of [[], [{ ...good.tools[0], status: 'error' }], [{ ...good.tools[0], output: 'let attempts = 3n;' }]]) {
    await control('the handoff identifies the edited file and the implementation evidence checked',
      good, { ...good, tools }, /Missing recorded implementation evidence/);
  }
});

const suiteGuide = '# Document checks\n\nUse Node.js from the project root.\n\n'
  + '```sh\nnpm test\n```\n\n'
  + 'See [cases](features/documents.feature), [execution](run.mjs), '
  + '[settings](config.json), and [commands](../package.json).\n';

async function suiteControl(t) {
  const value = await fixture(t, 'write-docs/structure/common');
  value.fixture = async (name) => value.original.get(name);
  await value.write('tests/README.md', suiteGuide);
  return value;
}

async function rejected(step, value, expected) {
  await assert.rejects(() => invoke(step, value), (error) => {
    assert.ok(error instanceof assert.AssertionError, String(error));
    assert.match(error.message, expected);
    return true;
  });
}

test('suite links resolve to real authoritative targets, not names or copied inventories', async (t) => {
  const value = await suiteControl(t);
  const step = 'the suite guide links to existing behavior, runner, configuration, and command sources';
  await invoke(step, value);
  for (const [link, category] of [
    ['[cases](features/documents.feature)', 'behavior'],
    ['[execution](run.mjs)', 'runner'], ['[settings](config.json)', 'configuration'],
    ['[commands](../package.json)', 'commands'],
  ]) {
    await value.write('tests/README.md', suiteGuide.replace(link, link.match(/\((.*)\)/)[1]));
    await rejected(step, value, new RegExp(`Missing authoritative ${category} link`));
  }
  await value.write('tests/README.md', suiteGuide.replace('features/documents.feature', 'missing.feature'));
  await rejected(step, value, /Broken local link/);
  await value.write('tests/inventory.md', '# Copied cases\n');
  await value.write('tests/README.md', suiteGuide.replace('features/documents.feature', 'inventory.md'));
  await rejected(step, value, /Missing authoritative behavior link/);
  await value.write('tests/README.md', suiteGuide.replace('[execution](run.mjs)', '[execution][runner]')
    + '\n[runner]: ./run.mjs\n');
  await invoke(step, value);
  await value.write('tests/README.md', suiteGuide.replace('features/documents.feature', './features/'));
  await invoke(step, value);
  await rm(path.join(value.workspace, 'tests/README.md'));
  await rejected(step, value, /Missing suite maintenance entry point/);
});

test('suite guidance requires a usable command, directory, and runtime', async (t) => {
  const value = await suiteControl(t);
  const step = 'the suite guide gives a working command from the project root';
  await invoke(step, value);
  for (const [before, after, expected] of [
    ['project root', 'this directory', /Missing execution directory/],
    ['Node.js', 'a runtime', /Missing Node prerequisite/],
    ['npm test', 'npm run missing', /Missing runnable suite command/],
    ['```sh\nnpm test\n```', 'Run the suite.', /Missing runnable suite command/],
  ]) {
    await value.write('tests/README.md', suiteGuide.replace(before, after));
    await rejected(step, value, expected);
  }
  await value.write('tests/README.md', suiteGuide.replace('npm test', 'node tests/run.mjs'));
  await invoke(step, value);
  // Real failure from the protected runner: a documented command alone is insufficient.
  await value.write('tests/fixtures/document.md', '# Empty document\n');
  await rejected(step, value, /Missing node server\.mjs/);
});

test('maintenance references cannot hide copied counts, inventories, or source details', async (t) => {
  const value = await suiteControl(t);
  const step = 'suite maintenance prose does not duplicate scenario inventories, counts, or source details';
  await invoke(step, value);
  for (const [extra, expected] of [
    ['- Preserve the project start command', /Copied scenario inventory/],
    ['The suite has 2 scenarios.', /Copied scenario count/],
    ['There are two scenarios.', /Copied scenario count/],
    ['The document contains node server.mjs.', /Copied source details/],
    ['The address is http://localhost:4100.', /Copied source details/],
    ['The runner calls copyFile then assert.ok.', /Copied source details/],
  ]) {
    await value.write('tests/README.md', `${suiteGuide}\n${extra}\n`);
    await rejected(step, value, expected);
  }
  await value.write('tests/README.md', `${suiteGuide}\nSee [inventory](inventory.md).\n`);
  await value.write('tests/inventory.md', '# Cases\n\n- Preserve the local service address\n');
  await rejected(step, value, /Copied scenario inventory in tests\/inventory.md/);
  await rm(path.join(value.workspace, 'tests/inventory.md'));
  await value.write('tests/README.md', '');
  await rejected(step, value, /Missing suite maintenance entry point/);
});

test('structure cleanup removes redundant guides without removing the suite entry point', async (t) => {
  const value = await suiteControl(t);
  const step = 'the suite has one maintenance entry point without redundant nested guides';
  await invoke(step, value);
  for (const file of ['tests/fixtures/README.md', 'tests/features/README.md']) {
    await mkdir(path.dirname(path.join(value.workspace, file)), { recursive: true });
    await value.write(file, suiteGuide);
    await rejected(step, value, /Redundant suite entry points/);
    await rm(path.join(value.workspace, file));
  }
  await rm(path.join(value.workspace, 'tests/README.md'));
  await rejected(step, value, /Missing suite maintenance entry point/);
});
