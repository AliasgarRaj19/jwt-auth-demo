import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, randomToken, hashSecret } from '../lib/crypto.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt.js';
import { sendEmail } from './email.js';
import { env } from '../config/env.js';

const maskEmail = (email) => email.replace(/(.{2}).+(@.+)/, '$1***$2');

function buildPublicUrl(pathname) {
  const basePath = env.APP_BASE_PATH || '';
  const normalizedBasePath = basePath && !basePath.startsWith('/') ? `/${basePath}` : basePath;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${String(env.APP_URL || '').replace(/\/+$/, '')}${normalizedBasePath}${normalizedPath}`;
}

async function storeUserRefreshToken(userId, role, familyId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refreshToken = await signRefreshToken({ sub: userId, role });
    try {
      await prisma.refreshToken.create({
        data: {
          userId,
          tokenHash: hashSecret(refreshToken),
          familyId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
      return refreshToken;
    } catch (err) {
      if (err?.code !== 'P2002' || attempt === 2) return null;
    }
  }
  return null;
}

async function storeMasterAdminRefreshToken(masterAdminId, role, familyId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const refreshToken = await signRefreshToken({ sub: masterAdminId, role });
    try {
      await prisma.masterAdminRefreshToken.create({
        data: {
          masterAdminId,
          tokenHash: hashSecret(refreshToken),
          familyId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      });
      return refreshToken;
    } catch (err) {
      if (err?.code !== 'P2002' || attempt === 2) return null;
    }
  }
  return null;
}

async function rotateUserRefreshToken(currentTokenHash, stored, user) {
  const newAccessToken = await signAccessToken({ sub: user.id, role: user.role });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const newRefreshToken = await signRefreshToken({ sub: user.id, role: user.role });
    try {
      await prisma.$transaction([
        prisma.refreshToken.update({ where: { tokenHash: currentTokenHash }, data: { revokedAt: new Date() } }),
        prisma.refreshToken.create({ data: { userId: user.id, tokenHash: hashSecret(newRefreshToken), familyId: stored.familyId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } })
      ]);
      return { accessToken: newAccessToken, refreshToken: newRefreshToken, user };
    } catch (err) {
      if (err?.code !== 'P2002' || attempt === 2) return null;
    }
  }
  return null;
}

async function rotateMasterAdminRefreshToken(currentTokenHash, stored, masterAdmin) {
  const role = 'admin';
  const newAccessToken = await signAccessToken({ sub: masterAdmin.id, role });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const newRefreshToken = await signRefreshToken({ sub: masterAdmin.id, role });
    try {
      await prisma.$transaction([
        prisma.masterAdminRefreshToken.update({ where: { tokenHash: currentTokenHash }, data: { revokedAt: new Date() } }),
        prisma.masterAdminRefreshToken.create({ data: { masterAdminId: masterAdmin.id, tokenHash: hashSecret(newRefreshToken), familyId: stored.familyId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } })
      ]);
      return { accessToken: newAccessToken, refreshToken: newRefreshToken, user: { id: masterAdmin.id, role: 'admin', username: masterAdmin.username, email: masterAdmin.email } };
    } catch (err) {
      if (err?.code !== 'P2002' || attempt === 2) return null;
    }
  }
  return null;
}

function normalizeRefreshToken(refreshToken) {
  return typeof refreshToken === 'string' && refreshToken.trim() ? refreshToken : null;
}

export async function registerUser(data) {
  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({ data: { firstName: data.firstName, lastName: data.lastName || null, email: data.email, phone: data.phone || null, gender: data.gender || null, address: data.address || null, passwordHash } });
  const token = randomToken();
  await prisma.verificationToken.create({ data: { userId: user.id, tokenHash: hashSecret(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  const verificationUrl = buildPublicUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  await sendEmail({
    to: user.email,
    subject: 'Verify your email',
    text: verificationUrl,
    html: `<p>Click to verify your email:</p><p><a href="${verificationUrl}">${verificationUrl}</a></p>`
  });
  return { email: maskEmail(user.email) };
}

export async function verifyEmailToken(token) {
  const tokenHash = hashSecret(token);
  const record = await prisma.verificationToken.findFirst({ where: { tokenHash, usedAt: null } });
  if (!record) return { status: 'invalid' };
  if (record.expiresAt < new Date()) return { status: 'expired' };
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.verificationToken.deleteMany({ where: { userId: record.userId, usedAt: null, id: { not: record.id } } })
  ]);
  return { status: 'ok' };
}

export async function resendVerificationEmail(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return { ok: true };
  if (user.emailVerifiedAt) return { ok: true };
  await prisma.verificationToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomToken();
  await prisma.verificationToken.create({ data: { userId: user.id, tokenHash: hashSecret(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  const verificationUrl = buildPublicUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  await sendEmail({ to: user.email, subject: 'Verify your email', text: verificationUrl, html: `<a href="${verificationUrl}">${verificationUrl}</a>` });
  return { ok: true };
}

export async function loginUser(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.isActive || !user.emailVerifiedAt) return { status: 'generic' };
  if (!(await verifyPassword(user.passwordHash, password))) return { status: 'generic' };
  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = await storeUserRefreshToken(user.id, user.role, crypto.randomUUID());
  return { user, accessToken, refreshToken };
}

export async function adminLogin(username, password) {
  const login = username.trim();
  const lowered = login.toLowerCase();
  const masterAdmin = await prisma.masterAdmin.findFirst({
    where: {
      OR: [
        { username: login },
        { email: lowered }
      ]
    }
  });
  if (!masterAdmin || masterAdmin.status !== 'active') return null;
  if (!(await verifyPassword(masterAdmin.passwordHash, password))) return null;
  const role = 'admin';
  const user = {
    id: masterAdmin.id,
    role,
    username: masterAdmin.username,
    email: masterAdmin.email || masterAdmin.username
  };
  const accessToken = await signAccessToken({ sub: masterAdmin.id, role });
  const refreshToken = await storeMasterAdminRefreshToken(masterAdmin.id, role, crypto.randomUUID());
  return { user, accessToken, refreshToken };
}

export async function refreshSession(refreshToken) {
  const rawToken = normalizeRefreshToken(refreshToken);
  if (!rawToken) return null;
  const tokenHash = hashSecret(rawToken);
  const { payload } = await verifyRefreshToken(rawToken).catch(() => ({ payload: null }));
  if (!payload) return null;
  if (payload.role === 'admin') {
    const stored = await prisma.masterAdminRefreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return null;
    const masterAdmin = await prisma.masterAdmin.findUnique({ where: { id: payload.sub } });
    if (!masterAdmin || masterAdmin.status !== 'active') return null;
    return rotateMasterAdminRefreshToken(tokenHash, stored, masterAdmin);
  }
  if (payload.role !== 'user') return null;
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) return null;
  return rotateUserRefreshToken(tokenHash, stored, user);
}

export async function logoutSession(refreshToken) {
  const rawToken = normalizeRefreshToken(refreshToken);
  if (!rawToken) return;
  const tokenHash = hashSecret(rawToken);
  const { payload } = await verifyRefreshToken(rawToken).catch(() => ({ payload: null }));
  if (payload?.role === 'admin') {
    await prisma.masterAdminRefreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
    return;
  }
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } });
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return { ok: true };
  const token = randomToken();
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashSecret(token), expiresAt: new Date(Date.now() + 15 * 60 * 1000) } });
  const resetUrl = buildPublicUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  await sendEmail({ to: user.email, subject: 'Reset your password', text: resetUrl, html: `<a href="${resetUrl}">${resetUrl}</a>` });
  return { ok: true };
}

export async function validatePasswordResetToken(token) {
  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash: hashSecret(token), usedAt: null } });
  if (!record) return { status: 'invalid' };
  if (record.expiresAt < new Date()) return { status: 'expired' };
  return { status: 'ok' };
}

export async function resetPassword(token, password) {
  const record = await prisma.passwordResetToken.findFirst({ where: { tokenHash: hashSecret(token), usedAt: null } });
  if (!record || record.expiresAt < new Date()) return { status: 'invalid' };
  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({ where: { userId: record.userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);
  return { status: 'ok' };
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) return { status: 'invalid' };
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
  ]);
  return { status: 'ok' };
}

export async function getAdminUsers() {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return users.map((user) => ({
    ...user,
    firstName: '******',
    lastName: '******',
    phone: '**********',
    gender: '******',
    address: '****************',
    passwordHash: undefined
  }));
}
