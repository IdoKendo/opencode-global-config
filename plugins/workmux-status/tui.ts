import { Plugin } from '@opencode/plugin/tui';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createEffect, createRoot } from 'solid-js';

const run = promisify(execFile);

export default Plugin.define({
  id: 'workmux-status',
  setup(ctx) {
    const controller = new AbortController();
    let lastWindowStatus: string | undefined;
    let pending = Promise.resolve();
    const stop = createRoot((dispose) => {
      // The client cache handles V2 execution events, including sessions already
      // running when this plugin loads. Track the sessions owned by this terminal.
      createEffect(() => {
        const route = ctx.ui.router.current();
        const tabs = ctx.ui.tabs.list().map((tab) => tab.sessionID);
        if (route.type === 'session') tabs.push(route.sessionID);
        const sessions = [...new Set(tabs.flatMap((id) => ctx.data.session.family(ctx.data.session.root(id))))]
          .filter((id) => ctx.data.session.get(id));
        if (sessions.length === 0) return;

        const waiting = sessions.some((id) => (ctx.data.session.permission.list(id)?.length ?? 0) > 0 ||
          (ctx.data.session.form.list(id)?.length ?? 0) > 0);
        const running = sessions.some((id) => ctx.data.session.status(id) === 'running');
        const status = waiting ? 'waiting' : running ? 'working' : 'done';

        pending = pending.then(async () => {
          if (controller.signal.aborted || lastWindowStatus === status) return;
          await run('workmux', ['set-window-status', status], { signal: controller.signal });
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
