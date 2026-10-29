import assert from 'node:assert/strict';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { Given } from '@cucumber/cucumber';

Given('an isolated workspace using the repository agent setup', async function () {
  assert.ok(path.isAbsolute(this.workspace));
  assert.ok((await stat(this.workspace)).isDirectory());
  assert.equal(await realpath(this.config), await realpath(this.setupRoot));
});

Given('a clean Git working tree and index', async function () {
  assert.equal((await this.git(['status', '--porcelain'])).trim(), '');
  assert.equal((await this.git(['rev-parse', 'HEAD'])).trim(), this.beforeHead.trim());
});
