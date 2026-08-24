import { cleanupDemoUsers } from '../src/services/demoCleanup.js';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const result = await cleanupDemoUsers({ dryRun, now: new Date() });
  if (dryRun) {
    process.stdout.write(`Demo cleanup dry run: ${result.eligibleCount} users eligible\n`);
    return;
  }
  process.stdout.write(`Demo cleanup complete: ${result.removedCount} users removed\n`);
}

main()
  .catch((err) => {
    process.stderr.write('Demo cleanup failed\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
