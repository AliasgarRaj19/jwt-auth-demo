import { describe, expect, it, vi, beforeEach } from 'vitest';
import { refreshSessionRequest } from '../src/refreshSessionRequest.js';

describe('refresh session retry helper', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('retries refresh on 409 REFRESH_RETRY and succeeds with the next attempt', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('REFRESH_RETRY'), { status: 409 }))
      .mockResolvedValueOnce({ accessToken: 'access.jwt', user: { id: 'u1' } });

    const result = await refreshSessionRequest(request);

    expect(result).toEqual({ accessToken: 'access.jwt', user: { id: 'u1' } });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('bubbles a non-retry refresh failure immediately', async () => {
    const request = vi.fn().mockRejectedValue(Object.assign(new Error('Unauthorized'), { status: 401 }));

    await expect(refreshSessionRequest(request)).rejects.toThrow('Unauthorized');
    expect(request).toHaveBeenCalledTimes(1);
  });
});
