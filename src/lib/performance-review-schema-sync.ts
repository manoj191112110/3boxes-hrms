import type { PrismaClient } from '@prisma/client';

let lastSyncAt = 0;
let syncPromise: Promise<void> | null = null;
const SYNC_TTL_MS = 10 * 60 * 1000;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "PerformanceReview" ("id" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "reviewCycle" TEXT NOT NULL, "reviewPeriod" TEXT, "reviewerId" TEXT, "rating" DOUBLE PRECISION NOT NULL DEFAULT 0, "goalsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "skillsRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "behaviorRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "overallRating" DOUBLE PRECISION NOT NULL DEFAULT 0, "comments" TEXT, "strengths" TEXT, "improvements" TEXT, "status" TEXT NOT NULL DEFAULT 'pending', "reviewDate" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(), CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id"))`,
  `CREATE INDEX IF NOT EXISTS "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId")`,
];

export async function ensurePerformanceReviewTable(db: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'development' && process.env.FORCE_RUNTIME_SYNC !== '1') {
    return;
  }
  if (Date.now() - lastSyncAt < SYNC_TTL_MS) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      for (const sql of STATEMENTS) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch {
          /* already exists */
        }
      }
      lastSyncAt = Date.now();
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}
