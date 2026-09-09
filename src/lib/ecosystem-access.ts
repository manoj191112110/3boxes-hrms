/**
 * REQ-SEC-CV-01 — Vendor & Client IDOR protection.
 *
 * Insecure direct object reference protection for the ecosystem (vendor + client)
 * routes. Without this, any authenticated user could read/modify any vendor or
 * client record by simply guessing its id.
 *
 * Hierarchy enforced:
 *   Vendor → Company → CompanyGroup → Tenant
 *   Client → Company → CompanyGroup → Tenant
 *
 * The JWT contains `tenantId` and `role` (no companyId), so:
 *   - super_admin / tenant_admin: full access (platform / tenant owner)
 *   - hr_admin / manager / employee / company_admin: must own the record's tenant
 *
 * Usage:
 *   const guard = await assertEcosystemAccess(request, 'vendor', vendorId);
 *   if (guard.deny) return guard.response;
 *   // guard.record is the loaded vendor (with company.tenantId)
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export type EcosystemKind = 'vendor' | 'client' | 'purchaseOrder' | 'vendorInvoice';

export interface EcosystemAccessResult<T> {
  deny: false;
  decoded: Record<string, any>;
  record: T;
}

export interface EcosystemAccessDenied {
  deny: true;
  response: NextResponse;
}

function deny(status: number, error: string): EcosystemAccessDenied {
  return {
    deny: true,
    response: NextResponse.json({ error }, { status, headers: CORS }),
  };
}

function isPlatformAdmin(role: string | undefined | null): boolean {
  return !!role && (role === 'super_admin' || role === 'tenant_admin');
}

/**
 * Authenticate the request AND verify the caller's tenant owns the requested
 * ecosystem record. Returns the loaded record on success.
 */
export async function assertEcosystemAccess<T = any>(
  request: Request,
  kind: EcosystemKind,
  recordId: string,
): Promise<EcosystemAccessResult<T> | EcosystemAccessDenied> {
  const token = getTokenFromHeaders(request);
  if (!token) return deny(401, 'No token provided');

  const decoded = await verifyToken(token);
  if (!decoded) return deny(401, 'Invalid or expired token');

  // Load the record with its owning tenant (Company → CompanyGroup → Tenant)
  let record: any;
  switch (kind) {
    case 'vendor':
      record = await prisma.vendor.findUnique({
        where: { id: recordId },
        include: { company: { select: { id: true, name: true, companyGroup: { select: { tenantId: true } } } } },
      });
      break;
    case 'client':
      record = await prisma.client.findUnique({
        where: { id: recordId },
        include: { company: { select: { id: true, name: true, companyGroup: { select: { tenantId: true } } } } },
      });
      break;
    case 'purchaseOrder':
      record = await prisma.purchaseOrder.findUnique({
        where: { id: recordId },
        include: { company: { select: { id: true, name: true, companyGroup: { select: { tenantId: true } } } } },
      });
      break;
    case 'vendorInvoice':
      record = await prisma.vendorInvoice.findUnique({
        where: { id: recordId },
        include: {
          vendor: {
            include: {
              company: { select: { id: true, name: true, companyGroup: { select: { tenantId: true } } } },
            },
          },
        },
      });
      if (record) {
        // Flatten for tenant check
        record.company = record.vendor?.company;
      }
      break;
  }

  if (!record) return deny(404, `${kind} not found`);

  const callerTenantId = (decoded as any).tenantId as string | undefined;
  const recordTenantId = record.company?.companyGroup?.tenantId as string | undefined;

  // Platform admins bypass tenant checks (they own everything)
  if (isPlatformAdmin((decoded as any).role)) {
    return { deny: false, decoded: decoded as Record<string, any>, record };
  }

  // Tenant-scoped roles: caller's tenant must own the record
  if (!callerTenantId || callerTenantId !== recordTenantId) {
    // Log the IDOR attempt for audit
    try {
      await prisma.auditLog.create({
        data: {
          userId: (decoded as any).userId as string,
          action: 'IDOR_BLOCKED',
          module: kind,
          details: `Blocked ${(decoded as any).email} from accessing ${kind} ${recordId} (tenant mismatch: caller=${callerTenantId}, record=${recordTenantId})`,
        },
      });
    } catch {
      // Non-blocking — don't fail the request if audit log write fails
    }
    return deny(403, 'You do not have access to this record');
  }

  return { deny: false, decoded: decoded as Record<string, any>, record };
}

/**
 * Convenience wrapper for list endpoints — verify caller is authenticated
 * and return the decoded payload. Used by GET /api/vendors and /api/clients
 * to enforce tenant scoping via WHERE clause.
 */
export async function requireAuthenticated(request: Request) {
  const token = getTokenFromHeaders(request);
  if (!token) {
    return {
      deny: true as const,
      response: NextResponse.json({ error: 'No token provided' }, { status: 401, headers: CORS }),
    };
  }
  const decoded = await verifyToken(token);
  if (!decoded) {
    return {
      deny: true as const,
      response: NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: CORS }),
    };
  }
  return { deny: false as const, decoded: decoded as Record<string, any> };
}

export { CORS };
