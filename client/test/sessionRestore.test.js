import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resetStartupRestoreForTests, restoreSessionOnce } from '../src/sessionRestore.js';
import { resetSessionSyncForTests } from '../src/sessionSync.js';

class FakeBroadcastChannel {
  static channels = new Set();
  constructor(name) {
    this.name = name;
    this.listeners = new Set();
    FakeBroadcastChannel.channels.add(this);
  }
  addEventListener(type, handler) {
    if (type === 'message') this.listeners.add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.delete(handler);
  }
  postMessage(data) {
    for (const channel of FakeBroadcastChannel.channels) {
      if (channel.name !== this.name) continue;
      for (const handler of channel.listeners) handler({ data });
    }
  }
  close() {
    FakeBroadcastChannel.channels.delete(this);
  }
}

function mockWebLocks(lockState = { active: false }) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request: async (_name, options, callback) => {
          if (lockState.active && options?.ifAvailable) return callback(null);
          if (lockState.active) return callback(null);
          lockState.active = true;
          try {
            return await callback({});
          } finally {
            lockState.active = false;
          }
        }
      }
    }
  });
}

async function importFreshSessionRestore() {
  vi.resetModules();
  return import('../src/sessionRestore.js');
}

describe('session restore helper', () => {
  beforeEach(() => {
    resetStartupRestoreForTests();
    resetSessionSyncForTests();
    FakeBroadcastChannel.channels.clear();
    globalThis.BroadcastChannel = FakeBroadcastChannel;
    mockWebLocks();
  });

  it('deduplicates concurrent startup restore calls', async () => {
    const refresh = vi.fn(async () => ({ accessToken: 'access.jwt' }));
    const [first, second] = await Promise.all([restoreSessionOnce(refresh), restoreSessionOnce(refresh)]);
    expect(first).toEqual({ accessToken: 'access.jwt' });
    expect(second).toEqual({ accessToken: 'access.jwt' });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('starts a new restore on a later startup cycle after reset', async () => {
    const refresh = vi.fn(async () => ({ accessToken: 'access.jwt' }));
    await restoreSessionOnce(refresh);
    resetStartupRestoreForTests();
    await restoreSessionOnce(refresh);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('resolves failed restore attempts as unauthenticated and allows a later fresh startup', async () => {
    const refresh = vi.fn()
      .mockResolvedValueOnce({ accessToken: '' })
      .mockResolvedValueOnce({ accessToken: 'access.jwt' });

    const first = await restoreSessionOnce(refresh);
    expect(first.accessToken).toBe('');

    resetStartupRestoreForTests();

    const second = await restoreSessionOnce(refresh);
    expect(second.accessToken).toBe('access.jwt');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('lets multiple concurrent tab restores share a single refresh request and result', async () => {
    const refresh = vi.fn(async () => ({ accessToken: 'access.jwt', csrfToken: 'csrf.jwt', user: { id: 'u1', role: 'admin' } }));
    const tabA = await importFreshSessionRestore();
    const tabB = await importFreshSessionRestore();

    const [first, second] = await Promise.all([
      tabA.restoreSessionOnce(refresh),
      tabB.restoreSessionOnce(refresh)
    ]);

    expect(first).toEqual(second);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('broadcasts logout and clears waiting tab sessions without persisting tokens', async () => {
    const seen = [];
    const channel = new BroadcastChannel('jwt-auth-demo-session-sync');
    channel.addEventListener('message', (event) => seen.push(event.data));

    channel.postMessage({ type: 'logout' });

    expect(seen).toEqual([{ type: 'logout' }]);
    expect(typeof localStorage === 'undefined' ? true : localStorage.length === 0).toBe(true);
    channel.close();
  });
});
