/**
 * Cached Employee-table column sync.
 * Previously ran 30+ ALTER TABLE statements on every /api/employees request.
 */

import type { PrismaClient } from '@prisma/client';

let lastSyncAt = 0;
let syncPromise: Promise<void> | null = null;
const SYNC_TTL_MS = 10 * 60 * 1000;

const EMPLOYEE_COLUMN_STATEMENTS = [
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "maritalStatus" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "nationality" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "address" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "city" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "state" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "zipCode" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "country" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "reportingManagerId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "designationId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "dateOfJoining" TIMESTAMP(3)`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bloodGroup" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankName" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankAccountNo" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankIfscCode" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "panNumber" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "aadhaarNumber" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "taxId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salary" DOUBLE PRECISION`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salaryCurrency" TEXT NOT NULL DEFAULT 'INR'`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "leavePolicyId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "attendancePolicyId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "travelPolicyId" TEXT`,
  `ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "salaryStructureId" TEXT`,
];

const USER_COLUMN_STATEMENTS = [
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatar" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'employee'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active'`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLogout" TIMESTAMP(3)`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW()`,
];

export async function ensureEmployeeColumns(db: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'development' && process.env.FORCE_RUNTIME_SYNC !== '1') {
    return;
  }
  if (Date.now() - lastSyncAt < SYNC_TTL_MS) return;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      for (const sql of EMPLOYEE_COLUMN_STATEMENTS) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch {
          /* column already exists */
        }
      }
      lastSyncAt = Date.now();
    } catch (err) {
      console.warn('[employee-schema-sync] failed (non-fatal):', err);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

export async function ensureEmployeeAndUserColumns(db: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'development' && process.env.FORCE_RUNTIME_SYNC !== '1') {
    return;
  }
  await ensureEmployeeColumns(db);
  if (Date.now() - lastSyncAt < SYNC_TTL_MS) return;

  for (const sql of USER_COLUMN_STATEMENTS) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch {
      /* column already exists */
    }
  }
}
