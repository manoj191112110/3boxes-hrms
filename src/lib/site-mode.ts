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

const DEMO_DOMAINS = [
  'nexus-hrms-mu.vercel.app',
  'nexus-hrms.vercel.app',
  '3boxes-hrms.vercel.app',
  '3boxes-hrms-mu.vercel.app',
];

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '3boxeshrms.com';

/** Dedicated QA/test host. It is tenant-neutral: no production tenant is forced. */
export const TEST_PLATFORM_HOST = 'test.3boxeshrms.com';

export function isTestPlatformHostname(hostname: string): boolean {
  return hostname.split(':')[0].toLowerCase() === TEST_PLATFORM_HOST;
}

const ENV_SITE_MODE = (process.env.SITE_MODE || '').toLowerCase() as SiteMode | '';

export type SiteMode = 'live' | 'demo';

export function getSiteMode(request: Request): SiteMode {
  if (ENV_SITE_MODE === 'live' || ENV_SITE_MODE === 'demo') {
    return ENV_SITE_MODE;
  }

  const host = request.headers.get('x-tenant-domain') || request.headers.get('host') || '';
  const hostname = host.split(':')[0].toLowerCase();

  if (DEMO_DOMAINS.includes(hostname)) {
    return 'demo';
  }

  if (hostname.endsWith('.vercel.app') && !hostname.includes('3boxeshrms.com')) {
    return 'demo';
  }

  return 'live';
}

export function isLiveMode(request: Request): boolean {
  return getSiteMode(request) === 'live';
}

export function isDemoMode(request: Request): boolean {
  return getSiteMode(request) === 'demo';
}

export function getClientSiteMode(): SiteMode {
  const clientEnvMode = (process.env.NEXT_PUBLIC_SITE_MODE || '').toLowerCase();
  if (clientEnvMode === 'live' || clientEnvMode === 'demo') {
    return clientEnvMode as SiteMode;
  }

  if (typeof window === 'undefined') return 'live';

  const hostname = window.location.hostname.toLowerCase();

  if (DEMO_DOMAINS.includes(hostname)) {
    return 'demo';
  }

  if (hostname.endsWith('.vercel.app') && !hostname.includes('3boxeshrms.com')) {
    return 'demo';
  }

  return 'live';
}

export function isClientLiveMode(): boolean {
  return getClientSiteMode() === 'live';
}

export function isClientDemoMode(): boolean {
  return getClientSiteMode() === 'demo';
}

export function isDemoTenant(slug: string): boolean {
  return slug === '3boxes-hrms-demo';
}

export const DEMO_TENANT_SLUG = '3boxes-hrms-demo';

const LIVE_VERCEL_HOSTS = ['3boxeshrms.vercel.app'];

export function isVercelDemoHostname(hostname: string): boolean {
  const h = hostname.split(':')[0].toLowerCase();
  if (LIVE_VERCEL_HOSTS.includes(h)) return false;
  return h.endsWith('.vercel.app') && !h.includes('3boxeshrms.com');
}

/**
 * Normalize a tenant slug for the current host.
 * The QA/test host is intentionally tenant-neutral: preserve any explicit
 * tenant context supplied by middleware/query instead of forcing Marqaitech.
 */
export function resolveTenantSlugForHost(slug: string, hostname: string): string {
  if (isTestPlatformHostname(hostname)) return slug;

  if (slug && slug !== DEMO_TENANT_SLUG && slug !== '3boxes-hrms') {
    return slug;
  }
  if (isVercelDemoHostname(hostname)) return DEMO_TENANT_SLUG;
  if (slug === '3boxes-hrms') return DEMO_TENANT_SLUG;
  return slug;
}

export function isProductionTenant(slug: string): boolean {
  return !!slug && slug !== '3boxes-hrms-demo';
}
