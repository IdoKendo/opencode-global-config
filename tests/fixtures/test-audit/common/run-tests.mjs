import { createHash } from 'node:crypto';
import { appendFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { run } from 'node:test';

async function sources(directory = '.') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sources(name));
    else if (/\.(?:mjs|cjs|js)$/.test(name)) files.push(name);
  }
  return files.sort();
}

let summary;
let failures = 0;
let errors = 0;
for await (const { type, data } of run({ files: await sources('tests') })) {
  if (type === 'test:summary' && data.file === undefined) summary = data;
  if (type === 'test:fail') {
    const error = data.details.error;
    // Parent suites repeat their children's failures; count each failed check once.
    if (error.failureType === 'subtestsFailed') continue;
    if (error.cause?.code === 'ERR_ASSERTION') failures += 1;
    else errors += 1;
    console.error(`${data.name}: ${error.cause?.stack ?? error.stack}`);
  }
  if (type === 'test:stderr' || type === 'test:stdout') process.stderr.write(data.message);
}
if (!summary) throw new Error('Test runner produced no summary');
const digest = createHash('sha256');
for (const name of await sources()) digest.update(name).update(await readFile(name));
const record = {
  kind: 'shipping-suite',
  tests: summary.counts.tests,
  failures,
  errors,
  skipped: summary.counts.skipped + summary.counts.todo,
  digest: digest.digest('hex'),
};
console.log(JSON.stringify(record));
if (process.env.AGENT_TEST_RECEIPTS) {
  await appendFile(process.env.AGENT_TEST_RECEIPTS, JSON.stringify(record) + '\n');
}
process.exitCode = summary.success ? 0 : 1;
