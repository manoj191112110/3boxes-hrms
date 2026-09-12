/**
 * Leave Approval Workflow Engine
 *
 * Handles dynamic multi-tier leave approval:
 *   1. Resolves the approver chain from LeaveWorkflowConfig
 *   2. Resolves concrete user IDs for each tier (reporting_manager → userId, etc.)
 *   3. Creates LeaveApprovalStep rows for each tier
 *   4. Advances the workflow on each approve/reject
 *   5. Sends notifications at each stage
 *
 * Approver types:
 *   - 'reporting_manager' → Employee.reportingManagerId → User.id
 *   - 'department_head'   → Department.headId → User.id
 *   - 'hr_admin'          → any user with role 'admin' in the tenant
 *   - 'tenant_admin'      → any user with role 'tenant_admin' in the tenant
 *   - 'specific_user'     → the exact user ID specified in approverId
 *   - 'specific_employee' → the employee ID specified → resolve to their userId
 */

import type { PrismaClient } from '@/generated/prisma/client';

export interface WorkflowTier {
  tier: number;
  approverType: 'reporting_manager' | 'department_head' | 'hr_admin' | 'tenant_admin' | 'specific_user' | 'specific_employee';
  approverId?: string | null; // user ID (for specific_user) or employee ID (for specific_employee)
  label?: string;
}

export interface WorkflowConfig {
  tiers: WorkflowTier[];
  requireAllTiers: boolean;
  autoApproveShortLeave?: boolean;
  shortLeaveMaxDays?: number;

  // ─── Unified policy rules (absorbed from legacy LeavePolicyRule) ───
  // These were previously configured in the separate "Policy Rules &
  // Leave Type Configuration" tab. They are now part of the single
  // workflow config so leave has ONE source of truth for both policy
  // and approval chain.
  sandwichRuleEnabled?: boolean;        // leave sandwiched between holidays/weekends counts as leave
  proRataEnabled?: boolean;             // pro-rata leave for mid-year joiners
  probationRestriction?: boolean;       // restrict leave during probation
  probationMonths?: number;             // months of probation before full leave access
  encashmentAllowed?: boolean;          // can encash unused leave
  carryForwardGlobal?: boolean;         // global carry-forward toggle
  maxCarryForwardDays?: number;         // max days that can be carried forward
  // Leave-type allocations are kept in the LeaveType table itself (per-type
  // defaultDays / carryForward), so they are NOT duplicated here. The
  // LeavePolicyRule.leaveTypeAllocations JSON is deprecated.
}

export const DEFAULT_WORKFLOW_CONFIG: WorkflowConfig = {
  tiers: [
    { tier: 1, approverType: 'reporting_manager', label: 'Reporting Manager' },
    { tier: 2, approverType: 'hr_admin', label: 'HR Admin' },
  ],
  requireAllTiers: true,
  autoApproveShortLeave: false,
  shortLeaveMaxDays: 1,
  // Unified policy defaults (mirror legacy LeavePolicyRule defaults)
  sandwichRuleEnabled: true,
  proRataEnabled: false,
  probationRestriction: true,
  probationMonths: 6,
  encashmentAllowed: false,
  carryForwardGlobal: true,
  maxCarryForwardDays: 5,
};

/**
 * Load the active workflow config for a tenant + leave type.
 * Falls back to a leave-type-specific config, then a tenant-wide config,
 * then inherits policy-rule fields from the legacy LeavePolicyRule table,
 * then the DEFAULT_WORKFLOW_CONFIG.
 */
export async function loadWorkflowConfig(
  db: PrismaClient,
  tenantId: string,
  leaveTypeId?: string | null,
): Promise<{ config: WorkflowConfig; configId: string | null }> {
  try {
    // 1. Try leave-type-specific config
    if (leaveTypeId) {
      const typeConfig = await (db as any).leaveWorkflowConfig?.findFirst({
        where: { tenantId, leaveTypeId, isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (typeConfig) {
        const parsed = JSON.parse(typeConfig.config) as WorkflowConfig;
        return { config: { ...DEFAULT_WORKFLOW_CONFIG, ...parsed }, configId: typeConfig.id };
      }
    }
    // 2. Try tenant-wide config (leaveTypeId IS NULL)
    const tenantConfig = await (db as any).leaveWorkflowConfig?.findFirst({
      where: { tenantId, leaveTypeId: null, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (tenantConfig) {
      const parsed = JSON.parse(tenantConfig.config) as WorkflowConfig;
      return { config: { ...DEFAULT_WORKFLOW_CONFIG, ...parsed }, configId: tenantConfig.id };
    }
  } catch {
    // Table might not exist yet — fall through to legacy fallback
  }

  // 3. Legacy fallback — inherit policy-rule fields from LeavePolicyRule
  // table so admins who configured the old "Policy Rules" tab don't lose
  // their sandwich / pro-rata / probation / encashment / carry-forward
  // settings until they save a unified workflow config.
  try {
    const legacyRule = await (db as any).leavePolicyRule?.findFirst({
      where: { status: 'active', employmentType: 'all' },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    });
    if (legacyRule) {
      return {
        config: {
          ...DEFAULT_WORKFLOW_CONFIG,
          sandwichRuleEnabled: legacyRule.sandwichRuleEnabled ?? DEFAULT_WORKFLOW_CONFIG.sandwichRuleEnabled,
          proRataEnabled: legacyRule.proRataEnabled ?? DEFAULT_WORKFLOW_CONFIG.proRataEnabled,
          probationRestriction: legacyRule.probationRestriction ?? DEFAULT_WORKFLOW_CONFIG.probationRestriction,
          probationMonths: Number(legacyRule.probationMonths ?? DEFAULT_WORKFLOW_CONFIG.probationMonths),
          encashmentAllowed: legacyRule.encashmentAllowed ?? DEFAULT_WORKFLOW_CONFIG.encashmentAllowed,
          carryForwardGlobal: legacyRule.carryForwardGlobal ?? DEFAULT_WORKFLOW_CONFIG.carryForwardGlobal,
          maxCarryForwardDays: Number(legacyRule.maxCarryForwardDays ?? DEFAULT_WORKFLOW_CONFIG.maxCarryForwardDays),
        },
        configId: null,
      };
    }
  } catch {
    /* legacy table may not exist — ignore */
  }

  // 4. Default config
  return { config: DEFAULT_WORKFLOW_CONFIG, configId: null };
}

/**
 * Resolve a concrete user ID for a single tier's approver type.
 * Returns the user ID or null if no approver could be resolved.
 */
export async function resolveApproverForTier(
  db: PrismaClient,
  employeeId: string,
  tenantId: string,
  tier: WorkflowTier,
): Promise<string | null> {
  try {
    // Fetch the employee with department + reporting manager
    const emp = await db.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        userId: true,
        reportingManagerId: true,
        departmentId: true,
        department: { select: { id: true, headId: true } },
      },
    });
    if (!emp) return null;

    switch (tier.approverType) {
      case 'reporting_manager': {
        if (!emp.reportingManagerId) return null;
        const mgr = await db.employee.findUnique({
          where: { id: emp.reportingManagerId },
          select: { userId: true },
        });
        return mgr?.userId || null;
      }
      case 'department_head': {
        const headId = emp.department?.headId;
        if (!headId) return null;
        const head = await db.employee.findUnique({
          where: { id: headId },
          select: { userId: true },
        });
        return head?.userId || null;
      }
      case 'hr_admin': {
        // Find any active admin user in the tenant
        const admin = await db.user.findFirst({
          where: { tenantId, role: 'admin', status: 'active' },
          select: { id: true },
        });
        return admin?.id || null;
      }
      case 'tenant_admin': {
        const admin = await db.user.findFirst({
          where: { tenantId, role: 'tenant_admin', status: 'active' },
          select: { id: true },
        });
        return admin?.id || null;
      }
      case 'specific_user': {
        return tier.approverId || null;
      }
      case 'specific_employee': {
        if (!tier.approverId) return null;
        const target = await db.employee.findUnique({
          where: { id: tier.approverId },
          select: { userId: true },
        });
        return target?.userId || null;
      }
      default:
        return null;
    }
  } catch (err) {
    console.error('[LeaveWorkflow] resolveApproverForTier failed:', err);
    return null;
  }
}

/**
 * Initialize the workflow for a newly-submitted leave request.
 * Creates LeaveApprovalStep rows for each tier, sets the workflowStage
 * to the first tier, and notifies the first approver.
 *
 * Returns the resolved currentApproverId (or null if no workflow was set up).
 */
export async function initializeLeaveWorkflow(
  db: PrismaClient,
  leaveRequestId: string,
  employeeId: string,
  tenantId: string,
  config: WorkflowConfig,
  configId: string | null,
  leaveTypeName?: string,
): Promise<{ currentApproverId: string | null; firstTier: number }> {
  // Snapshot the config so historical requests retain their original chain
  const configSnapshot = JSON.stringify({ config, configId, initializedAt: new Date().toISOString() });

  // If no tiers, fall back to legacy single-step behavior
  if (!config.tiers || config.tiers.length === 0) {
    await db.$executeRawUnsafe(
      `UPDATE "LeaveRequest" SET "workflowStage" = NULL, "workflowConfigSnapshot" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
      configSnapshot,
      leaveRequestId,
    ).catch(() => null);
    return { currentApproverId: null, firstTier: 0 };
  }

  const firstTier = config.tiers[0];
  const firstApproverId = await resolveApproverForTier(db, employeeId, tenantId, firstTier);

  // Set the workflow stage to tier 1
  const stage = `tier_${firstTier.tier}_review`;
  await db.$executeRawUnsafe(
    `UPDATE "LeaveRequest" SET "workflowStage" = $1, "currentApproverId" = $2, "workflowConfigSnapshot" = $3, "updatedAt" = NOW() WHERE "id" = $4`,
    stage,
    firstApproverId,
    configSnapshot,
    leaveRequestId,
  ).catch(async (err: Error) => {
    // If the columns don't exist (tenant DB not synced), try ALTER + retry
    console.warn('[LeaveWorkflow] workflowStage update failed, trying schema sync:', err.message);
    try {
      await db.$executeRawUnsafe(`ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "workflowStage" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "currentApproverId" TEXT`);
      await db.$executeRawUnsafe(`ALTER TABLE "LeaveRequest" ADD COLUMN IF NOT EXISTS "workflowConfigSnapshot" TEXT`);
      await db.$executeRawUnsafe(
        `UPDATE "LeaveRequest" SET "workflowStage" = $1, "currentApproverId" = $2, "workflowConfigSnapshot" = $3, "updatedAt" = NOW() WHERE "id" = $4`,
        stage,
        firstApproverId,
        configSnapshot,
        leaveRequestId,
      );
    } catch (e2) {
      console.error('[LeaveWorkflow] schema sync + retry failed:', e2);
    }
  });

  // Create LeaveApprovalStep rows for ALL tiers (with action=NULL)
  // This gives us a complete approval chain preview upfront
  for (const tier of config.tiers) {
    const approverUserId = tier.tier === firstTier.tier
      ? firstApproverId
      : null; // Will be resolved when this tier becomes active

    try {
      // Check if the LeaveApprovalStep table exists; if not, create it
      await db.$executeRawUnsafe(
        `INSERT INTO "LeaveApprovalStep" ("id", "leaveRequestId", "tier", "approverType", "approverUserId", "createdAt")
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT DO NOTHING`,
        `las-${leaveRequestId}-${tier.tier}-${Date.now().toString(36)}`,
        leaveRequestId,
        tier.tier,
        tier.approverType,
        approverUserId,
      ).catch(async (err: Error) => {
        // Table might not exist — create it and retry
        if (err.message.includes('relation') || err.message.includes('does not exist')) {
          await db.$executeRawUnsafe(
            `CREATE TABLE IF NOT EXISTS "LeaveApprovalStep" (
              "id" TEXT NOT NULL,
              "leaveRequestId" TEXT NOT NULL,
              "tier" INTEGER NOT NULL,
              "approverType" TEXT NOT NULL,
              "approverUserId" TEXT,
              "actionByUserId" TEXT,
              "action" TEXT,
              "comments" TEXT,
              "actionAt" TIMESTAMP(3),
              "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
              CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
            )`,
          ).catch(() => null);
          await db.$executeRawUnsafe(
            `CREATE INDEX IF NOT EXISTS "LeaveApprovalStep_leaveRequestId_idx" ON "LeaveApprovalStep"("leaveRequestId")`,
          ).catch(() => null);
          // Retry insert
          await db.$executeRawUnsafe(
            `INSERT INTO "LeaveApprovalStep" ("id", "leaveRequestId", "tier", "approverType", "approverUserId", "createdAt")
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT DO NOTHING`,
            `las-${leaveRequestId}-${tier.tier}-${Date.now().toString(36)}`,
            leaveRequestId,
            tier.tier,
            tier.approverType,
            approverUserId,
          ).catch(() => null);
        }
      });
    } catch (e) {
      console.error('[LeaveWorkflow] Failed to create approval step for tier', tier.tier, e);
    }
  }

  return { currentApproverId: firstApproverId, firstTier: firstTier.tier };
}

/**
 * Advance the workflow to the next tier after the current tier approves.
 * If this was the last tier, finalize the leave request (status='approved').
 *
 * Returns:
 *   - { finalized: true } if the request is now fully approved
 *   - { finalized: false, nextApproverId, nextTier } if advanced to next tier
 */
export async function advanceLeaveWorkflow(
  db: PrismaClient,
  leaveRequestId: string,
  employeeId: string,
  tenantId: string,
  approvedByUserId: string,
  comments: string,
  leaveTypeName?: string,
): Promise<{ finalized: boolean; nextApproverId: string | null; nextTier: number | null }> {
  // Load the workflow config snapshot from the leave request
  let config: WorkflowConfig | null = null;
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT "workflowConfigSnapshot" FROM "LeaveRequest" WHERE "id" = $1 LIMIT 1`,
      leaveRequestId,
    ) as any[];
    if (rows?.[0]?.workflowconfigsnapshot || rows?.[0]?.workflowConfigSnapshot) {
      const snapshot = JSON.parse(rows[0].workflowconfigsnapshot || rows[0].workflowConfigSnapshot);
      config = snapshot.config;
    }
  } catch (err) {
    console.error('[LeaveWorkflow] Failed to load config snapshot:', err);
  }

  if (!config || !config.tiers || config.tiers.length === 0) {
    // No workflow — legacy single-step. Finalize immediately.
    return { finalized: true, nextApproverId: null, nextTier: null };
  }

  // Find the current tier from the workflowStage
  let currentTierNum = 1;
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT "workflowStage" FROM "LeaveRequest" WHERE "id" = $1 LIMIT 1`,
      leaveRequestId,
    ) as any[];
    const stage = rows?.[0]?.workflowstage || rows?.[0]?.workflowStage;
    if (stage) {
      const match = stage.match(/^tier_(\d+)_review$/);
      if (match) currentTierNum = parseInt(match[1]);
    }
  } catch { /* ignore */ }

  // Mark the current tier's approval step as 'approve'
  try {
    await db.$executeRawUnsafe(
      `UPDATE "LeaveApprovalStep"
         SET "action" = 'approve', "actionByUserId" = $1, "comments" = $2, "actionAt" = NOW()
       WHERE "leaveRequestId" = $3 AND "tier" = $4 AND "action" IS NULL`,
      approvedByUserId,
      comments || null,
      leaveRequestId,
      currentTierNum,
    );
  } catch (e) {
    console.error('[LeaveWorkflow] Failed to update approval step:', e);
  }

  // Find the next tier
  const sortedTiers = [...config.tiers].sort((a, b) => a.tier - b.tier);
  const currentTierIndex = sortedTiers.findIndex(t => t.tier === currentTierNum);
  const nextTier = sortedTiers[currentTierIndex + 1];

  if (!nextTier) {
    // No more tiers — finalize
    await db.$executeRawUnsafe(
      `UPDATE "LeaveRequest"
         SET "status" = 'approved',
             "workflowStage" = 'final_approval',
             "currentApproverId" = NULL,
             "approvedBy" = $1,
             "approvedAt" = NOW(),
             "comments" = $2,
             "updatedAt" = NOW()
       WHERE "id" = $3`,
      approvedByUserId,
      comments || null,
      leaveRequestId,
    ).catch(() => null);

    // ─── Deduct leave balance on final approval ───
    // Bug fix: the workflow engine previously finalized without deducting
    // the leave balance. The PATCH /api/leave/[id] route had its own
    // deduction as a rescue, but centralizing it here ensures every caller
    // gets the deduction for free (and prevents double-deduction since the
    // PATCH route checks result.finalized before deducting).
    try {
      const lr = await db.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        select: { employeeId: true, leaveTypeId: true, startDate: true, endDate: true, halfDay: true },
      });
      if (lr) {
        const daysDiff = Math.ceil(
          (new Date(lr.endDate).getTime() - new Date(lr.startDate).getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
        const days = lr.halfDay ? 0.5 : daysDiff;
        const year = new Date(lr.startDate).getFullYear();
        await db.leaveBalance.updateMany({
          where: { employeeId: lr.employeeId, leaveTypeId: lr.leaveTypeId, year },
          data: { used: { increment: days }, remaining: { decrement: days } },
        });
      }
    } catch (e) {
      console.warn(`[leave-workflow] Balance deduction on finalize failed (non-fatal) for ${leaveRequestId}:`, e);
    }

    return { finalized: true, nextApproverId: null, nextTier: null };
  }

  // Resolve the next approver
  const nextApproverId = await resolveApproverForTier(db, employeeId, tenantId, nextTier);
  const nextStage = `tier_${nextTier.tier}_review`;

  await db.$executeRawUnsafe(
    `UPDATE "LeaveRequest"
       SET "workflowStage" = $1,
           "currentApproverId" = $2,
           "updatedAt" = NOW()
     WHERE "id" = $3`,
    nextStage,
    nextApproverId,
    leaveRequestId,
  ).catch(() => null);

  // Update the approval step for the next tier with the resolved approver
  try {
    await db.$executeRawUnsafe(
      `UPDATE "LeaveApprovalStep"
         SET "approverUserId" = $1
       WHERE "leaveRequestId" = $2 AND "tier" = $3`,
      nextApproverId,
      leaveRequestId,
      nextTier.tier,
    );
  } catch { /* non-critical */ }

  return { finalized: false, nextApproverId, nextTier: nextTier.tier };
}

/**
 * Reject the leave request at the current tier.
 * Sets status='rejected', marks the current approval step as 'reject',
 * and stops the workflow.
 */
export async function rejectLeaveWorkflow(
  db: PrismaClient,
  leaveRequestId: string,
  rejectedByUserId: string,
  comments: string,
): Promise<void> {
  // Find the current tier
  let currentTierNum = 1;
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT "workflowStage" FROM "LeaveRequest" WHERE "id" = $1 LIMIT 1`,
      leaveRequestId,
    ) as any[];
    const stage = rows?.[0]?.workflowstage || rows?.[0]?.workflowStage;
    if (stage) {
      const match = stage.match(/^tier_(\d+)_review$/);
      if (match) currentTierNum = parseInt(match[1]);
    }
  } catch { /* ignore */ }

  // Mark the current tier's step as 'reject'
  try {
    await db.$executeRawUnsafe(
      `UPDATE "LeaveApprovalStep"
         SET "action" = 'reject', "actionByUserId" = $1, "comments" = $2, "actionAt" = NOW()
       WHERE "leaveRequestId" = $3 AND "tier" = $4 AND "action" IS NULL`,
      rejectedByUserId,
      comments || null,
      leaveRequestId,
      currentTierNum,
    );
  } catch (e) {
    console.error('[LeaveWorkflow] Failed to update rejection step:', e);
  }

  // Set the leave request status to 'rejected'
  await db.$executeRawUnsafe(
    `UPDATE "LeaveRequest"
       SET "status" = 'rejected',
           "workflowStage" = 'rejected',
           "currentApproverId" = NULL,
           "approvedBy" = $1,
           "approvedAt" = NOW(),
           "comments" = $2,
           "updatedAt" = NOW()
     WHERE "id" = $3`,
    rejectedByUserId,
    comments || null,
    leaveRequestId,
  ).catch(() => null);
}

/**
 * Check if a user is authorized to approve the current tier of a leave request.
 * - The resolved currentApproverId must match
 * - OR the user is a super_admin / tenant_admin (can override any tier)
 * - OR the user is an admin in the same tenant
 */
export async function canUserApproveCurrentTier(
  db: PrismaClient,
  leaveRequestId: string,
  userId: string,
  userRole: string,
  tenantId: string,
): Promise<boolean> {
  // Super admins and tenant admins can always approve
  if (userRole === 'super_admin' || userRole === 'tenant_admin') return true;

  // Get the currentApproverId from the leave request
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT "currentApproverId", "status" FROM "LeaveRequest" WHERE "id" = $1 LIMIT 1`,
      leaveRequestId,
    ) as any[];
    if (!rows?.[0]) return false;
    if (rows[0].status !== 'pending') return false; // Can't approve non-pending

    const currentApproverId = rows[0].currentapproverid || rows[0].currentApproverId;
    if (currentApproverId === userId) return true;

    // HR admins (role='admin' or 'hr_admin') in the same tenant can also
    // approve. 2026-09-09: 'hr_admin' added — the LIVE tenant's HR account
    // (admin@marqaitech.com) has role 'hr_admin' and tier approverType is
    // 'hr_admin', but this check only knew role 'admin' → tier-2 approvals
    // were impossible ("not authorized to approve this tier").
    if (userRole === 'admin' || userRole === 'hr_admin') {
      const admin = await db.user.findFirst({
        where: { id: userId, tenantId, role: { in: ['admin', 'hr_admin'] }, status: 'active' },
        select: { id: true },
      });
      if (admin) return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Get the full approval history for a leave request.
 * Returns the LeaveApprovalStep rows ordered by tier.
 */
export async function getApprovalHistory(
  db: PrismaClient,
  leaveRequestId: string,
): Promise<any[]> {
  try {
    const rows = await db.$queryRawUnsafe(
      `SELECT las.*, u."name" AS "actionByName", u."email" AS "actionByEmail"
       FROM "LeaveApprovalStep" las
       LEFT JOIN "User" u ON u."id" = las."actionByUserId"
       WHERE las."leaveRequestId" = $1
       ORDER BY las."tier" ASC`,
      leaveRequestId,
    ) as any[];
    return rows || [];
  } catch {
    return [];
  }
}
