import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Combined middleware: i18n locale detection + tenant detection.
 *
 * IMPORTANT: We intentionally do NOT use next-intl's createMiddleware here.
 *
 * Why: next-intl's middleware expects the app to be structured under
 * `app/[locale]/`. With `localePrefix: 'as-needed'`, it rewrites
 * `/login` → `/en/login` INTERNALLY (server-side). Since our app uses
 * `app/login/`, `app/(dashboard)/`, etc. — with NO `[locale]` segment —
 * the rewritten path `/en/login` doesn't match any route, and Next.js
 * returns 404 for EVERY page. This was the root cause of the
 * 2026-06-21 production outage on 3boxeshrms-mu.vercel.app.
 *
 * Fix: implement locale detection OURSELVES. We:
 *   1. Read NEXT_LOCALE cookie (set when user explicitly switches locale)
 *   2. Fall back to Accept-Language header
 *   3. Fall back to default locale ('en')
 *   4. Set the `x-next-intl-locale` request header so next-intl's
 *      `getLocale()` and `getMessages()` in layout.tsx work correctly.
 *   5. Set the NEXT_LOCALE cookie if not already set (so future requests
 *      remember the user's locale).
 *
 * We ALSO keep the existing tenant-detection logic (subdomain / ?tenant= query).
 *
 * GOLDEN RULE: Demo link (nexus-hrms-mu.vercel.app) must resolve to demo tenant.
 * Tenant links (marqaitechgroup.3boxeshrms.com) resolve to their own tenant.
 * x-tenant-slug is set on ALL requests so API routes can route to the correct DB.
 *
 * No URL rewriting happens — `/login` stays `/login`, `/dashboard` stays
 * `/dashboard`. Locale is a runtime concept, not a URL structure.
 *
 * PRODUCTION (Vercel): Subdomain routing works like this:
 *   - 3boxeshrms.com          → main site (super admin login)
 *   - marqaitechgroup.3boxeshrms.com → tenant "marqaitechgroup" login
 *   - nexus-hrms-mu.vercel.app → demo tenant
 *   - *.3boxeshrms.com        → any tenant subdomain
 */

const LOCALES = ['en', 'es', 'fr', 'de', 'hi', 'ar'] as const;
const DEFAULT_LOCALE = 'en';

// Root domain for multi-tenant subdomain resolution
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || '3boxeshrms.com';

// Subdomains that should NOT be treated as tenant slugs
const RESERVED_SUBDOMAINS = ['www', 'api', 'app', 'admin', 'mail', 'ftp', 'localhost', 'staging', 'dev', 'test'];

// ─── Demo domain configuration ───────────────────────────────────────

// Domains that should resolve to the demo tenant
const DEMO_DOMAINS = [
  'nexus-hrms-mu.vercel.app',
  'nexus-hrms.vercel.app',
  '3boxes-hrms.vercel.app',
  '3boxeshrms.vercel.app',
  '3boxes-hrms-mu.vercel.app',
]

// The demo tenant slug — this tenant's dedicated DB contains sample data only
const DEMO_SLUG = '3boxes-hrms-demo'

function isSupportedLocale(loc: string | undefined | null): loc is typeof LOCALES[number] {
  return !!loc && (LOCALES as readonly string[]).includes(loc);
}

function detectLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  const acceptLang = request.headers.get('accept-language') || '';
  const candidates = acceptLang
    .split(',')
    .map((part) => part.trim().split(';')[0].toLowerCase())
    .map((tag) => tag.split('-')[0]);
  for (const lang of candidates) {
    if (isSupportedLocale(lang)) return lang;
  }

  return DEFAULT_LOCALE;
}

function extractTenantSlug(request: NextRequest): string {
  // 1. ?tenant= query parameter (highest priority)
  const fromQuery = request.nextUrl.searchParams.get('tenant');
  if (fromQuery) return fromQuery;

  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  // 2. Demo domain detection — resolves Vercel URLs to the demo tenant
  if (DEMO_DOMAINS.includes(hostname)) {
    return DEMO_SLUG;
  }

  // 3. Subdomain of root domain (e.g., marqaitechgroup.3boxeshrms.com)
  if (hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = hostname.replace(`.${ROOT_DOMAIN}`, '').toLowerCase();
    if (sub && !RESERVED_SUBDOMAINS.includes(sub)) return sub;
  }

  // 4. Generic 3+ part hostname (custom domains)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const sub = parts[0].toLowerCase();
    if (sub && !RESERVED_SUBDOMAINS.includes(sub)) return sub;
  }

  // 5. Any *.vercel.app that isn't the demo domain — treat as demo
  if (hostname.endsWith('.vercel.app') && !DEMO_DOMAINS.includes(hostname)) {
    return DEMO_SLUG;
  }

  return '';
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Detect locale
  const locale = detectLocale(request);

  // 2. Extract tenant slug — ALWAYS, even for API routes
  //    This is critical for per-tenant DB routing (Golden Rule)
  const tenantSlug = extractTenantSlug(request);
  const host = request.headers.get('host') || '';

  // 2b. Tenant subdomain redirect: if a tenant slug is resolved and the
  //     user visits the root path ("/") or any landing page path ("/landing/*"),
  //     redirect to /login — tenant users should see a branded login, not the
  //     public marketing landing page. The main domain (3boxeshrms.com) still
  //     shows the landing page as usual.
  if (tenantSlug && (pathname === '/' || pathname.startsWith('/landing'))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // 3. Build augmented request headers
  const requestHeaders = new Headers(request.headers);

  // Set locale header for page routes (not API)
  const isApiRoute = pathname.startsWith('/api/');
  if (!isApiRoute) {
    requestHeaders.set('x-next-intl-locale', locale);
  }

  // ALWAYS set tenant context headers — API routes need this for DB routing
  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }
  requestHeaders.set('x-tenant-domain', host);

  // 4. Continue with the SAME URL + augmented headers
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // 5. Persist locale cookie (non-API only)
  if (!isApiRoute) {
    const existingCookie = request.cookies.get('NEXT_LOCALE')?.value;
    if (existingCookie !== locale) {
      response.cookies.set('NEXT_LOCALE', locale, {
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  }

  return response;
}

export const config = {
  // Run middleware on every page route and API route.
  // Static assets, images, service worker, manifest are excluded.
  // ALL API routes now get tenant context headers for DB routing.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icon-|robots.txt|sw.js|manifest.json|icons/).*)',
  ],
}
