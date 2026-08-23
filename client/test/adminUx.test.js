import { describe, expect, it, vi } from 'vitest';
import { clearAdminSession, getAdminDashboardControls } from '../src/adminUx.js';

describe('admin UX helpers', () => {
  it('renders a logout control on the admin dashboard', () => {
    expect(getAdminDashboardControls()).toEqual([{ label: 'Logout', action: 'logout' }]);
  });

  it('clears the admin-authenticated session state on logout', () => {
    const setState = vi.fn();
    const auth = { setState };

    clearAdminSession(auth, (prev, next) => ({ ...prev, ...next, ready: true }));

    expect(setState).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(expect.any(Function));

    const updater = setState.mock.calls[0][0];
    expect(updater({ accessToken: 'admin-token', csrfToken: 'csrf', user: { id: 1 }, ready: true })).toEqual({
      accessToken: '',
      csrfToken: '',
      user: null,
      ready: true
    });
  });
});
