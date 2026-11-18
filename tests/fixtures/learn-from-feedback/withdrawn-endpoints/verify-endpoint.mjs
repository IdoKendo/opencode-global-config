import { readFileSync } from 'node:fs';

const { environment, url } = JSON.parse(readFileSync('endpoint.json', 'utf8'));
const allowed = { rehearsal: ['http:', 'https:'], production: ['https:'] };
if (!allowed[environment]?.includes(new URL(url).protocol)) {
  console.error(`Endpoint scheme rejected for ${environment}`);
  process.exitCode = 1;
}
