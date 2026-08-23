import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('HTTP security headers', () => {
  beforeEach(() => {
    env.NODE_ENV = 'development';
    env.CLIENT_URL = 'http://localhost:5501';
    env.COOKIE_SECURE = false;
  });

  it('omits X-Powered-By and sets nosniff, frame, and referrer headers', async () => {
    const app = createApp();
    const res = await request(app).get('/health').expect(200);

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('does not send HSTS in development or production', async () => {
    const developmentApp = createApp();
    const developmentRes = await request(developmentApp).get('/health').expect(200);
    expect(developmentRes.headers['strict-transport-security']).toBeUndefined();

    env.NODE_ENV = 'production';
    const productionApp = createApp();
    const productionRes = await request(productionApp).get('/health').expect(200);
    expect(productionRes.headers['strict-transport-security']).toBeUndefined();
  });

  it('keeps security headers on error responses', async () => {
    const app = createApp();
    const res = await request(app).post('/api/user/change-password').expect(401);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });
});
