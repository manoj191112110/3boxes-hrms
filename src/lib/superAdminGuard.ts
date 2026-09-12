/**
 * superAdminGuard.ts — Shared helper to enforce the GOLDEN RULE
 *
 * When super_admin is logged in on the LIVE site (3boxeshrms.com) with no
 * tenant or company selected, getDb(request) returns the platform DB which
 * contains seed/demo data. This helper provides a consistent way to detect
 * that situation so each API route can return an empty response instead of
 * leaking seed data.
 *
 * IMPORTANT: On the DEMO site (nexus-hrms-mu.vercel.app), this guard is
 * BYPASSED — demo data should flow freely so the showcase site shows
 * populated dashboards.
 *
 * Usage:
 *   import { isSuperAdminWithoutScope } from '@/lib/superAdminGuard';
 *   ...
 *   if (isSuperAdminWithoutScope(decoded, effectiveCompanyId, tenantId, request)) {
 *     return NextResponse.json({ /* empty shape *\/ }, { headers: corsHeaders });
 *   }
 */

import { isServerLiveSite } from '@/lib/tenant-filter';

/**
 * Returns true when the caller is a super_admin who has NOT selected a
 * specific tenant or company in the CompanySwitcher AND we're on the LIVE
 * site. On the DEMO site, always returns false (never block demo data).
 *
 * @param decoded      The decoded JWT payload (from verifyToken)
 * @param companyId    The ?companyId= query param (or null/empty)
 * @param tenantId     The ?tenantId= query param (or null/empty) — optional
 * @param request      The Request object (used to detect LIVE vs DEMO site)
 */
export function isSuperAdminWithoutScope(
  decoded: { role?: string } | null,
  companyId?: string | null,
  tenantId?: string | null,
  request?: Request | null,
): boolean {
  if (!decoded) return false;
  if (decoded.role !== 'super_admin') return false;
  // GOLDEN RULE: Only apply guard on LIVE site.
  // On DEMO site, always let data through (demo data should be visible).
  if (request && !isServerLiveSite(request)) return false;
  const hasCompany = companyId && companyId.trim() !== '';
  const hasTenant = tenantId && tenantId.trim() !== '';
  return !hasCompany && !hasTenant;
}
