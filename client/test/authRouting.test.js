import { describe, expect, it } from 'vitest';
import { adminRoutes, getAdminLoginRedirect, getDashboardRoute, getLoginRedirect, getProtectedRouteRedirect, getRootRedirect, publicRoutes } from '../src/authRouting.js';

describe('client auth routing helpers', () => {
  it('redirects the root route based on auth state', () => {
    expect(getRootRedirect({ ready: true, accessToken: '', user: null })).toBe('/login');
    expect(getRootRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'user' } })).toBe('/dashboard');
    expect(getRootRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'admin' } })).toBe('/admin/dashboard');
  });

  it('includes the unverified recovery route as public', () => {
    expect(publicRoutes).toContain('/unverified');
    expect(adminRoutes).toContain('/admin/dashboard');
  });

  it('redirects login routes for authenticated users', () => {
    expect(getLoginRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'user' } })).toBe('/dashboard');
    expect(getAdminLoginRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'admin' } })).toBe('/admin/dashboard');
  });

  it('maps roles to dashboard routes', () => {
    expect(getDashboardRoute('user')).toBe('/dashboard');
    expect(getDashboardRoute('admin')).toBe('/admin/dashboard');
  });

  it('preserves an authenticated user session when the user opens an admin route', () => {
    expect(getProtectedRouteRedirect({ auth: { ready: true, accessToken: 'access.jwt', user: { role: 'user' } }, requiredRole: 'admin' })).toBe('/dashboard');
  });

  it('preserves an authenticated admin session when the admin opens a user route', () => {
    expect(getProtectedRouteRedirect({ auth: { ready: true, accessToken: 'access.jwt', user: { role: 'admin' } }, requiredRole: 'user' })).toBe('/admin/dashboard');
  });

  it('routes unauthenticated visitors to the matching login page without clearing session state', () => {
    expect(getProtectedRouteRedirect({ auth: { ready: true, accessToken: '', user: null }, requiredRole: 'user' })).toBe('/login');
    expect(getProtectedRouteRedirect({ auth: { ready: true, accessToken: '', user: null }, requiredRole: 'admin' })).toBe('/admin/login');
  });
});
