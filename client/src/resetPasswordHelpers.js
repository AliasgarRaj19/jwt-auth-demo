export function getResetTokenFromSearchParams(searchParams) {
  return searchParams.get('token') || '';
}

export function buildResetPasswordPayload(form, token) {
  return { ...form, token };
}
