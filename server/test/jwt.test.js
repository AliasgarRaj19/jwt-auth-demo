import { createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SignJWT, decodeProtectedHeader } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { resetJwtKeyringForTests, signAccessToken, signRefreshToken, signVerificationActionToken, verifyAccessToken, verifyRefreshToken, verifyVerificationActionToken, getAccessJwks } from '../src/lib/jwt.js';

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

async function prepareKeyEnv() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'jwt-keys-'));
  const access = await writeKeyPair(dir, 'access-current');
  const refresh = await writeKeyPair(dir, 'refresh-current');
  const action = await writeKeyPair(dir, 'action-current');
  const accessPrevious = await writeKeyPair(dir, 'access-previous');
  env.NODE_ENV = 'development';
  env.JWT_ACCESS_PRIVATE_KEY_PATH = access.privatePath;
  env.JWT_ACCESS_PUBLIC_KEY_PATH = access.publicPath;
  env.JWT_ACCESS_PREVIOUS_PUBLIC_KEY_PATH = accessPrevious.publicPath;
  env.JWT_ACCESS_KID = 'access-20260824';
  env.JWT_ACCESS_PREVIOUS_KID = 'access-20260724';
  env.JWT_REFRESH_PRIVATE_KEY_PATH = refresh.privatePath;
  env.JWT_REFRESH_PUBLIC_KEY_PATH = refresh.publicPath;
  env.JWT_REFRESH_PREVIOUS_PUBLIC_KEY_PATH = '';
  env.JWT_REFRESH_KID = 'refresh-20260824';
  env.JWT_REFRESH_PREVIOUS_KID = '';
  env.JWT_ACTION_PRIVATE_KEY_PATH = action.privatePath;
  env.JWT_ACTION_PUBLIC_KEY_PATH = action.publicPath;
  env.JWT_ACTION_PREVIOUS_PUBLIC_KEY_PATH = '';
  env.JWT_ACTION_KID = 'action-20260824';
  env.JWT_ACTION_PREVIOUS_KID = '';
  env.JWT_ISSUER = 'jwt-auth-demo';
  env.JWT_AUDIENCE = 'jwt-auth-demo-users';
  resetJwtKeyringForTests();
  return { dir, access, refresh, action, accessPrevious };
}

describe('jwt keyring and signing', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('signs access tokens with RS256 and a kid header', async () => {
    const keys = await prepareKeyEnv();
    const token = await signAccessToken({ sub: 'user-1', role: 'user' });
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe('access-20260824');

    const verified = await verifyAccessToken(token);
    expect(verified.payload.sub).toBe('user-1');
    expect(verified.payload.role).toBe('user');
    expect(verified.payload.typ).toBe('access');
    expect(keys.accessPrevious.publicKey).toBeDefined();
  });

  it('rejects HS256 and alg none tokens', async () => {
    await prepareKeyEnv();
    const hs256 = await new SignJWT({ sub: 'user-1', role: 'user', typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('jwt-auth-demo')
      .setAudience('jwt-auth-demo-users')
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(Buffer.from('not-the-right-key'));
    await expect(verifyAccessToken(hs256)).rejects.toThrow();

    const noneToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'user-1', typ: 'access', iss: 'jwt-auth-demo', aud: 'jwt-auth-demo-users', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url')}.`;
    await expect(verifyAccessToken(noneToken)).rejects.toThrow();
  });

  it('rejects unknown kid, issuer mismatch, audience mismatch, and expiration failures', async () => {
    const keys = await prepareKeyEnv();
    const token = await new SignJWT({ sub: 'user-1', role: 'user', typ: 'access' })
      .setProtectedHeader({ alg: 'RS256', kid: 'missing-kid' })
      .setIssuer('jwt-auth-demo')
      .setAudience('jwt-auth-demo-users')
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(keys.access.privateKey);
    await expect(verifyAccessToken(token)).rejects.toThrow();

    const signedToken = await signAccessToken({ sub: 'user-1', role: 'user' });

    env.JWT_ISSUER = 'wrong-issuer';
    resetJwtKeyringForTests();
    await expect(verifyAccessToken(signedToken)).rejects.toThrow();

    env.JWT_ISSUER = 'jwt-auth-demo';
    env.JWT_AUDIENCE = 'wrong-audience';
    resetJwtKeyringForTests();
    await expect(verifyAccessToken(signedToken)).rejects.toThrow();

    env.JWT_AUDIENCE = 'jwt-auth-demo-users';
    resetJwtKeyringForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T00:00:00.000Z'));
    const expired = await signAccessToken({ sub: 'user-1', role: 'user' });
    vi.setSystemTime(new Date('2026-08-24T00:20:00.000Z'));
    await expect(verifyAccessToken(expired)).rejects.toThrow();
    vi.useRealTimers();
  });

  it('preserves user and admin role claims and keeps refresh tokens unique', async () => {
    await prepareKeyEnv();
    const access = await signAccessToken({ sub: 'user-1', role: 'user' });
    const adminAccess = await signAccessToken({ sub: 'admin-1', role: 'admin' });
    expect((await verifyAccessToken(access)).payload.role).toBe('user');
    expect((await verifyAccessToken(adminAccess)).payload.role).toBe('admin');

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T00:00:00.000Z'));
    const first = await signRefreshToken({ sub: 'user-1', role: 'user' });
    const second = await signRefreshToken({ sub: 'user-1', role: 'user' });
    expect(first).not.toBe(second);
    const firstPayload = (await verifyRefreshToken(first)).payload;
    const secondPayload = (await verifyRefreshToken(second)).payload;
    expect(firstPayload.jti).toBeDefined();
    expect(secondPayload.jti).toBeDefined();
    expect(firstPayload.jti).not.toBe(secondPayload.jti);
    vi.useRealTimers();
  });

  it('uses the action keyset for verification recovery tokens', async () => {
    await prepareKeyEnv();
    const token = await signVerificationActionToken({ sub: 'u1' });
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe('RS256');
    expect(header.kid).toBe('action-20260824');
    const verified = await verifyVerificationActionToken(token);
    expect(verified.payload.typ).toBe('verification-action');
    expect(verified.payload.purpose).toBe('resend-verification');
  });

  it('exposes only the current and previous access public keys in JWKS', async () => {
    await prepareKeyEnv();
    const jwks = await getAccessJwks();
    expect(jwks.keys).toHaveLength(2);
    expect(jwks.keys[0].kid).toBe('access-20260824');
    expect(jwks.keys[1].kid).toBe('access-20260724');
    expect(jwks.keys.every((key) => key.kty && key.n && key.e)).toBe(true);
    expect(JSON.stringify(jwks)).not.toContain('PRIVATE');
  });
});
