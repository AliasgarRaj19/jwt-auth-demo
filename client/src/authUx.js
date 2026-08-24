export function getChangePasswordNavigationItems() {
  return [
    { label: 'Back to User Panel', href: '/dashboard' },
    { label: 'Logout', action: 'logout' }
  ];
}

export function getResetPasswordFieldLabels() {
  return ['New Password', 'Repeat New Password', 'Reset Password'];
}

export function getResetPasswordUiState({ validState, message }) {
  const isSuccess = message === 'Password reset successfully.';
  return {
    showLoading: validState === 'loading',
    showInvalidState: validState !== 'loading' && validState !== 'valid',
    showForm: validState === 'valid' && !isSuccess,
    showSuccess: validState === 'valid' && isSuccess,
    showContinueToLogin: validState === 'valid' && isSuccess,
    successMessage: 'Your password has been reset successfully.',
    invalidMessage: 'This password reset link is invalid, expired, or has already been used.',
    requestNewLinkHref: '/forgot-password',
    continueToLoginHref: '/login'
  };
}
