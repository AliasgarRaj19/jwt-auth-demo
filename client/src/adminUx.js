export function getAdminDashboardControls() {
  return [{ label: 'Logout', action: 'logout' }];
}

export function clearAdminSession(auth, mergeAuthSession) {
  auth.setState((prev) => mergeAuthSession(prev, { accessToken: '', csrfToken: '', user: null }));
}
