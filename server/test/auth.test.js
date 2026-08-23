import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    masterAdmin: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    verificationToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn()
    },
    passwordResetToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn()
    },
    masterAdminRefreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn()
    },
    $transaction: vi.fn(async (ops) => Promise.all(ops))
  },
  sendEmail: vi.fn(async () => {}),
  hashPassword: vi.fn(async (value) => `hashed:${value}`),
  verifyPassword: vi.fn(async (_hash, value) => value === 'correct-password'),
  randomToken: vi.fn(() => 'token123'),
  hashSecret: vi.fn((value) => `hash:${value}`),
  signAccessToken: vi.fn(async () => 'access.jwt'),
  signRefreshToken: vi.fn(async () => 'refresh.jwt'),
  signVerificationActionToken: vi.fn(async () => 'verification-action.jwt'),
  verifyRefreshToken: vi.fn(async () => ({ payload: { sub: 'user-1', role: 'user', typ: 'refresh' } })),
  verifyVerificationActionToken: vi.fn(async () => ({ payload: { sub: 'u1', typ: 'verification-action', purpose: 'resend-verification' } })),
  env: {
    CLIENT_URL: 'http://localhost:5501',
    APP_URL: 'http://localhost:5501',
    APP_BASE_PATH: '',
    MASTER_ADMIN_USERNAME: 'admin@example.com',
    MASTER_ADMIN_PASSWORD: 'admin-pass'
  }
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: mocks.prisma }));
vi.mock('../src/services/email.js', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('../src/lib/crypto.js', () => ({
  hashPassword: mocks.hashPassword,
  verifyPassword: mocks.verifyPassword,
  randomToken: mocks.randomToken,
  hashSecret: mocks.hashSecret
}));
vi.mock('../src/lib/jwt.js', () => ({
  signAccessToken: mocks.signAccessToken,
  signRefreshToken: mocks.signRefreshToken,
  signVerificationActionToken: mocks.signVerificationActionToken,
  verifyRefreshToken: mocks.verifyRefreshToken,
  verifyVerificationActionToken: mocks.verifyVerificationActionToken
}));
vi.mock('../src/config/env.js', () => ({ env: mocks.env }));

const auth = await import('../src/services/auth.js');

  beforeEach(() => {
    Object.values(mocks.prisma).forEach((group) => {
      if (group && typeof group === 'object') {
        Object.values(group).forEach((fn) => fn.mockReset?.());
      }
    });
    mocks.prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
  mocks.sendEmail.mockReset();
  mocks.hashPassword.mockReset();
  mocks.verifyPassword.mockReset();
  mocks.randomToken.mockReset();
  mocks.hashSecret.mockReset();
  mocks.signAccessToken.mockReset();
  mocks.signRefreshToken.mockReset();
  mocks.signVerificationActionToken.mockReset();
  mocks.verifyRefreshToken.mockReset();
  mocks.verifyVerificationActionToken.mockReset();
});

describe('registration and verification flow', () => {
  it('returns the registration handoff and sends a browser-facing verification URL', async () => {
    mocks.prisma.user.create.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    const result = await auth.registerUser({ firstName: 'User', email: 'user@example.com', password: 'password123' });
    expect(result.email).toBe('us***@example.com');
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    const emailArgs = mocks.sendEmail.mock.calls[0][0];
    expect(emailArgs.text).toContain('http://localhost:5501/verify-email?token=token123');
    expect(emailArgs.html).toContain('http://localhost:5501/verify-email?token=token123');
  });

  it('uses the configured production base path for verification emails', async () => {
    mocks.env.APP_URL = 'https://signalgrowth.in';
    mocks.env.APP_BASE_PATH = '/jwt-auth-demo';
    mocks.prisma.user.create.mockResolvedValue({ id: 'u1', email: 'user@example.com' });

    const result = await auth.registerUser({ firstName: 'User', email: 'user@example.com', password: 'password123' });

    expect(result.email).toBe('us***@example.com');
    const emailArgs = mocks.sendEmail.mock.calls[0][0];
    expect(emailArgs.text).toContain('https://signalgrowth.in/jwt-auth-demo/verify-email?token=token123');
    expect(emailArgs.html).toContain('https://signalgrowth.in/jwt-auth-demo/verify-email?token=token123');
  });

  it('returns a recovery context when registration email delivery fails', async () => {
    mocks.prisma.user.create.mockResolvedValue({ id: 'u1', email: 'user@example.com' });
    mocks.sendEmail.mockRejectedValue(new Error('smtp down'));

    const result = await auth.registerUser({ firstName: 'User', email: 'user@example.com', password: 'password123' });

    expect(result.code).toBe('VERIFICATION_EMAIL_FAILED');
    expect(result.email).toBe('us***@example.com');
    expect(result.recoveryToken).toBe('verification-action.jwt');
  });

  it('accepts a valid verification token once', async () => {
    mocks.prisma.verificationToken.findFirst.mockResolvedValue({ id: 'vt1', userId: 'u1', expiresAt: new Date(Date.now() + 60_000) });
    mocks.prisma.user.update.mockResolvedValue({ id: 'u1', emailVerifiedAt: new Date() });
    mocks.prisma.verificationToken.update.mockResolvedValue({ id: 'vt1', usedAt: new Date() });
    mocks.prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
    const result = await auth.verifyEmailToken('token123');
    expect(result.status).toBe('ok');
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'u1' },
      data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) })
    }));
    expect(mocks.prisma.verificationToken.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'vt1' },
      data: expect.objectContaining({ usedAt: expect.any(Date) })
    }));
    expect(mocks.prisma.verificationToken.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', usedAt: null, id: { not: 'vt1' } }
    }));
  });

  it('reports expired verification tokens', async () => {
    mocks.prisma.verificationToken.findFirst.mockResolvedValue({ id: 'vt1', userId: 'u1', expiresAt: new Date(Date.now() - 60_000) });
    const result = await auth.verifyEmailToken('token123');
    expect(result.status).toBe('expired');
  });

  it('rejects an already used verification token', async () => {
    mocks.prisma.verificationToken.findFirst.mockResolvedValue(null);
    const result = await auth.verifyEmailToken('token123');
    expect(result.status).toBe('invalid');
  });

  it('rejects missing or invalid verification tokens safely', async () => {
    mocks.prisma.verificationToken.findFirst.mockResolvedValue(null);
    const result = await auth.verifyEmailToken('bad-token');
    expect(result.status).toBe('invalid');
  });

  it('validates password reset tokens without consuming them', async () => {
    mocks.prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 'prt1',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null
    });
    const result = await auth.validatePasswordResetToken('token123');
    expect(result.status).toBe('ok');
  });

  it('marks a used verification token as unusable on resend', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', emailVerifiedAt: null });
    const result = await auth.resendVerificationEmail('user@example.com');
    expect(result.ok).toBe(true);
    expect(mocks.prisma.verificationToken.updateMany).toHaveBeenCalled();
  });

  it('returns ACCOUNT_UNVERIFIED after a correct password for an unverified account without issuing a session', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hashed:correct-password',
      isActive: true,
      emailVerifiedAt: null,
      role: 'user'
    });
    mocks.verifyPassword.mockResolvedValue(true);

    const result = await auth.loginUser('user@example.com', 'correct-password');

    expect(result.code).toBe('ACCOUNT_UNVERIFIED');
    expect(result.email).toBe('us***@example.com');
    expect(result.recoveryToken).toBe('verification-action.jwt');
    expect(mocks.signAccessToken).not.toHaveBeenCalled();
    expect(mocks.signRefreshToken).not.toHaveBeenCalled();
  });

  it('keeps wrong credentials generic even when the account is unverified', async () => {
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hashed:correct-password',
      isActive: true,
      emailVerifiedAt: null,
      role: 'user'
    });
    mocks.verifyPassword.mockResolvedValue(false);

    const result = await auth.loginUser('user@example.com', 'wrong-password');

    expect(result.status).toBe('generic');
    expect(result.code).toBeUndefined();
    expect(mocks.signVerificationActionToken).not.toHaveBeenCalled();
  });

  it('reissues verification email tokens from the unverified recovery context', async () => {
    mocks.verifyVerificationActionToken.mockResolvedValue({ payload: { sub: 'u1', typ: 'verification-action', purpose: 'resend-verification' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', emailVerifiedAt: null });
    mocks.prisma.verificationToken.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.verificationToken.create.mockResolvedValue({ id: 'vt2' });
    mocks.sendEmail.mockResolvedValue({});

    const result = await auth.resendVerificationForActionToken('verification-action.jwt');

    expect(result.status).toBe('sent');
    expect(mocks.prisma.verificationToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', usedAt: null }
    }));
    expect(mocks.prisma.verificationToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'u1', expiresAt: expect.any(Date) })
    }));
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('returns verified if the account is already verified during resend recovery', async () => {
    mocks.verifyVerificationActionToken.mockResolvedValue({ payload: { sub: 'u1', typ: 'verification-action', purpose: 'resend-verification' } });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', emailVerifiedAt: new Date() });

    const result = await auth.resendVerificationForActionToken('verification-action.jwt');

    expect(result.status).toBe('verified');
    expect(mocks.prisma.verificationToken.create).not.toHaveBeenCalled();
  });
});

describe('refresh and reset token security', () => {
  it('rotates a valid refresh session', async () => {
    mocks.prisma.refreshToken.findUnique.mockResolvedValue({
      tokenHash: 'hash:refresh.jwt',
      userId: 'u1',
      familyId: 'family-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000)
    });
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'user', isActive: true });

    const result = await auth.refreshSession('refresh.jwt');

    expect(result.accessToken).toBe('access.jwt');
    expect(result.refreshToken).toBe('refresh.jwt');
    expect(mocks.prisma.refreshToken.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: 'hash:refresh.jwt' },
      data: expect.objectContaining({ revokedAt: expect.any(Date) })
    }));
    expect(mocks.prisma.refreshToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'u1', familyId: 'family-1', tokenHash: 'hash:refresh.jwt' })
    }));
    expect(mocks.prisma.masterAdminRefreshToken.create).not.toHaveBeenCalled();
  });

  it('supports sequential refresh rotation from A to B to C', async () => {
    const tokenRecords = new Map([
      ['hash:refresh-a', { tokenHash: 'hash:refresh-a', userId: 'u1', familyId: 'family-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }],
      ['hash:refresh-b', { tokenHash: 'hash:refresh-b', userId: 'u1', familyId: 'family-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }]
    ]);
    mocks.prisma.refreshToken.findUnique.mockImplementation(async ({ where: { tokenHash } }) => tokenRecords.get(tokenHash) || null);
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', role: 'user', isActive: true });
    mocks.signRefreshToken
      .mockResolvedValueOnce('refresh-b')
      .mockResolvedValueOnce('refresh-c');
    mocks.prisma.refreshToken.create.mockImplementation(async ({ data }) => {
      tokenRecords.set(data.tokenHash, { ...data, revokedAt: null });
      return data;
    });
    mocks.prisma.refreshToken.update.mockImplementation(async ({ where: { tokenHash }, data }) => {
      const current = tokenRecords.get(tokenHash);
      if (current) tokenRecords.set(tokenHash, { ...current, ...data });
      return tokenRecords.get(tokenHash);
    });

    const first = await auth.refreshSession('refresh-a');
    const second = await auth.refreshSession(first.refreshToken);

    expect(first.refreshToken).toBe('refresh-b');
    expect(second.refreshToken).toBe('refresh-c');
    expect(tokenRecords.get('hash:refresh-a').revokedAt).toBeInstanceOf(Date);
    expect(tokenRecords.get('hash:refresh-b').revokedAt).toBeInstanceOf(Date);
  });

  it('rejects revoked refresh sessions', async () => {
    mocks.prisma.refreshToken.findUnique.mockResolvedValue({
      tokenHash: 'hash:refresh.jwt',
      userId: 'u1',
      familyId: 'family-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    });

    const result = await auth.refreshSession('refresh.jwt');

    expect(result).toBeNull();
  });

  it('rejects expired refresh sessions', async () => {
    mocks.prisma.refreshToken.findUnique.mockResolvedValue({
      tokenHash: 'hash:refresh.jwt',
      userId: 'u1',
      familyId: 'family-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 60_000)
    });

    const result = await auth.refreshSession('refresh.jwt');

    expect(result).toBeNull();
  });

  it('rejects missing refresh cookies safely without hashing undefined', async () => {
    const result = await auth.refreshSession(undefined);

    expect(result).toBeNull();
    expect(mocks.hashSecret).not.toHaveBeenCalled();
    expect(mocks.verifyRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects invalid refresh cookies safely without throwing', async () => {
    mocks.verifyRefreshToken.mockRejectedValue(new Error('invalid token'));

    const result = await auth.refreshSession('bad-refresh-token');

    expect(result).toBeNull();
    expect(mocks.hashSecret).toHaveBeenCalledWith('bad-refresh-token');
  });

  it('persists an admin refresh session and preserves the admin role on refresh', async () => {
    mocks.prisma.masterAdmin.findFirst.mockResolvedValue({
      id: 'demo-admin',
      username: 'admin@example.com',
      email: 'admin@example.com',
      passwordHash: 'hashed:admin-pass',
      status: 'active'
    });
    mocks.prisma.masterAdminRefreshToken.create.mockResolvedValue({ id: 'rt-admin', tokenHash: 'hash:refresh.jwt' });
    mocks.prisma.masterAdminRefreshToken.findUnique.mockResolvedValue({
      tokenHash: 'hash:refresh.jwt',
      userId: 'demo-admin',
      familyId: 'family-admin',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000)
    });
    mocks.prisma.masterAdmin.findUnique.mockResolvedValue({ id: 'demo-admin', username: 'admin@example.com', email: 'admin@example.com', status: 'active' });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.verifyRefreshToken.mockResolvedValue({ payload: { sub: 'demo-admin', role: 'admin', typ: 'refresh' } });

    const login = await auth.adminLogin('admin@example.com', 'admin-pass');
    expect(login.refreshToken).toBe('refresh.jwt');
    expect(mocks.prisma.masterAdminRefreshToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ masterAdminId: 'demo-admin', tokenHash: 'hash:refresh.jwt' })
    }));

    const refreshed = await auth.refreshSession('refresh.jwt');
    expect(refreshed.user.role).toBe('admin');
    expect(refreshed.accessToken).toBe('access.jwt');
  });

  it('issues refreshed master admin access tokens with the admin role claim', async () => {
    const tokenRecords = new Map([
      ['hash:refresh.jwt', { tokenHash: 'hash:refresh.jwt', masterAdminId: 'demo-admin', familyId: 'family-admin', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) }]
    ]);
    mocks.prisma.masterAdminRefreshToken.findUnique.mockImplementation(async ({ where: { tokenHash } }) => tokenRecords.get(tokenHash) || null);
    mocks.prisma.masterAdmin.findUnique.mockResolvedValue({
      id: 'demo-admin',
      username: 'admin@example.com',
      email: 'admin@example.com',
      status: 'active'
    });
    mocks.verifyRefreshToken.mockResolvedValue({ payload: { sub: 'demo-admin', role: 'admin', typ: 'refresh' } });
    mocks.signAccessToken.mockImplementation(async ({ role }) => `access:${role}`);
    mocks.signRefreshToken.mockResolvedValue('refresh-b');
    mocks.prisma.masterAdminRefreshToken.update.mockImplementation(async ({ where: { tokenHash }, data }) => {
      const current = tokenRecords.get(tokenHash);
      if (current) tokenRecords.set(tokenHash, { ...current, ...data });
      return tokenRecords.get(tokenHash);
    });
    mocks.prisma.masterAdminRefreshToken.create.mockImplementation(async ({ data }) => {
      tokenRecords.set(data.tokenHash, { ...data, revokedAt: null });
      return data;
    });

    const refreshed = await auth.refreshSession('refresh.jwt');

    expect(refreshed.accessToken).toBe('access:admin');
    expect(refreshed.user.role).toBe('admin');
    expect(mocks.prisma.masterAdminRefreshToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ masterAdminId: 'demo-admin', tokenHash: 'hash:refresh-b' })
    }));
  });

  it('hashes the master admin refresh cookie value before lookup and rotation', async () => {
    mocks.prisma.masterAdminRefreshToken.findUnique.mockResolvedValue({
      tokenHash: 'hash:refresh.jwt',
      masterAdminId: 'demo-admin',
      familyId: 'family-admin',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000)
    });
    mocks.prisma.masterAdmin.findUnique.mockResolvedValue({
      id: 'demo-admin',
      username: 'admin@example.com',
      email: 'admin@example.com',
      status: 'active'
    });
    mocks.verifyRefreshToken.mockResolvedValue({ payload: { sub: 'demo-admin', role: 'admin', typ: 'refresh' } });

    await auth.refreshSession('refresh.jwt');

    expect(mocks.hashSecret).toHaveBeenCalledWith('refresh.jwt');
    expect(mocks.prisma.masterAdminRefreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: 'hash:refresh.jwt' }
    });
  });

  it('rejects wrong admin credentials safely', async () => {
    mocks.prisma.masterAdmin.findFirst.mockResolvedValue({
      id: 'demo-admin',
      username: 'admin@example.com',
      email: 'admin@example.com',
      passwordHash: 'hashed:admin-pass',
      status: 'active'
    });
    mocks.verifyPassword.mockResolvedValue(false);

    const login = await auth.adminLogin('admin@example.com', 'wrong-pass');

    expect(login).toBeNull();
    expect(mocks.prisma.masterAdminRefreshToken.create).not.toHaveBeenCalled();
  });

  it('revokes an admin refresh session on logout and rejects reuse afterward', async () => {
    mocks.prisma.masterAdminRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    mocks.prisma.masterAdminRefreshToken.findUnique.mockResolvedValue(null);
    mocks.verifyRefreshToken.mockResolvedValue({ payload: { sub: 'demo-admin', role: 'admin', typ: 'refresh' } });

    await auth.logoutSession('refresh.jwt');
    expect(mocks.prisma.masterAdminRefreshToken.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: 'hash:refresh.jwt' },
      data: expect.objectContaining({ revokedAt: expect.any(Date) })
    }));

    const refreshed = await auth.refreshSession('refresh.jwt');
    expect(refreshed).toBeNull();
  });

  it('rejects invalid admin refresh tokens safely without throwing', async () => {
    mocks.verifyRefreshToken.mockRejectedValue(new Error('invalid admin refresh token'));

    const result = await auth.refreshSession('bad-admin-refresh');

    expect(result).toBeNull();
    expect(mocks.hashSecret).toHaveBeenCalledWith('bad-admin-refresh');
  });

  it('rejects expired password-reset tokens', async () => {
    mocks.prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 'prt1',
      userId: 'u1',
      expiresAt: new Date(Date.now() - 60_000),
      usedAt: null
    });

    const result = await auth.resetPassword('token123', 'new-password');

    expect(result.status).toBe('invalid');
    expect(mocks.prisma.passwordResetToken.update).not.toHaveBeenCalled();
  });

  it('marks password-reset tokens as single-use and invalidates reused links', async () => {
    const tokenRecord = {
      id: 'prt1',
      userId: 'u1',
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null
    };
    mocks.prisma.passwordResetToken.findFirst.mockImplementation(() => (tokenRecord.usedAt ? null : tokenRecord));
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com', isActive: true });
    mocks.prisma.user.update.mockResolvedValue({ id: 'u1' });
    mocks.prisma.passwordResetToken.update.mockImplementation(async () => {
      tokenRecord.usedAt = new Date();
      return tokenRecord;
    });
    mocks.prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    mocks.prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

    const first = await auth.resetPassword('token123', 'new-password');
    const second = await auth.resetPassword('token123', 'new-password-2');

    expect(first.status).toBe('ok');
    expect(second.status).toBe('invalid');
    expect(mocks.prisma.passwordResetToken.update).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(mocks.prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('uses the configured production base path for reset emails', async () => {
    mocks.env.APP_URL = 'https://signalgrowth.in';
    mocks.env.APP_BASE_PATH = '/jwt-auth-demo';
    mocks.prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'user@example.com' });

    const result = await auth.requestPasswordReset('user@example.com');

    expect(result.ok).toBe(true);
    const emailArgs = mocks.sendEmail.mock.calls[0][0];
    expect(emailArgs.text).toContain('https://signalgrowth.in/jwt-auth-demo/reset-password?token=token123');
    expect(emailArgs.html).toContain('https://signalgrowth.in/jwt-auth-demo/reset-password?token=token123');
  });
});
