import { readFileSync } from 'node:fs';
import path from 'node:path';

const directory = process.argv[2];
const submissions = JSON.parse(readFileSync(path.join(directory, 'submissions.json')));
const report = {};
for (const row of submissions) {
  if (row.verdict !== 'pass') report[row.release] = 'blocked';
  else report[row.release] ??= 'ready';
}
console.log(JSON.stringify(report));
