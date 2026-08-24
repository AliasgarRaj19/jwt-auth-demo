import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { rateLimit, rateLimitPresets, resetLimiterForTests } from '../src/lib/limiter.js';

function buildApp(options = {}) {
  const app = express();
  app.use(express.json());
  app.get('/limited', rateLimit(() => 'ip:1', options.preset || rateLimitPresets.login), (_req, res) => res.json({ ok: true }));
  app.post('/login', rateLimit(() => 'login:1', rateLimitPresets.login), (_req, res) => res.json({ ok: true }));
  app.post('/admin-login', rateLimit(() => 'admin:1', rateLimitPresets.adminLogin), (_req, res) => res.json({ ok: true }));
  app.post('/refresh', rateLimit(() => 'refresh:1', rateLimitPresets.refresh), (_req, res) => res.json({ ok: true }));
  app.post('/forgot-password', rateLimit(() => 'forgot:1', rateLimitPresets.forgotPassword), (_req, res) => res.json({ ok: true }));
  return app;
}

describe('rate limiter', () => {
  beforeEach(() => {
    resetLimiterForTests();
    env.NODE_ENV = 'development';
    env.RATE_LIMIT_DEV_MULTIPLIER = 20;
    env.RATE_LIMIT_DEV_WINDOW_MS = 60_000;
  });

  it('allows requests below the configured threshold', async () => {
    const app = buildApp({ preset: { limit: 2, windowMs: 60_000 } });
    await request(app).get('/limited').expect(200);
    await request(app).get('/limited').expect(200);
  });

  it('returns a generic 429 message after the threshold is exceeded', async () => {
    env.NODE_ENV = 'production';
    const app = buildApp({ preset: { limit: 1, windowMs: 60_000 } });
    await request(app).get('/limited').expect(200);
    const res = await request(app).get('/limited').expect(429);
    expect(res.body.message).toBe('Too many requests. Please try again later.');
    expect(JSON.stringify(res.body)).not.toContain('ip');
    expect(JSON.stringify(res.body)).not.toContain('account');
  });

  it('uses a higher effective threshold in development', async () => {
    env.NODE_ENV = 'development';
    env.RATE_LIMIT_DEV_MULTIPLIER = 10;
    const app = buildApp({ preset: { limit: 2, windowMs: 60_000 } });
    for (let i = 0; i < 20; i += 1) {
      await request(app).get('/limited').expect(200);
    }
  });

  it('keeps the configured base threshold in production', async () => {
    env.NODE_ENV = 'production';
    const app = buildApp({ preset: { limit: 2, windowMs: 60_000 } });
    await request(app).get('/limited').expect(200);
    await request(app).get('/limited').expect(200);
    await request(app).get('/limited').expect(429);
  });

  it('rate limits login, admin login, refresh, and forgot password handlers', async () => {
    env.NODE_ENV = 'production';
    const app = buildApp();
    for (let i = 0; i < rateLimitPresets.login.limit; i += 1) {
      await request(app).post('/login').expect(200);
    }
    await request(app).post('/login').expect(429);

    resetLimiterForTests();
    for (let i = 0; i < rateLimitPresets.adminLogin.limit; i += 1) {
      await request(app).post('/admin-login').expect(200);
    }
    await request(app).post('/admin-login').expect(429);

    resetLimiterForTests();
    for (let i = 0; i < rateLimitPresets.refresh.limit; i += 1) {
      await request(app).post('/refresh').expect(200);
    }
    const refreshRes = await request(app).post('/refresh').expect(429);
    expect(refreshRes.body.message).toBe('Too many requests. Please try again later.');
    expect(rateLimitPresets.refresh.limit).toBe(350);

    resetLimiterForTests();
    for (let i = 0; i < rateLimitPresets.forgotPassword.limit; i += 1) {
      await request(app).post('/forgot-password').expect(200);
    }
    const res = await request(app).post('/forgot-password').expect(429);
    expect(res.body.message).toBe('Too many requests. Please try again later.');
  });

  it('keeps development refresh bursts practical', async () => {
    env.NODE_ENV = 'development';
    env.RATE_LIMIT_DEV_MULTIPLIER = 20;
    const app = buildApp();
    const threshold = rateLimitPresets.refresh.limit * env.RATE_LIMIT_DEV_MULTIPLIER;
    expect(threshold).toBe(7000);
    for (let i = 0; i < 100; i += 1) {
      await request(app).post('/refresh').expect(200);
    }
  });
});
