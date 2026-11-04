// Run with node --conditions=browser --test scripts/quality/check-workmux-status.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import * as solid from 'solid-js';
import { createData } from '@opencode/client/solid';
import { Plugin } from '@opencode/plugin/tui';

test('owned shell lifecycle, snapshots, waiting precedence and cleanup reach workmux', async () => {
  const source = fs.readFileSync(new URL('../../plugins/workmux-status/tui.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const location = { directory: '/project' };
  const listeners = new Set();
  const event = {
    listen(handler) { listeners.add(handler); return () => listeners.delete(handler); },
    on(type, handler) { return this.listen(({ details }) => { if (details.type === type) handler(details); }); },
  };
  const emit = (type, data = {}) => solid.batch(() => {
    for (const handler of listeners) handler({ details: { type, data, location } });
  });
  const shell = (id, sessionID = 'child', status = 'running') => ({ id, status, metadata: { sessionID } });
  let snapshot = [shell('existing')];
  let release;
  let gate = new Promise(resolve => { release = resolve; });
  let reads = 0;
  let fail = false;
  let dispose;
  const data = solid.createRoot(stop => {
    dispose = stop;
    return createData({ directory: location.directory, event, api: () => ({
      shell: { list: async () => {
        reads++;
        const captured = snapshot;
        await gate;
        if (fail) throw new Error('offline');
        return { location, data: captured };
      } },
      session: { active: async () => ({}) },
      location: { get: async () => location },
      vcs: { get: async () => ({ location, data: {} }) },
      project: { list: async () => [] },
    }) });
  });
  const [state, setState] = solid.createSignal({ running: false, permission: false, form: false });
  const [route, setRoute] = solid.createSignal({ type: 'session', sessionID: 'parent' });
  const writes = [];
  const errors = [];
  let activeWrites = 0;
  const exports = {};
  vm.runInNewContext(code, {
    exports, AbortController, setTimeout, clearTimeout,
    console: { error: (...args) => errors.push(args) },
    require(name) {
      if (name === '@opencode/plugin/tui') return { Plugin };
      if (name === 'solid-js') return solid;
      if (name === 'node:child_process') return { execFile(command, args, options, callback) {
        assert.equal(command, 'workmux');
        assert.equal(activeWrites++, 0, 'writes must be serialized');
        return { stdin: { end() {
          queueMicrotask(() => { activeWrites--; writes.push(args[1]); callback(); });
        } } };
      } };
      throw new Error(name);
    },
  });
  const ctx = { data: { ...data, session: {
    get: id => ({ id, location }), root: id => id === 'child' ? 'parent' : id,
    family: id => id === 'parent' ? ['parent', 'child'] : [id],
    status: () => state().running ? 'running' : 'idle',
    permission: { list: () => state().permission ? [{}] : [] },
    form: { list: () => state().form ? [{}] : [] },
  } }, ui: { router: { current: route }, tabs: { list: () => [] } } };
  let cleanup = exports.default.setup(ctx);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const expect = async status => { await settle(); assert.equal(writes.at(-1), status); };
  try {
    await settle();
    assert.deepEqual(writes, [], 'startup must not flash done before the shell snapshot');
    release();
    await expect('working');
    setState({ permission: true }); await expect('waiting');
    setState({ form: true }); await expect('waiting');
    setState({}); await expect('working');
    for (const status of ['exited', 'timeout', 'killed']) {
      emit('shell.created', { info: shell(status) });
      emit('shell.exited', { id: 'existing', status: 'exited', exit: 0 });
      await expect('working');
      emit('shell.exited', { id: status, status, exit: 1 });
      await expect('done');
    }
    emit('shell.created', { info: shell('foreign', 'unrelated') });
    emit('shell.created', { info: shell('terminal', null) });
    await expect('done');
    emit('shell.created', { info: shell('owned') }); await expect('working');
    emit('shell.deleted', { id: 'owned' }); await expect('done');
    setState({ running: true }); await expect('working');
    setState({}); await expect('done');

    // Reconnect catches missed starts and missed exits, including snapshot/event races.
    snapshot = [shell('missed')];
    emit('server.connected'); await expect('working');
    gate = new Promise(resolve => { release = resolve; });
    emit('server.connected');
    await settle();
    snapshot = [];
    emit('shell.exited', { id: 'missed' });
    release(); await expect('done');
    assert.ok(reads >= 4);

    snapshot = [shell('reload')];
    await cleanup();
    cleanup = exports.default.setup(ctx);
    await expect('working');
    setRoute({ type: 'session', sessionID: 'unrelated' });
    // The foreign shell belongs to this route, but reload's snapshot removed it.
    await expect('done');
    setRoute({ type: 'session', sessionID: 'parent' }); await expect('working');
    fail = true;
    emit('server.connected'); await settle();
    assert.equal(errors.length, 1);
    const count = writes.length;
    await cleanup();
    emit('shell.created', { info: shell('after-cleanup') });
    await settle();
    assert.equal(writes.length, count);
    assert.equal(listeners.size, 1, 'only the SDK cache listener remains');
  } finally {
    await cleanup();
    dispose();
  }
});
