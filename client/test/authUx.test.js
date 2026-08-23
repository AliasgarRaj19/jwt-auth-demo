import { describe, expect, it } from 'vitest';
import { getChangePasswordNavigationItems, getResetPasswordFieldLabels } from '../src/authUx.js';

describe('client auth UX helpers', () => {
  it('exposes back and logout controls for change password', () => {
    const nav = getChangePasswordNavigationItems();
    expect(nav).toEqual([
      { label: 'Back to User Panel', href: '/dashboard' },
      { label: 'Logout', action: 'logout' }
    ]);
  });

  it('omits a visible reset token field', () => {
    expect(getResetPasswordFieldLabels()).toEqual(['New Password', 'Repeat New Password', 'Reset Password']);
  });
});
