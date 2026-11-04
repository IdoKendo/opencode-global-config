import assert from 'node:assert/strict';
import { files } from './harness.mjs';

export async function onlyChanges(world, allowed = []) {
  const current = await files(world.workspace);
  for (const name of new Set([...current.keys(), ...world.original.keys()])) {
    if (!allowed.includes(name)) {
      assert.equal(current.get(name), world.original.get(name), `Out-of-scope file: ${name}`);
    }
  }
  assert.equal(await world.git(['diff', '--cached', '--name-only']), '', 'Index changed');
  assert.equal(await world.git(['rev-parse', 'HEAD']), world.beforeHead, 'HEAD changed');
}
