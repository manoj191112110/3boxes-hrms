/**
 * useAutoSeedDemo — silently triggers /api/auto-seed-demo on mount if demo
 * data is missing, then calls onSeeded() so the page can re-fetch.
 *
 * Use case: Vercel deployments need demo data to appear on the marketplace,
 * wellness, and collaboration hub pages without an admin clicking a button.
 *
 * Behaviour:
 *  - Only runs once per page mount (guarded by a module-scoped session flag)
 *  - Uses sessionStorage to avoid re-running across same-session navigation
 *  - Silent: never throws, never shows errors to the user
 *  - Returns { seeded, error } so callers can optionally react
 *
 * LIVE MODE GUARD:
 *  On the production platform (3boxeshrms.com and tenant subdomains like
 *  marqaitechgroup.3boxeshrms.com), auto-seeding is COMPLETELY DISABLED.
 *  No dummy/sample data will ever be auto-seeded into live databases.
 *  Only the demo site (nexus-hrms-mu.vercel.app) will auto-seed.
 *
 *  Additionally, tenants with slug '3boxeshrms' or 'marqaitechgroup' are
 *  EXCLUDED from auto-seeding even if somehow called. These are production
 *  tenants that had their sample data cleaned up.
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { isClientLiveMode } from '@/lib/site-mode';

type Module = 'marketplace' | 'wellness' | 'collaboration' | 'clients' | 'vendors' | 'all';

/**
 * Tenant slugs whose sample data was intentionally cleaned up.
 * Auto-seeding is disabled for these tenants to prevent re-introducing
 * the sample data that was removed via the cleanup endpoint.
 * The demo tenant (nexus-hrms-mu.vercel.app) is NOT in this list
 * and will continue to auto-seed normally.
 */
const CLEANUP_EXCLUDED_SLUGS = ['3boxeshrms', 'marqaitechgroup'];

const sessionCache: Record<string, boolean> = {};

export function useAutoSeedDemo(module: Module, onSeeded?: () => void) {
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // ─── LIVE MODE GUARD ───
    // On the production platform (3boxeshrms.com, tenant subdomains),
    // auto-seeding is COMPLETELY DISABLED. No dummy data should ever
    // appear in production databases. Only the demo site auto-seeds.
    if (isClientLiveMode()) {
      // Mark as done in cache so we don't re-check on every render
      const cacheKey = `auto-seed-${module}`;
      sessionCache[cacheKey] = true;
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(cacheKey, 'done');
        }
      } catch {}
      return;
    }

    // ─── Intentional exclusion check ───
    // If the current tenant's slug matches a cleanup-excluded slug,
    // skip auto-seeding entirely. This prevents sample data from being
    // re-seeded after an admin runs the cleanup endpoint for production
    // tenants (3boxeshrms.com, marqaitechgroup.3boxeshrms.com).
    // The demo at nexus-hrms-mu.vercel.app is NOT excluded.
    const tenantSlug = useAuthStore.getState().user?.tenant?.slug;
    if (tenantSlug && CLEANUP_EXCLUDED_SLUGS.includes(tenantSlug)) {
      // Mark as done in cache so we don't re-check on every render
      const cacheKey = `auto-seed-${module}`;
      sessionCache[cacheKey] = true;
      try {
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(cacheKey, 'done');
        }
      } catch {}
      return;
    }

    const cacheKey = `auto-seed-${module}`;
    if (sessionCache[cacheKey]) return;

    // Also check sessionStorage so we don't re-trigger within the same tab session
    try {
      if (typeof window !== 'undefined' && window.sessionStorage.getItem(cacheKey) === 'done') {
        sessionCache[cacheKey] = true;
        return;
      }
    } catch {}

    // NOTE: authStore persists the JWT under the `tb_token` localStorage key
    // (see src/store/authStore.ts). The bare `token` key is never set, so reading
    // it returns null and the API responds with "No token provided" — that's the
    // bug we're fixing here.
    const token = typeof window !== 'undefined' ? localStorage.getItem('tb_token') : null;
    if (!token) return; // not logged in yet — page-level guard will handle redirect

    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`/api/auto-seed-demo?module=${module}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          if (!cancelled) setError(`HTTP ${r.status}`);
          return;
        }
        const json = await r.json();
        if (cancelled) return;

        // Mark as done in both in-memory cache and sessionStorage
        sessionCache[cacheKey] = true;
        try { window.sessionStorage.setItem(cacheKey, 'done'); } catch {}

        // Only mark seeded if we actually wrote rows
        const resultKeys = Object.keys(json.results || {});
        if (resultKeys.length > 0) {
          setSeeded(true);
          onSeeded?.();
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Network error');
      }
    })();

    return () => { cancelled = true; };
  }, [module]);

  return { seeded, error };
}
