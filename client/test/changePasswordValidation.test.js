import { describe, expect, it } from 'vitest';
import { isChangePasswordFormValid } from '../src/changePasswordValidation.js';

describe('change password validation helper', () => {
  it('enables the form only when required values are valid and matching', () => {
    expect(isChangePasswordFormValid({
      currentPassword: 'current-pass',
      newPassword: 'newpassword1',
      repeatNewPassword: 'newpassword1'
    })).toBe(true);
  });

  it('rejects mismatched or too-short new passwords', () => {
    expect(isChangePasswordFormValid({
      currentPassword: 'current-pass',
      newPassword: 'short',
      repeatNewPassword: 'short'
    })).toBe(false);
    expect(isChangePasswordFormValid({
      currentPassword: 'current-pass',
      newPassword: 'newpassword1',
      repeatNewPassword: 'different'
    })).toBe(false);
  });
});
