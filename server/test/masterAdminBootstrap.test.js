import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    masterAdmin: {
      findFirst: vi.fn(),
      create: vi.fn()
    }
  },
  hashPassword: vi.fn(async (value) => `hashed:${value}`)
}));

vi.mock('../src/lib/crypto.js', () => ({ hashPassword: mocks.hashPassword }));

const { bootstrapMasterAdmin } = await import('../src/services/masterAdminBootstrap.js');

beforeEach(() => {
  mocks.prisma.masterAdmin.findFirst.mockReset();
  mocks.prisma.masterAdmin.create.mockReset();
  mocks.hashPassword.mockReset();
  mocks.hashPassword.mockImplementation(async (value) => `hashed:${value}`);
});

describe('master admin bootstrap', () => {
  it('hashes the bootstrap password when creating the first MasterAdmin', async () => {
    mocks.prisma.masterAdmin.findFirst.mockResolvedValue(null);
    mocks.prisma.masterAdmin.create.mockResolvedValue({ id: 'ma1', username: 'admin@example.com' });

    const result = await bootstrapMasterAdmin(mocks.prisma, {
      username: 'admin@example.com',
      password: 'secret-pass'
    });

    expect(result.created).toBe(true);
    expect(mocks.hashPassword).toHaveBeenCalledWith('secret-pass');
    expect(mocks.prisma.masterAdmin.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        username: 'admin@example.com',
        email: 'admin@example.com',
        passwordHash: 'hashed:secret-pass',
        status: 'active'
      })
    }));
  });

  it('is idempotent when the MasterAdmin already exists', async () => {
    mocks.prisma.masterAdmin.findFirst.mockResolvedValue({
      id: 'ma1',
      username: 'admin@example.com',
      passwordHash: 'hashed:secret-pass'
    });

    const result = await bootstrapMasterAdmin(mocks.prisma, {
      username: 'admin@example.com',
      password: 'secret-pass'
    });

    expect(result.created).toBe(false);
    expect(result.masterAdmin.id).toBe('ma1');
    expect(mocks.hashPassword).not.toHaveBeenCalled();
    expect(mocks.prisma.masterAdmin.create).not.toHaveBeenCalled();
  });
});
