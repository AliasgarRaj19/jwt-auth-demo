const CHANNEL_NAME = 'jwt-auth-demo-session-sync';

let channel;

function getChannel() {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function broadcastSessionState(session) {
  const bc = getChannel();
  if (!bc) return;
  bc.postMessage({ type: 'session-updated', session });
}

export function broadcastLogout() {
  const bc = getChannel();
  if (!bc) return;
  bc.postMessage({ type: 'logout' });
}

export function listenSessionState(onSession, onLogout) {
  const bc = getChannel();
  if (!bc) return () => {};
  const handler = (event) => {
    const message = event?.data;
    if (!message || typeof message !== 'object') return;
    if (message.type === 'session-updated' && message.session) onSession?.(message.session);
    if (message.type === 'logout') onLogout?.();
  };
  bc.addEventListener('message', handler);
  return () => bc.removeEventListener('message', handler);
}

export function resetSessionSyncForTests() {
  channel?.close?.();
  channel = null;
}
