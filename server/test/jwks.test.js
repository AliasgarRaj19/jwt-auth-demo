import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { resetJwtKeyringForTests } from '../src/lib/jwt.js';

async function writeKeyPair(dir, name) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: { format: 'pem', type: 'spki' },
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' }
  });
  const privatePath = path.join(dir, `${name}-private.pem`);
  const publicPath = path.join(dir, `${name}-public.pem`);
  await writeFile(privatePath, privateKey);
  await writeFile(publicPath, publicKey);
  return { privatePath, publicPath, privateKey: createPrivateKey(privateKey), publicKey: createPublicKey(publicKey) };
}

describe('jwks endpoint', () => {
  beforeEach(() => {
    env.NODE_ENV = 'development';
    env.CLIENT_URL = 'http://localhost:5501';
    env.JWT_ISSUER = 'jwt-auth-demo';
    env.JWT_AUDIENCE = 'jwt-auth-demo-users';
    resetJwtKeyringForTests();
  });

  it('publishes only the access public keys and hides private material', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'jwks-'));
    const access = await writeKeyPair(dir, 'access-current');
    const accessPrevious = await writeKeyPair(dir, 'access-previous');
    env.JWT_ACCESS_PRIVATE_KEY_PATH = access.privatePath;
    env.JWT_ACCESS_PUBLIC_KEY_PATH = access.publicPath;
    env.JWT_ACCESS_PREVIOUS_PUBLIC_KEY_PATH = accessPrevious.publicPath;
    env.JWT_ACCESS_KID = 'access-20260824';
    env.JWT_ACCESS_PREVIOUS_KID = 'access-20260724';

    const app = createApp();
    const res = await request(app).get('/api/.well-known/jwks.json').expect(200);

    expect(res.headers['cache-control']).toContain('max-age=300');
    expect(res.body.keys).toHaveLength(2);
    expect(res.body.keys[0].kid).toBe('access-20260824');
    expect(res.body.keys[1].kid).toBe('access-20260724');
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE');
  });
});
