/**
 * 3Boxes HRMS — Shared Authentication Utility for API Routes
 *
 * Provides a two-phase user lookup function that mirrors the same pattern
 * used in /api/auth/login and /api/auth/me:
 *   Phase 1: Search the platform DB (neondb) for the user.
 *   Phase 2: If not found, search the tenant-specific DB.
 *
 * This is critical because:
 *   - Super admin users live ONLY in the platform DB (neondb)
 *   - Tenant users may live in EITHER the platform DB or the tenant DB
 *   - The JWT token's userId comes from whichever DB authenticated the user
 *   - API routes that only look in the tenant DB will fail for platform DB users
 *
 * Usage in API routes:
 *   import { resolveAuthenticatedUser } from '@/lib/auth-resolve';
 *   const { user, db } = await resolveAuthenticatedUser(request);
 *   if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
 */

import { getPlatformDb, getDbForTenant, getDbForTenantById } from '@/lib/tenant-db';
import { verifyToken, getTokenFromHeaders } from '@/lib/auth';
import type { PrismaClient } from '@/generated/prisma/client';

interface ResolvedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  avatar: string | null;
  tenantId: string | null;
  [key: string]: unknown;
}

interface ResolveResult {
  user: ResolvedUser | null;
  db: PrismaClient;
  /** The DB that actually contains the user record (platform or tenant) */
  authDb: PrismaClient;
}

/**
 * Resolve the authenticated user from the request by performing a two-phase
 * lookup across the platform DB and tenant DB.
 *
 * Returns:
 *   - user: The user record (from whichever DB contains it)
 *   - db: The tenant-scoped DB for data operations (roles, permissions, etc.)
 *   - authDb: The DB that actually contains the user record
 */
export async function resolveAuthenticatedUser(request: Request): Promise<ResolveResult> {
  const platformDb = getPlatformDb();

  // Get the tenant-scoped DB for data operations
  let tenantDb: PrismaClient = platformDb;
  try {
    const tenantSlug = request.headers.get('x-tenant-slug') || '';
    if (tenantSlug) {
      tenantDb = await getDbForTenant(tenantSlug);
    } else {
      // Try from JWT
      const token = getTokenFromHeaders(request);
      if (token) {
        const decoded = await verifyToken(token);
        if (decoded?.tenantId && typeof decoded.tenantId === 'string') {
          tenantDb = await getDbForTenantById(decoded.tenantId);
        }
      }
    }
  } catch {
    // Fall back to platform DB
  }

  // Verify the token
  const token = getTokenFromHeaders(request);
  if (!token) {
    return { user: null, db: tenantDb, authDb: platformDb };
  }

  const decoded = await verifyToken(token);
  if (!decoded) {
    return { user: null, db: tenantDb, authDb: platformDb };
  }

  const userId = decoded.userId as string;

  // Phase 1: Platform DB lookup
  try {
    const platformUser = await platformDb.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        tenantId: true,
      },
    });

    if (platformUser) {
      return { user: platformUser as ResolvedUser, db: tenantDb, authDb: platformDb };
    }
  } catch (e) {
    console.error('[AuthResolve] Platform DB lookup failed:', e);
  }

  // Phase 2: Tenant DB lookup
  try {
    const tenantUser = await tenantDb.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatar: true,
        tenantId: true,
      },
    });

    if (tenantUser) {
      return { user: tenantUser as ResolvedUser, db: tenantDb, authDb: tenantDb };
    }
  } catch (e) {
    console.error('[AuthResolve] Tenant DB lookup failed:', e);
  }

  return { user: null, db: tenantDb, authDb: platformDb };
}
