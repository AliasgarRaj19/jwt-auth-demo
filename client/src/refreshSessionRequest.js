const REFRESH_RETRY_DELAY_MS = 150;
const REFRESH_RETRY_LIMIT = 3;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function refreshSessionRequest(request) {
  let lastError = null;
  for (let attempt = 0; attempt < REFRESH_RETRY_LIMIT; attempt += 1) {
    try {
      return await request('/api/auth/refresh', { method: 'POST' });
    } catch (err) {
      lastError = err;
      if (err?.status !== 409 || err.message !== 'REFRESH_RETRY' || attempt === REFRESH_RETRY_LIMIT - 1) {
        throw err;
      }
      await wait(REFRESH_RETRY_DELAY_MS);
    }
  }
  throw lastError || new Error('Unauthorized');
}
