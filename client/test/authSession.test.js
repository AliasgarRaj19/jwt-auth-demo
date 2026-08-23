import { describe, expect, it } from 'vitest';
import { mergeAuthSession } from '../src/authSession.js';

describe('session state helper', () => {
  it('preserves authenticated ready state when merging login data', () => {
    const next = mergeAuthSession({ ready: false, csrfToken: 'old' }, { accessToken: 'abc', csrfToken: 'new', user: { id: 'u1' } });
    expect(next.ready).toBe(true);
    expect(next.accessToken).toBe('abc');
    expect(next.csrfToken).toBe('new');
  });

  it('preserves ready state when clearing auth on logout', () => {
    const next = mergeAuthSession({ ready: true, accessToken: 'abc', csrfToken: 'new', user: { id: 'u1' } }, { accessToken: '', csrfToken: '', user: null });
    expect(next.ready).toBe(true);
    expect(next.accessToken).toBe('');
    expect(next.user).toBeNull();
  });
});
