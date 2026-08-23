import { beforeEach, describe, expect, it, vi } from 'vitest';
import { broadcastLogout, broadcastSessionState, listenSessionState, resetSessionSyncForTests } from '../src/sessionSync.js';

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

describe('session sync helper', () => {
  beforeEach(() => {
    FakeBroadcastChannel.channels.clear();
    globalThis.BroadcastChannel = FakeBroadcastChannel;
    globalThis.localStorage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0 };
    globalThis.sessionStorage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(), length: 0 };
    resetSessionSyncForTests();
  });

  it('broadcasts auth updates without writing tokens to browser storage', () => {
    const updates = [];
    const cleanup = listenSessionState((session) => updates.push(session), () => updates.push('logout'));
    broadcastSessionState({ accessToken: 'access.jwt', csrfToken: 'csrf.jwt', user: { id: 'u1', role: 'admin' } });
    broadcastLogout();

    expect(updates).toEqual([
      { accessToken: 'access.jwt', csrfToken: 'csrf.jwt', user: { id: 'u1', role: 'admin' } },
      'logout'
    ]);
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled();
    expect(globalThis.sessionStorage.setItem).not.toHaveBeenCalled();
    cleanup();
  });
});
