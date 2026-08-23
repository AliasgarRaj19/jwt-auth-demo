import { broadcastSessionState } from './sessionSync.js';

let startupRestorePromise = null;
const RESTORE_LOCK_NAME = 'jwt-auth-demo-session-restore';

function waitForBroadcastResult() {
  return new Promise((resolve) => {
    if (typeof BroadcastChannel === 'undefined') {
      resolve({ accessToken: '', csrfToken: '', user: null });
      return;
    }
    const channel = new BroadcastChannel('jwt-auth-demo-session-sync');
    const timer = setTimeout(() => {
      channel.removeEventListener?.('message', handler);
      channel.close();
      resolve({ accessToken: '', csrfToken: '', user: null });
    }, 10_000);
    const handler = (event) => {
      const message = event?.data;
      if (!message || typeof message !== 'object') return;
      if (message.type === 'session-updated' && message.session) {
        clearTimeout(timer);
        channel.removeEventListener?.('message', handler);
        channel.close();
        resolve(message.session);
      }
      if (message.type === 'logout') {
        clearTimeout(timer);
        channel.removeEventListener?.('message', handler);
        channel.close();
        resolve({ accessToken: '', csrfToken: '', user: null });
      }
    };
    channel.addEventListener?.('message', handler);
  });
}

export async function restoreSessionOnce(refreshFn) {
  if (!startupRestorePromise) {
    startupRestorePromise = Promise.resolve().then(async () => {
      const locks = globalThis.navigator?.locks;
      if (locks?.request) {
        const result = await locks.request(RESTORE_LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
          if (!lock) return waitForBroadcastResult();
          const data = await refreshFn();
          if (data?.accessToken) broadcastSessionState(data);
          return data;
        });
        return result;
      }
      const data = await refreshFn();
      if (data?.accessToken) broadcastSessionState(data);
      return data;
    }).finally(() => {
      startupRestorePromise = null;
    });
  }
  return startupRestorePromise;
}

export function resetStartupRestoreForTests() {
  startupRestorePromise = null;
}
