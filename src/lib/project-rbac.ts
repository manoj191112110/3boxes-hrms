/**
 * Project-Level RBAC (REQ-SEC-11).
 *
 * Distinct from the global role system in roleAccess.ts — this governs
 * per-project access. Each project has a list of ProjectMember rows; each
 * member has one of four roles:
 *
 *   manager  — full project edit, sees financials, can manage members
 *   finance  — sees financials + invoices, cannot edit project fields
 *   member   — sees project (no financials), can log timesheets, edit tasks
 *   viewer   — read-only, no financials (for client stakeholders / observers)
 *
 * Global roles override project roles:
 *   - super_admin / tenant_admin → always full access (treated as 'manager')
 *   - hr_admin                   → 'finance' (sees financials, can edit fields)
 *   - manager (global)           → 'member' unless they're also a ProjectMember
 *   - employee                   → 'viewer' unless they're a ProjectMember
 *
 * Financial fields gated by this module:
 *   budgetAmount, billingRate, costRate, actualHours, exchangeRate, totalAmount
 *
 * Inferred access (no explicit ProjectMember row needed):
 *   - projectManagerId or deliveryManagerId on the Project itself → 'manager'
 *   - active ProjectAllocation on the project → 'member' (can log time + view)
 */

import prisma from '@/lib/prisma';
import { ensureSchemaSynced, withSchemaSync } from '@/lib/schema-sync';

export type ProjectRole = 'manager' | 'finance' | 'member' | 'viewer' | null;

export interface ProjectAccessResult {
  role: ProjectRole;
  canView: boolean;
  canViewFinancials: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  canDelete: boolean;
  canLogTime: boolean;
  source: 'global_role' | 'project_member' | 'project_manager' | 'project_allocation' | 'denied';
}

const FINANCIAL_FIELDS = [
  'budgetAmount',
  'billingRate',
  'costRate',
  'actualHours',
  'exchangeRate',
  'totalAmount',
  'totalAmountBase',
  'subtotalBase',
  'fxGainLoss',
] as const;

/**
 * Resolve the caller's effective role on a project. Returns null if access
 * is denied entirely.
 */
export async function resolveProjectAccess(
  decoded: { userId?: string; role?: string; tenantId?: string },
  projectId: string
): Promise<ProjectAccessResult> {
  await ensureSchemaSynced();

  const globalRole = decoded.role as string | undefined;

  // Global admins always get full access
  if (globalRole === 'super_admin' || globalRole === 'tenant_admin') {
    return {
      role: 'manager',
      canView: true,
      canViewFinancials: true,
      canEdit: true,
      canManageMembers: true,
      canDelete: globalRole === 'super_admin',
      canLogTime: true,
      source: 'global_role',
    };
  }

  // Fetch the project + member row in parallel
  const [project, member] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectManagerId: true,
        deliveryManagerId: true,
        companyId: true,
      },
    }),
    decoded.userId
      ? withSchemaSync(() =>
          prisma.projectMember.findFirst({
            where: {
              projectId,
              // Try userId first, then fall back to employee lookup by userId
              OR: [
                { userId: decoded.userId as string },
                { employee: { userId: decoded.userId as string } },
              ],
            },
          })
        ).catch(() => null)
      : Promise.resolve(null),
  ]);

  if (!project) {
    return {
      role: null,
      canView: false,
      canViewFinancials: false,
      canEdit: false,
      canManageMembers: false,
      canDelete: false,
      canLogTime: false,
      source: 'denied',
    };
  }

  // hr_admin → finance (sees financials + can edit fields, but can't manage members or delete)
  if (globalRole === 'admin') {
    return {
      role: 'finance',
      canView: true,
      canViewFinancials: true,
      canEdit: true,
      canManageMembers: false,
      canDelete: false,
      canLogTime: false,
      source: 'global_role',
    };
  }

  // finance role → can view financials but not edit project fields
  if (globalRole === 'finance') {
    return {
      role: 'finance',
      canView: true,
      canViewFinancials: true,
      canEdit: false,
      canManageMembers: false,
      canDelete: false,
      canLogTime: false,
      source: 'global_role',
    };
  }

  // If user is the project manager or delivery manager → 'manager'
  // We need their employeeId
  let employeeId: string | null = null;
  if (decoded.userId) {
    const emp = await prisma.employee.findUnique({
      where: { userId: decoded.userId },
      select: { id: true },
    });
    if (emp) employeeId = emp.id;
  }

  if (
    employeeId &&
    (project.projectManagerId === employeeId || project.deliveryManagerId === employeeId)
  ) {
    return {
      role: 'manager',
      canView: true,
      canViewFinancials: true,
      canEdit: true,
      canManageMembers: true,
      canDelete: false,
      canLogTime: true,
      source: 'project_manager',
    };
  }

  // If explicit ProjectMember row exists, use its role
  if (member) {
    const role = member.role as ProjectRole;
    return roleToAccess(role, 'project_member');
  }

  // If user has an active allocation on the project → 'member' (can log time + view, no financials)
  if (employeeId) {
    const alloc = await prisma.projectAllocation.findFirst({
      where: {
        projectId,
        employeeId,
        status: 'active',
      },
      select: { id: true },
    });
    if (alloc) {
      return roleToAccess('member', 'project_allocation');
    }
  }

  // No access
  return {
    role: null,
    canView: false,
    canViewFinancials: false,
    canEdit: false,
    canManageMembers: false,
    canDelete: false,
    canLogTime: false,
    source: 'denied',
  };
}

function roleToAccess(role: ProjectRole, source: ProjectAccessResult['source']): ProjectAccessResult {
  if (!role) {
    return {
      role: null,
      canView: false,
      canViewFinancials: false,
      canEdit: false,
      canManageMembers: false,
      canDelete: false,
      canLogTime: false,
      source: 'denied',
    };
  }
  switch (role) {
    case 'manager':
      return {
        role,
        canView: true,
        canViewFinancials: true,
        canEdit: true,
        canManageMembers: true,
        canDelete: false,
        canLogTime: true,
        source,
      };
    case 'finance':
      return {
        role,
        canView: true,
        canViewFinancials: true,
        canEdit: false,
        canManageMembers: false,
        canDelete: false,
        canLogTime: false,
        source,
      };
    case 'member':
      return {
        role,
        canView: true,
        canViewFinancials: false,
        canEdit: false,
        canManageMembers: false,
        canDelete: false,
        canLogTime: true,
        source,
      };
    case 'viewer':
      return {
        role,
        canView: true,
        canViewFinancials: false,
        canEdit: false,
        canManageMembers: false,
        canDelete: false,
        canLogTime: false,
        source,
      };
  }
}

/**
 * Strip financial fields from a project object based on the caller's access.
 * Returns a shallow-cloned project with financial fields set to undefined.
 */
export function gateProjectFinancials<T extends Record<string, unknown>>(
  project: T,
  access: ProjectAccessResult
): T {
  if (access.canViewFinancials) return project;
  const gated = { ...project };
  for (const field of FINANCIAL_FIELDS) {
    if (field in gated) {
      (gated as Record<string, unknown>)[field] = undefined;
    }
  }
  // Also strip financial fields from nested allocations + invoices if present
  if (Array.isArray(gated.allocations)) {
    gated.allocations = gated.allocations.map((a: Record<string, unknown>) => ({
      ...a,
      billingRate: undefined,
      internalCostRate: undefined,
    }));
  }
  if (Array.isArray(gated.invoices)) {
    gated.invoices = gated.invoices.map((i: Record<string, unknown>) => ({
      ...i,
      totalAmount: undefined,
      totalAmountBase: undefined,
      subtotal: undefined,
      subtotalBase: undefined,
      taxAmount: undefined,
      discountAmount: undefined,
      exchangeRate: undefined,
      fxGainLoss: undefined,
    }));
  }
  return gated;
}

export const FINANCIAL_FIELD_LIST = FINANCIAL_FIELDS;
