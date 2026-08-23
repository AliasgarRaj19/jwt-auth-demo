import { describe, expect, it } from 'vitest';
import { buildApiBaseUrl, buildProductionAssetBase, buildRouterBasename, normalizeBasePath } from '../src/appConfig.js';

describe('app config helpers', () => {
  it('keeps local routes and assets unprefixed', () => {
    expect(normalizeBasePath('')).toBe('');
    expect(buildRouterBasename('')).toBe('/');
    expect(buildApiBaseUrl('', 'http://localhost:5500/api')).toBe('http://localhost:5500/api');
    expect(buildProductionAssetBase('')).toBe('/');
  });

  it('derives the production subpath base consistently', () => {
    expect(normalizeBasePath('/jwt-auth-demo')).toBe('/jwt-auth-demo');
    expect(buildRouterBasename('/jwt-auth-demo')).toBe('/jwt-auth-demo');
    expect(buildApiBaseUrl('/jwt-auth-demo', '')).toBe('/jwt-auth-demo/api');
    expect(buildProductionAssetBase('/jwt-auth-demo')).toBe('/jwt-auth-demo/');
  });

  it('does not double-prefix already configured api urls', () => {
    expect(buildApiBaseUrl('/jwt-auth-demo', '/jwt-auth-demo/api')).toBe('/jwt-auth-demo/api');
  });
});
