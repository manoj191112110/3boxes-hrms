/**
 * tenant-filter.ts — SHARED, FOOLPROOF tenant visibility filter
 *
 * ═══════════════════════════════════════════════════════════════════
 * GOLDEN RULE (PERMANENT FIX):
 * On 3boxeshrms.com (LIVE), these slugs are NEVER shown anywhere:
 *   - '3boxes-hrms-demo' (demo/showcase tenant with sample data)
 *   - '3boxeshrms' (platform placeholder "Marq AI Tech Pvt Ltd")
 *
 * On demo/showcase sites, the live tenant is hidden:
 *   - 'marqaitechgroup' (real production tenant)
 *
 * This module provides FOOLPROOF detection that does NOT rely on:
 *   - SITE_MODE / NEXT_PUBLIC_SITE_MODE env vars (may be unset)
 *   - isLiveMode() / isDemoMode() (depends on host header routing)
 *   - Zustand store state (may be stale)
 *
 * Instead, it directly checks the hostname against a HARDCODED list
 * of known production domains. This is the ULTIMATE backstop.
 * ═══════════════════════════════════════════════════════════════════
 */

// ─── Known LIVE (production) domains ────────────────────────────────
// Any request arriving on these domains is ALWAYS in LIVE mode.
const LIVE_DOMAINS = [
  '3boxeshrms.com',
  // Common aliases
  'www.3boxeshrms.com',
];

// ─── Hidden tenant slugs ────────────────────────────────────────────
// LIVE_HIDDEN_SLUGS includes all known placeholder/demo tenants:
//   - '3boxes-hrms-demo' (demo/showcase tenant)
//   - '3boxeshrms' (platform placeholder "Marq AI Tech Pvt Ltd")
//   - '3boxes-corp' (older seed tenant, also named "Marq AI Tech Pvt Ltd")
export const LIVE_HIDDEN_SLUGS = ['3boxes-hrms-demo', '3boxeshrms', '3boxes-corp'];
export const DEMO_HIDDEN_SLUGS = ['marqaitechgroup'];

// ─── The "Marq AI Tech Pvt Ltd" tenant — the specific leak we're fixing
export const PLATFORM_PLACEHOLDER_SLUG = '3boxeshrms';
export const PLATFORM_PLACEHOLDER_NAME = 'Marq AI Tech Pvt Ltd';

// ─── Client-side: FOOLPROOF live mode detection ─────────────────────
// Checks window.location.hostname DIRECTLY — no env vars, no site-mode.ts
export function isClientLiveSite(): boolean {
  if (typeof window === 'undefined') return false; // SSR safety
  const h = window.location.hostname.toLowerCase();
  // Exact match on known live domains
  if (LIVE_DOMAINS.includes(h)) return true;
  // Any *.3boxeshrms.com subdomain (tenant subdomains) is also live
  if (h.endsWith('.3boxeshrms.com')) return true;
  return false;
}

// ─── Server-side: FOOLPROOF live mode detection ─────────────────────
// Checks the request host DIRECTLY — no env vars, no fallbacks
export function isServerLiveSite(request: Request): boolean {
  const host = (request.headers.get('x-tenant-domain') || request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (LIVE_DOMAINS.includes(host)) return true;
  if (host.endsWith('.3boxeshrms.com')) return true;
  return false;
}

// ─── Get hidden slugs (client-side) ─────────────────────────────────
// Uses FOOLPROOF hostname detection as the PRIMARY method,
// falls back to site-mode.ts for edge cases.
export function getClientHiddenSlugs(): string[] {
  if (isClientLiveSite()) return LIVE_HIDDEN_SLUGS;
  // On non-live sites, check if we're on a demo Vercel URL
  if (typeof window !== 'undefined') {
    const h = window.location.hostname.toLowerCase();
    if (h.endsWith('.vercel.app')) return DEMO_HIDDEN_SLUGS;
  }
  // Default: on unknown domains, use LIVE rules (safer — hides more)
  return LIVE_HIDDEN_SLUGS;
}

// ─── Get hidden slugs (server-side) ─────────────────────────────────
export function getServerHiddenSlugs(request: Request): string[] {
  if (isServerLiveSite(request)) return LIVE_HIDDEN_SLUGS;
  const host = (request.headers.get('x-tenant-domain') || request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (host.endsWith('.vercel.app')) return DEMO_HIDDEN_SLUGS;
  return LIVE_HIDDEN_SLUGS;
}

// ─── Check if a tenant slug is hidden (client-side) ────────────────
export function isTenantHiddenClient(slug: string): boolean {
  return getClientHiddenSlugs().includes(slug);
}

// ─── Check if a tenant slug is hidden (server-side) ────────────────
export function isTenantHiddenServer(slug: string, request: Request): boolean {
  return getServerHiddenSlugs(request).includes(slug);
}

// ─── Filter an array of tenant objects (client-side) ───────────────
export function filterHiddenTenantsClient<T extends { slug: string }>(tenants: T[]): T[] {
  const hidden = getClientHiddenSlugs();
  return tenants.filter(t => !hidden.includes(t.slug));
}

// ─── Filter an array of tenant objects (server-side) ───────────────
export function filterHiddenTenantsServer<T extends { slug: string }>(tenants: T[], request: Request): T[] {
  const hidden = getServerHiddenSlugs(request);
  return tenants.filter(t => !hidden.includes(t.slug));
}
