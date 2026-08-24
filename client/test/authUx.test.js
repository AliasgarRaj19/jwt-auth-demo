import { describe, expect, it } from 'vitest';
import { getChangePasswordNavigationItems, getResetPasswordFieldLabels, getResetPasswordUiState } from '../src/authUx.js';

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

  it('keeps the reset form visible until a successful submission, then hides it', () => {
    const valid = getResetPasswordUiState({ validState: 'valid', message: '' });
    expect(valid.showForm).toBe(true);
    expect(valid.showSuccess).toBe(false);

    const success = getResetPasswordUiState({ validState: 'valid', message: 'Password reset successfully.' });
    expect(success.showForm).toBe(false);
    expect(success.showSuccess).toBe(true);
    expect(success.showContinueToLogin).toBe(true);
    expect(success.successMessage).toBe('Your password has been reset successfully.');
    expect(success.continueToLoginHref).toBe('/login');
  });

  it('keeps the reset form visible on failure and preserves the invalid token flow', () => {
    const failure = getResetPasswordUiState({ validState: 'valid', message: 'Unable to reset password.' });
    expect(failure.showForm).toBe(true);
    expect(failure.showSuccess).toBe(false);

    const invalid = getResetPasswordUiState({ validState: 'invalid', message: '' });
    expect(invalid.showForm).toBe(false);
    expect(invalid.showInvalidState).toBe(true);
    expect(invalid.invalidMessage).toBe('This password reset link is invalid, expired, or has already been used.');
    expect(invalid.requestNewLinkHref).toBe('/forgot-password');
  });
});
