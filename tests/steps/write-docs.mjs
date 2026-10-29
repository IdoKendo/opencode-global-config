import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';

const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const plain = (text) => normalize(text.replace(/[`*_]/g, ''));
const contains = (text, expected) => assert.ok(text.includes(expected), `Missing ${JSON.stringify(expected)}`);
const original = (world, file) => world.fixture(file);
const document = (world) => world.read('document.md');
const output = (value) => typeof value === 'string' ? value : JSON.stringify(value ?? '');

function fences(text) {
  const result = [];
  let current;
  for (const line of text.split('\n')) {
    if (!current) {
      const match = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
      if (match) current = { marker: match[1], language: match[2].trim(), lines: [line] };
    } else {
      current.lines.push(line);
      if (new RegExp(`^\\s{0,3}${current.marker[0]}{${current.marker.length},}\\s*$`).test(line)) {
        result.push({ ...current, text: current.lines.join('\n') });
        current = undefined;
      }
    }
  }
  assert.ok(!current, 'Unclosed fenced code block');
  return result;
}

function protectedParts(text) {
  const blocks = fences(text).map((block) => block.text);
  let outside = text;
  for (const block of blocks) outside = outside.replace(block, '');
  return {
    blocks,
    tables: outside.split('\n').filter((line) => /^\s*\|.*\|\s*$/.test(line)),
    urls: outside.match(/https?:\/\/[^\s)>]+/g) ?? [],
    links: outside.match(/\[[^\]]*\]\(https?:\/\/[^\s)]+\)/g) ?? [],
  };
}

function proseLines(text) {
  for (const block of fences(text)) text = text.replace(block.text, '');
  return text.split('\n').filter((line) => line.trim()
    && !/^\s*\|.*\|\s*$/.test(line) && !/https?:\/\/\S+/.test(line));
}

function proseBlocks(text) {
  const blocks = [];
  const levels = [];
  let current;
  for (const line of text.split('\n')) {
    const item = line.match(/^(\s*)([-+*]|\d+[.)])(\s+)(.*)$/);
    if (!line.trim()) { current = undefined; continue; }
    if (item || !current) {
      if (item) {
        const indent = item[1].length;
        while (levels.length && indent < levels.at(-1).contentIndent) levels.pop();
        levels.push({ contentIndent: indent + item[2].length + item[3].length });
      } else levels.length = 0;
      current = { kind: item ? 'item' : 'paragraph', indent: item ? levels.length - 1 : 0,
        ...(item ? { ordered: /^\d/.test(item[2]) } : {}),
        text: item ? item[4] : line.trim() };
      blocks.push(current);
    } else current.text += ` ${line.trim()}`;
  }
  return blocks.map((block) => ({ ...block, text: normalize(block.text) }));
}

async function guide(world) {
  return world.read('docs/usage.md');
}

function defaultCount(text, count) {
  assert.match(plain(text), new RegExp(`\\bdefaults?\\b(?:(?!\\b(?:not|never|no)\\b)[^.!?\\n]){0,100}\\b${count}\\b`, 'i'));
  if (count === 5) assert.doesNotMatch(plain(text), /\bdefaults?\b[^.!?\n]{0,100}\b3\b/i);
}

async function workerRun(world, command, expectedCode, expectedOutput) {
  const result = await world.run(command);
  if (expectedCode === 0) assert.equal(result.code, 0, result.stderr);
  else assert.ok(Number.isInteger(result.code) && result.code !== 0, 'Expected command failure');
  contains(`${result.stdout}\n${result.stderr}`, expectedOutput);
}

Given('a Markdown document containing this paragraph on one source line:', async function (paragraph) {
  const text = await original(this, 'document.md');
  assert.ok(text.split('\n').includes(paragraph));
  assert.ok(paragraph.length > 100);
});

Given('the document has a nested list with a prose item longer than 100 characters', async function () {
  const items = proseBlocks(await original(this, 'document.md')).filter((block) => block.kind === 'item');
  assert.ok(items.some((item) => item.indent > 0 && item.text.length > 100));
  assert.ok(items.some((item) => item.indent === 0));
});

Given('a Markdown document with these constructs exceeding 100 characters per line:', async function (table) {
  assert.deepEqual(table.hashes().map((row) => row.construct), ['table row', 'ASCII diagram', 'code block', 'URL']);
  const text = await original(this, 'document.md');
  const parts = protectedParts(text);
  assert.ok(parts.tables.some((line) => line.length > 100));
  assert.ok(parts.urls.some((url) => url.length > 100));
  for (const language of ['text', 'python']) {
    assert.ok(fences(text).some((block) => block.language === language
      && block.lines.slice(1, -1).some((line) => line.length > 100)));
  }
});

Given('the document contains an ordinary prose paragraph longer than 100 characters', async function () {
  assert.ok(proseLines(await original(this, 'document.md')).some((line) => line.length > 100));
});

Given('a Markdown document containing:', async function (text) {
  contains(await original(this, 'document.md'), text);
});

Then('every ordinary prose source line is at most 100 characters', async function () {
  const lines = proseLines(await document(this));
  assert.ok(lines.length > 0, 'Document must retain prose');
  for (const line of lines) assert.ok(line.length <= 100, `Overlong prose (${line.length}): ${line}`);
});

Then('paragraph and list text is unchanged after normalizing wrapping whitespace', async function () {
  assert.deepEqual(proseBlocks(await document(this)).map(({ kind, text }) => ({ kind, text })),
    proseBlocks(await original(this, 'document.md')).map(({ kind, text }) => ({ kind, text })));
});

Then('the list item order and nesting are unchanged', async function () {
  const items = (text) => proseBlocks(text).filter((block) => block.kind === 'item');
  assert.deepEqual(items(await document(this)), items(await original(this, 'document.md')));
});

Then('the table, diagram, code block, and URL are unchanged', async function () {
  const before = await original(this, 'document.md');
  const after = await document(this);
  assert.deepEqual(protectedParts(after), protectedParts(before));
  assert.deepEqual(proseLines(after).map(normalize).join(' ').replace(/\s+/g, ' '),
    proseLines(before).map(normalize).join(' ').replace(/\s+/g, ' '));
});

Then('the document still names CacheBox and its TTL of 60 seconds', async function () {
  const text = plain(await document(this));
  contains(text, 'CacheBox');
  assert.match(text, /\bTTL\b[^.]{0,40}\b60\s*(?:seconds|s)\b/i);
});
Then('it still states that expiration is handled on the next read', async function () {
  const affirmative = plain(await document(this))
    .replace(/,\s*not\s+(?:by\s+)?(?:a\s+)?background timer/gi, '')
    .split(/[.!?]/)
    .filter((sentence) => !/\b(?:not|never|no)\b|n't\b/i.test(sentence)).join('.');
  assert.match(affirmative, /(?:expir\w*|remov\w*)[^.]{0,100}\bnext read\b/i);
});
Then('it still states that no background timer removes expired entries', async function () {
  assert.match(plain(await document(this)), /(?:\b(?:not|no|without)\b[^.]{0,50}background timer|background timer[^.]{0,50}\b(?:does not|doesn't|never)\b)/i);
});
Then('it omits {string}, {string}, and {string}', async function (first, second, third) {
  const text = plain(await document(this)).toLowerCase();
  for (const phrase of [first, second, third]) {
    assert.ok(!text.includes(phrase.toLowerCase()), `Retained filler: ${phrase}`);
  }
});

Given('a project with a runnable {string} command', async function (command) {
  assert.equal(command, 'python worker.py --attempts N');
  await workerRun(this, command.replace(/ N$/, ' 3'), 0, 'Retry attempts: 3');
});
Given('the command accepts positive integers and rejects 0 with {string}', async function (error) {
  await workerRun(this, 'python worker.py --attempts 1', 0, 'Retry attempts: 1');
  await workerRun(this, 'python worker.py --attempts 0', 1, error);
  await workerRun(this, 'python worker.py --attempts 1.5', 1, 'attempts must be an integer');
});
Given('existing guides use sentence-case headings and sections named {string} and {string}', async function (first, second) {
  const text = await original(this, 'docs/output.md');
  contains(text, `## ${first}`);
  contains(text, `## ${second}`);
  contains(text, '# Worker output');
});

Then('the guide uses sentence-case headings and {string} and {string} sections', async function (first, second) {
  const text = await guide(this);
  const headings = [...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => match[1]);
  for (const section of [first, second]) assert.ok(headings.includes(section));
  for (const heading of headings) {
    assert.ok(/^[A-Z]/.test(heading), `Heading lacks sentence case: ${heading}`);
    const words = heading.replace(/`[^`]*`/g, '').split(/\s+/).slice(1);
    assert.ok(words.every((word) => !/^[A-Z][a-z]+/.test(word)), `Title-case heading: ${heading}`);
  }
});
Then('it explains the positive-integer restriction before giving examples', async function () {
  const text = await guide(this);
  const restriction = text.search(/positive\s+integer|integer[^.\n]{0,60}(?:greater than (?:0|zero)|at least (?:1|one))/i);
  const examples = text.search(/^#{1,6}\s+Examples\s*$/m);
  assert.ok(restriction >= 0 && examples > restriction);
  assert.ok(restriction < text.indexOf('--attempts 3'));
});
Then('it includes examples with {string} and {string}', async function (first, second) {
  const blocks = fences(await guide(this));
  for (const example of [first, second]) assert.ok(blocks.some((block) => block.text.includes(example)));
});
Then('the zero-attempt example documents the error {string}', async function (error) {
  const text = await guide(this);
  const position = text.indexOf('--attempts 0');
  contains(text.slice(Math.max(0, position - 250), position + 600), error);
});
Then('command examples appear in syntax-highlighted code blocks', async function () {
  const text = await guide(this);
  const commands = fences(text).filter((block) => /python(?:3)?\s+worker\.py/.test(block.text));
  assert.ok(commands.length > 0);
  for (const block of commands) assert.match(block.language, /^(?:sh|bash|shell|shell-session|console|zsh)$/);
});
Then('source references use file paths and line numbers that locate the documented behavior', async function () {
  const text = await guide(this);
  const references = [...text.matchAll(/(?:[\w./-]*\/)?worker\.py:(\d+)(?:[-–](\d+))?/g)];
  assert.ok(references.length > 0, 'Missing worker.py:line source references');
  const source = (await this.read('worker.py')).split('\n');
  const located = [];
  for (const reference of references) {
    const start = Number(reference[1]);
    const end = Number(reference[2] ?? start);
    assert.ok(start >= 1 && end >= start && end <= source.length);
    const referencedPath = reference[0].split(':')[0];
    assert.equal(path.resolve(this.workspace, referencedPath), path.join(this.workspace, 'worker.py'));
    let lines = source.slice(start - 1, end).join('\n');
    // A reference to a function definition locates its body, not just the signature.
    if (start === end && /^def (?:main|positive_integer)\(/.test(source[start - 1])) {
      let boundary = start;
      while (boundary < source.length && /^(?:\s|$)/.test(source[boundary])) boundary += 1;
      lines = source.slice(start - 1, boundary).join('\n');
    }
    assert.match(lines, /attempts|positive_integer|parser\.parse_args\(/,
      `Reference does not locate attempts behavior: ${reference[0]}`);
    located.push(lines);
  }
  assert.match(located.join('\n'), /attempts <= 0|attempts must be positive|type=positive_integer/, 'References must locate validation, not just a mention');
});

Given("the worker's default retry count has changed from 3 to 5", async function () {
  defaultCount(await original(this, 'README.md'), 3);
  await workerRun(this, 'python worker.py', 0, 'Retry attempts: 5');
});
Given('{string} and {string} still describe the default as 3', async function (first, second) {
  for (const file of [first, second]) defaultCount(await original(this, file), 3);
});
Given('{string} names a removed installer command unrelated to retry behavior', async function (file) {
  const text = await original(this, file);
  contains(text, './install-worker.sh');
  assert.doesNotMatch(text, /retr(?:y|ies)|attempts/i);
  await assert.rejects(access(path.join(this.workspace, 'install-worker.sh')), { code: 'ENOENT' });
});
Then('{string} and {string} describe the default as 5', async function (first, second) {
  for (const file of [first, second]) defaultCount(await this.read(file), 5);
});
Then('{string} is unchanged', async function (file) {
  assert.equal(await this.read(file), await original(this, file));
});
Then('the handoff identifies the removed installer command in {string} as drift', function (file) {
  contains(this.handoff, file);
  contains(this.handoff, 'install-worker.sh');
  assert.match(this.handoff, /missing|removed|absent|does not exist|nonexistent|stale|outdated|drift|unavailable/i);
});

Given('{string} recommends {string}', async function (file, command) {
  contains(await original(this, file), command);
});
Given('that command exits with an unknown-option error', async function () {
  await workerRun(this, 'python worker.py --retry 3', 1, 'unrecognized arguments: --retry 3');
});
Given('the implementation accepts {string}', async function (command) {
  await workerRun(this, command, 0, 'Retry attempts: 3');
});
Then('the guide recommends {string}', async function (command) {
  const text = await this.read('docs/usage.md');
  contains(text, command);
  assert.ok(fences(text).some((block) => block.text.includes(command)));
  for (const block of fences(text)) assert.doesNotMatch(block.text, /python(?:3)?\s+worker\.py\b[^\n]*--retry\b/);
  assert.doesNotMatch(text, /(?:choose|set|configure)[^.\n]{0,80}\bwith\s+`?--retry\b/i);
});
Then('the agent executes the corrected command successfully', function () {
  assert.ok(this.executions.some(({ args, code }) => code === 0
    && args.length === 2 && args[0] === '--attempts' && args[1] === '3'),
  'No successful runtime receipt for worker.py --attempts 3');
});
Then('the handoff identifies the corrected option and the successful verification', function () {
  contains(this.handoff, '--attempts');
  assert.match(this.handoff, /verif|test|ran|execut|check/i);
  const claims = this.handoff.split(/[.!?\n]/)
    .filter((claim) => !/\b(?:not|never|failed|unable|couldn't|unverified)\b/i.test(claim)).join('\n');
  assert.match(claims, /success|pass|Retry attempts: 3|exit(?:ed)?\s+(?:code\s+)?0|works|confirmed|\bverified\b[^\n]*(?:examples?|commands?)/i);
});

Given('a deployment guide containing the command {string}', async function (command) {
  contains(await original(this, 'docs/deployment.md'), command);
});
Given('that command requires DEPLOY_TOKEN which is unavailable in the workspace', async function () {
  await workerRun(this, './deploy.sh --dry-run', 1, 'DEPLOY_TOKEN is required');
});
Then('the handoff identifies {string} as unverified', function (command) {
  assert.ok(this.handoff.includes(command)
    || (/\bdocs\/deployment\.md(?::\d+)?\b/.test(this.handoff)
      && /(?:documented|the) command/i.test(this.handoff)), 'Missing deployment command or documented-command reference');
  assert.match(this.handoff, /unverified|not verified|could not|cannot|can't|unable|blocked|not (?:run|executed)|failed/i);
});
Then('it states that the missing DEPLOY_TOKEN blocks verification', function () {
  contains(this.handoff, 'DEPLOY_TOKEN');
  assert.match(normalize(this.handoff.replace(/[`*]/g, '')), /(?:missing|unset|not set|unavailable|not (?:provided|available|configured)|requires|required|absent)[^.!?]{0,60}DEPLOY_TOKEN|DEPLOY_TOKEN[^.!?]{0,60}(?:missing|unset|not set|unavailable|not (?:provided|available|configured)|required|absent)|without\s+DEPLOY_TOKEN/i);
  assert.match(this.handoff, /block|cannot|could not|unable|unverified|fail|prevent/i);
});
Then('it does not claim that deployment verification passed', function () {
  assert.doesNotMatch(plain(this.handoff), /(?:^|[.!?]\s*)(?:it\s+)?(?:passed|succeeded|was successful)\b/i);
  assert.doesNotMatch(plain(this.handoff), /(?:deployment|dry[- ]run|verification)[^.!?]{0,45}(?<!not )(?<!never )(?:passed|succeeded|successful(?:ly)?|verified successfully)|all (?:checks|examples|commands) (?:passed|verified)/i);
  assert.match(this.handoff, /unverified|blocked|fail|could not|cannot|unable|not verified/i);
});

Given('{string} incorrectly describes the default retry count as 3', async function (file) {
  defaultCount(await original(this, file), 3);
});
Given('the implementation sets the default retry count to 5', async function () {
  await workerRun(this, 'python worker.py', 0, 'Retry attempts: 5');
});
Then('{string} describes the default retry count as 5', async function (file) {
  defaultCount(await this.read(file), 5);
});
Then('the agent does not ask for confirmation before editing', async function () {
  assert.notEqual(await this.read('docs/retries.md'), await original(this, 'docs/retries.md'));
  assert.ok(!this.tools.some((tool) => /question|confirm|approval/i.test(tool.name)), 'Agent requested confirmation');
  const text = `${this.handoff}\n${output(this.agentEvents)}`;
  assert.doesNotMatch(text, /(?:shall|should|may|can) I (?:proceed|edit|update|change)|(?:would you like|do you want) me to (?:proceed|edit|update)|(?:please confirm|need your (?:approval|confirmation))/i);
});
Then('the Git index remains empty', async function () {
  assert.equal((await this.git(['diff', '--cached', '--name-only'])).trim(), '');
  assert.ok((await this.git(['diff', '--name-only'])).split('\n').includes('docs/retries.md'), 'Expected unstaged documentation edit');
});
Then('the Git HEAD is unchanged', async function () {
  assert.equal((await this.git(['rev-parse', 'HEAD'])).trim(), this.beforeHead.trim());
});
Then('the handoff identifies the edited file and the implementation evidence checked', function () {
  contains(this.handoff, 'docs/retries.md');
  assert.ok(this.handoff.includes('worker.py')
    || /\bworker(?:['’]s)?\s+(?:default\s+)?output\b/i.test(this.handoff),
  'Missing implementation source or worker-output reference');
  assert.match(this.handoff, /\b5\b/);
  assert.match(this.handoff, /read|inspect|check|verif|confirm|default|source|implementation/i);
  assert.ok(this.tools.some((tool) => /worker\.py/.test(output(tool.input))
    && /default\s*=\s*5|Retry attempts: 5/.test(output(tool.output))
    && !/error|fail|cancel/i.test(tool.status ?? '')), 'Missing recorded implementation evidence');
});
