import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export async function signAccessToken(payload) {
  return new SignJWT({ ...payload, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(accessKey);
}
export async function signRefreshToken(payload) {
  return new SignJWT({ ...payload, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(crypto.randomUUID())
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(refreshKey);
}
export async function verifyAccessToken(token) {
  const result = await jwtVerify(token, accessKey, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, algorithms: ['HS256'] });
  if (result.payload.typ !== 'access') throw new Error('Invalid token type');
  return result;
}
export async function verifyRefreshToken(token) {
  const result = await jwtVerify(token, refreshKey, { issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE, algorithms: ['HS256'] });
  if (result.payload.typ !== 'refresh') throw new Error('Invalid token type');
  return result;
}
