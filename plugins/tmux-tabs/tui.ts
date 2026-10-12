import { Plugin } from '@opencode/plugin/tui';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createEffect, createRoot } from 'solid-js';

const run = promisify(execFile);

export default Plugin.define({
  id: 'tmux-tabs',
  setup(ctx) {
    const pane = process.env.TMUX_PANE;
    if (!process.env.TMUX || !pane) return;
    if (process.argv.includes('--standalone')) {
      ctx.ui.toast.show({ message: 'Tmux tabs require a shared OpenCode server.', variant: 'warning' });
      return;
    }

    const serverIndex = process.argv.indexOf('--server');
    const server = process.argv.find((arg) => arg.startsWith('--server='))?.slice(9) ??
      (serverIndex >= 0 ? process.argv[serverIndex + 1] : undefined);
    const environment = Object.entries(process.env)
      .filter(([key, value]) => value !== undefined && (key.startsWith('OPENCODE_') || key === 'PATH' || key === 'XDG_CONFIG_HOME'))
      .filter(([key]) => key !== 'OPENCODE_TMUX_SESSION')
      .flatMap(([key, value]) => ['-e', `${key}=${value}`]);
    const sessionIndex = process.argv.findIndex((arg) => arg === '--session' || arg === '-s');
    const startupSession = (process.env.OPENCODE_TMUX_SESSION || undefined) ??
      process.argv.find((arg) => arg.startsWith('--session='))?.slice(10) ??
      (sessionIndex >= 0 ? process.argv[sessionIndex + 1] : undefined);
    let previous: Set<string> | undefined;
    let tabsWereEnabled = ctx.ui.tabs.enabled();
    let previousRoute = { ...ctx.ui.router.current() };
    let homeSession = startupSession ?? (previousRoute.type === 'session' ? previousRoute.sessionID : undefined);
    let returnRoute = previousRoute;
    let pending = Promise.resolve();
    let disposed = false;
    const openings = new Map<string, object>();
    const command = [process.execPath, ...(server ? ['--server', server] : []),
      ...(process.argv.includes('--auto') ? ['--auto'] : [])];

    ctx.keymap.layer(() => ({
      mode: 'global',
      priority: 100,
      commands: [{
        id: 'session.new',
        title: 'New session in tmux window',
        group: 'Session',
        slash: { name: 'new' },
        bind: '<leader>n',
        palette: true,
        run() {
          ctx.ui.dialog.clear();
          const location = ctx.location ?? ctx.data.location.default();
          pending = pending.then(async () => {
            if (disposed) return;
            const { stdout: target } = await run('tmux', ['display-message', '-p', '-t', pane, '#{session_id}']);
            if (disposed) return;
            await run('tmux', ['new-window', '-t', `${target.trim()}:`, '-c', location.directory,
              '-n', 'opencode', ...environment, '-e', 'OPENCODE_TMUX_SESSION=', ...command, location.directory]);
          }).catch((error) => {
            if (!disposed) ctx.ui.toast.show({ title: 'Tmux tabs', message: String(error), variant: 'error' });
          });
          return pending;
        },
      }],
    }));

    const stop = createRoot((dispose) => {
      createEffect(() => {
        const tabs = ctx.ui.tabs.list();
        // The router returns a mutable store; keep a snapshot for comparisons.
        const route = { ...ctx.ui.router.current() };
        const enabled = ctx.ui.tabs.enabled();
        if (!enabled) {
          if (route.type === 'session') {
            homeSession ??= route.sessionID;
            if (route.sessionID === homeSession) returnRoute = route;
          } else {
            returnRoute = route;
          }
        }
        const current = new Set(enabled ? tabs.map((tab) => tab.sessionID) :
          route.type === 'session' ? [route.sessionID] : []);
        const prior = tabsWereEnabled === enabled ? previous : undefined;
        const added: { sessionID: string }[] = [];
        if (enabled && prior) {
          added.push(...tabs.filter((tab) => !prior.has(tab.sessionID) && tab.sessionID !== startupSession));
        } else if (!enabled && route.type === 'session' && homeSession &&
            route.sessionID !== homeSession &&
            (previousRoute.type !== 'session' || previousRoute.sessionID !== route.sessionID)) {
          added.push({ sessionID: route.sessionID });
        }
        for (const id of openings.keys()) {
          if (!current.has(id)) openings.delete(id);
        }
        const origin = previousRoute;
        previous = current;
        tabsWereEnabled = enabled;
        previousRoute = route;

        for (const tab of added) {
          const opening = {};
          openings.set(tab.sessionID, opening);
          const valid = () => !disposed && openings.get(tab.sessionID) === opening;
          pending = pending.then(async () => {
            if (!valid()) return;
            const session = await ctx.client.session.get({ sessionID: tab.sessionID });
            if (!valid()) return;
            // Subagent sessions stay in this window; explicit forks still get a window.
            if (!enabled && session.parentID && !session.fork) {
              returnRoute = { type: 'session', sessionID: session.id };
              return;
            }
            const { stdout: target } = await run('tmux', ['display-message', '-p', '-t', pane, '#{session_id}']);
            if (!valid()) return;
            // Window titles may be renamed by tmux, OpenCode, or the user. The
            // launch command still identifies an existing session's pane.
            const findWindow = async () => {
              const { stdout } = await run('tmux', ['list-panes', '-s', '-t', target.trim(),
                '-F', '#{window_id}\t#{pane_start_command}']);
              return stdout.split('\n').find((line) => line.endsWith(` --session ${tab.sessionID}`))?.split('\t')[0];
            };
            const existing = await findWindow();
            if (!valid()) return;
            const name = `opencode-${tab.sessionID}`;
            // Multiple command arguments bypass tmux's shell-command parsing.
            // -S also handles another client creating the window during lookup.
            const { stdout } = existing ? { stdout: '' } : await run('tmux', [
              'new-window', '-S', '-d', '-P', '-F', '#{window_id}', '-t', `${target.trim()}:`,
              '-c', session.location.directory, '-n', name,
              ...environment, '-e', `OPENCODE_TMUX_SESSION=${tab.sessionID}`,
              ...command, '--session', tab.sessionID,
            ]);
            if (!valid()) {
              if (stdout.trim()) await run('tmux', ['kill-window', '-t', stdout.trim()]);
              return;
            }
            const windowID = existing || stdout.trim() || await findWindow();
            if (!valid()) return;
            if (!windowID) throw new Error(`Could not find tmux window for ${tab.sessionID}`);
            const active = ctx.ui.router.current();
            const focused = active.type === 'session' && (enabled
              ? ctx.data.session.root(active.sessionID) === tab.sessionID : active.sessionID === tab.sessionID);
            if (enabled) ctx.ui.tabs.close(tab.sessionID);
            if (focused) {
              const retained = ctx.ui.tabs.list().filter((item) => !openings.has(item.sessionID));
              if (!enabled) {
                ctx.ui.router.navigate(returnRoute);
              } else if (origin.type === 'home' || (origin.type === 'session' &&
                  retained.some((item) => item.sessionID === ctx.data.session.root(origin.sessionID)))) {
                ctx.ui.router.navigate(origin);
              } else {
                const fallback = retained.find((item) => item.active) ?? retained[0];
                ctx.ui.router.navigate(fallback ? { type: 'session', sessionID: fallback.sessionID } : { type: 'home' });
              }
              await run('tmux', ['select-window', '-t', windowID]);
            }
          }).catch((error) => {
            if (!disposed) ctx.ui.toast.show({ title: 'Tmux tabs', message: String(error), variant: 'error' });
          }).finally(() => {
            if (openings.get(tab.sessionID) === opening) openings.delete(tab.sessionID);
          });
        }
      });
      return dispose;
    });

    return async () => {
      disposed = true;
      stop();
      await pending;
    };
  },
});
