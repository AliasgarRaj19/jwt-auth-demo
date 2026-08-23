export function getChangePasswordNavigationItems() {
  return [
    { label: 'Back to User Panel', href: '/dashboard' },
    { label: 'Logout', action: 'logout' }
  ];
}

export function getResetPasswordFieldLabels() {
  return ['New Password', 'Repeat New Password', 'Reset Password'];
}
