import type { Plugin } from '@opencode-ai/plugin';

type RuntimeEvent = {
  type: string;
  properties?: {
    [key: string]: unknown;
    sessionID?: string;
    info?: {
      [key: string]: unknown;
      role?: string;
      sessionID?: string;
    };
    status?: {
      type: string;
    };
  };
};

export const WorkmuxStatusPlugin: Plugin = async ({ $ }) => {
  // OpenCode can emit repeated `session.status busy` events for a single turn,
  // and can even emit a stale trailing `busy` after `idle` at the end. Track
  // per-session status so workmux only sees real transitions.
  const lastStatusBySession = new Map<string, string>();
  const acceptBusyBySession = new Map<string, boolean>();

  async function setStatus(
    sessionID: string | undefined,
    status: string,
  ) {
    if (!sessionID) {
      return;
    }

    const previous = lastStatusBySession.get(sessionID);
    // Ignore the final stale `busy` OpenCode sometimes emits after a session is
    // already done. The next user message re-arms `working` for the new turn.
    if (status === 'working' && acceptBusyBySession.get(sessionID) === false) {
      return;
    }
    if (previous === status) {
      return;
    }

    lastStatusBySession.set(sessionID, status);
    if (status === 'done') {
      acceptBusyBySession.set(sessionID, false);
    } else {
      acceptBusyBySession.set(sessionID, true);
    }

    await $`workmux set-window-status ${status}`.quiet();
  }

  return {
    event: async ({ event }: { event: RuntimeEvent }) => {
      const messageSessionID = event.properties?.info?.sessionID;
      if (event.type === 'message.updated' && event.properties?.info?.role === 'user' && messageSessionID) {
        acceptBusyBySession.set(messageSessionID, true);
      }

      const sessionID = event.properties?.sessionID;

      switch (event.type) {
        case 'session.status':
          if (event.properties?.status?.type === 'busy') {
            await setStatus(sessionID, 'working');
          }
          if (event.properties?.status?.type === 'idle') {
            await setStatus(sessionID, 'done');
          }
          break;
        case 'permission.asked':
        case 'question.asked':
          await setStatus(sessionID, 'waiting');
          break;
        case 'permission.replied':
        case 'question.replied':
          await setStatus(sessionID, 'working');
          break;
        case 'session.idle':
          await setStatus(sessionID, 'done');
          break;
      }
    },
  };
};
