import { prisma } from '../lib/prisma.js';

export const DEMO_CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1000;

export function getDemoCleanupCutoff(now = new Date()) {
  return new Date(now.getTime() - DEMO_CLEANUP_RETENTION_MS);
}

export async function countEligibleDemoUsers(cutoff = getDemoCleanupCutoff()) {
  return prisma.user.count({
    where: {
      createdAt: {
        lte: cutoff
      }
    }
  });
}

export async function cleanupDemoUsers({ dryRun = false, now = new Date() } = {}) {
  const cutoff = getDemoCleanupCutoff(now);
  const eligibleCount = await countEligibleDemoUsers(cutoff);
  if (dryRun) {
    return { dryRun: true, cutoff, eligibleCount, removedCount: 0 };
  }

  const result = await prisma.user.deleteMany({
    where: {
      createdAt: {
        lte: cutoff
      }
    }
  });

  return {
    dryRun: false,
    cutoff,
    eligibleCount,
    removedCount: result.count
  };
}
