import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: {
      count: vi.fn(),
      deleteMany: vi.fn()
    },
    masterAdmin: {
      count: vi.fn(),
      deleteMany: vi.fn()
    },
    masterAdminRefreshToken: {
      count: vi.fn(),
      deleteMany: vi.fn()
    },
    refreshToken: {
      count: vi.fn(),
      deleteMany: vi.fn()
    },
    verificationToken: {
      count: vi.fn(),
      deleteMany: vi.fn()
    },
    passwordResetToken: {
      count: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: mocks.prisma }));

const { cleanupDemoUsers, getDemoCleanupCutoff, DEMO_CLEANUP_RETENTION_MS } = await import('../src/services/demoCleanup.js');

function createFixture() {
  const now = new Date('2026-08-24T12:00:00.000Z');
  const users = [
    { id: 'u-young', createdAt: new Date(now.getTime() - (DEMO_CLEANUP_RETENTION_MS - 1)) },
    { id: 'u-just-under', createdAt: new Date(now.getTime() - (DEMO_CLEANUP_RETENTION_MS - 60_000)) },
    { id: 'u-at-cutoff', createdAt: new Date(now.getTime() - DEMO_CLEANUP_RETENTION_MS) },
    { id: 'u-old', createdAt: new Date(now.getTime() - (DEMO_CLEANUP_RETENTION_MS + 60_000)) },
    { id: 'u-verified-old', createdAt: new Date(now.getTime() - (DEMO_CLEANUP_RETENTION_MS + 120_000)) },
    { id: 'u-unverified-old', createdAt: new Date(now.getTime() - (DEMO_CLEANUP_RETENTION_MS + 180_000)) },
    { id: 'u-session-old', createdAt: new Date(now.getTime() - (DEMO_CLEANUP_RETENTION_MS + 240_000)) },
    { id: 'u-newer', createdAt: new Date(now.getTime() - 60_000) }
  ];
  const refreshTokens = [
    { id: 'rt-old', userId: 'u-old' },
    { id: 'rt-session', userId: 'u-session-old' }
  ];
  const verificationTokens = [
    { id: 'vt-old', userId: 'u-verified-old' },
    { id: 'vt-unverified', userId: 'u-unverified-old' }
  ];
  const passwordResetTokens = [
    { id: 'prt-old', userId: 'u-old' }
  ];
  const masterAdmins = [
    { id: 'ma-old', createdAt: new Date(now.getTime() - (DEMO_CLEANUP_RETENTION_MS + 7 * 24 * 60 * 60 * 1000)) }
  ];
  const masterAdminRefreshTokens = [
    { id: 'mart-old', masterAdminId: 'ma-old' }
  ];
  return { now, users, refreshTokens, verificationTokens, passwordResetTokens, masterAdmins, masterAdminRefreshTokens };
}

function installFixture(fixture) {
  mocks.prisma.user.count.mockImplementation(async ({ where }) => fixture.users.filter((user) => user.createdAt <= where.createdAt.lte).length);
  mocks.prisma.user.deleteMany.mockImplementation(async ({ where }) => {
    const eligible = fixture.users.filter((user) => user.createdAt <= where.createdAt.lte);
    const eligibleIds = new Set(eligible.map((user) => user.id));
    fixture.users = fixture.users.filter((user) => !eligibleIds.has(user.id));
    fixture.refreshTokens = fixture.refreshTokens.filter((token) => !eligibleIds.has(token.userId));
    fixture.verificationTokens = fixture.verificationTokens.filter((token) => !eligibleIds.has(token.userId));
    fixture.passwordResetTokens = fixture.passwordResetTokens.filter((token) => !eligibleIds.has(token.userId));
    return { count: eligible.length };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('demo cleanup', () => {
  it('calculates the cutoff exactly 24 hours back', () => {
    const now = new Date('2026-08-24T12:00:00.000Z');
    expect(getDemoCleanupCutoff(now).toISOString()).toBe('2026-08-23T12:00:00.000Z');
  });

  it('keeps users younger than 24 hours and deletes users at or older than the cutoff', async () => {
    const fixture = createFixture();
    installFixture(fixture);

    const result = await cleanupDemoUsers({ now: fixture.now });

    expect(result.eligibleCount).toBe(5);
    expect(result.removedCount).toBe(5);
    expect(fixture.users.map((u) => u.id)).toEqual(['u-young', 'u-just-under', 'u-newer']);
    expect(fixture.refreshTokens).toEqual([]);
    expect(fixture.verificationTokens).toEqual([]);
    expect(fixture.passwordResetTokens).toEqual([]);
  });

  it('treats exactly 24 hours as eligible and just under 24 hours as retained', async () => {
    const fixture = createFixture();
    installFixture(fixture);

    const result = await cleanupDemoUsers({ now: fixture.now, dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.eligibleCount).toBe(5);
    expect(result.removedCount).toBe(0);
    expect(fixture.users.map((u) => u.id)).toContain('u-at-cutoff');
    expect(fixture.users.map((u) => u.id)).toContain('u-just-under');
  });

  it('is idempotent on a second run', async () => {
    const fixture = createFixture();
    installFixture(fixture);

    const first = await cleanupDemoUsers({ now: fixture.now });
    const second = await cleanupDemoUsers({ now: fixture.now });

    expect(first.removedCount).toBe(5);
    expect(second.removedCount).toBe(0);
    expect(second.eligibleCount).toBe(0);
  });

  it('leaves MasterAdmin and MasterAdminRefreshToken untouched', async () => {
    const fixture = createFixture();
    installFixture(fixture);
    await cleanupDemoUsers({ now: fixture.now });

    expect(fixture.masterAdmins).toHaveLength(1);
    expect(fixture.masterAdminRefreshTokens).toHaveLength(1);
    expect(mocks.prisma.masterAdmin.count).not.toHaveBeenCalled();
    expect(mocks.prisma.masterAdmin.deleteMany).not.toHaveBeenCalled();
    expect(mocks.prisma.masterAdminRefreshToken.count).not.toHaveBeenCalled();
    expect(mocks.prisma.masterAdminRefreshToken.deleteMany).not.toHaveBeenCalled();
  });

  it('fails safely when the user count query fails', async () => {
    mocks.prisma.user.count.mockRejectedValue(new Error('database unavailable'));

    await expect(cleanupDemoUsers({ now: new Date('2026-08-24T12:00:00.000Z') })).rejects.toThrow('database unavailable');
  });
});
