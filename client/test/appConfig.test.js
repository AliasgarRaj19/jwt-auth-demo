import { describe, expect, it } from 'vitest';
import { buildApiBaseUrl, buildRouterBasename } from '../src/appConfig.js';

describe('app config helpers', () => {
  it('keeps the local API base on the backend origin', () => {
    expect(buildApiBaseUrl('', 'http://localhost:5500')).toBe('http://localhost:5500');
    expect(`${buildApiBaseUrl('', 'http://localhost:5500')}/api/auth/login`).toBe('http://localhost:5500/api/auth/login');
  });

  it('reduces a production api-prefixed config back to the app base path', () => {
    expect(buildApiBaseUrl('/jwt-auth-demo', '/jwt-auth-demo/api')).toBe('/jwt-auth-demo');
    expect(`${buildApiBaseUrl('/jwt-auth-demo', '/jwt-auth-demo/api')}/api/auth/login`).toBe('/jwt-auth-demo/api/auth/login');
  });

  it('does not create double api segments', () => {
    const base = buildApiBaseUrl('/jwt-auth-demo', '/jwt-auth-demo/api');
    expect(`${base}/api/auth/login`).not.toContain('/api/api/');
  });

  it('keeps the router basename on the production subpath', () => {
    expect(buildRouterBasename('/jwt-auth-demo')).toBe('/jwt-auth-demo');
  });
});
