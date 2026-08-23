export const publicRoutes = ['/login', '/register', '/register-success', '/verify-email', '/verify-expired', '/unverified', '/forgot-password', '/reset-password'];
export const userRoutes = ['/dashboard', '/change-password'];
export const adminRoutes = ['/admin/login', '/admin/dashboard'];

export function getDashboardRoute(role) {
  return role === 'admin' ? '/admin/dashboard' : '/dashboard';
}

export function getRootRedirect(auth) {
  if (!auth?.ready) return null;
  if (!auth.accessToken) return '/login';
  return getDashboardRoute(auth.user?.role);
}

export function getLoginRedirect(auth) {
  if (!auth?.ready || !auth.accessToken) return null;
  return getDashboardRoute(auth.user?.role);
}

export function getAdminLoginRedirect(auth) {
  if (!auth?.ready || !auth.accessToken) return null;
  return auth.user?.role === 'admin' ? '/admin/dashboard' : '/dashboard';
}

export function getAuthenticatedLandingRoute({ pathname, accessToken, user }) {
  if (accessToken && pathname === '/login') {
    return getDashboardRoute(user?.role);
  }
  return null;
}

export function getRouteFromLink(href) {
  return href;
}
