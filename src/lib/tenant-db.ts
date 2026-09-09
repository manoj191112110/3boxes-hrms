/**
 * 3Boxes HRMS — Per-Tenant Database Isolation (Centralized Routing)
 *
 * ⚠️  This is THE canonical module for database access in all API routes.
 * ⚠️  Always import { getDb } from '@/lib/tenant-db' — never use prisma directly.
 *
 * GOLDEN RULES:
 *   1. Demo link (nexus-hrms-mu.vercel.app) shows SAMPLE data only —
 *      routed to the demo tenant's dedicated database.
 *   2. Tenant links (e.g., marqaitechgroup.3boxeshrms.com) show REAL data —
 *      routed to that tenant's dedicated database.
 *   3. Every tenant + demo gets its own separate database.
 *   4. Same frontend for all links — only the DB routing differs.
 *
 * Architecture:
 *   - Platform DB: Stores Tenant, User (platform-level), TenantDatabase,
 *     TrialRegistration, and other cross-tenant data.
 *     Used by: super_admin operations, auth, tenant provisioning.
 *   - Tenant DB (e.g., tenant_marqaitechgroup): Stores the tenant's own data —
 *     CompanyGroup, Company, Department, Employee, Payroll, etc.
 *     Used by: all tenant-scoped CRUD operations.
 *   - Demo DB: Separate database with sample/demo data only.
 *     Routed to when the request comes from the demo domain.
 *
 * How it works:
 *   1. API route calls `const db = await getDb(request)`.
 *   2. getDb() extracts the tenant slug from:
 *      a. x-tenant-slug header (set by middleware from subdomain/query)
 *      b. JWT token's tenantId (decoded, then looked up)
 *   3. If the tenant has a dedicated database (TenantDatabase record),
 *      a PrismaClient connected to that DB is returned.
 *   4. If no dedicated DB exists yet, falls back to platform DB
 *      with tenantId filtering (shared-DB compatibility mode).
 *   5. For super_admin with no tenant context, returns platform DB.
 *
 * Usage in API routes:
 *   import { getDb, getPlatformDb } from '@/lib/tenant-db';
 *
 *   // For tenant-scoped data (most routes):
 *   const db = await getDb(request);
 *   const employees = await db.employee.findMany({ ... });
 *
 *   // For platform-level data (auth, tenant management):
 *   const platformDb = getPlatformDb();
 *   const tenants = await platformDb.tenant.findMany();
 */

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { db as platformDb } from '@/lib/db'
import { verifyToken, getTokenFromHeaders } from '@/lib/auth'

// Cache tenant DB clients to avoid recreating on every request
const tenantDbCache = new Map<string, { client: PrismaClient; lastAccess: number }>()

// Cache tenantId → slug lookups (every API used to hit platform DB for this)
const tenantSlugByIdCache = new Map<string, { slug: string; at: number }>()
const TENANT_SLUG_CACHE_MS = 300_000

async function getTenantSlugById(tenantId: string): Promise<string | null> {
  const cached = tenantSlugByIdCache.get(tenantId)
  if (cached && Date.now() - cached.at < TENANT_SLUG_CACHE_MS) return cached.slug
  const tenant = await platformDb.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  })
  if (!tenant?.slug) return null
  tenantSlugByIdCache.set(tenantId, { slug: tenant.slug, at: Date.now() })
  return tenant.slug
}

// Clean up cache entries older than 5 minutes (300000ms)
const CACHE_TTL = 300000

// Periodic cleanup
if (typeof globalThis !== 'undefined' && typeof setInterval === 'function') {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of tenantDbCache.entries()) {
      if (now - entry.lastAccess > CACHE_TTL) {
        entry.client.$disconnect().catch(() => {})
        tenantDbCache.delete(key)
      }
    }
  }, 60000)
  if (timer && typeof timer.unref === 'function') timer.unref()
}

// ─── Demo domain detection ───────────────────────────────────────────

const DEMO_DOMAINS = [
  'nexus-hrms-mu.vercel.app',
  'nexus-hrms.vercel.app',
  '3boxes-hrms.vercel.app',
  '3boxeshrms.vercel.app',
  '3boxes-hrms-mu.vercel.app',
]

const DEMO_SLUG = '3boxes-hrms-demo'

/**
 * Check if a host is the demo domain.
 * Returns the demo tenant slug if it is, empty string otherwise.
 */
function resolveDemoSlug(host: string): string {
  const hostname = (host || '').split(':')[0].toLowerCase()
  if (DEMO_DOMAINS.includes(hostname)) {
    return DEMO_SLUG
  }
  // Also check vercel.app subdomains that aren't tenant subdomains
  if (hostname.endsWith('.vercel.app') && !hostname.includes('3boxeshrms')) {
    return DEMO_SLUG
  }
  return ''
}

// ─── Core: getDb(request) ────────────────────────────────────────────

/**
 * Get the PrismaClient for the current request's tenant context.
 *
 * This is the PRIMARY function all API routes should use.
 * It automatically routes to the correct database based on:
 *   1. x-tenant-slug header (set by middleware from subdomain)
 *   2. JWT token's tenantId
 *   3. Demo domain detection
 *
 * Returns:
 *   - Tenant-specific PrismaClient if the tenant has a dedicated DB
 *   - Platform DB (with tenantId filtering) as fallback
 *   - Platform DB for super_admin with no tenant context
 */
export async function getDb(request?: Request | null): Promise<PrismaClient> {
  let tenantSlug = ''

  // 1. Try x-tenant-slug header (set by middleware)
  if (request) {
    const headerSlug = request.headers.get('x-tenant-slug')
    if (headerSlug) {
      tenantSlug = headerSlug
    }

    // 2. Try demo domain detection from host header
    if (!tenantSlug) {
      const host = request.headers.get('host') || ''
      const demoSlug = resolveDemoSlug(host)
      if (demoSlug) {
        tenantSlug = demoSlug
      }
    }

    // 3. Try JWT token's tenantId
    if (!tenantSlug) {
      try {
        const token = getTokenFromHeaders(request)
        if (token) {
          const decoded = await verifyToken(token)
          if (decoded?.tenantId && typeof decoded.tenantId === 'string') {
            // Look up slug from tenantId
            const slug = await getTenantSlugById(decoded.tenantId)
            if (slug) tenantSlug = slug
          }
        }
      } catch {
        // Token invalid or expired — no tenant context
      }
    }

    // 4. Try ?tenantId= query param (super_admin company switcher)
    // When super_admin selects a tenant/company in the switcher, the frontend
    // sends tenantId so we can resolve the correct tenant DB instead of
    // falling back to the platform DB (which has no real tenant data).
    if (!tenantSlug) {
      try {
        const url = new URL(request.url)
        const queryTenantId = url.searchParams.get('tenantId')
        if (queryTenantId) {
          const slug = await getTenantSlugById(queryTenantId)
          if (slug) tenantSlug = slug
        }
      } catch {
        // URL parsing failed — no tenant context
      }
    }
  }

  // No tenant context — return platform DB (super_admin / unauthenticated)
  if (!tenantSlug) {
    return platformDb
  }

  // Route to tenant's dedicated database
  return getDbForTenant(tenantSlug)
}

// ─── getDbForTenant(slug) ────────────────────────────────────────────

/**
 * Get the PrismaClient for a specific tenant's database by slug.
 *
 * If the tenant has a dedicated database (TenantDatabase record exists and is active),
 * returns a PrismaClient connected to that database.
 * Otherwise, returns the platform DB (shared mode with tenantId filtering).
 */
export async function getDbForTenant(tenantSlug: string): Promise<PrismaClient> {
  if (!tenantSlug) return platformDb

  // Check cache first
  const cached = tenantDbCache.get(tenantSlug)
  if (cached) {
    cached.lastAccess = Date.now()
    return cached.client
  }

  // Look up the tenant's dedicated database
  try {
    const tenantDbRecord = await platformDb.tenantDatabase.findFirst({
      where: {
        tenant: { slug: tenantSlug },
        isActive: true,
      },
      select: {
        connectionString: true,
        databaseName: true,
      },
    })

    if (!tenantDbRecord) {
      // No dedicated DB — use platform DB (shared mode)
      // The calling code should filter by tenantId
      console.log(`[TenantDB] No dedicated DB for "${tenantSlug}" — using platform DB with tenantId filtering`)
      return platformDb
    }

    // Create a new PrismaClient for this tenant's database
    console.log(`[TenantDB] Routing to dedicated DB "${tenantDbRecord.databaseName}" for tenant "${tenantSlug}"`)
    const adapter = new PrismaNeon({ connectionString: tenantDbRecord.connectionString })
    const tenantClient = new PrismaClient({ adapter })

    // Cache it
    tenantDbCache.set(tenantSlug, {
      client: tenantClient,
      lastAccess: Date.now(),
    })

    return tenantClient
  } catch (error) {
    console.error(`[TenantDB] Failed to get DB for tenant "${tenantSlug}":`, error)
    // Fall back to platform DB on error
    return platformDb
  }
}

// ─── getDbForTenantById(tenantId) ────────────────────────────────────

/**
 * Get the PrismaClient for a tenant by tenantId (instead of slug).
 * Useful when you already have the tenantId from the JWT.
 */
export async function getDbForTenantById(tenantId: string): Promise<PrismaClient> {
  if (!tenantId) return platformDb

  try {
    const slug = await getTenantSlugById(tenantId)
    if (!slug) return platformDb
    return getDbForTenant(slug)
  } catch (error) {
    console.error(`[TenantDB] Failed to get DB for tenantId "${tenantId}":`, error)
    return platformDb
  }
}

// ─── getPlatformDb() ─────────────────────────────────────────────────

/**
 * Get the platform (shared) database client.
 * Use this ONLY for cross-tenant operations:
 *   - Tenant management (CRUD)
 *   - User authentication (login, register)
 *   - TenantDatabase provisioning
 *   - Super admin dashboard (cross-tenant views)
 *
 * For all tenant-scoped data, use getDb(request) instead.
 */
export function getPlatformDb(): PrismaClient {
  return platformDb
}

// ─── Utility functions ───────────────────────────────────────────────

/**
 * Check if a tenant has a dedicated database (isolated mode).
 */
export async function isTenantIsolated(tenantSlug: string): Promise<boolean> {
  try {
    const count = await platformDb.tenantDatabase.count({
      where: {
        tenant: { slug: tenantSlug },
        isActive: true,
      },
    })
    return count > 0
  } catch {
    return false
  }
}

/**
 * Register a new dedicated database for a tenant.
 * Called during trial provisioning or when a separate DB is created.
 */
export async function registerTenantDatabase(params: {
  tenantId: string
  connectionString: string
  directUrl?: string
  databaseName: string
  neonBranchId?: string
  neonProjectId?: string
}) {
  // Invalidate cache if exists
  const tenant = await platformDb.tenant.findUnique({
    where: { id: params.tenantId },
    select: { slug: true },
  })
  if (tenant) {
    const cached = tenantDbCache.get(tenant.slug)
    if (cached) {
      cached.client.$disconnect().catch(() => {})
      tenantDbCache.delete(tenant.slug)
    }
  }

  return platformDb.tenantDatabase.upsert({
    where: { tenantId: params.tenantId },
    create: {
      tenantId: params.tenantId,
      connectionString: params.connectionString,
      directUrl: params.directUrl,
      databaseName: params.databaseName,
      neonBranchId: params.neonBranchId,
      neonProjectId: params.neonProjectId,
      isActive: true,
    },
    update: {
      connectionString: params.connectionString,
      directUrl: params.directUrl,
      databaseName: params.databaseName,
      neonBranchId: params.neonBranchId,
      neonProjectId: params.neonProjectId,
      isActive: true,
    },
  })
}

/**
 * Disconnect a tenant's dedicated database client from cache.
 */
export function disconnectTenantDb(tenantSlug: string) {
  const cached = tenantDbCache.get(tenantSlug)
  if (cached) {
    cached.client.$disconnect().catch(() => {})
    tenantDbCache.delete(tenantSlug)
  }
}

/**
 * Extract the tenant slug from a request.
 * Tries: x-tenant-slug header → demo domain → JWT tenantId.
 * Returns the slug or empty string.
 */
export async function getTenantSlugFromRequest(request: Request): Promise<string> {
  // 1. Header from middleware
  const headerSlug = request.headers.get('x-tenant-slug')
  if (headerSlug) return headerSlug

  // 2. Demo domain
  const host = request.headers.get('host') || ''
  const demoSlug = resolveDemoSlug(host)
  if (demoSlug) return demoSlug

  // 3. JWT token
  try {
    const token = getTokenFromHeaders(request)
    if (token) {
      const decoded = await verifyToken(token)
      if (decoded?.tenantId && typeof decoded.tenantId === 'string') {
        const tenant = await platformDb.tenant.findUnique({
          where: { id: decoded.tenantId },
          select: { slug: true },
        })
        if (tenant?.slug) return tenant.slug
      }
    }
  } catch {
    // ignore
  }

  return ''
}
