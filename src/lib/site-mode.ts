/**
 * Site Mode Detection — LIVE vs DEMO
 *
 * Centralized utility for determining whether the current request/page is
 * running on the LIVE production platform or the DEMO showcase site.
 *
 * ═══════════════════════════════════════════════════════════════════
 * PERMANENT FIX (GOLDEN RULE): Environment variable takes ABSOLUTE
 * precedence over host-header detection. This ensures that on Vercel,
 * where internal routing may use deployment URLs (e.g.,
 * 3boxeshrms.vercel.app which is in DEMO_DOMAINS), the mode is
 * ALWAYS correct regardless of how the request is routed internally.
 *
 * Priority:
 *   1. SITE_MODE env var (set at build/deploy time) — ABSOLUTE
 *   2. Host header detection — fallback only
 * ═══════════════════════════════════════════════════════════════════
 *
 * GOLDEN RULES:
 *   1. 3boxeshrms.com (platform root) → LIVE
 *   2. *.3boxeshrms.com (tenant subdomains) → LIVE
 *   3. nexus-hrms-mu.vercel.app (and other demo Vercel URLs) → DEMO
 *   4. localhost → LIVE (local development is treated as live)
 *
 * On LIVE mode:
 *   - Only real/live data is shown
 *   - All seed/auto-seed endpoints are BLOCKED
 *   - No dummy/sample data in any module or form
 *   - Hidden tenants: '3boxes-hrms-demo', '3boxeshrms'
 *
 * On DEMO mode:
 *   - Full sample/dummy data available for all roles and modules
 *   - Auto-seeding is enabled
 *   - Demo credentials are shown on the login page
 *   - Hidden tenant: 'marqaitechgroup'
 */

// ─── Demo domain list (must match middleware.ts & tenant-db.ts) ────────
// IMPORTANT: 3boxeshrms.vercel.app is the LIVE platform's Vercel deployment
// URL — it must NOT be in DEMO_DOMAINS. Previously its presence here caused
// isLiveMode() to return 'demo' when Vercel internally routed API requests
// through the deployment URL, leaking "Marq AI Tech Pvt Ltd" into the
// company switcher. See tenant-filter.ts for the FOOLPROOF backstop.
const DEMO_DOMAINS = [
  'nexus-hrms-mu.vercel.app',
  'nexus-hrms.vercel.app',
  '3boxes-hrms.vercel.app',
  '3boxes-hrms-mu.vercel.app',
];

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '3boxeshrms.com';

// ─── Environment Variable Override (PERMANENT FIX) ────────────────────
// SITE_MODE env var takes ABSOLUTE precedence. Set in Vercel:
//   - 3boxeshrms.com deployment: SITE_MODE=live
//   - nexus-hrms-mu.vercel.app deployment: SITE_MODE=demo
// This ensures correct mode even if Vercel routes requests internally
// through deployment URLs that happen to be in DEMO_DOMAINS.
const ENV_SITE_MODE = (process.env.SITE_MODE || '').toLowerCase() as SiteMode | '';

// ─── Server-side detection ─────────────────────────────────────────────

export type SiteMode = 'live' | 'demo';

/**
 * Detect the site mode from a Request object (server-side).
 *
 * PRIORITY:
 *   1. SITE_MODE env var — if set to 'live' or 'demo', ALWAYS use it
 *   2. Host header — fallback detection
 *
 * Returns 'demo' for demo domains, 'live' for everything else.
 */
export function getSiteMode(request: Request): SiteMode {
  // ─── PRIORITY 1: Environment variable (PERMANENT FIX) ───
  if (ENV_SITE_MODE === 'live' || ENV_SITE_MODE === 'demo') {
    return ENV_SITE_MODE;
  }

  // ─── PRIORITY 2: Host header detection (fallback) ───
  const host = request.headers.get('x-tenant-domain') || request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();

  if (DEMO_DOMAINS.includes(hostname)) {
    return 'demo';
  }

  // Any *.vercel.app that isn't the root platform → treat as demo
  // (matches middleware's fallback behavior)
  if (hostname.endsWith('.vercel.app') && !hostname.includes('3boxeshrms.com')) {
    return 'demo';
  }

  // Everything else is LIVE:
  // - 3boxeshrms.com (platform root)
  // - *.3boxeshrms.com (tenant subdomains)
  // - localhost / custom domains
  return 'live';
}

/**
 * Check if the current request is in LIVE mode (server-side).
 * LIVE = production platform with real data only.
 */
export function isLiveMode(request: Request): boolean {
  return getSiteMode(request) === 'live';
}

/**
 * Check if the current request is in DEMO mode (server-side).
 * DEMO = showcase site with sample/dummy data.
 */
export function isDemoMode(request: Request): boolean {
  return getSiteMode(request) === 'demo';
}

// ─── Client-side detection ─────────────────────────────────────────────

/**
 * Detect the site mode from the browser's current hostname (client-side).
 * Safe to call in useEffect or event handlers.
 *
 * PRIORITY:
 *   1. NEXT_PUBLIC_SITE_MODE env var — if set, ALWAYS use it
 *   2. window.location.hostname — fallback detection
 *
 * Returns 'demo' for demo domains, 'live' for everything else.
 */
export function getClientSiteMode(): SiteMode {
  // ─── PRIORITY 1: Environment variable (PERMANENT FIX) ───
  const clientEnvMode = (process.env.NEXT_PUBLIC_SITE_MODE || '').toLowerCase();
  if (clientEnvMode === 'live' || clientEnvMode === 'demo') {
    return clientEnvMode as SiteMode;
  }

  // ─── PRIORITY 2: Hostname detection (fallback) ───
  if (typeof window === 'undefined') return 'live'; // SSR default

  const hostname = window.location.hostname.toLowerCase();

  if (DEMO_DOMAINS.includes(hostname)) {
    return 'demo';
  }

  // Any *.vercel.app that isn't the root platform → treat as demo
  if (hostname.endsWith('.vercel.app') && !hostname.includes('3boxeshrms.com')) {
    return 'demo';
  }

  return 'live';
}

/**
 * Check if the browser is on a LIVE site (client-side).
 */
export function isClientLiveMode(): boolean {
  return getClientSiteMode() === 'live';
}

/**
 * Check if the browser is on a DEMO site (client-side).
 */
export function isClientDemoMode(): boolean {
  return getClientSiteMode() === 'demo';
}

/**
 * Check if a tenant slug corresponds to the demo tenant.
 * The demo tenant (3boxes-hrms-demo) is the ONLY tenant that
 * should have dummy/sample data on the LIVE platform.
 */
export function isDemoTenant(slug: string): boolean {
  return slug === '3boxes-hrms-demo';
}

/** Canonical demo tenant slug — must match middleware DEMO_SLUG and seed-demo TENANT_SLUG. */
export const DEMO_TENANT_SLUG = '3boxes-hrms-demo';

/** Vercel URLs that host the LIVE platform (not the demo showcase). */
const LIVE_VERCEL_HOSTS = ['3boxeshrms.vercel.app'];

/**
 * True for Vercel deployment hostnames that should use the demo tenant.
 * Includes per-deployment URLs like 3boxes-hrms-kvfm0lwlv-3-boxes-hrms.vercel.app.
 * Excludes the live platform deployment at 3boxeshrms.vercel.app.
 */
export function isVercelDemoHostname(hostname: string): boolean {
  const h = hostname.split(':')[0].toLowerCase();
  if (LIVE_VERCEL_HOSTS.includes(h)) return false;
  return h.endsWith('.vercel.app') && !h.includes('3boxeshrms.com');
}

/**
 * Normalize a tenant slug for the current host.
 * Explicit ?tenant= slugs (e.g. sdlglobe, tcs) are never overridden.
 */
export function resolveTenantSlugForHost(slug: string, hostname: string): string {
  if (slug && slug !== DEMO_TENANT_SLUG && slug !== '3boxes-hrms') {
    return slug;
  }
  if (isVercelDemoHostname(hostname)) return DEMO_TENANT_SLUG;
  if (slug === '3boxes-hrms') return DEMO_TENANT_SLUG;
  return slug;
}

/**
 * Check if a tenant slug is a production (non-demo) tenant.
 * These tenants should NEVER have dummy/sample data.
 */
export function isProductionTenant(slug: string): boolean {
  return !!slug && slug !== '3boxes-hrms-demo';
}
