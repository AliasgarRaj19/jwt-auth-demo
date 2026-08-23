import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { clearCookieOptions, cookieOptions } from '../src/lib/cookies.js';

describe('cookie and CORS configuration', () => {
  beforeEach(() => {
    env.NODE_ENV = 'development';
    env.COOKIE_SECURE = false;
    env.CLIENT_URL = 'http://localhost:5501';
    env.TRUST_PROXY_HOPS = 0;
  });

  it('sets the development refresh cookie as HttpOnly, insecure, and path-scoped', () => {
    const options = cookieOptions(7 * 24 * 60 * 60_000);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60_000
    });
    expect(options.domain).toBeUndefined();
  });

  it('sets the production refresh cookie as HttpOnly and secure', () => {
    env.NODE_ENV = 'production';
    env.COOKIE_SECURE = true;
    const options = cookieOptions(7 * 24 * 60 * 60_000);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60_000
    });
  });

  it('clears cookies using the same path and security attributes', () => {
    env.NODE_ENV = 'production';
    env.COOKIE_SECURE = true;
    expect(clearCookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0
    });
  });

  it('allows the configured development origin and rejects arbitrary origins without wildcarding', async () => {
    const app = createApp();
    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:5501').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5501');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const blocked = await request(app).get('/health').set('Origin', 'http://evil.example').expect(200);
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
    expect(blocked.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('supports credentialed preflight with Authorization and CSRF headers from the configured origin', async () => {
    const app = createApp();
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:5501')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type, Authorization, x-csrf-token')
      .expect(204);

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5501');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    expect(res.headers['access-control-allow-headers']).toContain('x-csrf-token');
  });

  it('uses the configured production origin', async () => {
    env.CLIENT_URL = 'https://app.example.com';
    const app = createApp();
    const res = await request(app).get('/health').set('Origin', 'https://app.example.com').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });

  it('keeps CSRF protection intact on authenticated state changes', async () => {
    const app = createApp();
    const res = await request(app).post('/api/user/change-password').set('Origin', 'http://localhost:5501').expect(401);
    expect(res.body.message).toBe('Unauthorized');
  });
});
