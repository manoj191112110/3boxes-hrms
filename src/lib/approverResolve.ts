/**
 * Approver configuration resolver — shared by:
 *  - /api/employees/update-requests      (profile update workflow)
 *  - /api/employees/probation/[id]       (probation → confirmation workflow)
 *  - /api/employees/workflow-config      (CRUD for the configuration)
 *
 * EmployeeWorkflowConfig rows are stored per-tenant with workflowType:
 *   'update_profile'          — profile field-change approval chain
 *   'probation_confirmation'  — probation → confirmed approval chain
 *
 * config JSON shape:
 *   { tiers: [{ approverType, approverUserId?, approverName? }], fieldSensitivity?: {...} }
 */
import { getAuthInfo } from '@/lib/companyScope';

export type ApproverType = 'reporting_manager' | 'hr_admin' | 'tenant_admin' | 'specific_user' | 'finance';

export interface WorkflowTier {
  approverType: ApproverType;
  approverUserId?: string | null;
  approverName?: string | null;
}

export interface ParsedWorkflowConfig {
  id: string;
  name: string;
  tiers: WorkflowTier[];
  fieldSensitivity?: Record<string, string>;
}

export const APPROVER_TYPE_LABELS: Record<ApproverType, string> = {
  reporting_manager: 'Reporting Manager',
  hr_admin: 'HR Admin',
  tenant_admin: 'MD / Tenant Admin',
  specific_user: 'Specific User',
  finance: 'Finance',
};

/** Load the active workflow config of a given type for the current tenant. */
export async function loadWorkflowConfig(
  db: Record<string, any>,
  req: Request,
  workflowType: 'update_profile' | 'probation_confirmation',
): Promise<ParsedWorkflowConfig | null> {
  try {
    const auth = await getAuthInfo(req);
    if (!auth?.tenantId) return null;
    const cfg = await (db as any).employeeWorkflowConfig?.findFirst({
      where: { tenantId: auth.tenantId, workflowType, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!cfg) return null;
    let parsed: { tiers?: WorkflowTier[]; fieldSensitivity?: Record<string, string> } = {};
    try { parsed = JSON.parse(cfg.config || '{}'); } catch { return null; }
    const tiers = Array.isArray(parsed.tiers) ? parsed.tiers.filter((t) => t && t.approverType) : [];
    if (!tiers.length) return null;
    return { id: cfg.id, name: cfg.name, tiers, fieldSensitivity: parsed.fieldSensitivity };
  } catch {
    return null;
  }
}

/**
 * Resolve the concrete userId(s) that act for a tier, given the employee in
 * question. Always includes super_admin/tenant_admin as a fallback audience
 * for notification purposes (they can act on any stage).
 */
export async function resolveTierApprovers(
  db: Record<string, any>,
  tier: WorkflowTier,
  employeeId: string,
): Promise<{ userIds: string[]; label: string }> {
  const label = tier.approverName || APPROVER_TYPE_LABELS[tier.approverType] || tier.approverType;
  const userIds = new Set<string>();
  try {
    if (tier.approverType === 'reporting_manager') {
      const emp = await db.employee.findUnique({ where: { id: employeeId }, select: { reportingManagerId: true } });
      if (emp?.reportingManagerId) {
        const mgr = await db.employee.findUnique({ where: { id: emp.reportingManagerId }, select: { userId: true } });
        if (mgr?.userId) userIds.add(mgr.userId);
      }
    } else if (tier.approverType === 'hr_admin') {
      const admins = await db.user.findMany({
        where: { role: { in: ['admin', 'hr_admin', 'company_hr_admin'] }, status: 'active' },
        select: { id: true },
        take: 20,
      });
      admins.forEach((a: { id: string }) => userIds.add(a.id));
    } else if (tier.approverType === 'tenant_admin') {
      const admins = await db.user.findMany({
        where: { role: { in: ['super_admin', 'tenant_admin'] }, status: 'active' },
        select: { id: true },
        take: 20,
      });
      admins.forEach((a: { id: string }) => userIds.add(a.id));
    } else if (tier.approverType === 'finance') {
      const fin = await db.user.findMany({
        where: { role: { in: ['finance', 'finance_admin'] }, status: 'active' },
        select: { id: true },
        take: 20,
      });
      fin.forEach((a: { id: string }) => userIds.add(a.id));
    } else if (tier.approverType === 'specific_user' && tier.approverUserId) {
      userIds.add(tier.approverUserId);
    }
  } catch { /* fall through */ }
  return { userIds: [...userIds], label };
}
