/**
 * Employee Workflow Configuration API — approver chain for:
 *   - update_profile           (employee profile-change requests)
 *   - probation_confirmation   (probation → confirmed workflow)
 *
 *   GET  /api/employees/workflow-config?type=update_profile|probation_confirmation
 *   POST /api/employees/workflow-config        — upsert the active config for a type
 *
 * POST body:
 *   { workflowType, name?, description?, tiers: [{ approverType, approverUserId?, approverName? }], fieldSensitivity? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/tenant-db';
import { getAuthInfo } from '@/lib/companyScope';
import { sanitizeMultiLineText } from '@/lib/sanitize';
import { APPROVER_TYPE_LABELS, WorkflowTier } from '@/lib/approverResolve';

const VALID_TYPES = ['update_profile', 'probation_confirmation'];
const VALID_APPROVER_TYPES = ['reporting_manager', 'hr_admin', 'tenant_admin', 'specific_user', 'finance'];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() });
}

export async function GET(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(auth.role);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });

    const url = new URL(req.url);
    const type = url.searchParams.get('type');

    const where: Record<string, unknown> = { tenantId: auth.tenantId };
    if (type && VALID_TYPES.includes(type)) where.workflowType = type;

    const configs = await (db as any).employeeWorkflowConfig?.findMany({
      where,
      orderBy: [{ workflowType: 'asc' }, { updatedAt: 'desc' }],
      take: 50,
    }) || [];

    const parsed = configs.map((c: Record<string, unknown>) => {
      let cfg: { tiers?: unknown[]; fieldSensitivity?: Record<string, string> } = {};
      try { cfg = JSON.parse(String(c.config || '{}')); } catch { /* ignore */ }
      return { ...c, config: undefined, parsedConfig: cfg };
    });

    return NextResponse.json({ configs: parsed }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Employee workflow config GET error:', error);
    return NextResponse.json({ configs: [] }, { headers: corsHeaders() });
  }
}

export async function POST(req: NextRequest) {
  const db = await getDb(req);
  try {
    const auth = await getAuthInfo(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });

    const isAdmin = ['super_admin', 'tenant_admin', 'admin', 'hr_admin', 'company_hr_admin'].includes(auth.role);
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders() });
    if (!auth.tenantId) return NextResponse.json({ error: 'Tenant context missing' }, { status: 400, headers: corsHeaders() });

    const body = await req.json();
    const { workflowType, name, description, tiers, fieldSensitivity } = body;

    if (!VALID_TYPES.includes(workflowType)) {
      return NextResponse.json({ error: `workflowType must be one of: ${VALID_TYPES.join(', ')}` }, { status: 400, headers: corsHeaders() });
    }
    if (!Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json({ error: 'At least one approval tier is required' }, { status: 400, headers: corsHeaders() });
    }
    if (tiers.length > 6) {
      return NextResponse.json({ error: 'A maximum of 6 approval tiers is supported' }, { status: 400, headers: corsHeaders() });
    }

    // Validate + normalize tiers
    const cleanTiers: WorkflowTier[] = [];
    for (const t of tiers) {
      const approverType = String(t?.approverType || '');
      if (!VALID_APPROVER_TYPES.includes(approverType)) {
        return NextResponse.json({ error: `Invalid approverType: ${approverType}. Valid: ${VALID_APPROVER_TYPES.join(', ')}` }, { status: 400, headers: corsHeaders() });
      }
      if (approverType === 'specific_user' && !t?.approverUserId) {
        return NextResponse.json({ error: 'Each "Specific User" tier needs a selected approver' }, { status: 400, headers: corsHeaders() });
      }
      cleanTiers.push({
        approverType,
        approverUserId: approverType === 'specific_user' ? String(t.approverUserId) : null,
        approverName: t?.approverName ? sanitizeMultiLineText(String(t.approverName), 100) : (APPROVER_TYPE_LABELS as Record<string, string>)[approverType] || approverType,
      });
    }

    const configJson = JSON.stringify({
      tiers: cleanTiers,
      ...(workflowType === 'update_profile' && fieldSensitivity && typeof fieldSensitivity === 'object' ? { fieldSensitivity } : {}),
    });

    // Upsert: one active config per type per tenant
    const existing = await (db as any).employeeWorkflowConfig?.findFirst({
      where: { tenantId: auth.tenantId, workflowType, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    let saved;
    if (existing) {
      saved = await (db as any).employeeWorkflowConfig?.update({
        where: { id: existing.id },
        data: {
          config: configJson,
          name: name ? sanitizeMultiLineText(String(name), 150) : existing.name,
          description: description !== undefined ? sanitizeMultiLineText(String(description || ''), 500) : existing.description,
        },
      });
    } else {
      saved = await (db as any).employeeWorkflowConfig?.create({
        data: {
          tenantId: auth.tenantId,
          workflowType,
          isActive: true,
          name: name ? sanitizeMultiLineText(String(name), 150) : (workflowType === 'update_profile' ? 'Profile Update Approval Workflow' : 'Probation Confirmation Approval Workflow'),
          description: description ? sanitizeMultiLineText(String(description), 500) : null,
          config: configJson,
        },
      });
    }

    return NextResponse.json({ config: { ...saved, config: undefined, parsedConfig: { tiers: cleanTiers } }, message: 'Approval workflow saved' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('Employee workflow config POST error:', error);
    return NextResponse.json({ error: 'Failed to save workflow config' }, { status: 500, headers: corsHeaders() });
  }
}
