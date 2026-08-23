import { describe, expect, it } from 'vitest';
import { buildResetPasswordPayload, getResetTokenFromSearchParams } from '../src/resetPasswordHelpers.js';

describe('reset password helpers', () => {
  it('reads the reset token from the URL search params internally', () => {
    expect(getResetTokenFromSearchParams(new URLSearchParams('token=secret-token'))).toBe('secret-token');
  });

  it('includes the token only in the submission payload', () => {
    expect(buildResetPasswordPayload({ password: 'newpass123', repeatPassword: 'newpass123' }, 'secret-token')).toEqual({
      token: 'secret-token',
      password: 'newpass123',
      repeatPassword: 'newpass123'
    });
  });
});
