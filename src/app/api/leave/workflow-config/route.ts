import { NextResponse } from 'next/server';
import { getDb, getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import { DEFAULT_WORKFLOW_CONFIG, type WorkflowConfig, type WorkflowTier } from '@/lib/leave-workflow';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

/**
 * GET /api/leave/workflow-config
 *
 * Returns the active leave workflow config for the current tenant.
 * Optional ?leaveTypeId= to get a leave-type-specific config.
 *
 * Query params:
 *   ?leaveTypeId=<id>  — get config scoped to this leave type
 */
export async function GET(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const tenantId = (decoded as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400, headers: corsHeaders() });
    }

    const { searchParams } = new URL(request.url);
    const leaveTypeId = searchParams.get('leaveTypeId');

    // ─── Inline schema-sync for LeaveWorkflowConfig table ───
    try {
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "LeaveWorkflowConfig" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "leaveTypeId" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "config" TEXT NOT NULL,
          "name" TEXT NOT NULL DEFAULT 'Default Leave Approval Workflow',
          "description" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
          CONSTRAINT "LeaveWorkflowConfig_pkey" PRIMARY KEY ("id")
        )`,
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "LeaveWorkflowConfig_tenantId_idx" ON "LeaveWorkflowConfig"("tenantId")`,
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "LeaveWorkflowConfig_leaveTypeId_idx" ON "LeaveWorkflowConfig"("leaveTypeId")`,
      );
    } catch { /* non-fatal */ }

    // Try leave-type-specific config first
    let configRow: any = null;
    if (leaveTypeId) {
      try {
        const rows = await db.$queryRawUnsafe(
          `SELECT * FROM "LeaveWorkflowConfig"
           WHERE "tenantId" = $1 AND "leaveTypeId" = $2 AND "isActive" = true
           ORDER BY "updatedAt" DESC LIMIT 1`,
          tenantId,
          leaveTypeId,
        ) as any[];
        if (rows?.[0]) configRow = rows[0];
      } catch { /* table might not exist */ }
    }

    // Fall back to tenant-wide config (leaveTypeId IS NULL)
    if (!configRow) {
      try {
        const rows = await db.$queryRawUnsafe(
          `SELECT * FROM "LeaveWorkflowConfig"
           WHERE "tenantId" = $1 AND "leaveTypeId" IS NULL AND "isActive" = true
           ORDER BY "updatedAt" DESC LIMIT 1`,
          tenantId,
        ) as any[];
        if (rows?.[0]) configRow = rows[0];
      } catch { /* table might not exist */ }
    }

    if (configRow) {
      let parsedConfig: WorkflowConfig;
      try {
        parsedConfig = JSON.parse(configRow.config);
      } catch {
        parsedConfig = DEFAULT_WORKFLOW_CONFIG;
      }
      return NextResponse.json({
        config: parsedConfig,
        configId: configRow.id,
        name: configRow.name,
        description: configRow.description,
        leaveTypeId: configRow.leavetypeid || configRow.leaveTypeId,
        source: configRow.leavetypeid || configRow.leaveTypeId ? 'leave_type' : 'tenant',
        // Scope fields (new — unification pass)
        policyDocumentId: configRow.policydocumentid || configRow.policyDocumentId || null,
        employmentType: configRow.employmenttype || configRow.employmentType || 'all',
        branchId: configRow.branchid || configRow.branchId || null,
        departmentId: configRow.departmentid || configRow.departmentId || null,
        employeeStatus: configRow.employeestatus || configRow.employeeStatus || 'all',
      }, { headers: corsHeaders() });
    }

    // No config found — return default
    return NextResponse.json({
      config: DEFAULT_WORKFLOW_CONFIG,
      configId: null,
      name: 'Default Leave Approval Workflow',
      description: null,
      leaveTypeId: leaveTypeId || null,
      source: 'default',
      // Scope defaults
      policyDocumentId: null,
      employmentType: 'all',
      branchId: null,
      departmentId: null,
      employeeStatus: 'all',
    }, { headers: corsHeaders() });
  } catch (error) {
    console.error('[WorkflowConfig GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() },
    );
  }
}

/**
 * POST /api/leave/workflow-config
 *
 * Creates or updates the leave workflow config for the current tenant.
 *
 * Body:
 *   {
 *     "leaveTypeId": "abc" | null,   // null = applies to ALL leave types
 *     "name": "Default Leave Approval Workflow",
 *     "description": "...",
 *     "config": {
 *       "tiers": [
 *         { "tier": 1, "approverType": "reporting_manager", "label": "Direct Manager" },
 *         { "tier": 2, "approverType": "hr_admin", "label": "HR Admin" }
 *       ],
 *       "requireAllTiers": true,
 *       "autoApproveShortLeave": false,
 *       "shortLeaveMaxDays": 1
 *     }
 *   }
 */
export async function POST(request: Request) {
  const db = await getDb(request);
  try {
    const token = getTokenFromHeaders(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: corsHeaders() });

    const role = decoded.role as string;
    if (!['super_admin', 'tenant_admin', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Only admins can configure the leave workflow' },
        { status: 403, headers: corsHeaders() },
      );
    }

    const tenantId = (decoded as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant context' }, { status: 400, headers: corsHeaders() });
    }

    const body = await request.json();
    const { leaveTypeId, name, description, config } = body;
    // Scope fields (new — unification pass)
    const policyDocumentId = (body.policyDocumentId as string) || null;
    const employmentType = ['all', 'full-time', 'part-time', 'contract', 'internship'].includes(String(body.employmentType))
      ? String(body.employmentType) : 'all';
    const branchId = (body.branchId as string) || null;
    const departmentId = (body.departmentId as string) || null;
    const employeeStatus = ['all', 'active', 'on_leave', 'inactive'].includes(String(body.employeeStatus))
      ? String(body.employeeStatus) : 'all';

    if (!config || !config.tiers || !Array.isArray(config.tiers) || config.tiers.length === 0) {
      return NextResponse.json(
        { error: 'Config must have at least one tier' },
        { status: 400, headers: corsHeaders() },
      );
    }

    // Validate tiers
    for (const tier of config.tiers as WorkflowTier[]) {
      if (!tier.tier || !tier.approverType) {
        return NextResponse.json(
          { error: `Each tier must have a tier number and approverType` },
          { status: 400, headers: corsHeaders() },
        );
      }
      const validTypes = ['reporting_manager', 'department_head', 'hr_admin', 'tenant_admin', 'specific_user', 'specific_employee'];
      if (!validTypes.includes(tier.approverType)) {
        return NextResponse.json(
          { error: `Invalid approverType: ${tier.approverType}. Must be one of: ${validTypes.join(', ')}` },
          { status: 400, headers: corsHeaders() },
        );
      }
      if ((tier.approverType === 'specific_user' || tier.approverType === 'specific_employee') && !tier.approverId) {
        return NextResponse.json(
          { error: `Tier ${tier.tier}: approverId is required when approverType is ${tier.approverType}` },
          { status: 400, headers: corsHeaders() },
        );
      }
    }

    // Sort tiers by tier number
    config.tiers.sort((a: WorkflowTier, b: WorkflowTier) => a.tier - b.tier);
    // Re-number tiers sequentially (1, 2, 3, ...)
    config.tiers.forEach((t: WorkflowTier, i: number) => { t.tier = i + 1; });

    // ─── Inline schema-sync ───
    try {
      await db.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "LeaveWorkflowConfig" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "leaveTypeId" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "config" TEXT NOT NULL,
          "name" TEXT NOT NULL DEFAULT 'Default Leave Approval Workflow',
          "description" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
          CONSTRAINT "LeaveWorkflowConfig_pkey" PRIMARY KEY ("id")
        )`,
      );
      await db.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "LeaveWorkflowConfig_tenantId_idx" ON "LeaveWorkflowConfig"("tenantId")`,
      );
    } catch { /* non-fatal */ }

    const configJson = JSON.stringify(config);
    const configId = `lwc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const finalLeaveTypeId = leaveTypeId || null; // null = tenant-wide
    const finalName = name || 'Default Leave Approval Workflow';

    // Upsert: if a config already exists for this tenant + leaveTypeId, update it
    // Otherwise, create a new one
    let existingId: string | null = null;
    try {
      let rows: any[];
      if (finalLeaveTypeId) {
        rows = await db.$queryRawUnsafe(
          `SELECT id FROM "LeaveWorkflowConfig"
           WHERE "tenantId" = $1 AND "leaveTypeId" = $2 AND "isActive" = true
           LIMIT 1`,
          tenantId,
          finalLeaveTypeId,
        ) as any[];
      } else {
        rows = await db.$queryRawUnsafe(
          `SELECT id FROM "LeaveWorkflowConfig"
           WHERE "tenantId" = $1 AND "leaveTypeId" IS NULL AND "isActive" = true
           LIMIT 1`,
          tenantId,
        ) as any[];
      }
      if (rows?.[0]?.id) existingId = rows[0].id;
    } catch { /* table might not exist yet */ }

    if (existingId) {
      // Update existing
      await db.$executeRawUnsafe(
        `UPDATE "LeaveWorkflowConfig"
           SET "config" = $1, "name" = $2, "description" = $3,
               "policyDocumentId" = $4, "employmentType" = $5, "branchId" = $6,
               "departmentId" = $7, "employeeStatus" = $8,
               "updatedAt" = NOW()
         WHERE "id" = $9`,
        configJson,
        finalName,
        description || null,
        policyDocumentId,
        employmentType,
        branchId,
        departmentId,
        employeeStatus,
        existingId,
      );
      return NextResponse.json({
        success: true,
        message: 'Leave workflow config updated successfully',
        configId: existingId,
        config,
        name: finalName,
        description: description || null,
        leaveTypeId: finalLeaveTypeId,
        policyDocumentId,
        employmentType,
        branchId,
        departmentId,
        employeeStatus,
      }, { headers: corsHeaders() });
    } else {
      // Create new
      await db.$executeRawUnsafe(
        `INSERT INTO "LeaveWorkflowConfig"
           ("id", "tenantId", "leaveTypeId", "isActive", "config", "name", "description",
            "policyDocumentId", "employmentType", "branchId", "departmentId", "employeeStatus",
            "createdAt", "updatedAt")
         VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        configId,
        tenantId,
        finalLeaveTypeId,
        configJson,
        finalName,
        description || null,
        policyDocumentId,
        employmentType,
        branchId,
        departmentId,
        employeeStatus,
      );
      return NextResponse.json({
        success: true,
        message: 'Leave workflow config created successfully',
        configId,
        config,
        name: finalName,
        description: description || null,
        leaveTypeId: finalLeaveTypeId,
        policyDocumentId,
        employmentType,
        branchId,
        departmentId,
        employeeStatus,
      }, { status: 201, headers: corsHeaders() });
    }
  } catch (error) {
    console.error('[WorkflowConfig POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500, headers: corsHeaders() },
    );
  }
}
