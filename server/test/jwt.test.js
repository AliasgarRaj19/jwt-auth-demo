import { describe, expect, it, vi } from 'vitest';
import { signRefreshToken, verifyRefreshToken } from '../src/lib/jwt.js';

describe('refresh token jwt uniqueness', () => {
  it('issues distinct refresh tokens even when minted back to back', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T00:00:00.000Z'));
    try {
      const first = await signRefreshToken({ sub: 'user-1', role: 'user' });
      const second = await signRefreshToken({ sub: 'user-1', role: 'user' });
      expect(first).not.toBe(second);

      const firstPayload = (await verifyRefreshToken(first)).payload;
      const secondPayload = (await verifyRefreshToken(second)).payload;
      expect(firstPayload.jti).toBeDefined();
      expect(secondPayload.jti).toBeDefined();
      expect(firstPayload.jti).not.toBe(secondPayload.jti);
      expect(firstPayload.typ).toBe('refresh');
      expect(secondPayload.typ).toBe('refresh');
    } finally {
      vi.useRealTimers();
    }
  });
});
