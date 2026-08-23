export function isChangePasswordFormValid({ currentPassword, newPassword, repeatNewPassword }) {
  return (
    currentPassword.trim().length > 0 &&
    newPassword.trim().length >= 8 &&
    repeatNewPassword.trim().length > 0 &&
    newPassword === repeatNewPassword
  );
}
