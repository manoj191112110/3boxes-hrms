/**
 * 3Boxes HRMS — Tenant Status Guard
 *
 * Shared utility to check tenant status before allowing write operations.
 * Per the golden rules:
 *   - Only ACTIVE tenants can perform CRUD operations
 *   - SUSPENDED tenants are blocked from all writes (but can still read)
 *   - INACTIVE tenants are blocked from all writes
 *   - SUPER ADMIN operations are NEVER blocked (they control tenant status)
 *
 * Usage in API routes:
 *   import { checkTenantStatus } from '@/lib/tenant-guard';
 *
 *   const guard = await checkTenantStatus(request);
 *   if (guard.blocked) {
 *     return NextResponse.json({ error: guard.error }, { status: guard.status });
 *   }
 *
 * This replaces the need to add individual status checks in every route.
 */

import { getPlatformDb } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

interface TenantGuardResult {
  blocked: boolean;
  error?: string;
  status?: number;
  tenantId?: string;
  tenantStatus?: string;
  tenantName?: string;
  isSuperAdmin?: boolean;
}

/**
 * Check if the requesting user's tenant is in a state that allows write operations.
 *
 * Returns { blocked: false } if the operation should proceed.
 * Returns { blocked: true, error, status } if the operation should be rejected.
 *
 * Super admins are NEVER blocked — they control tenant status.
 */
export async function checkTenantStatus(request: Request): Promise<TenantGuardResult> {
  try {
    const token = getTokenFromHeaders(request);
    if (!token) {
      // No token — let the route's own auth check handle it
      return { blocked: false };
    }

    const decoded = await verifyToken(token);
    if (!decoded) {
      // Invalid token — let the route's own auth check handle it
      return { blocked: false };
    }

    const userRole = decoded.role as string;

    // Super admin is never blocked — they control tenant status
    if (userRole === 'super_admin') {
      return {
        blocked: false,
        isSuperAdmin: true,
        tenantId: decoded.tenantId as string,
      };
    }

    // For tenant_admin / employee / other roles, check tenant status
    const tenantId = decoded.tenantId as string;
    if (!tenantId) {
      // No tenant context — let the route's own logic handle it
      return { blocked: false };
    }

    const platformDb = getPlatformDb();
    const tenant = await platformDb.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true },
    });

    if (!tenant) {
      return { blocked: false };
    }

    if (tenant.status === 'suspended') {
      return {
        blocked: true,
        error: `Your tenant "${tenant.name}" has been suspended. All write operations are blocked. Please contact the super admin to reactivate your account.`,
        status: 403,
        tenantId: tenant.id,
        tenantStatus: tenant.status,
        tenantName: tenant.name,
      };
    }

    if (tenant.status === 'inactive') {
      return {
        blocked: true,
        error: `Your tenant "${tenant.name}" is inactive. All write operations are blocked. Please contact the super admin.`,
        status: 403,
        tenantId: tenant.id,
        tenantStatus: tenant.status,
        tenantName: tenant.name,
      };
    }

    if (tenant.status === 'pending_approval') {
      return {
        blocked: true,
        error: `Your tenant "${tenant.name}" is pending approval. You cannot perform write operations until the super admin approves your account.`,
        status: 403,
        tenantId: tenant.id,
        tenantStatus: tenant.status,
        tenantName: tenant.name,
      };
    }

    // Tenant is active — allow the operation
    return {
      blocked: false,
      tenantId: tenant.id,
      tenantStatus: tenant.status,
      tenantName: tenant.name,
    };
  } catch (error) {
    console.error('[TenantGuard] Error checking tenant status:', error);
    // On error, don't block — let the route's own error handling take over
    return { blocked: false };
  }
}

/**
 * Convenience function: check tenant status and return a NextResponse
 * if blocked, or null if the operation should proceed.
 *
 * Usage:
 *   const blockResponse = await checkTenantStatusOrBlock(request);
 *   if (blockResponse) return blockResponse; // Tenant is blocked
 *   // ... proceed with normal route logic
 */
export async function checkTenantStatusOrBlock(
  request: Request,
  corsHeadersFn?: () => Record<string, string>,
): Promise<Response | null> {
  const guard = await checkTenantStatus(request);
  if (guard.blocked) {
    const headers = corsHeadersFn ? corsHeadersFn() : {};
    return new Response(
      JSON.stringify({ error: guard.error, code: 'TENANT_BLOCKED', tenantStatus: guard.tenantStatus }),
      {
        status: guard.status || 403,
        headers: { 'Content-Type': 'application/json', ...headers },
      },
    );
  }
  return null;
}
