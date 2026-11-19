import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Given, Then } from '@cucumber/cucumber';

Given('endpoint CI accepts HTTP in rehearsal and rejects it in production', async function () {
  const workflow = await this.read('.github/workflows/endpoint.yml');
  const command = workflow.match(/^\s*- run: (npm run [\w:-]+)\s*$/m)?.[1];
  assert.ok(command, 'Missing CI command');
  const file = path.join(this.workspace, 'endpoint.json');
  const original = await this.read('endpoint.json');
  try {
    assert.equal((await this.run(command)).code, 0, 'Rehearsal endpoint failed CI');
    const endpoint = { ...JSON.parse(original), environment: 'production' };
    assert.equal(new URL(endpoint.url).protocol, 'http:');
    await writeFile(file, JSON.stringify(endpoint));
    assert.equal((await this.run(command)).code, 1, 'Production HTTP passed CI');
    const secure = new URL(endpoint.url);
    secure.protocol = 'https:';
    await writeFile(file, JSON.stringify({ ...endpoint, url: secure.href }));
    assert.equal((await this.run(command)).code, 0, 'Production HTTPS failed CI');
  } finally {
    await writeFile(file, original);
  }
});

Then('the tracker keeps HTTP for rehearsal only and requests no new safeguard', function () {
  const reply = this.handoff.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1');
  assert.deepEqual(JSON.parse(reply), {
    httpAllowedIn: ['rehearsal'], blockingScript: 'verify:endpoint', followUps: [],
  }, 'Incorrect endpoint review disposition');
});
