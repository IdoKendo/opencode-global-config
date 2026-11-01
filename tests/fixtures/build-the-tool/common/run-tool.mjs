import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [tool, input] = process.argv.slice(2);
const digest = createHash('sha256').update(readFileSync(tool)).digest('hex');
const result = spawnSync(process.execPath, [tool, input], { encoding: 'utf8' });
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
const code = result.status ?? 1;
if (process.env.AGENT_TEST_RECEIPTS) {
  appendFileSync(process.env.AGENT_TEST_RECEIPTS,
    JSON.stringify({ kind: 'project-tool', tool, input, digest, code }) + '\n');
}
process.exitCode = code;
