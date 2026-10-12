const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { test } = require('node:test');
const ts = require('typescript');
const solid = require('solid-js/dist/solid.cjs');

const run = promisify(execFile);
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../../plugins/tmux-tabs/tui.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

test('tmux tab handoff preserves sessions, focus, startup tabs and failure recovery', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-tmux-test-'));
  const socket = path.join(directory, 'tmux.sock');
  const tmux = (...args) => run('tmux', ['-S', socket, ...args]);
  t.after(async () => {
    await tmux('kill-server').catch(() => {});
    fs.rmSync(directory, { recursive: true, force: true });
  });
  // Keep test windows alive without starting another OpenCode service or model.
  fs.writeFileSync(path.join(directory, 'opencode'), '#!/bin/sh\nexec /bin/sleep 120\n', { mode: 0o755 });
  await tmux('-f', '/dev/null', 'new-session', '-d', '-s', 'test', '/bin/sleep', '120');
  await tmux('set-hook', '-g', 'after-new-window', 'rename-window renamed');
  const { stdout: pane } = await tmux('display-message', '-p', '-t', 'test', '#{pane_id}');
  const { stdout: original } = await tmux('display-message', '-p', '-t', 'test', '#{window_id}');
  const windows = async () => (await tmux('list-windows', '-t', 'test', '-F', '#{window_id}')).stdout.trim().split('\n');
  const [tabs, setTabs] = solid.createSignal([{ sessionID: 'main' }, { sessionID: 'existing' }]);
  const [routeValue, setRoute] = solid.createSignal({ type: 'session', sessionID: 'main' });
  // OpenCode exposes a stable store object whose properties change on navigation.
  const currentRoute = {
    get type() { return routeValue().type; },
    get sessionID() { return routeValue().sessionID; },
  };
  const route = () => currentRoute;
  const [tabsEnabled, setTabsEnabled] = solid.createSignal(true);
  const errors = [];
  const closed = [];
  const lookups = [];
  const gates = new Map();
  let newSession;
  const exports = {};
  const { Plugin } = await import('@opencode/plugin/tui');
  vm.runInNewContext(code, {
    exports,
    process: { execPath: path.join(directory, 'opencode'), argv: ['opencode'], env: {
      TMUX: `${socket},0,0`, TMUX_PANE: pane.trim(),
      PATH: `${directory}:${process.env.PATH}`, OPENCODE_TMUX_SESSION: 'startup',
    } },
    require(name) {
      if (name === '@opencode/plugin/tui') return { Plugin };
      if (name === 'solid-js') return solid;
      if (name === 'node:child_process') {
        const execute = (command, args, callback) => execFile(command, ['-S', socket, ...args], callback);
        execute[promisify.custom] = (command, args) => run(command, ['-S', socket, ...args]);
        return { execFile: execute };
      }
      return require(name);
    },
  });
  const cleanup = exports.default.setup({
    location: { directory },
    keymap: { layer(factory) { newSession = factory().commands.find(command => command.id === 'session.new').run; } },
    client: { session: { get: async ({ sessionID }) => {
      lookups.push(sessionID);
      if (gates.has(sessionID)) await gates.get(sessionID);
      if (sessionID === 'failure') throw new Error('Session lookup failed');
      return { id: sessionID, location: { directory },
        ...(sessionID === 'subagent' ? { parentID: 'startup' } : {}),
        ...(sessionID === 'hidden-fork' ? { parentID: 'subagent', fork: { sessionID: 'subagent' } } : {}),
      };
    } } },
    data: { session: { root: id => id } },
    ui: {
      dialog: { clear() {} },
      router: { current: route, navigate(destination) {
        if (tabsEnabled() && destination.type === 'session' && !tabs().some(tab => tab.sessionID === destination.sessionID)) {
          setTabs(items => [...items, { sessionID: destination.sessionID }]);
        }
        setRoute(destination);
      } },
      tabs: { enabled: tabsEnabled, list: tabs, close(id) {
        closed.push(id);
        setTabs(items => items.filter(item => item.sessionID !== id));
      } },
      toast: { show: error => errors.push(error) },
    },
  });
  t.after(cleanup);
  async function waitFor(predicate) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await predicate()) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail(`Timed out waiting for tab handoff: ${JSON.stringify({ errors, closed, tabs: tabs(), windows: await windows() })}`);
  }
  const open = (id, focused = true) => solid.batch(() => {
    setTabs(items => [...items, { sessionID: id }]);
    if (focused) setRoute({ type: 'session', sessionID: id });
  });

  open('startup', false);
  open('fork');
  await waitFor(async () => closed.includes('fork') &&
    (await tmux('display-message', '-p', '-t', 'test', '#{window_id}')).stdout !== original);
  assert.equal((await windows()).length, 2);
  assert.equal(route().sessionID, 'main');
  assert.deepEqual(tabs().map(tab => tab.sessionID), ['main', 'existing', 'startup']);
  const { stdout: launch } = await tmux('list-panes', '-a', '-F', '#{pane_start_command}');
  assert.match(launch, /--session fork/);

  // A newly launched client republishes its startup tab through shared storage.
  await tmux('select-window', '-t', original.trim());
  open('fork');
  await waitFor(async () => closed.filter(id => id === 'fork').length === 2 &&
    (await tmux('display-message', '-p', '-t', 'test', '#{window_id}')).stdout !== original);
  assert.equal((await windows()).length, 2);

  await tmux('select-window', '-t', original.trim());
  open('background', false);
  await waitFor(() => closed.includes('background'));
  assert.equal((await windows()).length, 3);
  assert.equal((await tmux('display-message', '-p', '-t', 'test', '#{window_id}')).stdout, original);

  let release;
  gates.set('rapid-a', new Promise(resolve => { release = resolve; }));
  open('rapid-a');
  await waitFor(() => lookups.includes('rapid-a'));
  open('rapid-b');
  release();
  await waitFor(() => closed.includes('rapid-b'));
  assert.equal(route().sessionID, 'main');
  assert.equal((await windows()).length, 5);
  assert.ok(!tabs().some(tab => tab.sessionID === 'rapid-a'));

  gates.set('reopened', new Promise(resolve => { release = resolve; }));
  open('reopened', false);
  await waitFor(() => lookups.includes('reopened'));
  setTabs(items => items.filter(tab => tab.sessionID !== 'reopened'));
  open('reopened', false);
  release();
  await waitFor(() => closed.includes('reopened'));
  assert.equal((await windows()).length, 6);
  assert.equal(closed.filter(id => id === 'reopened').length, 1);

  solid.batch(() => {
    setTabsEnabled(false);
    setTabs([]);
    setRoute({ type: 'session', sessionID: 'startup' });
  });
  setRoute({ type: 'session', sessionID: 'subagent' });
  // /new queues behind navigation, so its completion also settles the handoff.
  await newSession();
  assert.equal((await windows()).length, 7);
  assert.equal(route().sessionID, 'subagent');
  setRoute({ type: 'session', sessionID: 'hidden-fork' });
  await waitFor(async () => (await windows()).length === 8 && route().sessionID === 'subagent');
  assert.equal((await windows()).length, 8);
  assert.deepEqual(tabs(), []);
  assert.ok(!closed.includes('hidden-fork'));
  // Returning to the original session must not trigger a second handoff.
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal((await windows()).length, 8);
  await newSession();
  assert.equal((await windows()).length, 9);
  assert.equal(route().sessionID, 'subagent');
  const { stdout: fresh } = await tmux('display-message', '-p', '-t', 'test', '#{pane_start_command}');
  assert.ok(!fresh.includes('--session'), 'new window must start fresh rather than resume the parent');
  setRoute({ type: 'home' });
  await newSession();
  assert.equal((await windows()).length, 10);
  assert.equal(route().type, 'home');
  solid.batch(() => {
    setTabsEnabled(true);
    setTabs([{ sessionID: 'main' }]);
    setRoute({ type: 'session', sessionID: 'main' });
  });

  open('failure');
  await waitFor(() => errors.length === 1);
  assert.ok(tabs().some(tab => tab.sessionID === 'failure'));
  assert.equal((await windows()).length, 10);
  await tmux('kill-server');
  open('tmux-failure');
  await waitFor(() => errors.length === 2);
  assert.ok(tabs().some(tab => tab.sessionID === 'tmux-failure'));
  await cleanup();
  open('after-unload');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(errors.length, 2);
  assert.deepEqual(closed, ['fork', 'fork', 'background', 'rapid-a', 'rapid-b', 'reopened']);
});
