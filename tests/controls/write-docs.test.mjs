import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfiguration, loadSupport } from '@cucumber/cucumber/api';

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
    '```python', `print("${'payload'.repeat(18)}")`, '```',
    `[Full reference](https://example.org/${'segment/'.repeat(18)})`,
  ].join('\n');
  const original = `Read the following examples carefully.\n\n${protectedText}`;
  const valid = `Read the following\nexamples carefully.\n\n${protectedText}`;
  const input = (text) => ({ docs: { 'document.md': text }, originals: { 'document.md': original } });
  await invoke('every ordinary prose source line is at most 100 characters', world(input(valid)));
  for (const [before, after] of [
    ['| Setting |', '| Option |'], ['client ', 'caller '],
    ['print(', 'repr('], ['example.org', 'example.net'],
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
  await control('it still states that expiration is handled on the next read',
    input('Expired entries are removed on the next read, not\nby a background timer.'),
    input('Expired entries are not removed on the next read, not by a background timer.'), 'match');
});

test('source references must resolve to real validation, not nearby mentions', async () => {
  const source = '# Worker entry point\nattempts = 5\nif attempts <= 0:\n    raise ValueError("attempts must be positive")\nargs = parser.parse_args()\ndef main():\n    parser.add_argument("--attempts", type=positive_integer, default=5)\n';
  const input = (reference) => ({ docs: { 'worker.py': source, 'docs/usage.md': `Positive integers only. See ${reference}.` } });
  for (const [reference, expected] of [
    ['worker.py:2', /References must locate validation/],
    ['worker.py:1', /Reference does not locate attempts behavior/],
    ['worker.py:999', '=='], ['worker.py:4-3', '=='],
    ['other/worker.py:3-4', 'strictEqual'],
    ['worker.py', /Missing worker.py:line/],
  ]) {
    await control('source references use file paths and line numbers that locate the documented behavior',
      input('worker.py:3-4'), input(reference), expected);
  }
  await control('source references use file paths and line numbers that locate the documented behavior',
    input('worker.py:3-4 and worker.py:5'), input('worker.py:5'), /References must locate validation/);
  await control('source references use file paths and line numbers that locate the documented behavior',
    input('worker.py:6'), input('worker.py:1'), /Reference does not locate attempts behavior/);
});

test('command highlighting accepts Python 3 and rejects missing fence languages', async () => {
  for (const python of ['python', 'python3']) {
    await control('command examples appear in syntax-highlighted code blocks',
      { docs: { 'docs/usage.md': `\`\`\`sh\n${python} worker.py --attempts 3\n\`\`\`` } },
      { docs: { 'docs/usage.md': `\`\`\`\n${python} worker.py --attempts 3\n\`\`\`` } }, 'match');
  }
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

test('corrected examples and verification claims cannot substitute for runtime receipts', async () => {
  const good = {
    docs: { 'docs/usage.md': '```sh\npython worker.py --attempts 3\n```' },
    tools: [{ name: 'shell', input: { command: 'python worker.py --attempts 3' }, output: 'Retry attempts: 3' }],
    handoff: 'Verified python worker.py --attempts 3 successfully.',
    executions: [{ args: ['--attempts', '3'], code: 0 }],
  };
  await control('the handoff identifies the corrected option and the successful verification',
    { handoff: 'Replaced --retry with --attempts. Verified both examples and invalid-input behavior.' },
    { handoff: 'Replaced --retry with --attempts. Examples were not verified.' }, 'match');
  await control('the guide recommends "python worker.py --attempts 3"', good,
    { ...good, docs: { 'docs/usage.md': 'python worker.py --attempts 3' } }, '==');
  await control('the guide recommends "python worker.py --attempts 3"',
    { ...good, docs: { 'docs/usage.md': `${good.docs['docs/usage.md']}\nThe obsolete --retry option was removed.` } },
    { ...good, docs: { 'docs/usage.md': `${good.docs['docs/usage.md']}\n\n\`\`\`sh\npython worker.py --retry 3\n\`\`\`` } }, 'doesNotMatch');
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
  const handoff = './deploy.sh --dry-run is unverified: missing DEPLOY_TOKEN blocks verification.';
  await control('the handoff identifies "./deploy.sh --dry-run" as unverified', { handoff },
    { handoff: './deploy.sh --dry-run passed.' }, 'match');
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
    handoff: 'Edited docs/retries.md after checking worker.py: default is 5.',
    tools: [{ name: 'read', input: { file: 'worker.py' }, output: 'default=5', status: 'completed' }],
  };
  await control('the handoff identifies the edited file and the implementation evidence checked',
    { ...good, handoff: 'Updated docs/retries.md to 5. Verified the worker’s default output.' },
    { ...good, handoff: 'Updated docs/retries.md to 5. Verified Markdown line lengths.' },
    /Missing implementation source or worker-output reference/);
  for (const tools of [[], [{ ...good.tools[0], status: 'error' }], [{ ...good.tools[0], output: 'default=3' }]]) {
    await control('the handoff identifies the edited file and the implementation evidence checked',
      good, { ...good, tools }, /Missing recorded implementation evidence/);
  }
});
