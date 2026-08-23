import { describe, expect, it } from 'vitest';
import { getAdminLoginRedirect, getDashboardRoute, getLoginRedirect, getRootRedirect } from '../src/authRouting.js';

describe('client auth routing helpers', () => {
  it('redirects the root route based on auth state', () => {
    expect(getRootRedirect({ ready: true, accessToken: '', user: null })).toBe('/login');
    expect(getRootRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'user' } })).toBe('/dashboard');
    expect(getRootRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'admin' } })).toBe('/admin/dashboard');
  });

  it('redirects login routes for authenticated users', () => {
    expect(getLoginRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'user' } })).toBe('/dashboard');
    expect(getAdminLoginRedirect({ ready: true, accessToken: 'access.jwt', user: { role: 'admin' } })).toBe('/admin/dashboard');
  });

  it('maps roles to dashboard routes', () => {
    expect(getDashboardRoute('user')).toBe('/dashboard');
    expect(getDashboardRoute('admin')).toBe('/admin/dashboard');
  });
});
