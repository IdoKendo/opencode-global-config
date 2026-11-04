import { Plugin } from '@opencode/plugin/tui';
import { execFile } from 'node:child_process';
import { createEffect, createMemo, createRoot, createSignal, onCleanup, untrack } from 'solid-js';

export default Plugin.define({
  id: 'workmux-status',
  setup(ctx) {
    const controller = new AbortController();
    let lastWindowStatus: string | undefined;
    let pending = Promise.resolve();
    const stop = createRoot((dispose) => {
      const [connection, reconnect] = createSignal(0);
      const [synced, setSynced] = createSignal('');
      let shellRevision = 0;
      onCleanup(ctx.data.on('server.connected', () => reconnect((value) => value + 1)));
      onCleanup(ctx.data.listen(({ details }) => {
        if (['shell.created', 'shell.exited', 'shell.deleted'].includes(details.type)) shellRevision++;
      }));
      // The client cache handles V2 execution events, including sessions already
      // running when this plugin loads. Track the sessions owned by this terminal.
      const owned = createMemo(() => {
        const route = ctx.ui.router.current();
        const tabs = ctx.ui.tabs.list().map((tab) => tab.sessionID);
        if (route.type === 'session') tabs.push(route.sessionID);
        return [...new Set(tabs.flatMap((id) => ctx.data.session.family(ctx.data.session.root(id))))]
          .filter((id) => ctx.data.session.get(id));
      });
      const locationOf = (id: string) => ctx.data.session.get(id)?.location ?? ctx.location ?? ctx.data.location.default();
      const snapshot = createMemo(() => JSON.stringify({
        connection: connection(),
        directories: [...new Set(owned().map((id) => locationOf(id).directory))].sort(),
      }));
      createEffect(() => {
        const key = snapshot();
        const { directories } = JSON.parse(key) as { directories: string[] };
        let cancelled = false;
        let retry: ReturnType<typeof setTimeout> | undefined;
        onCleanup(() => { cancelled = true; clearTimeout(retry); });
        const refresh = async () => {
          try {
            // Invalidate even on reload: sync otherwise reuses its completed cache.
            // Repeat if a lifecycle event raced the snapshot response.
            let revision: number;
            do {
              revision = shellRevision;
              await Promise.all(directories.map(async (directory) => {
                const location = { directory };
                ctx.data.shell.invalidate(location);
                await ctx.data.shell.sync(location);
              }));
            } while (!cancelled && revision !== shellRevision);
            if (!cancelled) setSynced(key);
          } catch (error) {
            if (cancelled) return;
            console.error('Workmux shell sync:', error);
            retry = setTimeout(refresh, 1000);
          }
        };
        untrack(() => void refresh());
      });
      createEffect(() => {
        const sessions = owned();
        if (sessions.length === 0) return;

        const waiting = sessions.some((id) => (ctx.data.session.permission.list(id)?.length ?? 0) > 0 ||
          (ctx.data.session.form.list(id)?.length ?? 0) > 0);
        // The SDK's listBySession uses metadata.sessionID; use the same ownership
        // contract with the list API exposed by the TUI plugin types.
        const running = sessions.some((id) => ctx.data.session.status(id) === 'running' ||
          ctx.data.shell.list(locationOf(id)).some((shell) =>
            shell.metadata.sessionID === id && shell.status === 'running'));
        // Do not announce done while startup/reconnect shell ownership is unknown.
        if (!waiting && !running && synced() !== snapshot()) return;
        const status = waiting ? 'waiting' : running ? 'working' : 'done';

        pending = pending.then(async () => {
          if (controller.signal.aborted || lastWindowStatus === status) return;
          await new Promise<void>((resolve, reject) => {
            const child = execFile('workmux', ['set-window-status', status],
              { signal: controller.signal }, (error) => error ? reject(error) : resolve());
            // Workmux waits for hook input until EOF, even when there is no payload.
            child.stdin?.end();
          });
          lastWindowStatus = status;
        }).catch((error) => {
          if (!controller.signal.aborted) console.error('Workmux status plugin:', error);
        });
      });
      return dispose;
    });

    return async () => {
      stop();
      controller.abort();
      await pending;
    };
  },
});
