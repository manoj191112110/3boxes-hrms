import { DEMO_TENANT_SLUG, getClientSiteMode, isVercelDemoHostname } from '@/lib/site-mode';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '3boxeshrms.com';

const RESERVED_SUBDOMAINS = [
  'www',
  'api',
  'app',
  'admin',
  'mail',
  'ftp',
  'localhost',
  'staging',
  'dev',
  'test',
];

/** Tenant slug from ?tenant= or subdomain (browser only). */
export function getClientTenantSlug(): string {
  if (typeof window === 'undefined') return '';

  const hostname = window.location.hostname.toLowerCase();

  // Vercel deployment URLs (including 3boxes-hrms-xxx-team.vercel.app) are never
  // real tenant subdomains — always use the demo tenant. This runs BEFORE
  // SITE_MODE env override so NEXT_PUBLIC_SITE_MODE=live cannot break demo login.
  if (isVercelDemoHostname(hostname)) {
    return DEMO_TENANT_SLUG;
  }

  if (getClientSiteMode() === 'demo') {
    return DEMO_TENANT_SLUG;
  }

  const fromQuery = new URLSearchParams(window.location.search).get('tenant');
  if (fromQuery) return fromQuery;

  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.replace(`.${ROOT_DOMAIN}`, '').toLowerCase();
    if (sub && !RESERVED_SUBDOMAINS.includes(sub)) return sub;
  }

  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (sub && !RESERVED_SUBDOMAINS.includes(sub)) return sub;
  }

  return '';
}

/** Working login path — use on current host (avoids unconfigured tenant subdomains). */
export function getTenantLoginPath(slug: string): string {
  return `/login?tenant=${encodeURIComponent(slug)}`;
}

/** Full login URL on the current origin (client) or main platform domain (SSR). */
export function getTenantLoginUrl(slug: string, origin?: string): string {
  const base =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : `https://${ROOT_DOMAIN}`);
  return `${base}${getTenantLoginPath(slug)}`;
}

/** Branded subdomain URL — only works after Vercel wildcard / per-tenant domain is added. */
export function getTenantSubdomainLoginUrl(slug: string): string {
  return `https://${slug}.${ROOT_DOMAIN}/login`;
}
