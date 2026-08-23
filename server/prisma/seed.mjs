import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { bootstrapMasterAdmin } from '../src/services/masterAdminBootstrap.js';

async function main() {
  const username = env.MASTER_ADMIN_USERNAME?.trim();
  const password = env.MASTER_ADMIN_PASSWORD;
  if (!username || !password) {
    throw new Error('MASTER_ADMIN_USERNAME and MASTER_ADMIN_PASSWORD must be set for bootstrap seeding');
  }
  const result = await bootstrapMasterAdmin(prisma, { username, password });
  process.stdout.write(result.created ? 'MasterAdmin seeded\n' : 'MasterAdmin already exists\n');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
